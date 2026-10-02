# CHKN OUTBREAK: one image with the Colyseus game server and the built client (same origin, one port).
# docker build -t chkn . && docker run -p 2580:2580 chkn   → http://localhost:2580
#
# Alpine (musl) on purpose: on glibc images Node starts its worker threads through clone3, which older
# Docker/runc seccomp profiles reject ("uv_thread_create" assertion at start). musl runs everywhere.

FROM node:24-alpine AS build
WORKDIR /app
# dependencies first: this layer stays cached while only the sources change
COPY package.json package-lock.json ./
# dev dependencies are needed to build (TypeScript, Vite); browsers for QA tools are not
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src src
COPY server server
COPY public public
ARG BUILD_ID=dev
ENV BUILD_ID=$BUILD_ID
RUN npm run build

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine
ARG BUILD_ID=dev
ENV NODE_ENV=production \
    PORT=2580 \
    BUILD_ID=$BUILD_ID
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json tsconfig.json ./
# the server runs its TypeScript through tsx and reads level maps from public/assets/maps
COPY server server
COPY src/shared src/shared
COPY public/assets/maps public/assets/maps
COPY --from=build /app/dist dist
RUN mkdir -p /app/data/rooms && chown -R node:node /app/data
USER node
EXPOSE 2580
# busybox wget: the health check needs no second Node process
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-2580}/healthz" || exit 1
CMD ["node", "--import", "tsx", "server/index.ts"]
