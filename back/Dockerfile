# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

# Chromium runtime dependencies for Puppeteer (PDF generation). We install the
# system chromium and tell Puppeteer to use it instead of downloading its own.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libgtk-3-0 \
      libasound2 \
      openssl \
      wget \
      gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && wget -qO /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
         https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
         https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Prisma client needs the schema present at generate time.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

# Storage holds temporary PDFs and DB backups (mounted as a volume).
RUN mkdir -p /app/storage/tmp /app/storage/backups

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Run pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
