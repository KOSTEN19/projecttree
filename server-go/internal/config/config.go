package config

import (
	"os"
	"strings"
)

// Имя БД по умолчанию — project_drevo (то же, что в docker-compose: MONGO_URI=.../project_drevo).
const DefaultMongoDBName = "project_drevo"

type Config struct {
	Port         string
	MongoURI     string
	JWTSecret    string
	ClientOrigin string
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "3001"),
		MongoURI:     getEnv("MONGO_URI", "mongodb://127.0.0.1:27017/"+DefaultMongoDBName),
		JWTSecret:    getEnv("JWT_SECRET", "dev_secret_change_me"),
		ClientOrigin: getEnv("CLIENT_ORIGIN", "*"),
	}
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
