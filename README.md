# Moyo

A dating/social platform for Kenyan adults — swipe-based matching, instant messaging, and paid subscriptions via M-Pesa.

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

Full API docs available at `http://localhost:5000/api/health`.

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

MIT
