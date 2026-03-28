package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/semaphore"
	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	ruWikiAPI       = "https://ru.ruwiki.ru/w/api.php"
	fallbackWikiImg = "https://cdn.ruwiki.ru/commonswiki/files/e/ee/WW2_collage.jpg"
	wikiUserAgent   = "project-drevo/1.0 (home feed; contact: support@local)"
	wikiCacheTTL    = 48 * time.Hour
)

type wikiCacheEntry struct {
	Title        string
	Extract      string
	ThumbnailURL string
	PageURL      string
	At           time.Time
}

var wikiSummaryCache sync.Map // title key -> wikiCacheEntry

type wikiQueryResponse struct {
	Query *struct {
		Pages []struct {
			Title     string `json:"title"`
			Extract   string `json:"extract"`
			FullURL   string `json:"fullurl"`
			Thumbnail *struct {
				Source string `json:"source"`
			} `json:"thumbnail"`
			Missing bool `json:"missing"`
		} `json:"pages"`
	} `json:"query"`
}

func fetchRuwikiSummary(ctx context.Context, title string) (outTitle, extract, thumb, pageURL string, err error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", "", "", "", fmt.Errorf("empty title")
	}
	cacheKey := strings.ToLower(title)
	if v, ok := wikiSummaryCache.Load(cacheKey); ok {
		e := v.(wikiCacheEntry)
		if time.Since(e.At) < wikiCacheTTL {
			return e.Title, e.Extract, e.ThumbnailURL, e.PageURL, nil
		}
	}

	u, _ := url.Parse(ruWikiAPI)
	q := u.Query()
	q.Set("action", "query")
	q.Set("format", "json")
	q.Set("formatversion", "2")
	q.Set("redirects", "1")
	q.Set("titles", title)
	q.Set("prop", "extracts|pageimages|info")
	q.Set("exintro", "1")
	q.Set("explaintext", "1")
	q.Set("piprop", "thumbnail")
	q.Set("pithumbsize", "400")
	q.Set("inprop", "url")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", "", "", "", err
	}
	req.Header.Set("User-Agent", wikiUserAgent)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", "", "", "", err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return "", "", "", "", fmt.Errorf("wiki status %d", res.StatusCode)
	}

	var payload wikiQueryResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return "", "", "", "", err
	}
	if payload.Query == nil || len(payload.Query.Pages) == 0 {
		return "", "", "", "", fmt.Errorf("no pages")
	}
	page := payload.Query.Pages[0]
	if page.Missing || page.Title == "" {
		return "", "", "", "", fmt.Errorf("missing page")
	}
	outTitle = page.Title
	extract = strings.TrimSpace(page.Extract)
	pageURL = strings.TrimSpace(page.FullURL)
	if pageURL == "" && outTitle != "" {
		pageURL = "https://ru.ruwiki.ru/wiki/" + strings.ReplaceAll(url.PathEscape(outTitle), "+", "%20")
	}
	if page.Thumbnail != nil {
		thumb = strings.TrimSpace(page.Thumbnail.Source)
	}
	wikiSummaryCache.Store(cacheKey, wikiCacheEntry{
		Title:        outTitle,
		Extract:      extract,
		ThumbnailURL: thumb,
		PageURL:      pageURL,
		At:           time.Now(),
	})
	return outTitle, extract, thumb, pageURL, nil
}

func trimRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func toYear(s string) int {
	s = strings.TrimSpace(s)
	if len(s) < 4 {
		return 0
	}
	var y int
	for i := 0; i < 4; i++ {
		c := s[i]
		if c < '0' || c > '9' {
			return 0
		}
		y = y*10 + int(c-'0')
	}
	if y < 1000 || y > 3000 {
		return 0
	}
	return y
}

type eraDef struct {
	Key       string
	Title     string
	Years     string
	Start     int
	End       int
	WikiTitle string
}

var eraCatalog = []eraDef{
	{"russo-japanese", "Русско-японская война", "1904–1905", 1904, 1905, "Русско-японская война"},
	{"ww1", "Первая мировая война", "1914–1918", 1914, 1918, "Первая мировая война"},
	{"revolution", "Революция и Гражданская война", "1917–1922", 1917, 1922, "Революция 1917 года в России"},
	{"collectivization", "Коллективизация и индустриализация", "1928–1937", 1928, 1937, "Индустриализация в СССР"},
	{"ww2", "Великая Отечественная война", "1941–1945", 1941, 1945, "Великая Отечественная война"},
	{"postwar", "Послевоенное восстановление", "1945–1953", 1945, 1953, "СССР"},
	{"space", "Космическая эра", "1957–1969", 1957, 1969, "Космическая гонка"},
	{"thaw", "Оттепель", "1953–1964", 1953, 1964, "Хрущёвская оттепель"},
	{"stagnation", "Поздний СССР", "1964–1982", 1964, 1982, "Эпоха застоя"},
	{"afghan", "Афганская война", "1979–1989", 1979, 1989, "Афганская война (1979—1989)"},
	{"perestroika", "Перестройка", "1985–1991", 1985, 1991, "Перестройка"},
	{"new-russia", "Становление современной России", "1991–2000", 1991, 2000, "История России (1991—настоящее время)"},
}

// HomeFeedItem одна карточка ленты для главной (медленный marquee).
type HomeFeedItem struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // "stat" | "era"
	Headline    string `json:"headline"`
	Body        string `json:"body"`
	ImageURL    string `json:"imageUrl"`
	SourceURL   string `json:"sourceUrl"`
	SourceLabel string `json:"sourceLabel"`
}

func enrichWithWiki(item *HomeFeedItem, wikiTitle string) {
	if wikiTitle == "" {
		if item.ImageURL == "" {
			item.ImageURL = fallbackWikiImg
		}
		return
	}
	// Не привязываем исходящие запросы к контексту HTTP-клиента: при таймауте прокси / обрыве соединения
	// request context отменяется, и все обращения к Ruwiki падали бы без sourceUrl и превью.
	wikiCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	t, ex, thumb, pURL, err := fetchRuwikiSummary(wikiCtx, wikiTitle)
	if err != nil {
		if item.ImageURL == "" {
			item.ImageURL = fallbackWikiImg
		}
		return
	}
	if thumb != "" {
		item.ImageURL = thumb
	} else if item.ImageURL == "" {
		item.ImageURL = fallbackWikiImg
	}
	if pURL != "" {
		item.SourceURL = pURL
		item.SourceLabel = "РУВИКИ"
	}
	if ex != "" && item.Kind == "era" {
		snip := trimRunes(ex, 200)
		if !strings.Contains(item.Body, snip) {
			item.Body = item.Body + " " + snip
		}
	}
	_ = t
}

func buildAdjacency(rels []models.Relationship) map[string]map[string]struct{} {
	adj := make(map[string]map[string]struct{})
	add := func(a, b string) {
		if a == "" || b == "" || a == b {
			return
		}
		if adj[a] == nil {
			adj[a] = make(map[string]struct{})
		}
		if adj[b] == nil {
			adj[b] = make(map[string]struct{})
		}
		adj[a][b] = struct{}{}
		adj[b][a] = struct{}{}
	}
	for _, r := range rels {
		add(r.BasePersonID.Hex(), r.RelatedPersonID.Hex())
	}
	return adj
}

func bfsDist(adj map[string]map[string]struct{}, start string) map[string]int {
	dist := map[string]int{start: 0}
	q := []string{start}
	for len(q) > 0 {
		cur := q[0]
		q = q[1:]
		for n := range adj[cur] {
			if _, ok := dist[n]; ok {
				continue
			}
			dist[n] = dist[cur] + 1
			q = append(q, n)
		}
	}
	return dist
}

func maxBFSDepth(adj map[string]map[string]struct{}, ids []string) int {
	longest := 0
	for _, id := range ids {
		d := bfsDist(adj, id)
		for _, v := range d {
			if v > longest {
				longest = v
			}
		}
	}
	return longest
}

// HomeFeed собирает ленту «факты о роде» + эпохи с обогащением из Ruwiki.
func HomeFeed(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	filter := bson.M{"userId": oid}
	cur, err := db.Persons.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	var persons []models.Person
	if err := cur.All(ctx, &persons); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	rcur, err := db.Relationships.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	var rels []models.Relationship
	if err := rcur.All(ctx, &rels); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	relatives := make([]models.Person, 0, len(persons))
	var meID string
	for _, p := range persons {
		if p.IsPlaceholder {
			continue
		}
		relatives = append(relatives, p)
		if p.IsSelf {
			meID = p.ID.Hex()
		}
	}

	adj := buildAdjacency(rels)
	ids := make([]string, 0, len(relatives))
	years := make([]int, 0)
	cityCount := make(map[string]int)
	nowY := time.Now().Year()

	for _, p := range relatives {
		ids = append(ids, p.ID.Hex())
		if y := toYear(p.BirthDate); y > 0 {
			years = append(years, y)
		}
		city := strings.TrimSpace(p.BirthCityCustom)
		if city == "" {
			city = strings.TrimSpace(p.BirthCity)
		}
		if city != "" {
			cityCount[city]++
		}
	}

	type cityPair struct {
		name  string
		count int
	}
	var cities []cityPair
	for n, cnt := range cityCount {
		cities = append(cities, cityPair{n, cnt})
	}
	sort.Slice(cities, func(i, j int) bool {
		if cities[i].count != cities[j].count {
			return cities[i].count > cities[j].count
		}
		return cities[i].name < cities[j].name
	})

	depth := 0
	if meID != "" {
		for _, v := range bfsDist(adj, meID) {
			if v > depth {
				depth = v
			}
		}
	}
	longest := maxBFSDepth(adj, ids)

	paternal := 0
	maternal := 0
	for _, r := range rels {
		rt := strings.ToLower(strings.TrimSpace(r.RelationType))
		if rt == "отец" {
			paternal++
		}
		if rt == "мать" {
			maternal++
		}
	}

	// Жизненные отрезки для эпох
	type span struct{ from, to int }
	var spans []span
	for _, p := range relatives {
		b := toYear(p.BirthDate)
		if b <= 0 {
			continue
		}
		t := toYear(p.DeathDate)
		if t <= 0 {
			t = min(nowY, b+95)
		}
		if t < b {
			t = b
		}
		spans = append(spans, span{b, t})
	}

	overlaps := func(start, end int) int {
		n := 0
		for _, r := range spans {
			if r.from <= end && r.to >= start {
				n++
			}
		}
		return n
	}

	type eraHit struct {
		def   eraDef
		count int
	}
	var eraHits []eraHit
	for _, e := range eraCatalog {
		eraHits = append(eraHits, eraHit{e, overlaps(e.Start, e.End)})
	}
	sort.Slice(eraHits, func(i, j int) bool {
		if eraHits[i].count != eraHits[j].count {
			return eraHits[i].count > eraHits[j].count
		}
		return eraHits[i].def.Start < eraHits[j].def.Start
	})

	var items []HomeFeedItem

	// 1) Эпохи с пересечением (главные первыми — уже по count)
	for _, h := range eraHits {
		if h.count <= 0 {
			continue
		}
		e := h.def
		items = append(items, HomeFeedItem{
			ID:       "era-" + e.Key,
			Kind:     "era",
			Headline: fmt.Sprintf("%s (%s)", e.Title, e.Years),
			Body:     fmt.Sprintf("Не менее %d родственников из вашей летописи пересекаются с этим периодом.", h.count),
			SourceLabel: "РУВИКИ",
		})
	}

	// 2) Статистика рода
	if depth > 0 {
		items = append(items, HomeFeedItem{
			ID:       "stat-generations",
			Kind:     "stat",
			Headline: "Глубина древа",
			Body:     fmt.Sprintf("От вашего узла — %d поколений (уровней).", depth+1),
		})
	} else {
		items = append(items, HomeFeedItem{
			ID:       "stat-generations",
			Kind:     "stat",
			Headline: "Глубина древа",
			Body:     "Добавьте связи и отметьте себя в дереве, чтобы увидеть глубину рода.",
		})
	}

	if len(years) > 0 {
		sort.Ints(years)
		lo, hi := years[0], years[len(years)-1]
		items = append(items, HomeFeedItem{
			ID:       "stat-timeline",
			Kind:     "stat",
			Headline: "Временной диапазон",
			Body:     fmt.Sprintf("Годы рождения в базе: %d — %d.", lo, hi),
		})
	} else {
		items = append(items, HomeFeedItem{
			ID:       "stat-timeline",
			Kind:     "stat",
			Headline: "Временной диапазон",
			Body:     "Укажите даты рождения в карточках — появится диапазон лет рода.",
		})
	}

	for i := 0; i < len(cities) && i < 3; i++ {
		items = append(items, HomeFeedItem{
			ID:       fmt.Sprintf("stat-city-%d", i),
			Kind:     "stat",
			Headline: "Город рода",
			Body:     fmt.Sprintf("%s — %d человек с этим местом рождения.", cities[i].name, cities[i].count),
		})
	}
	if len(cities) == 0 {
		items = append(items, HomeFeedItem{
			ID:       "stat-city-0",
			Kind:     "stat",
			Headline: "География",
			Body:     "Заполните места рождения — увидите центральные города семьи.",
		})
	}

	if longest > 0 {
		items = append(items, HomeFeedItem{
			ID:       "stat-branch",
			Kind:     "stat",
			Headline: "Самая длинная ветка",
			Body:     fmt.Sprintf("До %d человек в одной цепочке родства по графу.", longest+1),
		})
	} else {
		items = append(items, HomeFeedItem{
			ID:       "stat-branch",
			Kind:     "stat",
			Headline: "Ветви рода",
			Body:     "Свяжите карточки родственников — появятся метрики ветвей.",
		})
	}

	items = append(items, HomeFeedItem{
		ID:       "stat-lines",
		Kind:     "stat",
		Headline: "Отцовская / материнская линия",
		Body:     fmt.Sprintf("Связей «отец» / «мать» в базе: %d / %d.", paternal, maternal),
	})

	// Wiki enrichment (параллельно, до 5 одновременных запросов)
	type job struct {
		idx   int
		title string
	}
	var jobs []job
	for i := range items {
		it := &items[i]
		var wt string
		switch it.ID {
		case "stat-generations":
			wt = "Генеалогия"
		case "stat-timeline":
			wt = centuryWikiTitle(years)
		case "stat-branch":
			wt = "Родословная"
		case "stat-lines":
			wt = "Семья"
		default:
			if strings.HasPrefix(it.ID, "stat-city-") && len(cities) > 0 {
				idx := 0
				_, _ = fmt.Sscanf(strings.TrimPrefix(it.ID, "stat-city-"), "%d", &idx)
				if idx >= 0 && idx < len(cities) {
					wt = cities[idx].name
				}
			} else if strings.HasPrefix(it.ID, "era-") {
				key := strings.TrimPrefix(it.ID, "era-")
				for _, e := range eraCatalog {
					if e.Key == key {
						wt = e.WikiTitle
						break
					}
				}
			}
		}
		jobs = append(jobs, job{i, wt})
	}

	sem := semaphore.NewWeighted(5)
	var wg sync.WaitGroup
	semCtx := context.Background()
	for _, j := range jobs {
		j := j
		wg.Add(1)
		if err := sem.Acquire(semCtx, 1); err != nil {
			wg.Done()
			continue
		}
		go func() {
			defer sem.Release(1)
			defer wg.Done()
			enrichWithWiki(&items[j.idx], j.title)
		}()
	}
	wg.Wait()

	c.JSON(http.StatusOK, gin.H{"items": items})
}

func centuryWikiTitle(years []int) string {
	if len(years) == 0 {
		return "История России"
	}
	s := 0
	for _, y := range years {
		s += y
	}
	mid := s / len(years)
	c := (mid-1)/100 + 1
	if c < 1 {
		c = 1
	}
	if c > 21 {
		c = 21
	}
	roman := []string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"}
	if c >= 1 && c < len(roman) {
		return roman[c] + " век"
	}
	return "XXI век"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
