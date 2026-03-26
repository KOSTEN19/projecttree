package services

import (
	"sort"
	"strings"

	"project-drevo/internal/models"
)

var (
	parentTypes     = newSet("мать", "отец")
	childTypes      = newSet("сын", "дочь")
	spouseTypes     = newSet("муж", "жена")
	grandTypes      = newSet("бабушка", "дедушка")
	siblingTypes    = newSet("брат", "сестра")
	uncleTypes      = newSet("дядя", "тётя")
	grandchildTypes = newSet("внук", "внучка")
)

type TreeNode struct {
	ID            string              `json:"id"`
	IsSelf        bool                `json:"isSelf"`
	IsPlaceholder bool                `json:"isPlaceholder"`
	Title         string              `json:"title"`
	Subtitle      string              `json:"subtitle"`
	X             float64             `json:"x"`
	Y             float64             `json:"y"`
	Data          models.PersonClient `json:"data"`
}

type TreeLink struct {
	Type string `json:"type"`
	From string `json:"from"`
	To   string `json:"to"`
}

type TreeResult struct {
	SelfID     string                    `json:"selfId"`
	Nodes      []TreeNode                `json:"nodes"`
	Links      []TreeLink                `json:"links"`
	Unresolved []models.PersonClient     `json:"unresolved"`
	Positions  map[string]positionOffset `json:"positions"`
}

type positionOffset struct {
	DX float64 `json:"dx"`
	DY float64 `json:"dy"`
}

type parentEdge struct{ parentID, childID string }
type spouseEdge struct{ a, b string }

func BuildTree(persons []models.Person, relationships []models.Relationship, manualLinks []models.ManualLink, positions []models.Position) TreeResult {
	byID := make(map[string]*models.Person, len(persons))
	var selfPerson *models.Person
	for i := range persons {
		pid := persons[i].ID.Hex()
		byID[pid] = &persons[i]
		if persons[i].IsSelf {
			selfPerson = &persons[i]
		}
	}

	posMap := make(map[string]positionOffset, len(positions))
	for _, row := range positions {
		posMap[row.PersonID.Hex()] = positionOffset{DX: row.DX, DY: row.DY}
	}

	if selfPerson == nil {
		return TreeResult{Nodes: []TreeNode{}, Links: []TreeLink{}, Unresolved: []models.PersonClient{}, Positions: posMap}
	}
	selfID := selfPerson.ID.Hex()

	var pEdges []parentEdge
	var sEdges []spouseEdge
	parentsOf := map[string]map[string]bool{}
	childrenOf := map[string]map[string]bool{}
	unresolvedIDs := map[string]bool{}

	addParent := func(parentID, childID string) {
		pEdges = append(pEdges, parentEdge{parentID, childID})
		if parentsOf[childID] == nil {
			parentsOf[childID] = map[string]bool{}
		}
		if childrenOf[parentID] == nil {
			childrenOf[parentID] = map[string]bool{}
		}
		parentsOf[childID][parentID] = true
		childrenOf[parentID][childID] = true
	}
	addSpouse := func(a, b string) {
		sEdges = append(sEdges, spouseEdge{a, b})
	}
	findParentBySex := func(childID, sex string) string {
		pset := parentsOf[childID]
		for pid := range pset {
			p := byID[pid]
			if p != nil && p.Sex == sex {
				return pid
			}
		}
		return ""
	}

	for _, r := range relationships {
		base := r.BasePersonID.Hex()
		rel := r.RelatedPersonID.Hex()
		t := r.RelationType
		line := r.Line

		if byID[base] == nil || byID[rel] == nil {
			continue
		}

		if parentTypes.has(t) {
			addParent(rel, base)
			continue
		}
		if childTypes.has(t) {
			addParent(base, rel)
			continue
		}
		if spouseTypes.has(t) {
			addSpouse(base, rel)
			continue
		}

		if grandTypes.has(t) {
			var parentID string
			if line == "male" {
				parentID = findParentBySex(base, "M")
			}
			if line == "female" {
				parentID = findParentBySex(base, "F")
			}
			if parentID == "" {
				unresolvedIDs[rel] = true
				continue
			}
			addParent(rel, parentID)
			continue
		}

		if siblingTypes.has(t) {
			pset := parentsOf[base]
			if len(pset) == 0 {
				unresolvedIDs[rel] = true
				continue
			}
			for pid := range pset {
				addParent(pid, rel)
			}
			continue
		}

		if uncleTypes.has(t) {
			var parentID string
			if line == "male" {
				parentID = findParentBySex(base, "M")
			}
			if line == "female" {
				parentID = findParentBySex(base, "F")
			}
			if parentID == "" {
				unresolvedIDs[rel] = true
				continue
			}
			gp := parentsOf[parentID]
			if len(gp) == 0 {
				unresolvedIDs[rel] = true
				continue
			}
			for gpid := range gp {
				addParent(gpid, rel)
			}
			continue
		}

		if grandchildTypes.has(t) {
			kids := childrenOf[base]
			if len(kids) == 0 {
				unresolvedIDs[rel] = true
				continue
			}
			if len(kids) == 1 {
				for k := range kids {
					addParent(k, rel)
				}
			} else {
				unresolvedIDs[rel] = true
			}
			continue
		}

		unresolvedIDs[rel] = true
	}

	for _, m := range manualLinks {
		personID := m.PersonID.Hex()
		anchorID := m.AnchorPersonID.Hex()
		if byID[personID] == nil || byID[anchorID] == nil {
			continue
		}
		switch m.Mode {
		case "parent":
			addParent(personID, anchorID)
		case "child":
			addParent(anchorID, personID)
		case "spouse":
			addSpouse(personID, anchorID)
		}
		delete(unresolvedIDs, personID)
	}

	// BFS generation levels
	level := map[string]int{selfID: 0}
	for iter := 0; iter < 80; iter++ {
		changed := false
		for _, e := range pEdges {
			_, childHas := level[e.childID]
			_, parentHas := level[e.parentID]
			if childHas && !parentHas {
				level[e.parentID] = level[e.childID] + 1
				changed = true
			}
			if parentHas && !childHas {
				level[e.childID] = level[e.parentID] - 1
				changed = true
			}
		}
		for _, s := range sEdges {
			_, aHas := level[s.a]
			_, bHas := level[s.b]
			if aHas && !bHas {
				level[s.b] = level[s.a]
				changed = true
			}
			if bHas && !aHas {
				level[s.a] = level[s.b]
				changed = true
			}
		}
		if !changed {
			break
		}
	}

	// group by level
	groups := map[int][]string{}
	for pid, lvl := range level {
		groups[lvl] = append(groups[lvl], pid)
	}

	spouseOf := map[string]string{}
	for _, s := range sEdges {
		spouseOf[s.a] = s.b
		spouseOf[s.b] = s.a
	}

	nameKey := func(pid string) string {
		p := byID[pid]
		if p == nil {
			return ""
		}
		return strings.ToLower(strings.TrimSpace(p.LastName + " " + p.FirstName))
	}

	buildSegments := func(arr []string) [][]string {
		set := map[string]bool{}
		for _, x := range arr {
			set[x] = true
		}
		used := map[string]bool{}
		sorted := make([]string, len(arr))
		copy(sorted, arr)
		sort.Slice(sorted, func(i, j int) bool { return nameKey(sorted[i]) < nameKey(sorted[j]) })

		var segments [][]string
		if set[selfID] {
			sp := spouseOf[selfID]
			if sp != "" && set[sp] {
				segments = append(segments, []string{selfID, sp})
				used[selfID] = true
				used[sp] = true
			} else {
				segments = append(segments, []string{selfID})
				used[selfID] = true
			}
		}
		for _, pid := range sorted {
			if used[pid] {
				continue
			}
			partner := spouseOf[pid]
			if partner != "" && set[partner] && !used[partner] {
				if nameKey(pid) <= nameKey(partner) {
					segments = append(segments, []string{pid, partner})
				} else {
					segments = append(segments, []string{partner, pid})
				}
				used[pid] = true
				used[partner] = true
			} else {
				segments = append(segments, []string{pid})
				used[pid] = true
			}
		}
		return segments
	}

	const (
		yStep      = 180.0
		segmentGap = 240.0
		pairGap    = 160.0
	)

	type tmpPos struct {
		pid string
		x   float64
	}

	basePos := map[string][2]float64{}

	lvls := make([]int, 0, len(groups))
	for l := range groups {
		lvls = append(lvls, l)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(lvls)))

	for _, lvl := range lvls {
		arr := groups[lvl]
		segments := buildSegments(arr)

		var tmp []tmpPos
		cursor := 0.0
		for _, seg := range segments {
			if len(seg) == 1 {
				tmp = append(tmp, tmpPos{seg[0], cursor})
				cursor += segmentGap
			} else {
				tmp = append(tmp, tmpPos{seg[0], cursor})
				tmp = append(tmp, tmpPos{seg[1], cursor + pairGap})
				cursor += pairGap + segmentGap
			}
		}

		if len(tmp) == 0 {
			continue
		}
		minX, maxX := tmp[0].x, tmp[0].x
		for _, t := range tmp {
			if t.x < minX {
				minX = t.x
			}
			if t.x > maxX {
				maxX = t.x
			}
		}
		center := (minX + maxX) / 2

		for _, t := range tmp {
			basePos[t.pid] = [2]float64{t.x - center, float64(-lvl) * yStep}
		}
	}

	nodes := make([]TreeNode, 0)
	for pid, p := range byID {
		if _, ok := level[pid]; !ok {
			continue
		}
		base := basePos[pid]
		off := posMap[pid]
		nodes = append(nodes, TreeNode{
			ID:            pid,
			IsSelf:        p.IsSelf,
			IsPlaceholder: p.IsPlaceholder,
			Title:         formatName(p),
			Subtitle:      formatSubtitle(p),
			X:             base[0] + off.DX,
			Y:             base[1] + off.DY,
			Data:          p.ToClient(),
		})
	}

	idSet := map[string]bool{}
	for _, n := range nodes {
		idSet[n.ID] = true
	}

	links := make([]TreeLink, 0)
	for _, e := range pEdges {
		if idSet[e.parentID] && idSet[e.childID] {
			links = append(links, TreeLink{Type: "parent", From: e.parentID, To: e.childID})
		}
	}
	for _, s := range sEdges {
		if idSet[s.a] && idSet[s.b] {
			links = append(links, TreeLink{Type: "spouse", From: s.a, To: s.b})
		}
	}

	unresolved := make([]models.PersonClient, 0)
	for _, p := range persons {
		pid := p.ID.Hex()
		if p.IsSelf || p.IsPlaceholder {
			continue
		}
		if _, ok := level[pid]; !ok {
			unresolved = append(unresolved, p.ToClient())
		}
	}

	return TreeResult{
		SelfID:     selfID,
		Nodes:      nodes,
		Links:      links,
		Unresolved: unresolved,
		Positions:  posMap,
	}
}

func formatName(p *models.Person) string {
	parts := []string{}
	if ln := strings.TrimSpace(p.LastName); ln != "" {
		parts = append(parts, ln)
	}
	if fn := strings.TrimSpace(p.FirstName); fn != "" {
		parts = append(parts, fn)
	}
	if mn := strings.TrimSpace(p.MiddleName); mn != "" {
		parts = append(parts, mn)
	}
	if len(parts) == 0 {
		return "Без имени"
	}
	return strings.Join(parts, " ")
}

func formatSubtitle(p *models.Person) string {
	if p.BirthDate != "" {
		return "р. " + p.BirthDate
	}
	return ""
}

// simple string set
type strSet map[string]bool

func newSet(items ...string) strSet {
	s := make(strSet, len(items))
	for _, it := range items {
		s[it] = true
	}
	return s
}

func (s strSet) has(item string) bool { return s[item] }
