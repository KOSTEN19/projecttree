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

### ИИ-факты в ленте дома (опционально)

Сервер может добавлять на главную короткие карточки `kind: "ai"` через OpenAI-совместимый API (Ollama, облако и т.п.).

- Включение: `AI_ENABLED=true`; обязательны **`AI_API_BASE_URL`** (например `http://127.0.0.1:11434/v1` для Ollama) и **`AI_MODEL`** (имя модели в вашем провайдере).
- Ключ: для локального Ollama обычно не нужен; для облака — `AI_API_KEY`.
- Пример для Ollama: `AI_ENABLED=true`, `AI_API_BASE_URL=http://127.0.0.1:11434/v1`, `AI_MODEL=tinyllama` (или другая скачанная модель).
- Ручное обновление кэша пользователем: `POST /api/ai/feed/refresh` (лимит по времени на сервере).


#### Локальный Ollama в Docker Compose

- Сервис входит в обычный `docker compose up -d`. По умолчанию образ **`alpine/ollama`**, модель **`tinyllama`** (легче для слабого хоста). При старте контейнера [`scripts/ollama-docker-entry.sh`](scripts/ollama-docker-entry.sh) поднимает `ollama serve` и выполняет **`ollama pull`** для `AI_MODEL` (первый раз может занять несколько минут).
- На слабом VPS **API (`server`) не зависит от Ollama** в `docker-compose`: сайт поднимается, пока модель качается или если Ollama недоступен; ИИ-ленту можно включить позже. При желании ограничьте CPU/RAM контейнера `ollama` вручную в настройках Docker. Ещё легче модель: `AI_MODEL=qwen2:0.5b`. Полный официальный образ: `OLLAMA_IMAGE=ollama/ollama:latest`.
- В Docker Compose ИИ **включён по умолчанию** (`AI_ENABLED=true`); выключить: `AI_ENABLED=false` в `.env`. У `server`: `AI_API_BASE_URL=http://ollama:11434/v1`, `AI_MODEL` совпадает с подгружаемой в Ollama.
- Порт **11434** на хосте: **127.0.0.1**.
