package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"project-drevo/internal/middleware"
)

func reqCtx(c *gin.Context) context.Context {
	if c == nil || c.Request == nil {
		return context.Background()
	}
	return c.Request.Context()
}

func userOID(c *gin.Context) (bson.ObjectID, bool) {
	oid, err := bson.ObjectIDFromHex(middleware.GetUserID(c))
	return oid, err == nil
}

// respondValidation sends 400 with a Russian message for the client dialog.
func respondValidation(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error":   "validation_failed",
		"message": err.Error(),
	})
}
