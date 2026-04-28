#!/bin/bash
# ============================================
# PRINTVOLTRABOT — Hetzner Server Deploy Script
# ============================================

set -e

echo "🚀 Printvoltrabot deploy boshlandi..."

# Variables
REPO_URL="https://github.com/yourusername/printvoltrabot.git"
APP_DIR="/opt/printvoltrabot"
ENV_FILE="$APP_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ============================================
# 1. SYSTEM REQUIREMENTS
# ============================================
log_info "Tizim yangilanmoqda..."
apt-get update -qq
apt-get install -y -qq docker.io docker-compose git curl

# Docker service
systemctl enable docker
systemctl start docker

# ============================================
# 2. APP DIRECTORY
# ============================================
if [ ! -d "$APP_DIR" ]; then
    log_info "App papkasi yaratilmoqda..."
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    git clone "$REPO_URL" .
else
    log_info "Kod yangilanmoqda..."
    cd "$APP_DIR"
    git pull origin main
fi

# ============================================
# 3. ENV FILE
# ============================================
if [ ! -f "$ENV_FILE" ]; then
    log_warn ".env fayl topilmadi! .env.example nusxa olinmoqda..."
    cp .env.example .env
    log_error ".env faylini to'ldiring: nano $ENV_FILE"
fi

# ============================================
# 4. BUILD & START
# ============================================
log_info "Docker image build qilinmoqda..."
docker-compose build --no-cache

log_info "Eski konteynerlar to'xtatilmoqda..."
docker-compose down --remove-orphans || true

log_info "Bot ishga tushirilmoqda..."
docker-compose up -d

# ============================================
# 5. DATABASE MIGRATION
# ============================================
log_info "Database migration..."
sleep 5  # DB tayyor bo'lishini kuting
docker-compose exec bot npx prisma migrate deploy || log_warn "Migration xatosi (birinchi deploy bo'lsa normal)"

# ============================================
# 6. STATUS CHECK
# ============================================
echo ""
log_info "Deploy muvaffaqiyatli tugadi!"
echo ""
docker-compose ps
echo ""
echo "📋 Log ko'rish:    docker-compose logs -f bot"
echo "🔄 Qayta ishlatish: docker-compose restart bot"
echo "⏹️  To'xtatish:     docker-compose down"
