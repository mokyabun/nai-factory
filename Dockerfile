FROM oven/bun:1-alpine AS base

WORKDIR /app

FROM base AS deps

COPY package.json bun.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY shared/package.json ./shared/package.json

RUN bun install --frozen-lockfile

FROM base AS prod-deps

ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY shared/package.json ./shared/package.json

RUN bun install --frozen-lockfile --production --filter @nai-factory/server --linker hoisted

FROM deps AS build

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN bun --filter @nai-factory/web build \
    && bun --filter @nai-factory/server build:prod \
    && rm -rf server/dist/public server/dist/assets \
    && mv web/dist server/dist/public \
    && mkdir -p server/dist/assets \
    && cp server/assets/db.csv server/dist/assets/db.csv

FROM base AS runtime

ENV NODE_ENV=production
ENV BUN_ENV=production
ENV PORT=3000
ENV NAI_FACTORY_DATA_DIR=/app/server/data

EXPOSE 3000

COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/server/dist ./server/dist

RUN mkdir -p /app/server/data \
    && chown -R bun:bun /app/server

WORKDIR /app/server

USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.js"]
