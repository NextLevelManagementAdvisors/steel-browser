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

# Stage: Fetch the official "Claude in Chrome" extension. Closed-source,
# Chrome-Web-Store-only (unlike Bitwarden), so this stage downloads the
# signed CRX from Google's own update endpoint at build time instead of
# building from source -- nothing proprietary is vendored into this repo's
# git history, same as the bitwarden-build stage's own "not vendored" note.
# Verified separately: the CRX3's manifest.json already carries its own
# `key` field, and SHA-256 of that DER key derives extension id
# fcoeoabgfenejglbffodgkkbkcdhcgfn -- the real Chrome Web Store id for
# "Claude" -- so no manifest-key pinning is needed here unlike bitwarden.
FROM alpine:3.20 AS claude-extension

ARG CLAUDE_EXTENSION_ID=fcoeoabgfenejglbffodgkkbkcdhcgfn

RUN apk add --no-cache curl unzip

WORKDIR /ext
# CRX3 layout: 4-byte magic "Cr24", u32 version, u32 header length, then
# that many bytes of header proto, then the zip payload -- strip the header
# with od/tail rather than a scripting runtime, since this stage's only job
# is to produce a directory, not run JS.
RUN curl -sL -o claude.crx \
      "https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx3&prodversion=127.0&x=id%3D${CLAUDE_EXTENSION_ID}%26uc" && \
    headerlen=$(od -An -tu4 -j 8 -N 4 claude.crx | tr -d ' ') && \
    tail -c +$((12 + headerlen + 1)) claude.crx > claude.zip && \
    mkdir -p /out && \
    unzip -q claude.zip -d /out && \
    rm claude.crx claude.zip

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

# Claude in Chrome: opt-in named extension only -- a session must explicitly
# request it (POST /v1/sessions {"extensions": ["claude"]}, per
# getExtensionPaths()'s customExtensions path). Deliberately NOT added to
# cdp.service.ts's defaultExtensions like bitwarden is: pooled containers are
# fresh per session, this extension requires an interactive Anthropic
# sign-in that doesn't survive a fresh profile, and every pooled container
# already runs close to POOL_CONTAINER_MEMORY_MB -- making it default-on
# would add a second MV3 service worker + <all_urls> host permissions to
# every session for a feature that's signed out by default anyway.
COPY --from=claude-extension /out /app/api/extensions/claude

# Pre-sets the Bitwarden extension's self-hosted server URL via Chrome's
# native 3rd-party-extension managed-policy mechanism, so a tenant's first
# login never has to manually type the server URL -- Bitwarden's own
# manifest.json already declares a managed_schema accepting this
# ("environment": {"base": ...}), confirmed directly in bitwarden/clients.
RUN mkdir -p /etc/chromium/policies/managed && \
    cat > /etc/chromium/policies/managed/bitwarden.json <<'EOF'
{
  "3rdparty": {
    "extensions": {
      "jkigehmlkjibeeipffdneofilhmdebbm": {
        "environment": {
          "base": "https://vault.nlma.io"
        }
      }
    }
  }
}
EOF
