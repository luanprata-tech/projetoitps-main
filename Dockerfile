# Estágio base com Node.js 22 e Bun para instalar exatamente as versões travadas no bun.lock.
FROM oven/bun:1-alpine AS bun-bin

FROM node:22-alpine AS deps
WORKDIR /app

COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Estágio de desenvolvimento (uso opcional com target: dev no docker-compose).
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Estágio de build de produção; NITRO_PRESET=node-server gera servidor Node portável sem alterar vite.config.ts.
FROM deps AS builder
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}
ENV NITRO_PRESET=node-server

COPY . .
RUN bun run build

# Estágio final enxuto servindo a aplicação compilada pelo TanStack Start / Nitro.
FROM node:22-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
