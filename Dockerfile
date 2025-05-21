# syntax = docker/dockerfile:1
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim AS base
LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

# Enable pnpm using corepack and prepare the specified version
RUN corepack enable pnpm && corepack prepare pnpm@10.10.0+sha512.d615db246fe70f25dcfea6d8d73dee782ce23e2245e3c4f6f888249fb568149318637dca73c2c5c8ef2a4ca0d5657fb9567188bfab47f566d1ee6ce987815c39 --activate

# --- Build Stage ---
FROM base AS build
WORKDIR /app

# Install packages needed for native modules and poppler
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy root package.json, pnpm-lock.yaml, and pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy the 'apps' directory which contains frontend and backend
COPY ./apps ./apps

# --- Install ALL Dependencies for the Workspace (including devDependencies) ---
# This is simpler for the build stage, as both backend and frontend builds need their devDependencies.
# We will prune them all at once later.
RUN pnpm install --frozen-lockfile # This installs for all workspace packages

# --- Build Backend ---
# The backend's build script (`node build.mjs`) outputs to `../../dist/server.js`
# which means it will create /app/dist/server.js
RUN pnpm --filter backend run build

# --- Build Frontend ---
# The frontend's build script (`tsc -b && vite build`) will use its vite.config.ts
# which outputs to `../../dist/client`. This means it will create /app/dist/client
RUN pnpm --filter frontend run build

# --- Prune Dev Dependencies from the entire workspace ---
# This removes devDependencies from all packages after builds are complete.
# `pnpm prune --prod` when run in the workspace root handles all workspace packages.
RUN pnpm prune --prod # <<< CORRECTED LINE

# --- Final Production Stage ---
FROM base AS final
WORKDIR /app

# Copy necessary files from the build stage
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy the 'apps' directory structure (specifically backend/package.json if needed by pnpm start for some reason, though direct node call is better)
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json

# Copy production node_modules (hoisted to the root)
COPY --from=build /app/node_modules ./node_modules

# Copy the built application artifacts (server and client)
COPY --from=build /app/dist ./dist

# Install poppler-utils in the final image for runtime use by node-poppler
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create tmp directory with proper permissions
RUN mkdir -p /app/tmp && chmod 777 /app/tmp

EXPOSE 3000

# Use the root start script which directly invokes the built server artifact
CMD [ "pnpm", "run", "start" ]
