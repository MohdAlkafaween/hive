# Cloudflare Tunnel — fully CLI setup

Step-by-step to wire HIVE to a Cloudflare Tunnel without touching the Zero
Trust dashboard (one browser URL visit for OAuth, the rest is shell).

Prerequisites:
- VM with Docker + this repo cloned at `~/hive`
- Your domain is on Cloudflare DNS (free plan is fine)
- `TUNNEL_NAME` (e.g. `hive-prod`) and `DOMAIN` (e.g. `mycafe.com`) ready

All commands run on the VM (over Tailscale or local SSH).

```bash
cd ~/hive
DOMAIN=mycafe.com         # ← change to your domain
TUNNEL_NAME=hive-prod
```

## 1. Install cloudflared

```bash
curl -fsSL --output /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb
cloudflared --version
```

## 2. Authenticate (one-time browser visit, like Tailscale)

```bash
cloudflared tunnel login
```

Cloudflared prints a URL. Open it in any browser, log into Cloudflare,
select your domain (`DOMAIN` above), click **Authorize**. Cloudflared
writes `~/.cloudflared/cert.pem` and you're set.

## 3. Create the tunnel

```bash
cloudflared tunnel create "$TUNNEL_NAME"
```

This creates the tunnel on Cloudflare's side and drops the credentials
file at `~/.cloudflared/<UUID>.json`. Note the UUID it prints.

## 4. Stage credentials + config inside the project

```bash
mkdir -p cloudflared
cp ~/.cloudflared/*.json cloudflared/
TUNNEL_ID=$(ls cloudflared/*.json | head -1 | xargs basename .json)

cat > cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${DOMAIN}
    service: http://hive:3000
  # Catch-all: anything not matched returns 404
  - service: http_status:404
EOF

cat cloudflared/config.yml          # eyeball it
```

(The .gitignore in this repo excludes `cloudflared/*.json` so the
credentials never get committed.)

## 5. Create the public DNS record

```bash
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"
```

Cloudflare creates a CNAME at `${DOMAIN}` pointing to your tunnel.
Verify (may take ~30s):

```bash
dig +short "$DOMAIN" CNAME
# Expected: <tunnel-id>.cfargotunnel.com.
```

## 6. Launch the stack

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.cloudflare.yml'
dc up -d --build
dc ps                                # hive-app must be (healthy), cloudflared Up
dc logs --tail=20 cloudflared        # look for "Registered tunnel connection"
```

Open `https://${DOMAIN}` in a browser — login page should load with HTTPS.

## Adding more hostnames later

Edit `cloudflared/config.yml`, add another `ingress` entry above the
catch-all, then:

```bash
cloudflared tunnel route dns "$TUNNEL_NAME" "kiosk.${DOMAIN}"
dc restart cloudflared
```

## Migrating to another VM

Tunnels are portable. To move HIVE to a new VM keeping the same domain:

```bash
# On the OLD VM
tar czf cloudflared-backup.tgz cloudflared/

# Copy cloudflared-backup.tgz + your DB backup to the new VM, then:
tar xzf cloudflared-backup.tgz
dc up -d --build
```

The tunnel reconnects from the new machine automatically — no DNS change,
no Cloudflare dashboard step.
