#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/home/ubuntu/intacsep"
WEB_DIR="/var/www/intacsep"
PM2_APP="index"

trap 'echo "Deployment failed at line $LINENO. Review output above; some steps may already have completed." >&2' ERR

if [[ "$EUID" -eq 0 ]]; then
  echo "Run as ubuntu, not with sudo. The script requests sudo when necessary." >&2
  exit 1
fi

for cmd in git npm pm2 rsync flock; do
  command -v "$cmd" >/dev/null || { echo "Missing command: $cmd" >&2; exit 1; }
done

exec 9>"$HOME/.intacsep-deploy.lock"
flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }

sudo -n true
cd "$APP_DIR"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Checkout main before deploying." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has local changes. Review and commit them or move them aside first:" >&2
  git status --short
  exit 1
fi

pm2 describe "$PM2_APP" >/dev/null
sudo -n nginx -t

echo "== Pulling origin/main =="
git pull --ff-only origin main

echo "== Installing frontend dependencies and building =="
cd "$APP_DIR/client"
npm ci
npm run build
test -s dist/index.html

echo "== Installing backend dependencies =="
cd "$APP_DIR/server"
npm ci
npm run build --if-present
node -e 'const b = require("bcrypt"); if (!b.compareSync("deploy-test", b.hashSync("deploy-test", 10))) process.exit(1)'

echo "== Restarting backend =="
pm2 restart "$PM2_APP" --update-env
sleep 5
node <<'NODE'
const http = require('node:http');
const req = http.get('http://127.0.0.1:3000/', res => {
  res.resume();
  if (res.statusCode >= 500) {
    console.error('Backend returned HTTP ' + res.statusCode);
    process.exitCode = 1;
  } else {
    console.log('Backend HTTP check: ' + res.statusCode);
  }
});
req.setTimeout(10000, () => req.destroy(new Error('Backend check timed out')));
req.on('error', err => { console.error(err.message); process.exitCode = 1; });
NODE

echo "== Publishing frontend =="
sudo -n mkdir -p "$WEB_DIR"
sudo -n rsync -a --delete --chmod=D755,F644 "$APP_DIR/client/dist/" "$WEB_DIR/"

sudo -n nginx -t
sudo -n systemctl enable --now nginx
sudo -n systemctl reload nginx
pm2 save

echo "== Deployment complete =="
git -C "$APP_DIR" log -1 --format='%h %s'
pm2 list
echo "Frontend: https://intacsep.spotynet.com"
echo "Backend:  https://intacsep-app.spotynet.com"
