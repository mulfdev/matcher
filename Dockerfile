# syntax = docker/dockerfile:1
# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim AS base
LABEL fly_launch_runtime="Node.js"
# Node.js app lives here
WORKDIR /app
# Set production environment
ENV NODE_ENV="production"
# Throw-away build stage to reduce size of final image
FROM base AS build
# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 poppler-data poppler-utils
# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev
# Copy application code
COPY . .
# Build application
RUN npm run build
# Remove development dependencies
RUN npm prune --omit=dev
# Final stage for app image
FROM base
# Copy built application
COPY --from=build /app /app

# Install poppler-utils in the final image for PDF processing
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create the tmp directory and ensure it has proper permissions
RUN mkdir -p /app/tmp && chmod 777 /app/tmp

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
