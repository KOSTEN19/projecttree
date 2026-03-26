package services

import "strings"

type City struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
}

var Cities = []City{
	{Name: "Москва", Lat: 55.7558, Lon: 37.6173},
	{Name: "Санкт-Петербург", Lat: 59.9311, Lon: 30.3609},
	{Name: "Казань", Lat: 55.7961, Lon: 49.1064},
	{Name: "Екатеринбург", Lat: 56.8389, Lon: 60.6057},
	{Name: "Новосибирск", Lat: 55.0084, Lon: 82.9357},
	{Name: "Самара", Lat: 53.1959, Lon: 50.1008},
	{Name: "Ростов-на-Дону", Lat: 47.2357, Lon: 39.7015},
	{Name: "Краснодар", Lat: 45.0355, Lon: 38.9753},
	{Name: "Воронеж", Lat: 51.6755, Lon: 39.2089},
	{Name: "Пермь", Lat: 58.0105, Lon: 56.2502},
	{Name: "Уфа", Lat: 54.7388, Lon: 55.9721},
	{Name: "Тула", Lat: 54.1930, Lon: 37.6177},
	{Name: "Тверь", Lat: 56.8587, Lon: 35.9176},
}

func CityByName(name string) *City {
	if name == "" {
		return nil
	}
	n := strings.ToLower(strings.TrimSpace(name))
	for i := range Cities {
		if strings.ToLower(Cities[i].Name) == n {
			return &Cities[i]
		}
	}
	return nil
}
