# HIVE — production image (single-instance SQLite deployment)
#
# Debian-slim base (NOT alpine): better-sqlite3 ships prebuilt glibc binaries,
# avoiding musl/native-build issues. Node 22 LTS (Node 20 is EOL since 2026-04).

# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps
# Toolchain only needed if better-sqlite3 has to compile from source
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Build ----
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client is generated into src/generated/prisma (gitignored — must generate here).
# DATABASE_URL is only read by prisma.config.ts at CLI time; no DB is touched.
ENV DATABASE_URL=file:./dev.db
RUN npx prisma generate

ENV NODE_ENV=production
# Build-time placeholder ONLY: src/lib/auth.ts hard-fails the production build
# without JWT_SECRET. This value is confined to the builder stage (not present in
# the final image) and the real secret is injected at runtime via docker compose.
ENV JWT_SECRET=build-time-placeholder-not-a-secret
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:22-slim AS runner

# tzdata is REQUIRED: all of HIVE's date logic runs in the business timezone.
# Without tzdata, TZ=Asia/Amman silently falls back to UTC and dates break.
# openssl: required by the Prisma CLI (db push in the entrypoint).
RUN apt-get update && apt-get install -y --no-install-recommends tzdata openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Amman
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# App + full node_modules (includes prisma CLI used by the entrypoint's `db push`)
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/generated ./src/generated
COPY deploy/docker-entrypoint.sh ./deploy/docker-entrypoint.sh
RUN chmod +x ./deploy/docker-entrypoint.sh

# Persistent data lives on the volume mounted at /app/data.
# The app hardcodes ./dev.db and ./backups (process.cwd()), so the entrypoint
# symlinks those into /app/data — see deploy/docker-entrypoint.sh.
RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000

# Healthcheck without curl/wget (slim has neither)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=25s \
  CMD node -e "fetch('http://localhost:3000/api/settings/public').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./deploy/docker-entrypoint.sh"]
