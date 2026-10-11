FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm ci --registry=https://registry.npmjs.org
COPY . .
RUN npm ci --prefix speech --omit=dev --registry=https://registry.npmjs.org
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build:api && npm run build

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/speech ./speech
USER node
EXPOSE 3000
CMD ["node","server.js"]

FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends perl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production STUDIO_API_HOST=0.0.0.0 STUDIO_API_PORT=38322 STUDIO_DATA_DIR=/var/lib/studio/data
RUN mkdir -p /var/lib/studio/data && chown node:node /var/lib/studio/data
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/packages ./packages
RUN npm ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org
COPY --from=build --chown=node:node /app/dist-api ./dist-api
COPY --from=build --chown=node:node /app/speech ./speech
USER node
EXPOSE 38322
CMD ["node","dist-api/server.cjs"]
