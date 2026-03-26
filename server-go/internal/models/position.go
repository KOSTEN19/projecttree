package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Position struct {
	ID       bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID   bson.ObjectID `bson:"userId" json:"userId"`
	PersonID bson.ObjectID `bson:"personId" json:"personId"`
	DX       float64       `bson:"dx" json:"dx"`
	DY       float64       `bson:"dy" json:"dy"`
	CreatedAt time.Time    `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time    `bson:"updatedAt" json:"updatedAt"`
}
