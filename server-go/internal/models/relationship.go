package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Relationship struct {
	ID              bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          bson.ObjectID `bson:"userId" json:"userId"`
	BasePersonID    bson.ObjectID `bson:"basePersonId" json:"basePersonId"`
	RelatedPersonID bson.ObjectID `bson:"relatedPersonId" json:"relatedPersonId"`
	RelationType    string        `bson:"relationType" json:"relationType"`
	Line            string        `bson:"line" json:"line"`
	CreatedAt       time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time     `bson:"updatedAt" json:"updatedAt"`
}

type RelationshipClient struct {
	ID              string `json:"id"`
	UserID          string `json:"userId"`
	BasePersonID    string `json:"basePersonId"`
	RelatedPersonID string `json:"relatedPersonId"`
	RelationType    string `json:"relationType"`
	Line            string `json:"line"`
}

func (r *Relationship) ToClient() RelationshipClient {
	return RelationshipClient{
		ID:              r.ID.Hex(),
		UserID:          r.UserID.Hex(),
		BasePersonID:    r.BasePersonID.Hex(),
		RelatedPersonID: r.RelatedPersonID.Hex(),
		RelationType:    r.RelationType,
		Line:            r.Line,
	}
}
