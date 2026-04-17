package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"project-drevo/internal/ai"
	"project-drevo/internal/config"
	"project-drevo/internal/db"
	"project-drevo/internal/models"
	"project-drevo/internal/textutil"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const aiFallbackImg = "https://cdn.ruwiki.ru/commonswiki/files/e/ee/WW2_collage.jpg"

const aiMaxFieldRunes = 220

var (
	aiFeedMu    sync.Mutex
	aiFeedCfg   *config.Config
	aiHTTP      *ai.Client
	aiTaskCh    chan aiFeedTask
	aiEnqueueAt = map[string]time.Time{}

	reInterestingFact1 = regexp.MustCompile(`(?is)интересный\s+факт\s*1\b`)
	reInterestingFact2 = regexp.MustCompile(`(?is)интересный\s+факт\s*2\b`)
)

type aiFeedTask struct {
	UserID bson.ObjectID
	Force  bool
}

type aiFeedCacheDoc struct {
	UserID        bson.ObjectID `bson:"userId"`
	InputHash     string        `bson:"inputHash"`
	ItemsJSON     string        `bson:"itemsJson"`
	Model         string        `bson:"model"`
	SourceLabel   string        `bson:"sourceLabel"`
	CreatedAt     time.Time     `bson:"createdAt"`
	LastRefreshAt time.Time     `bson:"lastRefreshAt"`
	LastError     string        `bson:"lastError,omitempty"`
}

// InitAIFeed вызывается из main при старте (после Load config).
func InitAIFeed(cfg *config.Config) {
	aiFeedMu.Lock()
	defer aiFeedMu.Unlock()
	aiFeedCfg = cfg
	if cfg == nil || !cfg.AIEnabled {
		return
	}
	aiHTTP = &ai.Client{
		BaseURL:   cfg.AIAPIBaseURL,
		APIKey:    cfg.AIAPIKey,
		Model:     cfg.AIModel,
		Timeout:   cfg.AITimeout,
		MaxTokens: cfg.AIMaxTokens,
	}
	aiTaskCh = make(chan aiFeedTask, 48)
	go aiFeedWorkerLoop()
	log.Printf("[ai] feed worker started (model=%s)", cfg.AIModel)
}

func aiSourceLabel(baseURL, model string) string {
	u := strings.ToLower(baseURL)
	if strings.Contains(u, "127.0.0.1") || strings.Contains(u, "localhost") || strings.Contains(u, "::1") {
		return "Локально · " + model
	}
	if strings.Contains(u, "ollama") {
		return "Локально · " + model
	}
	return "Облако · " + model
}

// aiCanonPerson и aiCanonRel — каноническое представление для хэша кэша (все поля, влияющие на промпт).
type aiCanonPerson struct {
	ID           string   `json:"id"`
	LastName     string   `json:"lastName,omitempty"`
	MaidenName   string   `json:"maidenName,omitempty"`
	FirstName    string   `json:"firstName,omitempty"`
	MiddleName   string   `json:"middleName,omitempty"`
	Sex          string   `json:"sex,omitempty"`
	BirthDate    string   `json:"birthDate,omitempty"`
	BirthCity    string   `json:"birthCity,omitempty"`
	Alive        bool     `json:"alive"`
	DeathDate    string   `json:"deathDate,omitempty"`
	BurialPlace  string   `json:"burialPlace,omitempty"`
	Notes        string   `json:"notes,omitempty"`
	Biography    string   `json:"biography,omitempty"`
	Education    string   `json:"education,omitempty"`
	WorkPath     string   `json:"workPath,omitempty"`
	MilitaryPath string   `json:"militaryPath,omitempty"`
	LinkTitles   []string `json:"linkTitles,omitempty"`
	IsSelf       bool     `json:"isSelf"`
	UpdatedAt    int64    `json:"updatedAt"`
}

type aiCanonRel struct {
	ID              string `json:"id"`
	BasePersonID    string `json:"basePersonId"`
	RelatedPersonID string `json:"relatedPersonId"`
	RelationType    string `json:"relationType"`
	Line            string `json:"line,omitempty"`
	UpdatedAt       int64  `json:"updatedAt"`
}

func hashFamilyInput(persons []models.Person, rels []models.Relationship) string {
	var cps []aiCanonPerson
	for _, p := range persons {
		if p.IsPlaceholder {
			continue
		}
		bc := strings.TrimSpace(p.BirthCityCustom)
		if bc == "" {
			bc = strings.TrimSpace(p.BirthCity)
		}
		var titles []string
		for _, l := range p.ExternalLinks {
			t := textutil.SanitizeForAI(l.Title, 200)
			if t != "" {
				titles = append(titles, t)
			}
		}
		sort.Strings(titles)
		cps = append(cps, aiCanonPerson{
			ID: p.ID.Hex(), LastName: p.LastName, MaidenName: p.MaidenName, FirstName: p.FirstName,
			MiddleName: p.MiddleName, Sex: p.Sex, BirthDate: p.BirthDate, BirthCity: bc,
			Alive: p.Alive, DeathDate: p.DeathDate, BurialPlace: p.BurialPlace,
			Notes: textutil.SanitizeForAI(p.Notes, aiMaxFieldRunes),
			Biography: textutil.SanitizeForAI(p.Biography, aiMaxFieldRunes),
			Education: textutil.SanitizeForAI(p.Education, aiMaxFieldRunes),
			WorkPath: textutil.SanitizeForAI(p.WorkPath, aiMaxFieldRunes),
			MilitaryPath: textutil.SanitizeForAI(p.MilitaryPath, aiMaxFieldRunes),
			LinkTitles: titles, IsSelf: p.IsSelf, UpdatedAt: p.UpdatedAt.Unix(),
		})
	}
	sort.Slice(cps, func(i, j int) bool { return cps[i].ID < cps[j].ID })

	var crs []aiCanonRel
	for _, r := range rels {
		crs = append(crs, aiCanonRel{
			ID: r.ID.Hex(), BasePersonID: r.BasePersonID.Hex(), RelatedPersonID: r.RelatedPersonID.Hex(),
			RelationType: strings.TrimSpace(r.RelationType), Line: strings.TrimSpace(r.Line),
			UpdatedAt: r.UpdatedAt.Unix(),
		})
	}
	sort.Slice(crs, func(i, j int) bool { return crs[i].ID < crs[j].ID })

	h := sha256.New()
	_ = json.NewEncoder(h).Encode(cps)
	_ = json.NewEncoder(h).Encode(crs)
	return hex.EncodeToString(h.Sum(nil))
}

func sexLabelRu(s string) string {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "M":
		return "мужской"
	case "F":
		return "женский"
	default:
		return ""
	}
}

func personDisplayName(p models.Person) string {
	parts := []string{
		strings.TrimSpace(p.LastName),
		strings.TrimSpace(p.FirstName),
		strings.TrimSpace(p.MiddleName),
	}
	var out []string
	for _, x := range parts {
		if x != "" {
			out = append(out, x)
		}
	}
	s := strings.Join(out, " ")
	if s == "" {
		return "Без имени"
	}
	return s
}

func personShortLabel(p models.Person) string {
	ln := strings.TrimSpace(p.LastName)
	fn := strings.TrimSpace(p.FirstName)
	if fn != "" && len([]rune(fn)) > 0 {
		r := []rune(fn)[0]
		if ln != "" {
			return fmt.Sprintf("%s %s.", ln, string(r))
		}
		return string(r) + "."
	}
	if ln != "" {
		return ln
	}
	return "?"
}

// buildPlainAIFamilyContext — только непустые санитизированные поля + связи с именами.
func buildPlainAIFamilyContext(persons []models.Person, rels []models.Relationship) string {
	byID := make(map[string]models.Person)
	for _, p := range persons {
		if !p.IsPlaceholder {
			byID[p.ID.Hex()] = p
		}
	}
	var b strings.Builder
	b.WriteString("РОДСТВЕННИКИ\n\n")
	for _, p := range persons {
		if p.IsPlaceholder {
			continue
		}
		title := personDisplayName(p)
		if p.MaidenName != "" {
			title += " (девичья фамилия: " + textutil.SanitizeForAI(p.MaidenName, 120) + ")"
		}
		b.WriteString("— ")
		b.WriteString(title)
		if p.IsSelf {
			b.WriteString(" [вы]")
		}
		b.WriteString("\n")
		if sx := sexLabelRu(p.Sex); sx != "" {
			b.WriteString("  Пол: ")
			b.WriteString(sx)
			b.WriteString("\n")
		}
		if p.BirthDate != "" {
			b.WriteString("  Дата рождения: ")
			b.WriteString(textutil.SanitizeForAI(p.BirthDate, 40))
			b.WriteString("\n")
		}
		city := textutil.SanitizeForAI(p.BirthCityCustom, 200)
		if city == "" {
			city = textutil.SanitizeForAI(p.BirthCity, 200)
		}
		if city != "" {
			b.WriteString("  Место рождения: ")
			b.WriteString(city)
			b.WriteString("\n")
		}
		if p.Alive {
			b.WriteString("  Статус: жив(а)\n")
		} else {
			b.WriteString("  Статус: умер(ла)\n")
			if p.DeathDate != "" {
				b.WriteString("  Дата смерти: ")
				b.WriteString(textutil.SanitizeForAI(p.DeathDate, 40))
				b.WriteString("\n")
			}
			if bp := textutil.SanitizeForAI(p.BurialPlace, 200); bp != "" {
				b.WriteString("  Место захоронения: ")
				b.WriteString(bp)
				b.WriteString("\n")
			}
		}
		for label, val := range map[string]string{
			"Биография":      textutil.SanitizeForAI(p.Biography, aiMaxFieldRunes),
			"Образование":    textutil.SanitizeForAI(p.Education, aiMaxFieldRunes),
			"Трудовой путь":  textutil.SanitizeForAI(p.WorkPath, aiMaxFieldRunes),
			"Военная служба": textutil.SanitizeForAI(p.MilitaryPath, aiMaxFieldRunes),
			"Заметки":        textutil.SanitizeForAI(p.Notes, aiMaxFieldRunes),
		} {
			if val != "" {
				b.WriteString("  ")
				b.WriteString(label)
				b.WriteString(": ")
				b.WriteString(val)
				b.WriteString("\n")
			}
		}
		for _, l := range p.ExternalLinks {
			t := textutil.SanitizeForAI(l.Title, 200)
			if t != "" {
				b.WriteString("  Ссылка (название): ")
				b.WriteString(t)
				b.WriteString("\n")
			}
		}
		b.WriteString("\n")
	}
	if len(rels) > 0 {
		b.WriteString("СВЯЗИ\n\n")
		for _, r := range rels {
			bp, ok1 := byID[r.BasePersonID.Hex()]
			rp, ok2 := byID[r.RelatedPersonID.Hex()]
			if !ok1 || !ok2 {
				continue
			}
			b.WriteString(personShortLabel(bp))
			b.WriteString(" — ")
			b.WriteString(strings.TrimSpace(r.RelationType))
			b.WriteString(" — ")
			b.WriteString(personShortLabel(rp))
			if ln := strings.TrimSpace(r.Line); ln != "" {
				b.WriteString(" (линия: ")
				b.WriteString(textutil.SanitizeForAI(ln, 40))
				b.WriteString(")")
			}
			b.WriteString("\n")
		}
	}
	return strings.TrimSpace(b.String())
}

func parseAIFactsText(raw string, sourceLabel string) ([]HomeFeedItem, error) {
	s := strings.TrimSpace(raw)
	loc1 := reInterestingFact1.FindStringIndex(s)
	loc2 := reInterestingFact2.FindStringIndex(s)
	if loc1 == nil || loc2 == nil {
		return nil, fmt.Errorf("missing fact markers")
	}
	if loc2[0] < loc1[0] {
		loc1, loc2 = loc2, loc1
	}
	body1 := strings.TrimSpace(s[loc1[1]:loc2[0]])
	body2 := strings.TrimSpace(s[loc2[1]:])
	if body1 == "" || body2 == "" {
		return nil, fmt.Errorf("empty fact body")
	}
	const maxBody = 220
	if len([]rune(body1)) > maxBody {
		body1 = string([]rune(body1)[:maxBody]) + "…"
	}
	if len([]rune(body2)) > maxBody {
		body2 = string([]rune(body2)[:maxBody]) + "…"
	}
	return []HomeFeedItem{
		{ID: "ai-1", Kind: "ai", Headline: "Интересный факт 1", Body: body1, ImageURL: aiFallbackImg, SourceLabel: sourceLabel},
		{ID: "ai-2", Kind: "ai", Headline: "Интересный факт 2", Body: body2, ImageURL: aiFallbackImg, SourceLabel: sourceLabel},
	}, nil
}

func insertAfterEras(base []HomeFeedItem, extra []HomeFeedItem) []HomeFeedItem {
	if len(extra) == 0 {
		return base
	}
	i := 0
	for i < len(base) && base[i].Kind == "era" {
		i++
	}
	out := make([]HomeFeedItem, 0, len(base)+len(extra))
	out = append(out, base[:i]...)
	out = append(out, extra...)
	out = append(out, base[i:]...)
	return out
}

func loadAIFeedCache(ctx context.Context, userID bson.ObjectID) (*aiFeedCacheDoc, error) {
	var doc aiFeedCacheDoc
	err := db.AIFeedCache.FindOne(ctx, bson.M{"userId": userID}).Decode(&doc)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func saveAIFeedCache(ctx context.Context, doc *aiFeedCacheDoc) error {
	doc.CreatedAt = time.Now()
	_, err := db.AIFeedCache.ReplaceOne(ctx,
		bson.M{"userId": doc.UserID},
		doc,
		options.Replace().SetUpsert(true),
	)
	return err
}

// EnqueueAIFeedGenerate ставит задачу в очередь (debounce для фоновых запросов).
func EnqueueAIFeedGenerate(userID bson.ObjectID, force bool) {
	aiFeedMu.Lock()
	cfg := aiFeedCfg
	ch := aiTaskCh
	aiFeedMu.Unlock()
	if cfg == nil || !cfg.AIEnabled || ch == nil {
		return
	}
	if !force {
		aiFeedMu.Lock()
		k := userID.Hex()
		if t, ok := aiEnqueueAt[k]; ok && time.Since(t) < 2*time.Minute {
			aiFeedMu.Unlock()
			return
		}
		aiEnqueueAt[k] = time.Now()
		aiFeedMu.Unlock()
	}
	select {
	case ch <- aiFeedTask{UserID: userID, Force: force}:
	default:
		log.Printf("[ai] task queue full, skip user=%s", userID.Hex())
	}
}

func aiFeedWorkerLoop() {
	for t := range aiTaskCh {
		runAIFeedJob(t)
	}
}

func runAIFeedJob(t aiFeedTask) {
	startedAt := time.Now()
	aiFeedMu.Lock()
	cfg := aiFeedCfg
	client := aiHTTP
	aiFeedMu.Unlock()
	if cfg == nil || client == nil {
		return
	}
	var (
		ctx    context.Context
		cancel context.CancelFunc
	)
	if cfg.AITimeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), cfg.AITimeout+45*time.Second)
	} else {
		ctx = context.Background()
		cancel = func() {}
	}
	defer cancel()

	filter := bson.M{"userId": t.UserID}
	cur, err := db.Persons.Find(ctx, filter)
	if err != nil {
		log.Printf("[ai] persons: %v", err)
		return
	}
	var persons []models.Person
	if err := cur.All(ctx, &persons); err != nil {
		log.Printf("[ai] persons decode: %v", err)
		return
	}
	rcur, err := db.Relationships.Find(ctx, filter)
	if err != nil {
		log.Printf("[ai] rels: %v", err)
		return
	}
	var rels []models.Relationship
	if err := rcur.All(ctx, &rels); err != nil {
		log.Printf("[ai] rels decode: %v", err)
		return
	}

	hash := hashFamilyInput(persons, rels)
	if !t.Force {
		if doc, err := loadAIFeedCache(ctx, t.UserID); err == nil && doc != nil {
			if doc.InputHash == hash && doc.ItemsJSON != "" && time.Since(doc.CreatedAt) < cfg.AICacheTTL {
				return
			}
		}
	}

	dataBlock := buildPlainAIFamilyContext(persons, rels)
	if dataBlock == "" {
		dataBlock = "(Нет заполненных карточек родственников — опирайся только на это сообщение.)"
	}

	system := `Ты помощник семейной летописи.
Сделай РОВНО 2 коротких факта на русском по входным данным.
Не выдумывай личные события, которых нет во входе.
Без HTML/JSON/markdown.
Строгий формат:
Интересный факт 1
<1-2 коротких предложения, до 220 символов>

Интересный факт 2
<1-2 коротких предложения, до 220 символов>

Никаких "Интересный факт 3".`

	userPrompt := "Дай 2 очень коротких исторических факта по семье.\n\nДАННЫЕ:\n" + dataBlock

	llmStartedAt := time.Now()
	text, err := client.ChatComplete(ctx, system, userPrompt)
	if err != nil {
		log.Printf("[ai] llm: %v (took=%s)", err, time.Since(llmStartedAt).Round(time.Millisecond))
		return
	}
	log.Printf("[ai] llm ok (took=%s)", time.Since(llmStartedAt).Round(time.Millisecond))
	label := aiSourceLabel(cfg.AIAPIBaseURL, cfg.AIModel)
	items, err := parseAIFactsText(text, label)
	if err != nil {
		log.Printf("[ai] parse facts: %v", err)
		return
	}
	if len(items) != 2 {
		return
	}
	b, _ := json.Marshal(items)
	doc := &aiFeedCacheDoc{
		UserID: t.UserID, InputHash: hash, ItemsJSON: string(b),
		Model: cfg.AIModel, SourceLabel: label, LastError: "",
	}
	if t.Force {
		doc.LastRefreshAt = time.Now()
	} else if old, err := loadAIFeedCache(ctx, t.UserID); err == nil && old != nil && !old.LastRefreshAt.IsZero() {
		doc.LastRefreshAt = old.LastRefreshAt
	}
	if err := saveAIFeedCache(ctx, doc); err != nil {
		log.Printf("[ai] save cache: %v", err)
	}
	log.Printf("[ai] feed job done user=%s force=%v total=%s", t.UserID.Hex(), t.Force, time.Since(startedAt).Round(time.Millisecond))
}

// mergeAIFeedItems добавляет кэшированные ИИ-карточки и при необходимости ставит фоновую генерацию.
func mergeAIFeedItems(ctx context.Context, userID bson.ObjectID, persons []models.Person, rels []models.Relationship, base []HomeFeedItem) ([]HomeFeedItem, bool) {
	aiFeedMu.Lock()
	cfg := aiFeedCfg
	aiFeedMu.Unlock()
	if cfg == nil || !cfg.AIEnabled {
		return base, false
	}
	hash := hashFamilyInput(persons, rels)
	doc, err := loadAIFeedCache(ctx, userID)
	if err == nil && doc != nil && doc.InputHash == hash && doc.ItemsJSON != "" && time.Since(doc.CreatedAt) < cfg.AICacheTTL {
		var extra []HomeFeedItem
		if json.Unmarshal([]byte(doc.ItemsJSON), &extra) == nil && len(extra) > 0 {
			if len(extra) > 2 {
				extra = extra[:2]
			}
			for i := range extra {
				if extra[i].ImageURL == "" {
					extra[i].ImageURL = aiFallbackImg
				}
				if extra[i].Kind == "" {
					extra[i].Kind = "ai"
				}
				if extra[i].SourceLabel == "" {
					extra[i].SourceLabel = doc.SourceLabel
				}
			}
			return insertAfterEras(base, extra), false
		}
	}
	EnqueueAIFeedGenerate(userID, false)
	return base, true
}

// PostAIFeedRefresh ручной пересчёт (rate limit).
func PostAIFeedRefresh(c *gin.Context) {
	aiFeedMu.Lock()
	cfg := aiFeedCfg
	aiFeedMu.Unlock()
	if cfg == nil || !cfg.AIEnabled {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ai_disabled"})
		return
	}
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	ctx := reqCtx(c)
	doc, _ := loadAIFeedCache(ctx, oid)
	if doc != nil && !doc.LastRefreshAt.IsZero() && time.Since(doc.LastRefreshAt) < cfg.AIRateRefresh {
		rem := cfg.AIRateRefresh - time.Since(doc.LastRefreshAt)
		if rem < 0 {
			rem = 0
		}
		wait := rem.Round(time.Minute)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":   "ai_rate_limited",
			"message": fmt.Sprintf("Повторите примерно через %v", wait),
		})
		return
	}
	EnqueueAIFeedGenerate(oid, true)
	_, _ = db.AIFeedCache.UpdateOne(ctx,
		bson.M{"userId": oid},
		bson.M{
			"$set":         bson.M{"lastRefreshAt": time.Now()},
			"$setOnInsert": bson.M{"userId": oid, "inputHash": "", "itemsJson": "", "createdAt": time.Now(), "model": "", "sourceLabel": ""},
		},
		options.UpdateOne().SetUpsert(true),
	)
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Задача поставлена. Обновите страницу через минуту."})
}
