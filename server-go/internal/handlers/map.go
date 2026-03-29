package handlers

import (
	"net/http"

	"project-drevo/internal/db"
	"project-drevo/internal/models"
	"project-drevo/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type mapMarker struct {
	Lat    float64             `json:"lat"`
	Lon    float64             `json:"lon"`
	Label  string              `json:"label"`
	Person models.PersonClient `json:"person"`
}

func personsToMarkers(persons []models.Person, filter string) []mapMarker {
	markers := make([]mapMarker, 0, len(persons))
	for _, p := range persons {
		if filter == "birth" {
			label, city := services.BirthCityCoordsForMap(p.BirthCity, p.BirthCityCustom)
			if city == nil {
				continue
			}
			markers = append(markers, mapMarker{Lat: city.Lat, Lon: city.Lon, Label: label, Person: p.ToClient()})
		} else {
			if p.Alive {
				continue
			}
			city := services.CityByName(p.BurialPlace)
			if city == nil {
				continue
			}
			markers = append(markers, mapMarker{Lat: city.Lat, Lon: city.Lon, Label: p.BurialPlace, Person: p.ToClient()})
		}
	}
	return markers
}

func GetMap(c *gin.Context) {
	ctx := reqCtx(c)
	oid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}
	filter := c.DefaultQuery("filter", "birth")

	cursor, err := db.Persons.Find(ctx, bson.M{"userId": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	var persons []models.Person
	if err := cursor.All(ctx, &persons); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"filter": filter, "markers": personsToMarkers(persons, filter)})
}

func GetMapAll(c *gin.Context) {
	ctx := reqCtx(c)
	filter := c.DefaultQuery("filter", "birth")

	cursor, err := db.Persons.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	var persons []models.Person
	if err := cursor.All(ctx, &persons); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"filter": filter, "markers": personsToMarkers(persons, filter)})
}
