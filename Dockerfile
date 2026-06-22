# Debian slim base so Puppeteer's Chromium can run (Alpine lacks the libs).
FROM node:22-bookworm-slim
WORKDIR /app

# Use the system Chromium instead of Puppeteer's bundled download.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2 \
    libxss1 libgbm1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8090
CMD ["npm", "start"]
