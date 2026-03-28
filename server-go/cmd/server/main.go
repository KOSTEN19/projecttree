package main

import (
	"log"
	"os"
	"strings"

	"project-drevo/internal/config"
	"project-drevo/internal/db"
	"project-drevo/internal/handlers"
	"project-drevo/internal/middleware"
	"project-drevo/internal/seed"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[fatal] config: %v", err)
	}
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	if err := db.Connect(cfg.MongoURI); err != nil {
		log.Fatalf("[fatal] %v", err)
	}

	if err := middleware.InitJWT(cfg.JWTSecret, cfg.JWTBindProcess, cfg.JWTAccessTTL); err != nil {
		log.Fatalf("[fatal] jwt: %v", err)
	}

	seed.RunDemoSeed()
	seed.RunAdminSeed()

	r := gin.Default()

	allowedOrigins := parseAllowedOrigins(cfg.ClientOrigin)
	corsCfg := cors.Config{
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}
	if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
		corsCfg.AllowAllOrigins = true
	} else {
		corsCfg.AllowOrigins = allowedOrigins
	}
	r.Use(cors.New(corsCfg))

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	r.GET("/api/stats", handlers.PublicStats)
	r.GET("/api/files/:userId/:filename", middleware.RequireAuth(), handlers.ServePersonPhoto)

	auth := r.Group("/api/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
		auth.GET("/me", middleware.RequireAuth(), handlers.Me)
	}

	profile := r.Group("/api/profile", middleware.RequireAuth())
	{
		profile.GET("", handlers.GetProfile)
		profile.PUT("/password", handlers.ChangePassword)
		profile.PUT("", handlers.UpdateProfile)
	}

	persons := r.Group("/api/persons", middleware.RequireAuth())
	{
		persons.GET("", handlers.ListPersons)
		persons.POST("", handlers.CreatePerson)
		persons.POST("/:id/photo", handlers.UploadPersonPhoto)
		persons.PUT("/:id", handlers.UpdatePerson)
		persons.DELETE("/:id", handlers.DeletePerson)
	}

	tree := r.Group("/api/tree", middleware.RequireAuth())
	{
		tree.GET("", handlers.GetTree)
		tree.POST("/position", handlers.SavePosition)
		tree.POST("/manual-attach", handlers.ManualAttach)
	}

	r.GET("/api/map", middleware.RequireAuth(), handlers.GetMap)
	r.GET("/api/map/all", middleware.RequireAuth(), handlers.GetMapAll)
	r.GET("/api/geo/suggest", middleware.RequireAuth(), handlers.GeoSuggest)
	r.GET("/api/home/feed", middleware.RequireAuth(), handlers.HomeFeed)

	r.GET("/api/relationships", middleware.RequireAuth(), handlers.ListRelationships)

	admin := r.Group("/api/admin", middleware.RequireAuth(), middleware.RequireAdmin())
	{
		admin.GET("/overview", handlers.AdminOverview)
	}

	log.Printf("[server] http://localhost:%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("[fatal] %v", err)
	}
}

func parseAllowedOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{"*"}
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		origin := strings.TrimSpace(p)
		if origin == "" {
			continue
		}
		origins = append(origins, origin)
	}

	if len(origins) == 0 {
		return []string{"*"}
	}
	return origins
}
