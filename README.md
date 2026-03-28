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

- Поднять стек с Ollama: `docker compose --profile ai up -d` (без профиля `ai` поведение как раньше, контейнер Ollama не создаётся).
- Один раз загрузить модель, например: `docker compose --profile ai exec ollama ollama pull llama3.2` (имя должно совпадать с `AI_MODEL`).
- В `.env` задайте `AI_ENABLED=true`. В [`docker-compose.yml`](docker-compose.yml) для сервиса `server` уже проброшены `AI_API_BASE_URL` (по умолчанию `http://ollama:11434/v1` — имя сервиса в сети compose) и `AI_MODEL`.
- Порт **11434** слушает только на **127.0.0.1** на хосте (удобно вызывать `ollama` с машины; с других интерфейсов не открыт).
