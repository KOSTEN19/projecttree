package seed

import (
	"context"
	"errors"
	"log"
	"os"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"
)

const (
	DefaultAdminLogin    = "admin"
	DefaultAdminPassword = "V9!mQ2#tK7@pL4$zR6"
)

func RunAdminSeed() {
	ctx := context.Background()
	now := time.Now()
	adminLogin := envOr("ADMIN_LOGIN", DefaultAdminLogin)
	adminPassword := envOr("ADMIN_PASSWORD", DefaultAdminPassword)

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[seed-admin] bcrypt password: %v", err)
		return
	}
	hashStr := string(hash)

	var existing models.User
	err = db.Users.FindOne(ctx, bson.M{"login": adminLogin}).Decode(&existing)
	if err == nil {
		_, uerr := db.Users.UpdateOne(ctx, bson.M{"login": adminLogin}, bson.M{
			"$set": bson.M{
				"isAdmin":      true,
				"passwordHash": hashStr,
				"updatedAt":    now,
			},
		})
		if uerr != nil {
			log.Printf("[seed-admin] failed to refresh admin password: %v", uerr)
		} else {
			log.Printf("[seed-admin] admin exists (id=%s), password hash refreshed", existing.ID.Hex())
		}
		return
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		log.Printf("[seed-admin] find admin user: %v", err)
		return
	}

	admin := models.User{
		FirstName:    "System",
		LastName:     "Admin",
		Email:        "admin@local",
		Phone:        "",
		Login:        adminLogin,
		PasswordHash: hashStr,
		IsAdmin:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if _, err := db.Users.InsertOne(ctx, admin); err != nil {
		log.Printf("[seed-admin] failed to create admin user: %v", err)
		return
	}

	log.Printf("[seed-admin] admin created. login=%s", adminLogin)
}

func envOr(name, fallback string) string {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	return v
}
