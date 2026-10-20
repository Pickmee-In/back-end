FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

FROM build AS migrate
CMD ["npm", "run", "db:migrate"]

FROM build AS production-deps
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
RUN groupadd --gid 10001 pickme && useradd --uid 10001 --gid 10001 --no-create-home pickme
USER pickme
CMD ["node", "dist/index.js"]
