package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID              bson.ObjectID `bson:"_id,omitempty" json:"id"`
	FirstName       string        `bson:"firstName" json:"firstName"`
	LastName        string        `bson:"lastName" json:"lastName"`
	Email           string        `bson:"email" json:"email"`
	Phone           string        `bson:"phone" json:"phone"`
	Login           string        `bson:"login" json:"login"`
	PasswordHash    string        `bson:"passwordHash" json:"-"`
	Sex             string        `bson:"sex" json:"sex"`
	BirthDate       string        `bson:"birthDate" json:"birthDate"`
	BirthCity       string        `bson:"birthCity" json:"birthCity"`
	BirthCityCustom string        `bson:"birthCityCustom" json:"birthCityCustom"`
	IsAdmin         bool          `bson:"isAdmin" json:"isAdmin"`
	CreatedAt       time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time     `bson:"updatedAt" json:"updatedAt"`
}

type UserClient struct {
	ID              string `json:"id"`
	FirstName       string `json:"firstName"`
	LastName        string `json:"lastName"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	Login           string `json:"login"`
	Sex             string `json:"sex"`
	BirthDate       string `json:"birthDate"`
	BirthCity       string `json:"birthCity"`
	BirthCityCustom string `json:"birthCityCustom"`
	IsAdmin         bool   `json:"isAdmin"`
}

func (u *User) ToClient() UserClient {
	return UserClient{
		ID:              u.ID.Hex(),
		FirstName:       u.FirstName,
		LastName:        u.LastName,
		Email:           u.Email,
		Phone:           u.Phone,
		Login:           u.Login,
		Sex:             u.Sex,
		BirthDate:       u.BirthDate,
		BirthCity:       u.BirthCity,
		BirthCityCustom: u.BirthCityCustom,
		IsAdmin:         u.IsAdmin,
	}
}
