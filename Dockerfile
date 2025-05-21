# syntax = docker/dockerfile:1
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app
ENV NODE_ENV="production"

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY backend ./backend
COPY frontend ./frontend

RUN corepack enable pnpm && pnpm install --frozen-lockfile

RUN pnpm run build:backend
RUN pnpm run build:frontend

RUN pnpm prune --prod

FROM base AS final
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/tmp && chmod 777 /app/tmp

EXPOSE 3000

CMD ["node", "dist/server/main.js"]

