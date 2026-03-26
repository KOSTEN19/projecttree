package handlers

import (
	"net/http"
	"strings"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type createPersonReq struct {
	LastName        string `json:"lastName"`
	MaidenName      string `json:"maidenName"`
	FirstName       string `json:"firstName"`
	MiddleName      string `json:"middleName"`
	Sex             string `json:"sex"`
	BirthDate       string `json:"birthDate"`
	BirthCity       string `json:"birthCity"`
	BirthCityCustom string `json:"birthCityCustom"`
	Phone           string `json:"phone"`
	Alive           *bool  `json:"alive"`
	DeathDate       string `json:"deathDate"`
	BurialPlace     string `json:"burialPlace"`
	Notes           string `json:"notes"`
	Biography       string `json:"biography"`
	Education       string `json:"education"`
	WorkPath        string `json:"workPath"`
	MilitaryPath    string `json:"militaryPath"`
	BasePersonID    string `json:"basePersonId"`
	RelationType    string `json:"relationType"`
	Line            string `json:"line"`
}

func ListPersons(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	cursor, err := db.Persons.Find(ctx, bson.M{"userId": oid},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	var persons []models.Person
	if err := cursor.All(ctx, &persons); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	result := make([]models.PersonClient, 0, len(persons))
	for _, p := range persons {
		result = append(result, p.ToClient())
	}
	c.JSON(http.StatusOK, result)
}

func CreatePerson(c *gin.Context) {
	var req createPersonReq
	if err := c.ShouldBindJSON(&req); err != nil {
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

	alive := true
	if req.Alive != nil {
		alive = *req.Alive
	}

	person := models.Person{
		UserID:          oid,
		IsSelf:          false,
		LastName:        req.LastName,
		MaidenName:      req.MaidenName,
		FirstName:       req.FirstName,
		MiddleName:      req.MiddleName,
		Sex:             req.Sex,
		BirthDate:       req.BirthDate,
		BirthCity:       req.BirthCity,
		BirthCityCustom: req.BirthCityCustom,
		Phone:           req.Phone,
		Alive:           alive,
		DeathDate:       req.DeathDate,
		BurialPlace:     req.BurialPlace,
		Notes:           req.Notes,
		Biography:       req.Biography,
		Education:       req.Education,
		WorkPath:        req.WorkPath,
		MilitaryPath:    req.MilitaryPath,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	res, err := db.Persons.InsertOne(ctx, person)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	personID := res.InsertedID.(bson.ObjectID)
	person.ID = personID

	if req.BasePersonID != "" && req.RelationType != "" {
		baseOID, err := bson.ObjectIDFromHex(req.BasePersonID)
		if err != nil {
			_, _ = db.Persons.DeleteOne(ctx, bson.M{"_id": personID})
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_basePersonId"})
			return
		}

		count, _ := db.Persons.CountDocuments(ctx, bson.M{"_id": baseOID, "userId": oid})
		if count == 0 {
			_, _ = db.Persons.DeleteOne(ctx, bson.M{"_id": personID})
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad_basePersonId"})
			return
		}

		rel := models.Relationship{
			UserID:          oid,
			BasePersonID:    baseOID,
			RelatedPersonID: personID,
			RelationType:    req.RelationType,
			Line:            req.Line,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		_, _ = db.Relationships.InsertOne(ctx, rel)
	}

	c.JSON(http.StatusOK, person.ToClient())
}

func UpdatePerson(c *gin.Context) {
	personIDHex := c.Param("id")
	personOID, err := bson.ObjectIDFromHex(personIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_id"})
		return
	}

	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	var existing models.Person
	if err := db.Persons.FindOne(ctx, bson.M{"_id": personOID, "userId": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
		return
	}

	set := bson.M{"updatedAt": time.Now()}
	setStr := func(key, field string, def string) {
		if v, ok := body[key]; ok {
			if s, ok := v.(string); ok {
				set[field] = s
				return
			}
		}
		set[field] = def
	}
	setStr("lastName", "lastName", existing.LastName)
	setStr("firstName", "firstName", existing.FirstName)
	setStr("middleName", "middleName", existing.MiddleName)
	setStr("sex", "sex", existing.Sex)
	setStr("birthDate", "birthDate", existing.BirthDate)
	setStr("birthCity", "birthCity", existing.BirthCity)
	setStr("birthCityCustom", "birthCityCustom", existing.BirthCityCustom)
	setStr("phone", "phone", existing.Phone)
	setStr("deathDate", "deathDate", existing.DeathDate)
	setStr("burialPlace", "burialPlace", existing.BurialPlace)
	setStr("notes", "notes", existing.Notes)
	setStr("maidenName", "maidenName", existing.MaidenName)
	setStr("biography", "biography", existing.Biography)
	setStr("education", "education", existing.Education)
	setStr("workPath", "workPath", existing.WorkPath)
	setStr("militaryPath", "militaryPath", existing.MilitaryPath)

	if v, ok := body["externalLinks"]; ok {
		if v == nil {
			set["externalLinks"] = []models.ExternalLink{}
		} else {
			set["externalLinks"] = parseExternalLinks(v)
		}
	}

	if v, ok := body["alive"]; ok {
		if b, ok := v.(bool); ok {
			set["alive"] = b
		} else {
			set["alive"] = existing.Alive
		}
	} else {
		set["alive"] = existing.Alive
	}

	_, _ = db.Persons.UpdateOne(ctx, bson.M{"_id": personOID, "userId": oid}, bson.M{"$set": set})

	var updated models.Person
	_ = db.Persons.FindOne(ctx, bson.M{"_id": personOID, "userId": oid}).Decode(&updated)
	c.JSON(http.StatusOK, updated.ToClient())
}

func DeletePerson(c *gin.Context) {
	personIDHex := c.Param("id")
	personOID, err := bson.ObjectIDFromHex(personIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_id"})
		return
	}

	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	var existing models.Person
	if err := db.Persons.FindOne(ctx, bson.M{"_id": personOID, "userId": oid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	if existing.IsSelf {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_delete_self"})
		return
	}

	_, _ = db.Persons.DeleteOne(ctx, bson.M{"_id": personOID, "userId": oid})

	relFilter := bson.M{
		"userId": oid,
		"$or": bson.A{
			bson.M{"basePersonId": personOID},
			bson.M{"relatedPersonId": personOID},
		},
	}
	_, _ = db.Relationships.DeleteMany(ctx, relFilter)

	linkFilter := bson.M{
		"userId": oid,
		"$or": bson.A{
			bson.M{"personId": personOID},
			bson.M{"anchorPersonId": personOID},
		},
	}
	_, _ = db.ManualLinks.DeleteMany(ctx, linkFilter)
	_, _ = db.Positions.DeleteMany(ctx, bson.M{"userId": oid, "personId": personOID})

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func parseExternalLinks(v any) []models.ExternalLink {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]models.ExternalLink, 0, len(arr))
	for _, item := range arr {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		t, _ := m["title"].(string)
		u, _ := m["url"].(string)
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		out = append(out, models.ExternalLink{Title: strings.TrimSpace(t), URL: u})
	}
	return out
}
