package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"project-drevo/internal/ai"
	"project-drevo/internal/config"
	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const aiFallbackImg = "https://cdn.ruwiki.ru/commonswiki/files/e/ee/WW2_collage.jpg"

var (
	aiFeedMu      sync.Mutex
	aiFeedCfg     *config.Config
	aiHTTP        *ai.Client
	aiTaskCh      chan aiFeedTask
	aiEnqueueAt   = map[string]time.Time{}
)

type aiFeedTask struct {
	UserID bson.ObjectID
	Force  bool
}

type aiFeedCacheDoc struct {
	UserID         bson.ObjectID `bson:"userId"`
	InputHash      string        `bson:"inputHash"`
	ItemsJSON      string        `bson:"itemsJson"`
	Model          string        `bson:"model"`
	SourceLabel    string        `bson:"sourceLabel"`
	CreatedAt      time.Time     `bson:"createdAt"`
	LastRefreshAt  time.Time     `bson:"lastRefreshAt"`
	LastError      string        `bson:"lastError,omitempty"`
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
	return "Облако · " + model
}

type aiPersonStub struct {
	ID       string `json:"id"`
	LastName string `json:"lastName"`
	First    string `json:"firstName"`
	Birth    string `json:"birthDate"`
	City     string `json:"city"`
	Self     bool   `json:"isSelf"`
	Alive    bool   `json:"alive"`
}

type aiPayload struct {
	People []aiPersonStub `json:"people"`
	Stats  map[string]any `json:"stats"`
}

func hashFamilyInput(persons []models.Person, rels []models.Relationship) string {
	type row struct {
		ID, LN, FN, BD, City string
		Self                 bool
		Upd                  int64
	}
	var rows []row
	for _, p := range persons {
		if p.IsPlaceholder {
			continue
		}
		city := strings.TrimSpace(p.BirthCityCustom)
		if city == "" {
			city = strings.TrimSpace(p.BirthCity)
		}
		rows = append(rows, row{
			ID: p.ID.Hex(), LN: p.LastName, FN: p.FirstName, BD: p.BirthDate,
			City: city, Self: p.IsSelf, Upd: p.UpdatedAt.Unix(),
		})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].ID < rows[j].ID })
	h := sha256.New()
	_ = json.NewEncoder(h).Encode(rows)
	h.Write([]byte(fmt.Sprintf("|rels=%d", len(rels))))
	return hex.EncodeToString(h.Sum(nil))
}

func buildAIPayload(persons []models.Person, rels []models.Relationship) aiPayload {
	var stubs []aiPersonStub
	paternal, maternal := 0, 0
	for _, r := range rels {
		rt := strings.ToLower(strings.TrimSpace(r.RelationType))
		if rt == "отец" {
			paternal++
		}
		if rt == "мать" {
			maternal++
		}
	}
	for _, p := range persons {
		if p.IsPlaceholder {
			continue
		}
		city := strings.TrimSpace(p.BirthCityCustom)
		if city == "" {
			city = strings.TrimSpace(p.BirthCity)
		}
		stubs = append(stubs, aiPersonStub{
			ID: p.ID.Hex(), LastName: p.LastName, First: p.FirstName,
			Birth: p.BirthDate, City: city, Self: p.IsSelf, Alive: p.Alive,
		})
	}
	return aiPayload{
		People: stubs,
		Stats: map[string]any{
			"relativesCount": len(stubs),
			"relationsCount": len(rels),
			"paternalEdges":  paternal,
			"maternalEdges":  maternal,
		},
	}
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
	aiFeedMu.Lock()
	cfg := aiFeedCfg
	client := aiHTTP
	aiFeedMu.Unlock()
	if cfg == nil || client == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), cfg.AITimeout+45*time.Second)
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

	payload := buildAIPayload(persons, rels)
	userJSON, _ := json.MarshalIndent(payload, "", "  ")
	system := `Ты помощник семейной летописи. Ответь ТОЛЬКО валидным JSON-массивом из 2–4 объектов без markdown и без пояснений.
Каждый объект: {"id":"ai-1","headline":"короткий заголовок","body":"1–2 предложения по-русски"}.
Правила: не выдумывай факты, которых нет во входных данных (имена, годы, города, числа). Можно мягко интерпретировать и связывать то, что есть. id должны быть уникальны (ai-1, ai-2, …).`
	userPrompt := "Данные для формулировок (только из этого текста):\n" + string(userJSON)

	text, err := client.ChatComplete(ctx, system, userPrompt)
	if err != nil {
		log.Printf("[ai] llm: %v", err)
		return
	}
	text = strings.TrimSpace(text)
	if i := strings.Index(text, "["); i >= 0 {
		text = text[i:]
	}
	if j := strings.LastIndex(text, "]"); j >= 0 {
		text = text[:j+1]
	}
	var raw []struct {
		ID       string `json:"id"`
		Headline string `json:"headline"`
		Body     string `json:"body"`
	}
	if err := json.Unmarshal([]byte(text), &raw); err != nil || len(raw) == 0 {
		log.Printf("[ai] parse json: %v", err)
		return
	}
	label := aiSourceLabel(cfg.AIAPIBaseURL, cfg.AIModel)
	var items []HomeFeedItem
	for i, r := range raw {
		if i >= 6 {
			break
		}
		id := strings.TrimSpace(r.ID)
		if id == "" {
			id = fmt.Sprintf("ai-%d", i+1)
		}
		head := strings.TrimSpace(r.Headline)
		body := strings.TrimSpace(r.Body)
		if head == "" || body == "" {
			continue
		}
		if len([]rune(head)) > 120 {
			head = string([]rune(head)[:118]) + "…"
		}
		if len([]rune(body)) > 420 {
			body = string([]rune(body)[:418]) + "…"
		}
		items = append(items, HomeFeedItem{
			ID: id, Kind: "ai", Headline: head, Body: body,
			ImageURL: aiFallbackImg, SourceLabel: label,
		})
	}
	if len(items) == 0 {
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
