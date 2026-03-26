# ProjectTree

Репозиторий: [github.com/KOSTEN19/projecttree](https://github.com/KOSTEN19/projecttree)

## Конфигурация (кратко)

| Параметр | Где задано | Значение |
|----------|------------|----------|
| MongoDB URI | `server-go/internal/config` (`MONGO_URI`), `docker-compose.yml` | Одна и та же база **`project_drevo`**: локально `mongodb://127.0.0.1:27017/project_drevo`, в Docker — URI с логином/паролем и `authSource=admin` (см. `.env.example`). Данные в **`./mongo-data`**. Порт MongoDB **не пробрасывается** наружу. |
| Логин/пароль Mongo (Docker) | `.env` (`MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`) | По умолчанию в compose: пользователь **`root`**, пароль **`project_drevo_mongo_dev`** (для прода скопируйте `.env.example` → `.env` и задайте свой пароль). Учётная запись создаётся при **первом** запуске с пустым `mongo-data`. |
| Админ-учётка приложения | `server-go/internal/seed/admin.go`, `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) | По умолчанию создаётся/обновляется **`admin`** с паролем **`V9!mQ2#tK7@pL4$zR6`** и доступом к `/app/admin`. Для прода задайте свои значения в `.env`. |
| Демо-вход | сид `server-go/internal/seed`, страницы входа | логин **`demo`**, пароль **`demo123`**. При каждом старте сервера пароль demo сбрасывается к этому значению. |
| Nginx: сканеры | `client/nginx.conf`, `./logs/nginx` | Типичные пути сканеров — **444** и запись в **`logs/nginx/scanners.log`**; общий лог — `access.log`. |
