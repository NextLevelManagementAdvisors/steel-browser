ARG NODE_VERSION=22.13.0

# Narrowly-scoped build arg for the bitwarden-build stage only (see below).
# Declared here, before the first FROM, because Docker only expands a later
# FROM's image reference using ARGs declared before the FIRST FROM in the
# file -- an ARG placed between two stages is parsed as part of the
# preceding stage's body, not as a new global-scope declaration, so it would
# NOT be visible to `FROM node:${BITWARDEN_NODE_VERSION}` below.
ARG BITWARDEN_NODE_VERSION=24.17.0

FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

ENV NODE_ENV="production" \
    PUPPETEER_CACHE_DIR=/app/.cache \
    DISPLAY=:10 \
    PATH="/usr/bin:/app/selenium/driver:${PATH}" \
    CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

LABEL org.opencontainers.image.source="https://github.com/steel-dev/steel-browser"

# Install dependencies
RUN rm -f /etc/apt/apt.conf.d/docker-clean; \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache; \
    apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get -yq dist-upgrade && \
    apt-get install -y --no-install-recommends \
    expat \
    libxslt1.1 \
    libpam0g \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Stage: Build Bitwarden browser extension (pinned, third-party source)
# Uses its own BITWARDEN_NODE_VERSION build arg (declared before the first
# FROM, at the top of this file -- not the shared NODE_VERSION) because
# bitwarden/clients at BITWARDEN_TAG requires Node >=24.17.0 / npm ~11,
# while NODE_VERSION stays pinned at 22.13.0 for every other stage and the
# runtime image. This stage's only output is a static build/ directory
# copied into `production` below, so its Node version has no effect on the
# runtime image's Node version. Uses the full node image (not the -slim
# variant `base` uses) since this stage needs git plus the Angular/webpack
# toolchain and is independent of `base` anyway.
FROM node:${BITWARDEN_NODE_VERSION} AS bitwarden-build

ARG BITWARDEN_TAG=browser-v2026.7.0

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /bw
RUN git clone --depth 1 --branch ${BITWARDEN_TAG} https://github.com/bitwarden/clients.git .

# Root-only install, per bitwarden/clients' own contributing docs -- installing
# per-app dependencies separately is explicitly unsupported there.
RUN npm ci

WORKDIR /bw/apps/browser
RUN npm run build:prod:chrome

# Inject our own fixed manifest key so Chrome derives the same extension ID on
# every rebuild of THIS image -- see api/extensions/bitwarden-manifest-key.txt
# and the README section next to it for why this matters.
COPY api/extensions/bitwarden-manifest-key.txt /tmp/bitwarden-manifest-key.txt
RUN node -e " \
  const fs = require('fs'); \
  const manifestPath = './build/manifest.json'; \
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); \
  manifest.key = fs.readFileSync('/tmp/bitwarden-manifest-key.txt', 'utf8').trim(); \
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); \
"

FROM base AS build

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential \
    pkg-config \
    python-is-python3 \
    xvfb

# Copy root workspace files first
COPY --link package.json package-lock.json ./

# Remove or override the prepare script to avoid husky in Docker
RUN npm pkg set scripts.prepare="echo skip husky"

COPY --link api/ ./api/

# Install dependencies for api
RUN npm ci --include=dev --workspace=api

# Install dependencies for recorder extension separately
RUN cd api/extensions/recorder && npm ci --include=dev && cd -

# Build the api package
RUN npm run build -w api

RUN cd api/extensions/recorder && \
    npm run build && \
    cd -

# Prune dev dependencies
RUN npm prune --omit=dev -w api
RUN cd api/extensions/recorder && npm prune --omit=dev && cd -

FROM base AS production
# Install dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends \
    wget \
    nginx \
    gnupg \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    xvfb \
    curl \
    unzip \
    dbus \
    dbus-x11 \
    procps \
    x11-xserver-utils

# Install Chrome and ChromeDriver
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    curl \
    unzip \
    # Download and install Chromium
    && apt-get install -y chromium chromium-driver \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

RUN mkdir -p /files

COPY --chmod=755 api/entrypoint.sh /app/api/entrypoint.sh

EXPOSE 3000 9223

ENV HOST_IP=localhost \
    DBUS_SESSION_BUS_ADDRESS=autolaunch:

ENTRYPOINT ["/app/api/entrypoint.sh"]

COPY --from=build /app /app

# Bitwarden extension: built in its own stage above (third-party source, not
# vendored into this repo's git history) and copied into the same
# api/extensions/<name>/ layout getExtensionPaths() expects for every other
# named extension. Placed here, after ENTRYPOINT, to match the existing
# COPY --from=build /app /app line immediately above -- not "fixing" that
# pre-existing ordering as a drive-by change.
COPY --from=bitwarden-build /bw/apps/browser/build /app/api/extensions/bitwarden
