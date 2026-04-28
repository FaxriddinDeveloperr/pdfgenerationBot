FROM node:20-slim

# Puppeteer Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Package files
COPY package*.json ./
COPY prisma ./prisma/

# Dependencies
RUN npm ci --only=production

# Prisma generate
RUN npx prisma generate

# Source
COPY . .

# Build TypeScript
RUN npm run build

# Papkalar
RUN mkdir -p temp/pdfs logs assets

# User
RUN groupadd -r botuser && useradd -r -g botuser botuser \
    && chown -R botuser:botuser /app
USER botuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
