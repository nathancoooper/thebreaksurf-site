FROM node:20-alpine AS base

# ── builder: compile the app ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
# Install dependencies inside the Linux build image. This keeps deployments
# reproducible and avoids host npm versions rewriting the production lockfile.
COPY package.json package-lock.json ./
# Lockfile is generated with npm 11 — match it here so optional-dep
# resolution (e.g. sharp's wasm entries) agrees and `npm ci` stays happy.
RUN npm i -g npm@11 && apk add --no-cache python3 make g++ && npm ci
COPY . .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — pass
# the real production values via build args (see docker-compose.yml). The
# fallbacks are safe public defaults, never secrets.
ARG NEXT_PUBLIC_APP_URL=https://thebreaksurf.co.uk
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_placeholder
ENV ADMIN_JWT_SECRET=build-placeholder \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# ── runner: minimal production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
RUN apk add --no-cache ffmpeg su-exec

# Standalone output bundles only what's needed to run
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ is served statically — copy everything except uploads (that's a volume)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure the uploads, data, and backups volume mount points are owned by nextjs
RUN mkdir -p /app/public/images/uploads /app/data /app/backups /app/data/receipts /app/data/receipts/derived && chown -R nextjs:nodejs /app/public/images/uploads /app/data /app/backups

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["./docker-entrypoint.sh"]
