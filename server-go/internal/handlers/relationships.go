package handlers

import (
	"net/http"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func ListRelationships(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	cursor, err := db.Relationships.Find(ctx, bson.M{"userId": oid},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	var items []models.Relationship
	if err := cursor.All(ctx, &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	result := make([]models.RelationshipClient, 0, len(items))
	for _, r := range items {
		result = append(result, r.ToClient())
	}
	c.JSON(http.StatusOK, result)
}
