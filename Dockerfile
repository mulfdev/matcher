# syntax = docker/dockerfile:1
ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim AS base
LABEL fly_launch_runtime="Node.js"

# Set up app directory
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Enable pnpm using corepack and set version
RUN corepack enable pnpm && corepack prepare pnpm@10.10.0 --activate

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 poppler-data poppler-utils

# Copy only necessary files from monorepo root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build application
WORKDIR /app/apps/backend

# Remove development dependencies
RUN cd /app && pnpm prune --prod

# Final stage for app image
FROM base

# Copy only the backend application
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=build /app/apps/backend /app/apps/backend
COPY --from=build /app/node_modules /app/node_modules

# Install poppler-utils in the final image
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create tmp directory with proper permissions
RUN mkdir -p /app/apps/backend/tmp && chmod 777 /app/apps/backend/tmp

# Set workdir to the backend directory
WORKDIR /app/apps/backend

# Start the server
EXPOSE 3000
CMD [ "pnpm", "run", "start" ]
