# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.18.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apt-get update \
    && apt-get install --yes --no-install-recommends dumb-init openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS development-dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

FROM development-dependencies AS build
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    npm run prisma:generate \
    && npm run build

FROM build AS tools

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/health/live`).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
