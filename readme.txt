# Project Drevo (Проект Древо)

Веб-приложение для ведения семейного профиля, добавления родственников, построения генеалогического древа и отображения точек на карте России.  
Стек: **React + Vite (клиент)**, **Node.js + Express (сервер)**, **MongoDB (база данных, без Docker)**.

---

# 1) Что нужно установить

### Обязательно
1) **Node.js (LTS)**  
   Скачать: https://nodejs.org/  
   После установки проверь:
   ```bash
   node -v
   npm -v


MongoDB Community Server
Скачать: https://www.mongodb.com/try/download/community

При установке на Windows удобнее выбрать вариант Install as a Service (как служба).
После установки проверь:
mongosh

Если mongosh не установлен - поставь отдельно (обычно он идет вместе с MongoDB или ставится через MongoDB Shell).

2) Структура проекта
tree/
  client/                 # фронтенд (React + Vite)
    src/
    public/
    package.json
    vite.config.js
  server/                 # бэкенд (Node.js + Express)
    src/
      index.js
      routes/
      models/
      middleware/
      ...
    package.json
    .env                  # локальные переменные окружения (создается вручную)

1) Общая идея: из чего состоит проект

Проект - это две отдельные программы, которые запускаются отдельно:

client - это сайт (интерфейс).
Он рисует страницы, формы, кнопки, дерево, карту.

server - это сервер (API).
Он принимает запросы от сайта: “зарегистрируй”, “войти”, “дай список родственников”, “сохрани родственника”, “дай данные для дерева”, “дай точки для карты”.

MongoDB - база данных.
Сервер хранит там пользователей, людей (Person) и связи (Relationship).

Схема общения:

Браузер (client) -> HTTP запрос -> server -> MongoDB
Браузер (client) <- JSON ответ  <- server <- MongoDB

2) Структура по верхнему уровню
tree/
  client/     # сайт (React + Vite)
  server/     # сервер (Node.js + Express)

3) CLIENT - подробно
3.1 client/package.json

Файл, который описывает:

какие библиотеки нужны клиенту (react, react-router-dom, maplibre-gl и т.д.)

команды запуска:

npm run dev (запуск в режиме разработки)

npm run build (сборка)

npm run preview (проверка сборки)

Если у человека нет библиотек - npm install читает package.json и ставит всё нужное.

3.2 client/vite.config.js

Настройки сборщика Vite.
Обычно тут:

базовые настройки

иногда прокси на сервер (если настроено)

настройки порта

3.3 client/public/

Папка для статических файлов.
Это не React-код, это “просто файлы”.

client/public/
  logo.png
  tree_bg.svg
  ...


Как это работает:

всё из public/ доступно по адресу /filename

например tree_bg.svg можно использовать как url(/tree_bg.svg) в CSS или inline style в React

Зачем это нужно:

картинки для фона дерева

логотипы

иконки

3.4 client/src/ - главный код клиента
client/src/
  main.jsx
  App.jsx
  api.js
  styles.css
  pages/
  components/
  data/

3.4.1 client/src/main.jsx - вход в приложение

Это первый файл, который запускается на стороне браузера.
Он:

подключает CSS

создаёт React-приложение и вставляет его в HTML

Самое важное:

здесь должен быть импорт styles.css

если CSS подключён не туда - внешний вид “пропадает”

3.4.2 client/src/styles.css - весь дизайн проекта

Это общий стиль для всех страниц:

фон

карточки .card

кнопки .btn

вкладки .tab

формы .input, .select, .textarea

стили карты/дерева/модалок

Если что-то “стало прозрачным/непрозрачным” - это правится здесь.

3.4.3 client/src/api.js - слой общения с сервером

Это самый важный файл для всех запросов.

Он делает однообразно:

apiGet("/api/tree")

apiPost("/api/auth/login", payload)

apiPut("/api/persons/id", payload)

и так далее

Почему это важно:

если сервер использует сессии (cookie), тут должно быть credentials: "include"

если неправильный порт (не 3001) - всё ломается

То есть api.js - это “курьер”, который носит данные между страницами и сервером.

3.4.4 client/src/App.jsx - маршрутизация страниц

Это “карта сайта” внутри React.

Примерно логика такая:

/login -> Login.jsx

/register -> Register.jsx

/app -> Layout.jsx + внутренние вкладки:

/app/profile -> Profile.jsx

/app/relatives -> Relatives.jsx

/app/tree -> Tree.jsx

/app/map -> Map.jsx

Если человек вводит URL в браузере - App.jsx решает какую страницу показать.

3.5 client/src/components/ - переиспользуемые блоки

Тут лежат “детали интерфейса”, которые повторяются.

Примеры:

Layout.jsx

Общий каркас, который одинаков для вкладок:

верхняя навигация

вкладки

кнопка выйти

место для контента (<Outlet />)

Если ты хочешь, чтобы дизайн был одинаковым везде - это делается через Layout.

Modal.jsx

Компонент модального окна:

используется в “Добавить родственника”

используется в карточке родственника

используется в карточке на карте

Если нужно уменьшить прозрачность фона модалки - правится CSS класса модалки (в styles.css) или стиль внутри Modal.jsx.

PersonCard.jsx

“Мини карточка человека” (в списке родственников):

Фамилия Имя

дата рождения

возможно город

3.6 client/src/data/ - данные/списки

Например:

список городов CITY_OPTIONS

Это делается чтобы:

не хранить огромный список прямо внутри страницы

переиспользовать его и в профиле, и в родственниках

3.7 client/src/pages/ - страницы сайта

Это основные экраны.

Register.jsx

показывает форму регистрации

отправляет POST /api/auth/register

после регистрации обычно переводит на /app или /app/home

Login.jsx

показывает форму входа

отправляет POST /api/auth/login

после входа переводит на главную

Profile.jsx

загружает профиль GET /api/profile

сохраняет PUT /api/profile

поля совпадают с User + синхронизация Person(isSelf)

Relatives.jsx

загружает людей GET /api/persons

создаёт человека POST /api/persons

редактирует PUT /api/persons/:id

удаляет DELETE /api/persons/:id

плюс создаёт связь POST /api/relationships (если у тебя так сделано) или внутри /api/persons

Tree.jsx

загружает GET /api/tree

получает:

mePersonId

people[]

relationships[]

строит из этого дерево и рисует

Map.jsx

загружает GET /api/map?filter=birth|burial

получает список маркеров с координатами

рисует MapLibre карту и точки/кластеры

4) SERVER - подробно
4.1 server/package.json

Список библиотек сервера:

express

mongoose

express-session

bcryptjs

cors

dotenv
и т.д.

Команды:

npm run dev запускает src/index.js (у тебя через node --watch)

4.2 server/.env

Настройки:

PORT порт сервера

MONGO_URL адрес MongoDB

SESSION_SECRET ключ сессии

CLIENT_ORIGIN разрешённый адрес фронтенда

Без .env сервер часто запускается, но сессии/подключение может быть не тем.

4.3 server/src/index.js - главный файл сервера

Это “дирижёр”:

Подключает .env

Подключает Express

Подключает middleware:

json body

session

cors

Подключает роуты (routes/*.js) на адреса:

/api/auth

/api/profile

/api/persons

/api/relationships

/api/tree

/api/map

Подключается к MongoDB через mongoose

Запускает сервер на порту

Если падает сервер “роут не экспортирует” - проблема в export/import роутов и index.js.

4.4 server/src/middleware/auth.js

Функция requireAuth:

если в сессии нет userId - вернуть 401

иначе разрешить

Это защита от ситуации “не вошёл в аккаунт, но пытаешься смотреть дерево”.

4.5 server/src/models/ - база данных (Mongoose)
User.js

Хранит аккаунт:

login

passwordHash

email, phone

и доп поля профиля

Person.js

Хранит каждого человека в древе:

userId - чей это набор данных (какой пользователь владелец)

isSelf - это сам пользователь?

lastName/firstName/middleName

sex

birthDate

birthCity или birthCityCustom

alive

deathDate

burialPlace

notes

Relationship.js

Связи (как ты прислала):

userId

basePersonId - человек, для которого добавили связь (КОМУ добавлен)

relatedPersonId - добавленный человек (КТО добавлен)

relationType - тип связи (мать/отец/сын/дочь/…)

line - male/female/"" (линия)

Пример: если ты добавила “мать” для себя:

basePersonId = твой Person(isSelf)

relatedPersonId = Person матери

relationType = "мать"

line = "female" или "" (как заполнено)

4.6 server/src/routes/ - API (маршруты)

У тебя часть роутов сделана как export function ...Routes() { return router }.
Это значит, что index.js должен их подключать как функцию.

Примеры:

routes/auth.js

POST /register

POST /login

POST /logout

GET /me

Важно: при регистрации создаёт Person(isSelf=true).

routes/profile.js

GET /

PUT /
Работа с профилем User + синхронизация Person(isSelf).

routes/persons.js

(у тебя он есть, раз /api/persons работает)

GET / - список людей

POST / - создать человека + связь

PUT /:id - обновить

DELETE /:id - удалить

routes/relationships.js

У тебя уже:

GET / - получить все связи

routes/tree.js

GET / -> отдаёт всё нужное дереву:

mePersonId

people

relationships
(и возможно manualLinks/positions)

routes/map.js

GET / -> отдаёт маркеры для карты

4.7 server/src/cities.js

Справочник координат городов.
Функция cityByName("Москва") возвращает {lat, lon}.
Используется в map.js.

5) Как данные реально идут по проекту (очень важно понять)
Регистрация

client/Register.jsx -> apiPost("/api/auth/register", данные)

server/routes/auth.js:

создаёт User

создаёт Person(isSelf=true)

записывает req.session.userId

client после ok -> переходит на /app

Вход

client/Login.jsx -> apiPost("/api/auth/login")

server проверяет пароль, кладёт req.session.userId

браузер хранит cookie сессии (важно credentials: "include")

Добавить родственника

client/Relatives.jsx -> apiPost("/api/persons", payload)

server:

создаёт Person родственника

создаёт Relationship (basePersonId, relatedPersonId, relationType, line)

client снова грузит список /api/persons

Построение дерева

client/Tree.jsx -> apiGet("/api/tree")

server/tree.js:

находит Person и Relationship по userId

отдаёт JSON

Tree.jsx рисует дерево


4) Первый запуск проекта (локально)
Шаг 1. Запусти MongoDB

Если MongoDB установлена как служба Windows - она обычно уже запущена.

Проверка:

mongosh


Если подключилось - ок. Выход:

exit


Если не подключается:

Win + R → services.msc

найди MongoDB Server

нажми Start (Запустить)

Шаг 2. Запусти сервер (backend)

Открой терминал в папке tree/server:

npm install
npm run dev


Сервер должен стартовать на:

http://localhost:3001

Шаг 3. Запусти клиент (frontend)

Открой второй терминал в папке tree/client:

npm install
npm run dev


Клиент будет доступен на:

http://localhost (порт 80)

Открывай страницу входа:

http://localhost/login

5) Как перезапустить проект
Сервер

В окне сервера нажми:

Ctrl + C
и снова:

npm run dev

Клиент

В окне клиента нажми:

Ctrl + C
и снова:

npm run dev