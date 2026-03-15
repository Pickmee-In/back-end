# Terserah.in Backend

Backend API untuk aplikasi Terserah.in menggunakan Express.js, TypeScript, dan PostgreSQL (Neon).

## Tech Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Language**: TypeScript
-   **Database**: PostgreSQL (Neon)
-   **ORM**: Drizzle ORM
-   **Authentication**: JWT

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

Copy `.env.example` ke `.env` dan isi dengan nilai yang sesuai:

```bash
cp .env.example .env
```

**Konfigurasi Neon PostgreSQL:**

1. Buat akun di [Neon](https://console.neon.tech)
2. Buat project baru
3. Copy connection string ke `DATABASE_URL` di `.env`

### 3. Setup Database

Generate dan jalankan migration:

```bash
# Generate migration dari schema
npm run db:generate

# Push schema ke database
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000`

## API Endpoints

### Authentication (Google-only)

| Method | Endpoint                     | Description                 |
| ------ | ---------------------------- | --------------------------- |
| POST   | `/api/auth/google`           | Login/Register dengan Google |
| POST   | `/api/auth/refresh`          | Refresh access token        |
| POST   | `/api/auth/logout`           | Logout (revoke token)       |
| PUT    | `/api/auth/complete-profile` | Lengkapi profil user        |

### Google Auth Environment

Tambahkan env berikut:

- `GOOGLE_CLIENT_ID` → Web OAuth client ID untuk validasi `idToken`
- `GOOGLE_CLIENT_IDS` (opsional) → daftar client ID tambahan dipisah koma (Android/iOS)

### Users

| Method | Endpoint        | Description         |
| ------ | --------------- | ------------------- |
| GET    | `/api/users/me` | Get current user    |
| PATCH  | `/api/users/me` | Update current user |

### Explore & Swipe (PickMe)

| Method | Endpoint                         | Description |
| ------ | -------------------------------- | ----------- |
| GET    | `/api/explore/items`             | Explore items dengan filtering/sorting/lokasi |
| POST   | `/api/explore/swipe`             | Swipe item (`pick` = favorite, `skip` = lewat) |
| GET    | `/api/explore/favorites`         | List favorite items user |
| DELETE | `/api/explore/favorites/:itemId` | Hapus item dari favorite |

> Semua endpoint `/api/explore/*` membutuhkan Bearer token.

## Project Structure

```
src/
├── config/         # Configuration
├── controllers/    # Request handlers
├── db/             # Database schema & connection
├── middleware/     # Express middleware
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utilities
└── index.ts        # Entry point
```

## Scripts

| Script                | Description              |
| --------------------- | ------------------------ |
| `npm run dev`         | Start development server |
| `npm run build`       | Build for production     |
| `npm start`           | Start production server  |
| `npm run db:generate` | Generate migration       |
| `npm run db:migrate`  | Run migrations           |
| `npm run db:push`     | Push schema to DB        |
| `npm run db:studio`   | Open Drizzle Studio      |
| `npm run db:seed:swipe` | Seed data explore/swipe |
