FROM oven/bun:1-alpine AS base

WORKDIR /app

FROM base AS deps

COPY package.json bun.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY types/package.json ./types/package.json

RUN bun install --frozen-lockfile

FROM base AS prod-deps

ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY types/package.json ./types/package.json

RUN bun install --frozen-lockfile --production --filter @nai-factory/server --linker hoisted

FROM deps AS build

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN bun --filter @nai-factory/web build \
    && bun --filter @nai-factory/server build \
    && rm -rf server/dist/public server/dist/assets \
    && mv web/dist server/dist/public \
    && cp -R server/assets server/dist/assets

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/server/data/database.db

EXPOSE 3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist

WORKDIR /app/server

CMD ["bun", "run", "dist/index.js"]
