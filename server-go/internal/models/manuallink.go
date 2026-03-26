package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type ManualLink struct {
	ID             bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         bson.ObjectID `bson:"userId" json:"userId"`
	PersonID       bson.ObjectID `bson:"personId" json:"personId"`
	AnchorPersonID bson.ObjectID `bson:"anchorPersonId" json:"anchorPersonId"`
	Mode           string        `bson:"mode" json:"mode"`
	CreatedAt      time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time     `bson:"updatedAt" json:"updatedAt"`
}
