package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Имя БД по умолчанию — project_drevo (то же, что в docker-compose: MONGO_URI=.../project_drevo).
const DefaultMongoDBName = "project_drevo"

const minJWTSecretLen = 32

type Config struct {
	Port              string
	MongoURI          string
	JWTSecret         string
	JWTBindProcess    bool
	JWTAccessTTL      time.Duration
	ClientOrigin      string
	AIEnabled         bool
	AIAPIBaseURL      string
	AIAPIKey          string
	AIModel           string
	AITimeout         time.Duration
	AIMaxTokens       int
	AICacheTTL        time.Duration
	AIRateRefresh     time.Duration
}

func Load() (*Config, error) {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required (min %d characters of random data; generate e.g. openssl rand -base64 48)", minJWTSecretLen)
	}
	if len(secret) < minJWTSecretLen {
		return nil, fmt.Errorf("JWT_SECRET must be at least %d characters (got %d)", minJWTSecretLen, len(secret))
	}

	ttl := getEnvDuration("JWT_ACCESS_TTL", 24*time.Hour)
	if ttl < 5*time.Minute {
		return nil, fmt.Errorf("JWT_ACCESS_TTL must be at least 5m (got %v)", ttl)
	}
	if ttl > 720*time.Hour {
		return nil, fmt.Errorf("JWT_ACCESS_TTL must be at most 720h (got %v)", ttl)
	}

	// По умолчанию токены привязаны к процессу: после перезапуска/пересборки контейнера все сессии сбрасываются.
	// Для нескольких реплик за балансировщиком выставьте JWT_BIND_TO_PROCESS=false.
	bind := getEnvBoolDefault("JWT_BIND_TO_PROCESS", true)

	aiEnabled := getEnvBoolDefault("AI_ENABLED", false)
	aiBase := strings.TrimSpace(os.Getenv("AI_API_BASE_URL"))
	aiModel := strings.TrimSpace(os.Getenv("AI_MODEL"))
	if aiEnabled && (aiBase == "" || aiModel == "") {
		return nil, fmt.Errorf("AI_ENABLED=true requires AI_API_BASE_URL and AI_MODEL")
	}

	aiMaxTok := 128
	if v := strings.TrimSpace(os.Getenv("AI_MAX_TOKENS")); v != "" {
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil && n >= 32 && n <= 1024 {
			aiMaxTok = n
		}
	}

	return &Config{
		Port:           getEnv("PORT", "3001"),
		MongoURI:       getEnv("MONGO_URI", "mongodb://127.0.0.1:27017/"+DefaultMongoDBName),
		JWTSecret:      secret,
		JWTBindProcess: bind,
		JWTAccessTTL:   ttl,
		ClientOrigin:   getEnv("CLIENT_ORIGIN", "*"),
		AIEnabled:      aiEnabled,
		AIAPIBaseURL:   strings.TrimSuffix(aiBase, "/"),
		AIAPIKey:       strings.TrimSpace(os.Getenv("AI_API_KEY")),
		AIModel:        aiModel,
		// 0 => no HTTP timeout in AI client (for very slow CPU setups).
		AITimeout:      getEnvDuration("AI_TIMEOUT", 0),
		AIMaxTokens:    aiMaxTok,
		AICacheTTL:     getEnvDuration("AI_CACHE_TTL", 168*time.Hour),
		AIRateRefresh:  getEnvDuration("AI_RATE_REFRESH", time.Hour),
	}, nil
}

// DatabaseNameFromURI извлекает имя БД из пути URI (после host:port).
func DatabaseNameFromURI(uri string) string {
	i := strings.Index(uri, "://")
	if i < 0 {
		return DefaultMongoDBName
	}
	rest := uri[i+3:]
	slash := strings.Index(rest, "/")
	if slash < 0 || slash >= len(rest)-1 {
		return DefaultMongoDBName
	}
	name := rest[slash+1:]
	if q := strings.IndexByte(name, '?'); q >= 0 {
		name = name[:q]
	}
	if name == "" {
		return DefaultMongoDBName
	}
	return name
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBoolDefault(key string, defaultVal bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return defaultVal
	}
	switch v {
	case "0", "false", "no", "off":
		return false
	case "1", "true", "yes", "on":
		return true
	default:
		return defaultVal
	}
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return fallback
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
