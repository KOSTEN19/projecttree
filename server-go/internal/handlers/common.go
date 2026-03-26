package handlers

import (
	"context"

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
