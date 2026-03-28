package handlers

import (
	"net/http"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"
	"project-drevo/internal/validation"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "message": "Некорректный JSON в запросе."})
		return
	}
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	var existing models.User
	if err := db.Users.FindOne(ctx, bson.M{"_id": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	// Логин и почта не меняются через профиль — только с сервера (existing).
	if err := validation.ProfilePayload(
		payload.FirstName, payload.LastName, existing.Email, payload.Phone,
		existing.Login, payload.Sex, payload.BirthDate, payload.BirthCity, payload.BirthCityCustom,
	); err != nil {
		respondValidation(c, err)
		return
	}

	now := time.Now()

	update := bson.M{
		"$set": bson.M{
			"firstName":       payload.FirstName,
			"lastName":        payload.LastName,
			"phone":           payload.Phone,
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

type changePasswordReq struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func ChangePassword(c *gin.Context) {
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "message": "Некорректный JSON в запросе."})
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password_fields_required", "message": "Укажите текущий и новый пароль."})
		return
	}
	if err := validation.PasswordRegister(req.NewPassword); err != nil {
		respondValidation(c, err)
		return
	}

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

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wrong_current_password", "message": "Неверный текущий пароль."})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	now := time.Now()
	_, err = db.Users.UpdateOne(ctx, bson.M{"_id": oid}, bson.M{
		"$set": bson.M{
			"passwordHash": string(hash),
			"updatedAt":    now,
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
