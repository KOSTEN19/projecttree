# ProjectTree

Репозиторий: [github.com/KOSTEN19/projecttree](https://github.com/KOSTEN19/projecttree)

## Конфигурация (кратко)

| Параметр | Где задано | Значение |
|----------|------------|----------|
| MongoDB URI | `server-go/internal/config` (`MONGO_URI`), `docker-compose.yml` | Одна и та же база **`project_drevo`**: локально `mongodb://127.0.0.1:27017/project_drevo`, в Docker — URI с логином/паролем и `authSource=admin` (см. `.env.example`). Данные в **`./mongo-data`**. Порт MongoDB **не пробрасывается** наружу. |
| Логин/пароль Mongo (Docker) | `.env` (`MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`), значения по умолчанию в `docker-compose.yml` | Задаётся в `.env` (шаблон — `.env.example`). Учётная запись создаётся при **первом** запуске с пустым `mongo-data`. |
| Админ-учётка приложения | `server-go/internal/seed/admin.go`, `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) | Логин/пароль настраиваются в `.env`; при старте сервера сид обновляет админа по этим переменным. Доступ к `/app/admin`. |
| Демо-вход | `server-go/internal/seed/demo.go`, страницы входа | Учётка **`demo`**; пароль задаётся в коде сида и при старте сервера приводится к этому значению (см. файл сида, не дублируйте пароль в документации). |
| Nginx: сканеры | `client/nginx.conf`, `./logs/nginx` | Типичные пути сканеров — **444** и запись в **`logs/nginx/scanners.log`**; общий лог — `access.log`. |
