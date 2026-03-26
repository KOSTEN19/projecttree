package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ExternalLink ссылка для биографии (напр. «Бессмертный полк»).
type ExternalLink struct {
	Title string `bson:"title" json:"title"`
	URL   string `bson:"url" json:"url"`
}

type Person struct {
	ID              bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          bson.ObjectID `bson:"userId" json:"userId"`
	IsSelf          bool          `bson:"isSelf" json:"isSelf"`
	IsPlaceholder   bool          `bson:"isPlaceholder" json:"isPlaceholder"`
	LastName        string        `bson:"lastName" json:"lastName"`
	MaidenName      string        `bson:"maidenName" json:"maidenName"`
	FirstName       string        `bson:"firstName" json:"firstName"`
	MiddleName      string        `bson:"middleName" json:"middleName"`
	Sex             string        `bson:"sex" json:"sex"`
	BirthDate       string        `bson:"birthDate" json:"birthDate"`
	BirthCity       string        `bson:"birthCity" json:"birthCity"`
	BirthCityCustom string        `bson:"birthCityCustom" json:"birthCityCustom"`
	Phone           string        `bson:"phone" json:"phone"`
	Alive           bool          `bson:"alive" json:"alive"`
	DeathDate       string        `bson:"deathDate" json:"deathDate"`
	BurialPlace     string        `bson:"burialPlace" json:"burialPlace"`
	Notes           string        `bson:"notes" json:"notes"`
	PhotoURL        string        `bson:"photoUrl" json:"photoUrl"`
	Biography       string        `bson:"biography" json:"biography"`
	Education       string        `bson:"education" json:"education"`
	WorkPath        string        `bson:"workPath" json:"workPath"`
	MilitaryPath    string        `bson:"militaryPath" json:"militaryPath"`
	ExternalLinks   []ExternalLink `bson:"externalLinks" json:"externalLinks"`
	CreatedAt       time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time     `bson:"updatedAt" json:"updatedAt"`
}

type PersonClient struct {
	ID              string `json:"id"`
	IsSelf          bool   `json:"isSelf"`
	IsPlaceholder   bool   `json:"isPlaceholder,omitempty"`
	LastName        string `json:"lastName"`
	MaidenName      string `json:"maidenName"`
	FirstName       string `json:"firstName"`
	MiddleName      string `json:"middleName"`
	Sex             string `json:"sex"`
	BirthDate       string `json:"birthDate"`
	BirthCity       string `json:"birthCity"`
	BirthCityCustom string `json:"birthCityCustom"`
	Phone           string `json:"phone"`
	Alive           bool   `json:"alive"`
	DeathDate       string `json:"deathDate"`
	BurialPlace     string `json:"burialPlace"`
	Notes           string `json:"notes"`
	PhotoURL        string `json:"photoUrl"`
	Biography       string `json:"biography"`
	Education       string `json:"education"`
	WorkPath        string `json:"workPath"`
	MilitaryPath    string `json:"militaryPath"`
	ExternalLinks   []ExternalLink `json:"externalLinks"`
}

func (p *Person) ToClient() PersonClient {
	return PersonClient{
		ID:              p.ID.Hex(),
		IsSelf:          p.IsSelf,
		IsPlaceholder:   p.IsPlaceholder,
		LastName:        p.LastName,
		MaidenName:      p.MaidenName,
		FirstName:       p.FirstName,
		MiddleName:      p.MiddleName,
		Sex:             p.Sex,
		BirthDate:       p.BirthDate,
		BirthCity:       p.BirthCity,
		BirthCityCustom: p.BirthCityCustom,
		Phone:           p.Phone,
		Alive:           p.Alive,
		DeathDate:       p.DeathDate,
		BurialPlace:     p.BurialPlace,
		Notes:           p.Notes,
		PhotoURL:        p.PhotoURL,
		Biography:       p.Biography,
		Education:       p.Education,
		WorkPath:        p.WorkPath,
		MilitaryPath:    p.MilitaryPath,
		ExternalLinks:   p.ExternalLinks,
	}
}
