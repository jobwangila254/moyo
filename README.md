# Moyo

A dating/social platform for Kenyan adults — swipe-based matching, instant messaging, and paid subscriptions via M-Pesa.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Backend: Express](https://img.shields.io/badge/backend-Express-000000.svg)
![Mobile: React Native / Expo](https://img.shields.io/badge/mobile-React%20Native%20%2F%20Expo-61DAFB.svg)
![Database: PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-4169E1.svg)
![CI: passing](https://img.shields.io/badge/CI-passing-brightgreen.svg)

## Features

- Swipe-based matching (like / pass) for dating & social discovery
- M-Pesa STK Push payments via the Safaricom Daraja API
- Real-time messaging powered by Socket.IO
- JWT-based authentication and authorization
- Phone number verification via SMS codes

## Tech Stack

- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL
- **Mobile:** React Native (Expo SDK 52)
- **Realtime:** Socket.IO
- **Payments:** Safaricom Daraja API (M-Pesa STK Push)
- **Media:** Cloudinary
- **CI:** GitHub Actions

## Architecture

```
moyo/
├── backend/          Express API server (Node.js + Prisma + PostgreSQL)
├── mobile/           React Native app (Expo SDK 52)
└── .github/          CI/CD workflows
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Expo CLI (`npx expo`)
- A [Cloudinary](https://cloudinary.com) account for image uploads
- (Optional) Safaricom Daraja API credentials for M-Pesa

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> && cd moyo

# Backend
cd backend && npm install
cp .env.example .env   # edit with your config
npx prisma db push
npm run seed

# Mobile
cd ../mobile && npm install
```

### 2. Configure environment

Edit `backend/.env` with:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random 32+ character string |
| `CLOUDINARY_*` | Cloudinary API credentials |
| `MPESA_*` | Safaricom Daraja API credentials (optional, simulated otherwise) |

Edit `mobile/.env` with:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the backend API (e.g. `http://192.168.1.10:5000/api`). Used in `mobile/src/config.js` as the API base; defaults to `http://localhost:5000/api` when unset. |

### 3. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Mobile
cd mobile && npx expo start
```

## API Overview

All endpoints prefixed with `/api`.

| Endpoint | Auth | Description |
|---|---|---|
| `POST /auth/register` | — | Create account |
| `POST /auth/verify-phone` | — | Verify SMS code |
| `POST /auth/login` | — | Login, returns JWT |
| `GET /auth/me` | ✓ | Current user profile |
| `GET /users/profiles` | ✓ | Browse profiles |
| `POST /users/swipe` | ✓ | Like / Pass |
| `GET /users/matches` | ✓ | Your matches |
| `POST /users/matches/:id/messages` | ✓ | Send message |
| `POST /payments/stk-push` | ✓ | M-Pesa payment |

A health check is available at `GET /api/health` (no auth). The table above lists the main endpoints.

## Testing

```bash
cd backend
npm test               # Run tests
npm run test:coverage  # With coverage report
```

## Linting & Formatting

```bash
# Backend
cd backend
npm run lint
npm run format

# Mobile
cd mobile
npm run lint
npm run format
```

## License

MIT — see the [LICENSE](LICENSE) file for details.
