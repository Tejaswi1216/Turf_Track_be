# TurfTrack Backend (Node.js + Supabase)

A production-style backend for a turf booking platform, built with **Express**, **Supabase**, and **Razorpay**.  
This service handles authentication, turf management, booking workflows, online payments, and superadmin reporting/settlement APIs.

## Why this project is recruiter-friendly

This repository demonstrates:
- Real-world backend architecture with modular routes/services/middleware
- Role-based access control (`user`, `admin`, `superadmin`)
- OTP-based onboarding and password recovery
- Online payment integration (Razorpay) with signature verification
- Booking conflict checks, status transitions, and cancellation/refund flows
- Admin and superadmin reporting/export endpoints

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Database/Auth:** Supabase (`@supabase/supabase-js`)
- **Payments:** Razorpay
- **Email:** Nodemailer (SMTP) and optional Resend provider
- **Observability & Middleware:** Morgan, CORS, dotenv
- **Utilities:** uuid, crypto

## Core API Modules

- **Auth** (`/api/auth`)  
  Email availability check, register with OTP, login, forgot/reset password, profile management, activity logs

- **Turfs** (`/api/turfs`)  
  Public turf discovery, owner turf management (CRUD), availability lookup

- **Bookings** (`/api/bookings`)  
  User/admin booking views, booking creation with overlap checks, cancellation with refund-window logic

- **Payments** (`/api/payments`)  
  Razorpay order creation, payment verification, online booking confirmation, pay-later flow

- **Superadmin** (`/api/superadmin`)  
  Platform overview, bookings/payments/turfs/users analytics, activity logs, settlement and export endpoints

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env`

Create a `.env` file in the project root with:

```env
# App
NODE_ENV=development
PORT=3000
OTP_EXPIRY_SECONDS=600
EXPOSE_DEV_OTP=true

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Razorpay (optional but required for payment features)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email (pick one approach)
# Option A: SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
MAIL_FROM="Turf Track <no-reply@example.com>"

# Option B: Resend
RESEND_API_KEY=your_resend_api_key
RESEND_FROM="Turf Track <no-reply@example.com>"
EMAIL_PROVIDER=resend
```

### 3) Run locally

```bash
npm run dev
```

Server starts on:

`http://localhost:3000` (or `PORT` from `.env`)

## Available Scripts

- `npm run dev` – start the API server
- `npm run start` – start the API server

## Health Check

```http
GET /
```

Response:

```json
{
  "ok": true,
  "message": "TurfTrack API Server"
}
```

## Project Structure

```text
server.js
src/
  config/       # constants, database, payment config
  middleware/   # auth middleware and role checks
  routes/       # feature routes (auth, turf, booking, payment, admin)
  services/     # auth/email services
  mappers/      # DB row to API response mapping
  utils/        # helpers (time, location, OTP, payment utils)
```

## Notes

- No dedicated lint/test/build scripts are currently defined in `package.json`.
- Some transient auth/reset state is in-memory (suitable for single-instance development; for scale, move to Redis or persistent storage).
