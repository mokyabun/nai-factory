FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY types/package.json ./types/package.json

RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN bun --filter @nai-factory/web build \
    && bun --filter @nai-factory/server build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/server/data/database.db
ENV WEB_DIST_DIR=/app/web/dist

EXPOSE 3000

CMD ["bun", "--cwd", "server", "run", "start"]
