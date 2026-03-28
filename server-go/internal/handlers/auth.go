package handlers

import (
	"net/http"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/middleware"
	"project-drevo/internal/models"
	"project-drevo/internal/validation"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type registerReq struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Login     string `json:"login"`
	Password  string `json:"password"`
}

func Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "message": "Некорректный JSON в запросе."})
		return
	}
	if req.Login == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "login_and_password_required", "message": "Укажите логин и пароль."})
		return
	}
	if err := validation.RegisterPayload(req.FirstName, req.LastName, req.Email, req.Phone, req.Login, req.Password); err != nil {
		respondValidation(c, err)
		return
	}

	ctx := reqCtx(c)

	var existing models.User
	err := db.Users.FindOne(ctx, bson.M{"login": req.Login}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "login_already_exists", "message": "Этот логин уже занят. Выберите другой."})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	now := time.Now()
	user := models.User{
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		Phone:        req.Phone,
		Login:        req.Login,
		PasswordHash: string(hash),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	res, err := db.Users.InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	userID := res.InsertedID.(bson.ObjectID)

	person := models.Person{
		UserID:    userID,
		IsSelf:    true,
		LastName:  req.LastName,
		FirstName: req.FirstName,
		Phone:     req.Phone,
		Alive:     true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = db.Persons.InsertOne(ctx, person)

	token, err := middleware.GenerateToken(userID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "token": token})
}

type loginReq struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json", "message": "Некорректный JSON в запросе."})
		return
	}
	if req.Login == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "login_and_password_required", "message": "Укажите логин и пароль."})
		return
	}

	ctx := reqCtx(c)
	var user models.User
	err := db.Users.FindOne(ctx, bson.M{"login": req.Login}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "bad_credentials", "message": "Неверный логин или пароль."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "bad_credentials", "message": "Неверный логин или пароль."})
		return
	}

	token, err := middleware.GenerateToken(user.ID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "token": token})
}

func Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusOK, gin.H{"user": nil})
		return
	}

	ctx := reqCtx(c)
	oid, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"user": nil})
		return
	}

	var user models.User
	err = db.Users.FindOne(ctx, bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"user": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user.ToClient()})
}
