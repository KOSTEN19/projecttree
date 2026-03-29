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
	"golang.org/x/crypto/bcrypt"
)

const demoLogin = "demo"
// DemoPassword — единый пароль для демо-аккаунта (см. Login.jsx / LoginPage.tsx).
const DemoPassword = "demo123"

type rel struct {
	from    int // -1 = self
	to      int
	relType string
	line    string
}

func RunDemoSeed() {
	ctx := context.Background()

	now := time.Now()
	hash, err := bcrypt.GenerateFromPassword([]byte(DemoPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[seed] bcrypt demo password: %v", err)
		return
	}
	hashStr := string(hash)

	var existing models.User
	err = db.Users.FindOne(ctx, bson.M{"login": demoLogin}).Decode(&existing)
	if err == nil {
		// Пользователь demo уже есть — пароль и развёрнутые карточки семьи.
		_, uerr := db.Users.UpdateOne(ctx, bson.M{"login": demoLogin}, bson.M{
			"$set": bson.M{
				"passwordHash": hashStr,
				"updatedAt":    now,
			},
		})
		if uerr != nil {
			log.Printf("[seed] failed to refresh demo password: %v", uerr)
		} else {
			log.Printf("[seed] demo user exists (id=%s), password hash refreshed", existing.ID.Hex())
		}
		EnrichDemoPersons(ctx, existing.ID)
		EnsureDemoSpouseRels(ctx, existing.ID)
		return
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		log.Printf("[seed] find demo user: %v", err)
		return
	}

	log.Println("[seed] creating demo user and family data...")

	user := models.User{
		FirstName:    "Алексей",
		LastName:     "Иванов",
		Email:        "demo@example.com",
		Phone:        "+7 999 000-00-00",
		Login:        demoLogin,
		PasswordHash: hashStr,
		Sex:          "M",
		BirthDate:    "1995-03-12",
		BirthCity:    "Москва",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	res, err := db.Users.InsertOne(ctx, user)
	if err != nil {
		log.Printf("[seed] failed to create demo user: %v", err)
		return
	}
	userID := res.InsertedID.(bson.ObjectID)

	selfID := bson.NewObjectID()
	selfPerson := models.Person{
		ID:        selfID,
		UserID:    userID,
		IsSelf:    true,
		LastName:  "Иванов",
		FirstName: "Алексей",
		Sex:       "M",
		BirthDate: "1995-03-12",
		BirthCity: "Москва",
		Alive:     true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := db.Persons.InsertOne(ctx, selfPerson); err != nil {
		log.Printf("[seed] failed to create self person: %v", err)
		return
	}

	type p = models.Person
	family := []p{
		/*  0 */ {LastName: "Иванов", FirstName: "Сергей", MiddleName: "Петрович", Sex: "M", BirthDate: "1968-07-22", BirthCity: "Москва", Alive: true},
		/*  1 */ {LastName: "Иванова", FirstName: "Елена", MiddleName: "Николаевна", Sex: "F", BirthDate: "1970-11-05", BirthCity: "Санкт-Петербург", Alive: true},
		/*  2 */ {LastName: "Иванов", FirstName: "Пётр", MiddleName: "Алексеевич", Sex: "M", BirthDate: "1940-02-18", BirthCity: "Тула", Alive: false, DeathDate: "2015-09-10", BurialPlace: "Москва"},
		/*  3 */ {LastName: "Иванова", FirstName: "Мария", MiddleName: "Ивановна", Sex: "F", BirthDate: "1942-06-30", BirthCity: "Воронеж", Alive: false, DeathDate: "2020-01-15", BurialPlace: "Москва"},
		/*  4 */ {LastName: "Смирнова", FirstName: "Анна", MiddleName: "Фёдоровна", Sex: "F", BirthDate: "1943-08-12", BirthCity: "Казань", Alive: false, DeathDate: "2018-05-20", BurialPlace: "Санкт-Петербург"},
		/*  5 */ {LastName: "Смирнов", FirstName: "Николай", MiddleName: "Васильевич", Sex: "M", BirthDate: "1938-12-01", BirthCity: "Самара", Alive: false, DeathDate: "2010-03-08", BurialPlace: "Самара"},
		/*  6 */ {LastName: "Иванова", FirstName: "Ольга", MiddleName: "Сергеевна", Sex: "F", BirthDate: "1997-09-28", BirthCity: "Москва", Alive: true},
		/*  7 */ {LastName: "Иванов", FirstName: "Дмитрий", MiddleName: "Сергеевич", Sex: "M", BirthDate: "2001-04-14", BirthCity: "Москва", Alive: true},
		/*  8 */ {LastName: "Петрова", FirstName: "Анастасия", MiddleName: "Викторовна", Sex: "F", BirthDate: "1996-01-20", BirthCity: "Екатеринбург", Alive: true},
		/*  9 */ {LastName: "Иванов", FirstName: "Артём", MiddleName: "Алексеевич", Sex: "M", BirthDate: "2020-08-05", BirthCity: "Москва", Alive: true},
		/* 10 */ {LastName: "Иванова", FirstName: "София", MiddleName: "Алексеевна", Sex: "F", BirthDate: "2023-02-14", BirthCity: "Москва", Alive: true},
		/* 11 */ {LastName: "Иванов", FirstName: "Андрей", MiddleName: "Петрович", Sex: "M", BirthDate: "1965-05-30", BirthCity: "Краснодар", Alive: true},
		/* 12 */ {LastName: "Козлова", FirstName: "Татьяна", MiddleName: "Николаевна", Sex: "F", BirthDate: "1975-03-18", BirthCity: "Ростов-на-Дону", Alive: true},
		/* 13 */ {LastName: "Иванов", FirstName: "Алексей", MiddleName: "Фёдорович", Sex: "M", BirthDate: "1915-10-07", BirthCity: "Тверь", Alive: false, DeathDate: "1990-04-20", BurialPlace: "Тула"},
		/* 14 */ {LastName: "Смирнов", FirstName: "Фёдор", MiddleName: "Григорьевич", Sex: "M", BirthDate: "1910-03-15", BirthCity: "Новосибирск", Alive: false, DeathDate: "1985-11-22", BurialPlace: "Новосибирск"},
		/* 15 */ {LastName: "Петров", FirstName: "Виктор", MiddleName: "Иванович", Sex: "M", BirthDate: "1970-09-12", BirthCity: "Пермь", Alive: true},
		/* 16 */ {LastName: "Петрова", FirstName: "Людмила", MiddleName: "Александровна", Sex: "F", BirthDate: "1972-04-25", BirthCity: "Уфа", Alive: true},
	}

	ids := make([]bson.ObjectID, len(family))
	var docs []interface{}
	for i := range family {
		ids[i] = bson.NewObjectID()
		family[i].ID = ids[i]
		family[i].UserID = userID
		family[i].CreatedAt = now
		family[i].UpdatedAt = now
		docs = append(docs, family[i])
	}

	if _, err := db.Persons.InsertMany(ctx, docs); err != nil {
		log.Printf("[seed] failed to insert persons: %v", err)
		return
	}

	rels := []rel{
		{from: -1, to: 0, relType: "отец", line: "male"},
		{from: -1, to: 1, relType: "мать", line: "female"},
		{from: 0, to: 2, relType: "отец", line: "male"},
		{from: 0, to: 3, relType: "мать", line: "female"},
		{from: 1, to: 4, relType: "мать", line: "female"},
		{from: 1, to: 5, relType: "отец", line: "male"},
		{from: 0, to: 1, relType: "жена", line: ""},
		{from: 2, to: 3, relType: "жена", line: ""},
		{from: 5, to: 4, relType: "жена", line: ""},
		{from: -1, to: 6, relType: "сестра", line: ""},
		{from: -1, to: 7, relType: "брат", line: ""},
		{from: -1, to: 8, relType: "жена", line: ""},
		{from: -1, to: 9, relType: "сын", line: ""},
		{from: -1, to: 10, relType: "дочь", line: ""},
		{from: -1, to: 11, relType: "дядя", line: "male"},
		{from: -1, to: 12, relType: "тётя", line: "female"},
		{from: 2, to: 13, relType: "отец", line: "male"},
		{from: 5, to: 14, relType: "отец", line: "male"},
	}

	var relDocs []interface{}
	for _, r := range rels {
		baseID := selfID
		if r.from >= 0 {
			baseID = ids[r.from]
		}
		relDocs = append(relDocs, models.Relationship{
			UserID:          userID,
			BasePersonID:    baseID,
			RelatedPersonID: ids[r.to],
			RelationType:    r.relType,
			Line:            r.line,
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}

	if _, err := db.Relationships.InsertMany(ctx, relDocs); err != nil {
		log.Printf("[seed] failed to insert relationships: %v", err)
		return
	}

	EnrichDemoPersons(ctx, userID)
	EnsureDemoSpouseRels(ctx, userID)

	log.Printf("[seed] done: demo user created, %d persons, %d relationships", len(family)+1, len(rels))
}
