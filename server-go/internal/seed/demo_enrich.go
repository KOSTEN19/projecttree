package seed

import (
	"context"
	"log"

	"project-drevo/internal/db"
	"project-drevo/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// demoPersonUpdate — полные тексты для демо-семьи (обновление при каждом старте seed для login=demo).
type demoPersonUpdate struct {
	IsSelf                          bool
	LastName, FirstName, BirthDate string
	PhotoURL                        string
	Notes                           string
	Biography                       string
	Education                       string
	WorkPath                        string
	MilitaryPath                    string
	Links                           []models.ExternalLink
}

var demoPersonUpdates = []demoPersonUpdate{
	{
		IsSelf:    true,
		BirthDate: "1995-03-12",
		PhotoURL:  "https://randomuser.me/api/portraits/men/32.jpg",
		Notes:     "Ведущий демо-аккаунт «Память России»: здесь собрана вымышленная, но связная история трёх поколений для преподавания и тестов.",
		Biography: "Алексей Иванов — инженер-программист, живёт в Москве. Увлекается генеалогией с университета: собрал оцифрованное древо, сканы документов и устные истории бабушки Елены. " +
			"Ведёт семейный архив в этом приложении, периодически дополняет карточки родственников и проверяет отображение на карте и в древе.",
		Education: "МГТУ им. Баумана, факультет информатики и систем управления (2013–2019). Курсы по документоведению и архивному делу (онлайн, 2021).",
		WorkPath:  "Стажировка в IT-интеграторе (2018–2019). Разработчик ПО в продуктовой компании (2019–н.в.), участие в внутренних корпоративных проектах с картами и графами.",
		MilitaryPath: "Военную службу не проходил (отсрочка по учёбе, затем категория запаса по состоянию здоровья).",
		Links: []models.ExternalLink{
			{Title: "Мемориал «Живая память» (пример ссылки)", URL: "https://www.example.com/memorial-demo"},
		},
	},
	{
		LastName: "Иванов", FirstName: "Сергей", BirthDate: "1968-07-22",
		PhotoURL: "https://randomuser.me/api/portraits/men/45.jpg",
		Notes: "Отец Алексея; после службы в армии работал на производстве, затем в логистике.",
		Biography: "Сергей Петрович родился в Москве в семье рабочего и учительницы. Детство прошло в спальном районе, летние каникулы — у бабушки в Туле у печи и в огороде. " +
			"Служил в ВС СССР, затем демобилизовался и устроился на завод. Любит рыбалку на даче и рассказы о деде Алексее Фёдоровиче, прошедшем войну.",
		Education: "Среднее специальное — техникум связи (1985–1988). Повышение квалификации по охране труда (2005).",
		WorkPath:  "Служба в армии (1986–1988). Наладчик оборудования на машиностроительном заводе (1988–2003). Специалист по снабжению в торговой сети (2003–н.в.).",
		MilitaryPath: "Срочная служба в пограничных войсках, без участия в боевых действиях.",
		Links:        []models.ExternalLink{{Title: "Бессмертный полк (демо)", URL: "https://www.example.com/immortal-demo"}},
	},
	{
		LastName: "Иванова", FirstName: "Елена", BirthDate: "1970-11-05",
		PhotoURL: "https://randomuser.me/api/portraits/women/44.jpg",
		Notes: "Мать Алексея; хранительница семейных фотографий и писем.",
		Biography: "Елена Николаевна выросла в Ленинграде, пережила лихие 1990-е вместе с родителями. Работала бухгалтером, потом перешла в образование — методист в детском центре. " +
			"Собирает предания о прадеде Фёдоре Смирнове и тётиных историях о Казани.",
		Education: "СПбГЭУ, заочное отделение, экономика и бухучёт (1992–1997). Курсы проектного менеджмента (2014).",
		WorkPath:  "Бухгалтер на комбинате (1990–1998). Главный бухгалтер в частной фирме (1998–2008). Методист и администратор учебного центра (2008–н.в.).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Иванов", FirstName: "Пётр", BirthDate: "1940-02-18",
		PhotoURL: "https://randomuser.me/api/portraits/men/70.jpg",
		Notes: "Дед по отцу; ветеран труда, почётный донор.",
		Biography: "Пётр Алексеевич прошёл всю жизнь от слесарного ученика до мастера участка. Участвовал в строительстве объектов в 1960–70-х, много ездил в командировки по РСФСР. " +
			"После пенсии занимался огородом и внуками; оставил толстую папку с чертежами и открытками из командировок.",
		Education: "Вечернее отделение техникума, машиностроение (1962–1966).",
		WorkPath:  "Слесарь, мастер, начальник участка на заводе (1957–2000).",
		MilitaryPath: "Не призывался по состоянию здоровья в юности; трудовой резерв в годы напряжённости.",
		Links:        []models.ExternalLink{{Title: "Герои страны (пример)", URL: "https://www.example.com/heroes-demo"}},
	},
	{
		LastName: "Иванова", FirstName: "Мария", BirthDate: "1942-06-30",
		PhotoURL: "https://randomuser.me/api/portraits/women/68.jpg",
		Notes: "Бабушка по отцу; учитель начальных классов.",
		Biography: "Мария Ивановна родилась под Воронежом, детство — эвакуация и возвращение. Всю жизнь преподавала в школе, собирала детские рисунки и классные журналы. " +
			"Передавала Алексею семейные имена и даты.",
		Education: "Воронежский пединститут, начальные классы (1959–1964).",
		WorkPath:  "Учительница в сельской и городской школе (1964–1997).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Смирнова", FirstName: "Анна", BirthDate: "1943-08-12",
		PhotoURL: "https://randomuser.me/api/portraits/women/72.jpg",
		Notes: "Бабушка по матери; из казанской семьи.",
		Biography: "Анна Фёдоровна знала татарский и русский, работала библиотекарем. Любила народные песни и хранила письма от отца Николая с фронта (копии в семейном архиве).",
		Education: "Казанский государственный университет, филология (неоконченное, перевод на заочное; диплом 1968).",
		WorkPath:  "Библиотекарь детской библиотеки (1965–1998).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Смирнов", FirstName: "Николай", BirthDate: "1938-12-01",
		PhotoURL: "https://randomuser.me/api/portraits/men/73.jpg",
		Notes: "Дед по матери; инженер-железнодорожник.",
		Biography: "Николай Васильевич прошёл Самару, Ташкент и обратно, строил и ремонтировал инфраструктуру. Мало говорил о войне, больше — о послевоенном восстановлении.",
		Education: "Самарский институт инженеров железнодорожного транспорта (1956–1961).",
		WorkPath:  "Инженер, начальник отдела на дороге (1961–1998).",
		MilitaryPath: "Служба в тыловых частях, ремонт путей (кратковременный призыв в юности).",
		Links:        nil,
	},
	{
		LastName: "Иванова", FirstName: "Ольга", BirthDate: "1997-09-28",
		PhotoURL: "https://randomuser.me/api/portraits/women/31.jpg",
		Notes: "Сестра Алексея; дизайнер.",
		Biography: "Ольга Сергеевна училась в Москве, работает в сфере визуальных коммуникаций. Помогает оформлять семейный фотоальбом и сайт-визитку к юбилею деда Петра.",
		Education: "Британская высшая школа дизайна (2015–2019).",
		WorkPath:  "Фриланс, затем штатный дизайнер в студии (2019–н.в.).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Иванов", FirstName: "Дмитрий", BirthDate: "2001-04-14",
		PhotoURL: "https://randomuser.me/api/portraits/men/21.jpg",
		Notes: "Брат Алексея; студент-математик.",
		Biography: "Дмитрий Сергеевич увлекается спортом и олимпиадами. Ведёт генеалогическое древо вместе с братом как учебный проект.",
		Education: "МГУ, мехмат (2019–н.в.).",
		WorkPath:  "Репетиторство, летняя стажировка в аналитике (2023).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Петрова", FirstName: "Анастасия", BirthDate: "1996-01-20",
		PhotoURL: "https://randomuser.me/api/portraits/women/29.jpg",
		Notes: "Супруга Алексея; врач-ординатор.",
		Biography: "Анастасия Викторовна переехала из Екатеринбурга после мединститута. Поддерживает идею цифрового архива семьи и согласовывает медицинские формулировки в старых справках.",
		Education: "УГМУ, педиатрия (2013–2019). Ординатура в Москве (2019–2021).",
		WorkPath:  "Участковый педиатр в поликлинике (2021–н.в.).",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Иванов", FirstName: "Артём", BirthDate: "2020-08-05",
		PhotoURL: "https://randomuser.me/api/portraits/boys/8.jpg",
		Notes: "Сын Алексея и Анастасии.",
		Biography: "Младший член семьи; в демо-данных — чтобы показать детей в древе и поля возраста.",
		Education: "Детский сад (2023–н.в.).",
		WorkPath:  "",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Иванова", FirstName: "София", BirthDate: "2023-02-14",
		PhotoURL: "https://randomuser.me/api/portraits/girls/7.jpg",
		Notes: "Дочь Алексея и Анастасии.",
		Biography: "Самый младший ребёнок в вымышленной семье Ивановых для демонстрации интерфейса.",
		Education: "",
		WorkPath:  "",
		MilitaryPath: "",
		Links:        nil,
	},
	{
		LastName: "Иванов", FirstName: "Андрей", BirthDate: "1965-05-30",
		PhotoURL: "https://randomuser.me/api/portraits/men/52.jpg",
		Notes: "Дядя Алексея; брат Сергея.",
		Biography: "Андрей Петрович живёт в Краснодаре, работает в агрохолдинге. Редко видится с московской веткой, но присылает фото кузенов.",
		Education: "КубГАУ, агрономия (1982–1987). MBA (заочно, 2010).",
		WorkPath:  "Агроном, затем коммерческий директор регионального холдинга (1987–н.в.).",
		MilitaryPath: "Альтернативная гражданская служба (кратко, в 1990-х).",
		Links:        nil,
	},
	{
		LastName: "Козлова", FirstName: "Татьяна", BirthDate: "1975-03-18",
		PhotoURL: "https://randomuser.me/api/portraits/women/48.jpg",
		Notes: "Тётя Алексея; сестра Елены.",
		Biography: "Татьяна Николаевна — журналист регионального телеканала в Ростове. Писала материалы о местных музеях и ветеранах.",
		Education: "ЮФУ, журналистика (1992–1997).",
		WorkPath:  "Корреспондент, редактор выпуска (1997–н.в.).",
		MilitaryPath: "",
		Links:        []models.ExternalLink{{Title: "Ростовский краеведческий (демо)", URL: "https://www.example.com/rostov-museum-demo"}},
	},
	{
		LastName: "Иванов", FirstName: "Алексей", BirthDate: "1915-10-07",
		PhotoURL: "https://randomuser.me/api/portraits/men/79.jpg",
		Notes: "Прадед Алексея; ФИО совпадает с правнуком — различайте по дате рождения.",
		Biography: "Алексей Фёдорович родился в Тверской губернии, пережил коллективизацию и войну. Работал бригадиром на стройке, награждён медалями за труд. " +
			"Похоронен в Туле рядом с женой.",
		Education: "Начальное, курсы счетоводов при райкоме (1948).",
		WorkPath:  "Колхоз, стройка, бригадир смежного участка (1938–1975).",
		MilitaryPath: "Великая Отечественная: пехота, ранение, госпиталь, инвалидность III группы.",
		Links:        []models.ExternalLink{{Title: "ОБД «Мемориал» (демо)", URL: "https://www.example.com/obd-demo"}},
	},
	{
		LastName: "Смирнов", FirstName: "Фёдор", BirthDate: "1910-03-15",
		PhotoURL: "https://randomuser.me/api/portraits/men/82.jpg",
		Notes: "Прадед по материнской линии.",
		Biography: "Фёдор Григорьевич — сибиряк, пережил репрессии в семье (реабилитация посмертно в 1990-х). Работал на транспорте.",
		Education: "Семилетка, железнодорожные курсы (1932).",
		WorkPath:  "Дежурный по депо, диспетчер участка (1928–1965).",
		MilitaryPath: "Эвакуационные поезда, тыл (1941–1943), перевод в интендантскую службу.",
		Links:        nil,
	},
	{
		LastName: "Петров", FirstName: "Виктор", BirthDate: "1970-09-12",
		PhotoURL: "https://randomuser.me/api/portraits/men/55.jpg",
		Notes: "Отец Анастасии; тесть Алексея в демо-сюжете.",
		Biography: "Виктор Иванович — инженер-химик из Перми, любит горные лыжи и историю Урала.",
		Education: "ПГНИУ, химия (1987–1992).",
		WorkPath:  "НИИ, затем производство полимеров (1992–н.в.).",
		MilitaryPath: "Армия не служил (бронь по специальности в 1990-х).",
		Links:        nil,
	},
	{
		LastName: "Петрова", FirstName: "Людмила", BirthDate: "1972-04-25",
		PhotoURL: "https://randomuser.me/api/portraits/women/53.jpg",
		Notes: "Мать Анастасии.",
		Biography: "Людмила Александровна — преподаватель музыки, переехала с мужем в Москву ближе к дочери.",
		Education: "Уфимская государственная академия искусств (1989–1994).",
		WorkPath:  "Школа искусств, частная студия (1994–н.в.).",
		MilitaryPath: "",
		Links:        nil,
	},
}

// EnrichDemoPersons записывает развёрнутые поля во все карточки демо-пользователя (и при первом создании, и при уже существующем аккаунте).
func EnrichDemoPersons(ctx context.Context, userID bson.ObjectID) {
	n := 0
	for _, u := range demoPersonUpdates {
		var filter bson.M
		if u.IsSelf {
			filter = bson.M{"userId": userID, "isSelf": true}
		} else {
			filter = bson.M{
				"userId": userID, "lastName": u.LastName, "firstName": u.FirstName, "birthDate": u.BirthDate,
			}
		}
		links := u.Links
		if links == nil {
			links = []models.ExternalLink{}
		}
		set := bson.M{
			"notes": u.Notes, "biography": u.Biography, "education": u.Education,
			"workPath": u.WorkPath, "militaryPath": u.MilitaryPath, "externalLinks": links,
		}
		if u.PhotoURL != "" {
			set["photoUrl"] = u.PhotoURL
		}
		res, err := db.Persons.UpdateOne(ctx, filter, bson.M{"$set": set})
		if err != nil {
			log.Printf("[seed] enrich demo person %+v: %v", filter, err)
			continue
		}
		if res.ModifiedCount > 0 || res.MatchedCount > 0 {
			n++
		}
	}
	log.Printf("[seed] demo persons enriched: %d updates applied (userId=%s)", n, userID.Hex())
}
