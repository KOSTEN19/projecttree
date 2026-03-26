package middleware

import (
	"net/http"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		oid, err := bson.ObjectIDFromHex(userID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}

		var user models.User
		if err := db.Users.FindOne(c.Request.Context(), bson.M{"_id": oid}).Decode(&user); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
			return
		}
		if !user.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin_only"})
			return
		}

		c.Next()
	}
}
