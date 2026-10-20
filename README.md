# PickMe Backend API

Backend service for PickMe, built with Express + TypeScript + Drizzle + PostgreSQL.

## Stack

- Node.js (ESM)
- Express 5
- TypeScript
- Drizzle ORM + PostgreSQL (node-postgres)
- JWT auth (access + refresh)
- Multer + Sharp for image processing
- Local VPS storage or Vercel Blob for file storage

## Features

- Google authentication
- User profile APIs (including avatar update)
- Item listing APIs (create, update, delete, list own items)
- AI photo analysis endpoint for item metadata suggestion
- Explore/swipe and favorites
- Chat (conversation + messages)
- Simple pull-based notifications (non-realtime)
- Map/nearby item APIs

## Getting Started

### 1) Install dependencies

Use one of these:

```bash
npm install
```

or

```bash
bun install
```

### 2) Configure environment

Copy env template:

```bash
cp .env.example .env
```

Required minimum values:

- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `APP_URL` (public backend base URL used in API responses)
- `STORAGE_PROVIDER=local` and `UPLOAD_DIR` (or `BLOB_READ_WRITE_TOKEN` with `STORAGE_PROVIDER=blob`)
- `GOOGLE_CLIENT_ID`

Important optional values:

- `GOOGLE_CLIENT_IDS` (comma-separated additional client IDs)
- `FRONTEND_URL`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- `GEMINI_API_KEY` (photo analysis; leave empty for manual metadata entry)
- `ANTIVIRUS_ENABLED`, `ANTIVIRUS_SCAN_URL`, `ANTIVIRUS_TIMEOUT_MS` (optional external scanner)

`DATABASE_URL` is the only variable currently enforced at startup. Configure the
JWT secrets and Google client ID before using authentication; the Blob token is
required only for Blob uploads. `GOOGLE_PLACES_API_KEY` is declared but not currently used
by the services.

For the active Expo frontend, device-specific API URLs, and a complete environment
reference, see [the Expo setup guide](../front-end-rn/README.md). Expo Web uses Google Identity Services; native Google login still requires native integration.

### 3) Prepare database

```bash
npm run db:generate
npm run db:push
```

### 4) Run development server

```bash
npm run dev
```

Default URL: `http://localhost:3000`

Health checks:

- `GET /health`
- `GET /api/health`

---

## API Overview

Base prefix: `/api`

> Most endpoints require `Authorization: Bearer <access_token>`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/google` | Sign in/up with Google token payload |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout current session |
| PUT | `/auth/complete-profile` | Complete profile after auth |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Current user profile |
| GET | `/users/me/stats` | Current user profile stats |
| PATCH | `/users/me` | Update current user profile |
| PATCH | `/users/me/avatar` | Upload/update avatar image |

### Items

| Method | Endpoint | Description |
|---|---|---|
| POST | `/items/analyze` | Analyze single photo for item suggestions |
| POST | `/items` | Create item with up to 5 photos |
| GET | `/items/mine` | List current user's items |
| GET | `/items/mine/:id` | Get item detail owned by current user |
| PATCH | `/items/:id` | Update own item (supports photo replacement) |
| DELETE | `/items/:id` | Delete own item |

### Explore

| Method | Endpoint | Description |
|---|---|---|
| GET | `/explore/items` | Browse items with filters/sorting |
| POST | `/explore/swipe` | Swipe action (`pick` / `skip`) |
| GET | `/explore/favorites` | List favorites |
| DELETE | `/explore/favorites/:itemId` | Remove favorite item |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| GET | `/chat` | List user conversations |
| POST | `/chat/start` | Start conversation from an item |
| GET | `/chat/:id` | Conversation detail + messages |
| POST | `/chat/:id/messages` | Send message |

### Notifications (Simple, non-realtime)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | List notifications + unread count |
| PATCH | `/notifications/read-all` | Mark all as read |
| PATCH | `/notifications/:id/read` | Mark one as read |

### Map

| Method | Endpoint | Description |
|---|---|---|
| GET | `/map/nearby` | Nearby map markers for items |
| GET | `/map/items/:id` | Map item detail by id |

---

## File Uploads & Storage

- Image upload requests use multipart form data.
- Server processes images via Sharp (resize/compress/WebP where applicable).
- Final storage is handled via Vercel Blob.
- With `STORAGE_PROVIDER=blob`, `BLOB_READ_WRITE_TOKEN` must be valid. Local VPS storage does not use it.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Run dev server with watch |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run migration script |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed:swipe` | Seed swipe data |
| `npm run db:seed:klaten` | Seed Klaten data |

## Project Structure

```txt
src/
├── config/        # Environment and app configuration
├── controllers/   # HTTP controllers
├── db/            # Drizzle schema, DB client, migrations
├── middleware/    # Auth, validation, error handlers, upload handlers
├── routes/        # API route modules
├── services/      # Business logic layer
├── utils/         # Helpers/utilities
└── index.ts       # App entrypoint
```

## VPS deployment

See [deployment instructions](deploy/README.md) for Docker, Nginx, PostgreSQL,
HTTPS, backups, and production environment configuration.
