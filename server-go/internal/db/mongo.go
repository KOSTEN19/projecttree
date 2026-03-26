package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"project-drevo/internal/config"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	Client        *mongo.Client
	Users         *mongo.Collection
	Persons       *mongo.Collection
	Relationships *mongo.Collection
	Positions     *mongo.Collection
	ManualLinks   *mongo.Collection
)

func Connect(uri string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	opts := options.Client().ApplyURI(uri).
		SetMaxPoolSize(50).
		SetMinPoolSize(2).
		SetMaxConnIdleTime(2 * time.Minute)
	client, err := mongo.Connect(opts)
	if err != nil {
		return fmt.Errorf("mongo connect: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return fmt.Errorf("mongo ping: %w", err)
	}

	Client = client
	db := client.Database(config.DatabaseNameFromURI(uri))

	Users = db.Collection("users")
	Persons = db.Collection("persons")
	Relationships = db.Collection("relationships")
	Positions = db.Collection("positions")
	ManualLinks = db.Collection("manuallinks")

	log.Println("[db] connected to MongoDB")
	return ensureIndexes(ctx)
}

func ensureIndexes(ctx context.Context) error {
	_, err := Users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "login", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	_, err = Positions.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "personId", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	return err
}
