#!/bin/bash
# HIVE one-time server setup — Ubuntu 22.04/24.04 @ 13.60.47.65 (hivestation.space)
# Run from the project root:  chmod +x deploy/setup.sh && ./deploy/setup.sh
set -e

DOMAIN="hivestation.space"
SERVER_IP="13.60.47.65"

echo "=== HIVE Deployment Setup for $DOMAIN ==="

# 1. Update system
echo "[1/7] Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. Log out and back in (or run 'newgrp docker') for group changes."
fi

# 3. Install Docker Compose plugin
echo "[3/7] Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
fi

# 4. Directories (repo already ships nginx/ and deploy/)
echo "[4/7] Verifying directories..."
mkdir -p nginx deploy

# 5. DNS reminder
echo "[5/7] DNS check..."
echo "Make sure these DNS records exist BEFORE requesting the certificate:"
echo "  A record: $DOMAIN      -> $SERVER_IP"
echo "  A record: www.$DOMAIN  -> $SERVER_IP"
echo "Verify with:  dig +short $DOMAIN"
echo ""

# 6. Firewall (if ufw is active)
echo "[6/7] Firewall..."
if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "Opened ports 22, 80, 443."
fi

# 7. Production env
echo "[7/7] Environment setup..."
if [ ! -f .env ]; then
    cp deploy/.env.production .env
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|GENERATE_WITH: openssl rand -base64 32|$JWT_SECRET|" .env
    echo "Created .env with a generated JWT_SECRET."
    echo ">>> Edit .env now: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD. <<<"
else
    echo ".env already exists, skipping."
fi

cat <<'EOF'

=== Setup complete — deployment steps ===

1. Edit .env — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.

2. Confirm DNS resolves to this server:   dig +short hivestation.space

3. SSL BOOTSTRAP (first time only — nginx can't start with the SSL config
   until the certificate exists):

     cp nginx/nginx.conf nginx/nginx.conf.full          # keep the real config
     cp nginx/nginx-http-only.conf nginx/nginx.conf     # temporary HTTP-only
     docker compose up -d --build hive nginx

     docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
       -d hivestation.space -d www.hivestation.space \
       --email YOUR-EMAIL@domain.com --agree-tos --no-eff-email

     cp nginx/nginx.conf.full nginx/nginx.conf          # restore SSL config
     docker compose restart nginx

4. Full stack up:        docker compose up -d
   Check health:         docker compose ps     (hive-app should be "healthy")
   Logs:                 docker compose logs -f hive

5. Seed the admin account (first run only):
     - set ALLOW_SEED=true in .env
     - docker compose up -d hive        (recreates with the new env)
     - visit https://hivestation.space/api/auth/seed
     - set ALLOW_SEED=false in .env and: docker compose up -d hive

6. Log in at https://hivestation.space/login
   Then in the app: set backup schedule, capacity, receipt save path, and
   re-link the receipt printer on the on-site till PC (PRINTER_SETUP.md —
   printing is client-side; the server/Docker are not involved).

7. Updating the app later:
     git pull && docker compose up -d --build hive

Database, backups, receipt JSONs and uploads live on the named volumes
(hive-data, hive-uploads) and survive rebuilds. For off-server safety, copy
backups out periodically, e.g. a daily cron:
  docker cp hive-app:/app/data/backups /srv/hive-offsite/
EOF
