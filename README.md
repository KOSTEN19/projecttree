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
- Пример для Ollama: `AI_ENABLED=true`, `AI_API_BASE_URL=http://127.0.0.1:11434/v1`, `AI_MODEL=llama3.2` (подставьте установленную у вас модель).
- Ручное обновление кэша пользователем: `POST /api/ai/feed/refresh` (лимит по времени на сервере).


#### Локальный Ollama в Docker Compose

- Сервис входит в обычный `docker compose up -d`. По умолчанию образ **`alpine/ollama`** (небольшой CPU-слой; тот же API на порту 11434). Нужен полный официальный образ с GPU/CUDA — в `.env` задайте `OLLAMA_IMAGE=ollama/ollama:latest`.
- Модель весит отдельно (том `ollama-data`). Лёгкие варианты для экономии места: `tinyllama`, `qwen2:0.5b` и т.п. Пример: `docker compose exec ollama ollama pull tinyllama` и в `.env` `AI_MODEL=tinyllama`.
- В `.env` для ленты: `AI_ENABLED=true`. У `server` по умолчанию `AI_API_BASE_URL=http://ollama:11434/v1` и `AI_MODEL` (см. [`docker-compose.yml`](docker-compose.yml)).
- Порт **11434** на хосте: **127.0.0.1** (доступ только с локальной машины).
