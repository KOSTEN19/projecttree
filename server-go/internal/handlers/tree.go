package handlers

import (
	"net/http"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/models"
	"project-drevo/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/sync/errgroup"
)

func GetTree(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	filter := bson.M{"userId": oid}

	var persons []models.Person
	var relationships []models.Relationship
	var manualLinks []models.ManualLink
	var positions []models.Position

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		cur, err := db.Persons.Find(gctx, filter)
		if err != nil {
			return err
		}
		return cur.All(gctx, &persons)
	})
	g.Go(func() error {
		cur, err := db.Relationships.Find(gctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
		if err != nil {
			return err
		}
		return cur.All(gctx, &relationships)
	})
	g.Go(func() error {
		cur, err := db.ManualLinks.Find(gctx, filter)
		if err != nil {
			return err
		}
		return cur.All(gctx, &manualLinks)
	})
	g.Go(func() error {
		cur, err := db.Positions.Find(gctx, filter)
		if err != nil {
			return err
		}
		return cur.All(gctx, &positions)
	})
	if err := g.Wait(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	var mePersonID string
	for _, p := range persons {
		if p.IsSelf {
			mePersonID = p.ID.Hex()
			break
		}
	}

	people := make([]models.PersonClient, 0, len(persons))
	for _, p := range persons {
		people = append(people, p.ToClient())
	}

	rels := make([]models.RelationshipClient, 0, len(relationships))
	for _, r := range relationships {
		rels = append(rels, r.ToClient())
	}

	built := services.BuildTree(persons, relationships, manualLinks, positions)

	c.JSON(http.StatusOK, gin.H{
		"mePersonId":    mePersonID,
		"people":        people,
		"relationships": rels,
		"built":         built,
	})
}

func SavePosition(c *gin.Context) {
	var req struct {
		PersonID string  `json:"personId"`
		DX       float64 `json:"dx"`
		DY       float64 `json:"dy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.PersonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "personId_required"})
		return
	}

	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	personOID, err := bson.ObjectIDFromHex(req.PersonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_personId"})
		return
	}

	now := time.Now()
	f := bson.M{"userId": oid, "personId": personOID}
	update := bson.M{
		"$set": bson.M{
			"dx":        req.DX,
			"dy":        req.DY,
			"updatedAt": now,
		},
		"$setOnInsert": bson.M{
			"userId":    oid,
			"personId":  personOID,
			"createdAt": now,
		},
	}
	_, _ = db.Positions.UpdateOne(ctx, f, update, options.UpdateOne().SetUpsert(true))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func ManualAttach(c *gin.Context) {
	var req struct {
		PersonID string `json:"personId"`
		AnchorID string `json:"anchorId"`
		Mode     string `json:"mode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
		return
	}
	if req.PersonID == "" || req.AnchorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_request"})
		return
	}
	if req.Mode != "parent" && req.Mode != "child" && req.Mode != "spouse" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_mode"})
		return
	}

	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	personOID, _ := bson.ObjectIDFromHex(req.PersonID)
	anchorOID, _ := bson.ObjectIDFromHex(req.AnchorID)
	now := time.Now()

	ml := models.ManualLink{
		UserID:         oid,
		PersonID:       personOID,
		AnchorPersonID: anchorOID,
		Mode:           req.Mode,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_, _ = db.ManualLinks.InsertOne(ctx, ml)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
