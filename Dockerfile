# ── Build stage ─────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ────────────────────────────────
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation libatk-bridge2.0-0 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist/
COPY data/ data/
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:${PORT:-8090}/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
EXPOSE 8090
CMD ["node", "dist/index.js"]
