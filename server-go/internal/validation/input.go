package validation

import (
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"project-drevo/internal/models"
)

const (
	maxNameRunes    = 120
	maxLoginLen     = 32
	minLoginLen     = 3
	minPasswordLen  = 8
	maxNotesRunes   = 20000
	maxShortField   = 500
	maxExternalURLs = 24
)

var (
	loginRe     = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	phoneChars  = regexp.MustCompile(`^[0-9+()\s.\-]*$`)
	isoDateRe   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	controlReplacer = strings.NewReplacer("\x00", "", "\r", " ", "\n", " ")
)

// Err returns a validation error with a Russian message for API clients.
func Err(msg string) error {
	return errors.New(msg)
}

func countDigits(s string) int {
	n := 0
	for _, r := range s {
		if unicode.IsDigit(r) {
			n++
		}
	}
	return n
}

// Phone allows empty or international-style numbers: digits and + ( ) space . -
// No letters. If non-empty, require 10–15 digits.
func Phone(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if !phoneChars.MatchString(s) {
		return Err("Телефон может содержать только цифры и символы + ( ) - пробел.")
	}
	d := countDigits(s)
	if d < 10 {
		return Err("Телефон: укажите не менее 10 цифр или оставьте поле пустым.")
	}
	if d > 15 {
		return Err("Телефон: слишком много цифр (не более 15).")
	}
	return nil
}

// EmailOptional empty ok; otherwise RFC-ish via net/mail.
func EmailOptional(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if _, err := mail.ParseAddress(s); err != nil {
		return Err("Некорректный адрес электронной почты.")
	}
	return nil
}

// Login ASCII identifier.
func Login(s string) error {
	s = strings.TrimSpace(s)
	if len(s) < minLoginLen || len(s) > maxLoginLen {
		return fmt.Errorf("Логин: от %d до %d символов (латиница, цифры, _ . -).", minLoginLen, maxLoginLen)
	}
	if !loginRe.MatchString(s) {
		return Err("Логин: только латинские буквы, цифры и символы _ . -")
	}
	return nil
}

// Password register rule.
func PasswordRegister(s string) error {
	if len(s) < minPasswordLen {
		return fmt.Errorf("Пароль: не менее %d символов.", minPasswordLen)
	}
	return nil
}

// Sex empty, M, or F.
func Sex(s string) error {
	s = strings.TrimSpace(s)
	switch s {
	case "", "M", "F":
		return nil
	default:
		return Err("Пол: выберите значение из списка или оставьте пустым.")
	}
}

// PersonName trims and checks length; allows letters including Cyrillic and common punctuation.
func PersonName(label, s string, required bool) error {
	s = strings.TrimSpace(controlReplacer.Replace(s))
	if required && s == "" {
		return fmt.Errorf("%s: обязательное поле.", label)
	}
	if utf8.RuneCountInString(s) > maxNameRunes {
		return fmt.Errorf("%s: не более %d символов.", label, maxNameRunes)
	}
	for _, r := range s {
		if unicode.IsControl(r) {
			return fmt.Errorf("%s: недопустимые символы.", label)
		}
	}
	return nil
}

// ISODateOptional YYYY-MM-DD or empty.
func ISODateOptional(label, s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if !isoDateRe.MatchString(s) {
		return fmt.Errorf("%s: укажите дату в формате ГГГГ-ММ-ДД.", label)
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return fmt.Errorf("%s: некорректная дата.", label)
	}
	return nil
}

// LongText optional notes-like fields.
func LongText(label, s string, maxRunes int) error {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) > maxRunes {
		return fmt.Errorf("%s: слишком длинный текст (не более %d символов).", label, maxRunes)
	}
	return nil
}

// HTTPURL optional absolute http(s) URL.
func HTTPURL(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	u, err := url.Parse(s)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return Err("Ссылка должна начинаться с http:// или https://.")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return Err("Разрешены только ссылки http и https.")
	}
	return nil
}

// RegisterPayload validates registration request.
func RegisterPayload(firstName, lastName, email, phone, login, password string) error {
	if err := PersonName("Имя", firstName, false); err != nil {
		return err
	}
	if err := PersonName("Фамилия", lastName, false); err != nil {
		return err
	}
	if err := EmailOptional(email); err != nil {
		return err
	}
	if err := Phone(phone); err != nil {
		return err
	}
	if err := Login(login); err != nil {
		return err
	}
	if err := PasswordRegister(password); err != nil {
		return err
	}
	return nil
}

// ProfilePayload validates user profile update.
func ProfilePayload(firstName, lastName, email, phone, login, sex, birthDate, birthCity, birthCityCustom string) error {
	if err := PersonName("Имя", firstName, true); err != nil {
		return err
	}
	if err := PersonName("Фамилия", lastName, true); err != nil {
		return err
	}
	if err := EmailOptional(email); err != nil {
		return err
	}
	if err := Phone(phone); err != nil {
		return err
	}
	if err := Login(login); err != nil {
		return err
	}
	if err := Sex(sex); err != nil {
		return err
	}
	if err := ISODateOptional("Дата рождения", birthDate); err != nil {
		return err
	}
	if err := PersonName("Город (список)", birthCity, false); err != nil {
		return err
	}
	if err := LongText("Город (вручную)", birthCityCustom, maxShortField); err != nil {
		return err
	}
	return nil
}

// CreatePersonInput mirrors create-person JSON for validation.
type CreatePersonInput struct {
	LastName, MaidenName, FirstName, MiddleName string
	Sex, BirthDate, BirthCity, BirthCityCustom  string
	Phone                                       string
	DeathDate, BurialPlace                      string
	Notes, Biography, Education                 string
	WorkPath, MilitaryPath                      string
	RelationType, Line                          string
}

// CreatePersonPayload validates new relative / person.
func CreatePersonPayload(req CreatePersonInput) error {
	if err := PersonName("Фамилия", req.LastName, true); err != nil {
		return err
	}
	if err := PersonName("Имя", req.FirstName, true); err != nil {
		return err
	}
	if err := PersonName("Отчество", req.MiddleName, false); err != nil {
		return err
	}
	if err := PersonName("Девичья фамилия", req.MaidenName, false); err != nil {
		return err
	}
	if err := Sex(req.Sex); err != nil {
		return err
	}
	if err := ISODateOptional("Дата рождения", req.BirthDate); err != nil {
		return err
	}
	if err := PersonName("Город (список)", req.BirthCity, false); err != nil {
		return err
	}
	if err := LongText("Город (вручную)", req.BirthCityCustom, maxShortField); err != nil {
		return err
	}
	if err := Phone(req.Phone); err != nil {
		return err
	}
	if err := ISODateOptional("Дата смерти", req.DeathDate); err != nil {
		return err
	}
	if err := LongText("Место захоронения", req.BurialPlace, maxShortField); err != nil {
		return err
	}
	if err := LongText("Заметки", req.Notes, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Биография", req.Biography, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Образование", req.Education, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Трудовой путь", req.WorkPath, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Военная служба", req.MilitaryPath, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Тип связи", req.RelationType, 64); err != nil {
		return err
	}
	if err := LongText("Линия", req.Line, 64); err != nil {
		return err
	}
	return nil
}

// ExternalLinks checks count and each URL.
func ExternalLinks(links []models.ExternalLink) error {
	if len(links) > maxExternalURLs {
		return fmt.Errorf("Не более %d внешних ссылок.", maxExternalURLs)
	}
	for i, l := range links {
		if err := HTTPURL(l.URL); err != nil {
			return fmt.Errorf("Ссылка %d: %s", i+1, err.Error())
		}
		if utf8.RuneCountInString(l.Title) > 200 {
			return fmt.Errorf("Название ссылки %d: слишком длинное.", i+1)
		}
	}
	return nil
}

// PersonState is a flattened view after merge for update validation.
type PersonState struct {
	LastName, MaidenName, FirstName, MiddleName string
	Sex, BirthDate, BirthCity, BirthCityCustom  string
	Phone, DeathDate, BurialPlace               string
	Notes, Biography, Education                 string
	WorkPath, MilitaryPath                      string
}

// ValidatePersonState validates merged person fields (update).
func ValidatePersonState(p PersonState) error {
	if err := PersonName("Фамилия", p.LastName, true); err != nil {
		return err
	}
	if err := PersonName("Имя", p.FirstName, true); err != nil {
		return err
	}
	if err := PersonName("Отчество", p.MiddleName, false); err != nil {
		return err
	}
	if err := PersonName("Девичья фамилия", p.MaidenName, false); err != nil {
		return err
	}
	if err := Sex(p.Sex); err != nil {
		return err
	}
	if err := ISODateOptional("Дата рождения", p.BirthDate); err != nil {
		return err
	}
	if err := PersonName("Город (список)", p.BirthCity, false); err != nil {
		return err
	}
	if err := LongText("Город (вручную)", p.BirthCityCustom, maxShortField); err != nil {
		return err
	}
	if err := Phone(p.Phone); err != nil {
		return err
	}
	if err := ISODateOptional("Дата смерти", p.DeathDate); err != nil {
		return err
	}
	if err := LongText("Место захоронения", p.BurialPlace, maxShortField); err != nil {
		return err
	}
	if err := LongText("Заметки", p.Notes, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Биография", p.Biography, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Образование", p.Education, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Трудовой путь", p.WorkPath, maxNotesRunes); err != nil {
		return err
	}
	if err := LongText("Военная служба", p.MilitaryPath, maxNotesRunes); err != nil {
		return err
	}
	return nil
}

// MarriageRelation validates strict M-F marriage constraints for relationType муж/жена.
func MarriageRelation(relationType, baseSex, relatedSex string) error {
	t := strings.ToLower(strings.TrimSpace(relationType))
	if t != "муж" && t != "жена" {
		return nil
	}
	base := strings.TrimSpace(baseSex)
	related := strings.TrimSpace(relatedSex)
	if base == "" || related == "" {
		return Err("Для брака у обоих людей должен быть указан пол (M/F).")
	}
	if base == related {
		return Err("Брак допускается только между мужчиной и женщиной.")
	}
	if t == "муж" {
		if base != "F" || related != "M" {
			return Err("Связь «муж» требует: базовый человек — женщина, добавляемый человек — мужчина.")
		}
		return nil
	}
	if base != "M" || related != "F" {
		return Err("Связь «жена» требует: базовый человек — мужчина, добавляемый человек — женщина.")
	}
	return nil
}
