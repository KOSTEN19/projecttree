# UI (shadcn): src/components/ui/*.tsx хранятся в git (см. .gitignore). prebuild/ui:pull — опциональное обновление с реестра.
# node_modules в git не хранится: зависимости ставятся здесь (`npm ci` из npm registry), не через MCP.
# MCP shadcn в Cursor только помогает в IDE; образ собирается этим Dockerfile.
FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json components.json ./
RUN npm ci --no-audit --fund=false

# Явно копируем исходники (не полагаемся на «случайные» исключения в контексте).
COPY index.html vite.config.ts tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

# shadcn UI обязан быть в git; иначе Vite падает с ENOENT на `@/components/ui/card`.
RUN test -f src/components/ui/card.tsx && test -f src/components/ui/tabs.tsx || ( \
  echo "ERROR: нет client/src/components/ui/*.tsx в контексте Docker."; \
  echo "Сделайте git pull и проверьте, что файлы закоммичены (см. client/.gitignore)."; \
  ls -la src/components/ui 2>/dev/null || echo "(папка ui отсутствует)"; \
  exit 1 )

# Обходим `prebuild` → `ui:pull` (нужен внешний реестр); UI уже в git.
RUN npx vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
