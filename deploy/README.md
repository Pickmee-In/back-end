# PickMe VPS

Production URL: https://pickme.nekomik.web.id

## Layout

- `/var/www/pickme/backend`: backend source + migrations.
- `/var/www/pickme/frontend`: Expo Web export (static files).
- `/var/www/pickme/deploy/compose.yaml`: isolated Compose project `pickme`.
- `/var/www/pickme/.env`: production secrets, root-owned, mode 600.
- `/var/www/pickme/data/uploads`: persistent uploads, UID/GID 10001.
- `/var/www/pickme/backups`: database dumps and upload archives, root-only.

PostgreSQL 16 is the existing host service; PickMe has a dedicated `pickme`
database and login role. PostgreSQL data stays in its standard `/var/lib/postgresql`
directory. Other databases and applications are not changed. Never publish the
PickMe database password or expose a new database port.

The API container uses Node 22, host networking, `HOST=127.0.0.1`, `PORT=3010`,
read-only root filesystem, persistent upload mount, a 384 MB memory limit,
health checks, restart policy, and rotated logs. Nginx serves Expo and proxies
`/api`, `/uploads`, `/health`, and `/ready` to the API. `/ready` checks the DB.

## Deploy a backend update

Sync reviewed source into `backend/` without `.git`, `.env`, `node_modules`, or
local `dist`. Preserve `/var/www/pickme/.env` and `data/` across deployments.

```bash
cd /var/www/pickme/deploy
sudo /var/www/pickme/deploy/backup.sh
sudo docker compose build api migrate
sudo docker compose run --rm migrate
sudo docker compose up -d api
sudo docker compose ps
curl --fail https://pickme.nekomik.web.id/ready
```

Versioned SQL migrations are committed in `drizzle/`. Generate new migrations
locally with `npm run db:generate`; review them before deployment. Do not use
`db:push` on production. Backups are on the same VPS, so copy them to a separate
host for disaster recovery.

## Frontend

From the `expo/` directory in `Pickmee-In/front-end`:

```bash
npm ci
# Supply EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
npx expo export --platform web
```

Publish the contents of `dist/` to `/var/www/pickme/frontend`. Retain old hashed
assets during updates so open browser sessions can still load their chunks.
Never copy `.env`, source credentials, or backend files into the public web root.

## Google and Gemini

Expo Web uses Google Identity Services with an ID token callback and no OAuth
client secret. Configure `https://pickme.nekomik.web.id` in Authorized JavaScript
origins. Testing-mode OAuth only permits configured test users. Native Google
Sign-In remains a separate integration.

`GEMINI_API_KEY` is only in the BE env. `GEMINI_MODEL` defaults to
`gemini-3.5-flash-lite`; the older 2.5 Flash Lite endpoint is unavailable to new accounts. Missing Google audiences deny login rather
than trusting tokens for other apps. Two distinct JWT secrets (minimum 32
characters) are required in production. CORS restricts browser access to
`FRONTEND_URL`; native clients without Origin remain supported.

## Operations

```bash
sudo docker compose -f /var/www/pickme/deploy/compose.yaml logs --tail=100 api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certificates
```

The installed Certbot configuration renews the domain certificate; a deploy hook
reloads Nginx after successful renewal. The backup systemd timer runs daily and
retains 7 days of database/upload archives. A VPS backup does not include external
services or Google Cloud configuration.
