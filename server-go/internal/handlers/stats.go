package handlers

import (
	"net/http"

	"project-drevo/internal/db"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/sync/errgroup"
)

// PublicStats глобальные счётчики платформы (без авторизации).
func PublicStats(c *gin.Context) {
	ctx := reqCtx(c)

	var userCount, personCount, relationshipCount int64
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		n, err := db.Users.CountDocuments(gctx, bson.M{})
		userCount = n
		return err
	})
	// Все карточки людей по всем учётным записям (включая «Я»), без заглушек.
	g.Go(func() error {
		n, err := db.Persons.CountDocuments(gctx, bson.M{
			"isPlaceholder": bson.M{"$ne": true},
		})
		personCount = n
		return err
	})
	g.Go(func() error {
		n, err := db.Relationships.CountDocuments(gctx, bson.M{})
		relationshipCount = n
		return err
	})
	if err := g.Wait(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userCount":           userCount,
		"personCount":         personCount,
		"relationshipCount":   relationshipCount,
	})
}
