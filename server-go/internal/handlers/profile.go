package handlers

import (
	"net/http"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func GetProfile(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	var user models.User
	if err := db.Users.FindOne(ctx, bson.M{"_id": oid}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.JSON(http.StatusOK, user.ToClient())
}

func UpdateProfile(c *gin.Context) {
	var payload struct {
		FirstName       string `json:"firstName"`
		LastName        string `json:"lastName"`
		Email           string `json:"email"`
		Phone           string `json:"phone"`
		Login           string `json:"login"`
		Sex             string `json:"sex"`
		BirthDate       string `json:"birthDate"`
		BirthCity       string `json:"birthCity"`
		BirthCityCustom string `json:"birthCityCustom"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
		return
	}

	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	now := time.Now()

	update := bson.M{
		"$set": bson.M{
			"firstName":       payload.FirstName,
			"lastName":        payload.LastName,
			"email":           payload.Email,
			"phone":           payload.Phone,
			"login":           payload.Login,
			"sex":             payload.Sex,
			"birthDate":       payload.BirthDate,
			"birthCity":       payload.BirthCity,
			"birthCityCustom": payload.BirthCityCustom,
			"updatedAt":       now,
		},
	}

	_, err := db.Users.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	personUpdate := bson.M{
		"$set": bson.M{
			"lastName":        payload.LastName,
			"firstName":       payload.FirstName,
			"sex":             payload.Sex,
			"birthDate":       payload.BirthDate,
			"birthCity":       payload.BirthCity,
			"birthCityCustom": payload.BirthCityCustom,
			"phone":           payload.Phone,
			"updatedAt":       now,
		},
	}
	_, _ = db.Persons.UpdateOne(ctx, bson.M{"userId": oid, "isSelf": true}, personUpdate)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
