# UI (shadcn): src/components/ui/*.tsx хранятся в git (см. .gitignore). prebuild/ui:pull — опциональное обновление с реестра.
# node_modules в git не хранится: зависимости ставятся здесь (`npm ci` из npm registry), не через MCP.
# MCP shadcn в Cursor только помогает в IDE; образ собирается этим Dockerfile.
FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json components.json ./
RUN npm ci --no-audit --fund=false
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
