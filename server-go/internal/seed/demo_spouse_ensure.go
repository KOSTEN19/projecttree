package seed

import (
	"context"
	"errors"
	"log"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// demoSpousePair — мужчина (base) и женщина (related) для связи «жена», как в демо family / demoPersonUpdates.
type demoSpousePair struct {
	baseLast, baseFirst, baseBirth string
	relLast, relFirst, relBirth    string
}

// Пары супругов демо-семьи (родители героя и обе пары дедушка/бабушка).
var demoSpousePairs = []demoSpousePair{
	{"Иванов", "Сергей", "1968-07-22", "Иванова", "Елена", "1970-11-05"},
	{"Иванов", "Пётр", "1940-02-18", "Иванова", "Мария", "1942-06-30"},
	{"Смирнов", "Николай", "1938-12-01", "Смирнова", "Анна", "1943-08-12"},
}

func findDemoPersonID(ctx context.Context, userID bson.ObjectID, lastName, firstName, birthDate string) (bson.ObjectID, error) {
	var p models.Person
	err := db.Persons.FindOne(ctx, bson.M{
		"userId": userID, "lastName": lastName, "firstName": firstName, "birthDate": birthDate,
	}).Decode(&p)
	if err != nil {
		return bson.ObjectID{}, err
	}
	return p.ID, nil
}

// EnsureDemoSpouseRels добавляет связи «жена» между известными парами демо-аккаунта, если их ещё нет (идемпотентно).
func EnsureDemoSpouseRels(ctx context.Context, userID bson.ObjectID) {
	now := time.Now()
	for _, pair := range demoSpousePairs {
		baseID, err := findDemoPersonID(ctx, userID, pair.baseLast, pair.baseFirst, pair.baseBirth)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				log.Printf("[seed] ensure demo spouse: base person not found (%s %s)", pair.baseFirst, pair.baseLast)
			} else {
				log.Printf("[seed] ensure demo spouse: find base %s %s: %v", pair.baseFirst, pair.baseLast, err)
			}
			continue
		}
		relID, err := findDemoPersonID(ctx, userID, pair.relLast, pair.relFirst, pair.relBirth)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				log.Printf("[seed] ensure demo spouse: related person not found (%s %s)", pair.relFirst, pair.relLast)
			} else {
				log.Printf("[seed] ensure demo spouse: find related %s %s: %v", pair.relFirst, pair.relLast, err)
			}
			continue
		}

		filter := bson.M{
			"userId":          userID,
			"basePersonId":    baseID,
			"relatedPersonId": relID,
			"relationType":    "жена",
		}
		n, err := db.Relationships.CountDocuments(ctx, filter)
		if err != nil {
			log.Printf("[seed] ensure demo spouse: count: %v", err)
			continue
		}
		if n > 0 {
			continue
		}

		_, err = db.Relationships.InsertOne(ctx, models.Relationship{
			UserID:          userID,
			BasePersonID:    baseID,
			RelatedPersonID: relID,
			RelationType:    "жена",
			Line:            "",
			CreatedAt:       now,
			UpdatedAt:       now,
		})
		if err != nil {
			log.Printf("[seed] ensure demo spouse: insert: %v", err)
		}
	}
}
