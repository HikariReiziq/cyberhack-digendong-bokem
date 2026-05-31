# AromaSys — Warehouse Intelligence Platform

> An enterprise-grade warehouse management system built for the fragrance & essential oil manufacturing industry. AromaSys integrates a live **Digital Twin**, a **Gemini AI Production Copilot**, **Roboflow Vision QC**, and a complete **RBAC security layer** into one unified operations console.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Role-Based Access Control](#role-based-access-control)
- [Security](#security)
- [Team](#team)

---

## Overview

AromaSys digitizes and automates the core operations of a raw-material warehouse at **Sima Arome**, a fragrance production facility. The system replaces manual tracking with a real-time intelligent console that monitors inventory levels, cold-chain sensor telemetry, material expiry, and quality control — all surfaced through an interactive floor plan digital twin.

**Key outcomes the system is designed to deliver:**
- Prevent expired raw material from entering the production line via FIFO tracking and automated expiry alerts
- Reduce cold-chain failures through continuous temperature monitoring and anomaly detection
- Cut QC inspection time with AI-powered image analysis (Roboflow vision models)
- Provide end-to-end audit traceability for compliance with food/cosmetic industry standards
- Enable data-driven warehouse decisions through AI-generated reports and copilot analysis

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│   Next.js 16 App Router (React 19 + TypeScript)         │
│   Tailwind CSS · Recharts · Framer Motion · Lucide      │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────────┐
│                       BACKEND                           │
│   Express.js 5 (Node.js ESM)                            │
│   JWT Auth · RBAC Middleware · Rate Limiting            │
│   Input Validation · Security Headers                   │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼───────────────────┐
│   PostgreSQL        │   │   External AI Services        │
│   (Neon Serverless) │   │   · Google Gemini 2.5 Flash   │
│   Parameterized SQL │   │   · Roboflow Vision API       │
│   Connection Pool   │   └───────────────────────────────┘
└─────────────────────┘
```

The frontend and backend are maintained as separate packages within a monorepo root. Communication is strictly through a versioned REST API; no server components reach the database directly.

---

## Features

### Dashboard & Analytics
- **Overview dashboard** with 4 real-time KPI cards: active stock, nearing expiry, warehouse capacity (progress bar), and cold-chain alert count
- **Weekly stock trend** line chart (Recharts)
- **Quick Stats** donut circle charts — total categories, average days to expiry, expired item count
- **Zone Summary** bar chart showing capacity utilization per warehouse zone
- **Expiry Alerts** panel with days-remaining countdown
- **Items Requiring Immediate Use** table with critical/warning classification
- **Recent Activity** timeline linked to audit trail

### Interactive Floor Plan (Digital Twin)
- Drag-and-resize interactive zone canvas with percentage-based positioning
- Multi-floor layout support (add, rename, delete floor tabs)
- Custom floor plan image upload with AI-assisted zone extraction (Gemini vision)
- CSV metadata import for bulk zone configuration with coordinate mapping
- Zone details popup: capacity bar, assigned materials list, material search & assignment
- AI placement recommendations (Gemini) based on inventory category and zone temperature
- Full undo history for all drag/resize operations
- Zone legends with temperature range indicators

### FIFO & Expiry Management
- Sortable, filterable inventory table with expiry timeline progress bars
- Color-coded urgency: Expired / Critical (≤7 days) / Warning (≤30 days) / Safe
- CSV export of filtered dataset
- FIFO ordering enforced by intake date

### Cold-Chain Monitor
- Real-time temperature readings per zone (auto-refreshes every 60 seconds)
- System health summary: Stable / Warning / Critical zone counts at a glance
- Per-zone cards: current temp, deviation from target midpoint, avg/min/max recorded, anomaly count badge
- Smooth SVG polyline sparkline charts colored by zone status
- Full Recharts AreaChart in detail modal with min/max threshold reference lines
- Humidity indicator per zone
- Maintenance ticket creation linked directly to anomalous zones

### Quality Control (AI Vision)
- Live camera capture (environment-facing, 720p) or file upload (≤2 MB)
- Roboflow vision model inference for fruit/raw material and extract/powder material types
- Bounding box overlay on detected defects with class labels and confidence percentages
- Manual inspection fallback form when AI is unavailable
- Auto-save to inspection history database
- Full inspection history table with result badges, confidence scores, and timestamps

### AI Production Copilot (Chatbot)
- Conversational AI powered by Gemini 2.5 Flash with live database context injection
- Quick-insight prompts: low stock check, expiring lots, PPIC schedule, cold storage slot finder, full inventory report
- Markdown rendering with tables in chat output
- PDF report download from chat

### Data Ingestion
- Multi-file upload (CSV, PDF, images) with drag-and-drop interface
- AI-powered OCR extraction via Gemini for unstructured documents
- Duplicate detection before database commit
- Ingestion history log with file metadata and status

### Auto-Report Generator
- Three report types: Daily Inventory Status / Weekly FIFO & Expiry / Monthly Consumption Log
- Configurable date range and export format (PDF via browser print, or CSV/Excel)
- Live preview panel with metric cards, botanical reserve progress bars, and trend analysis
- AI Copilot analysis card — on-demand English-language analysis of current warehouse state generated by Gemini
- Custom notes with Markdown formatting support (rendered in PDF export)

### Audit Trail
- Immutable activity log for all user actions across all modules
- Searchable by actor, action, or detail text
- Filterable by role and module
- Actor avatar display

### User Management & Settings
- Admin-only user management (add, edit, delete users with role assignment)
- Profile settings: name, email display, avatar upload
- Password change with current-password verification
- Language switcher (English / Bahasa Indonesia) — persisted per user in the database
- Notification center with real-time badge count, category filters, mark-as-read

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js (App Router) | 16.2.6 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 3.8 |
| Animations | Framer Motion | 11.9 |
| Icons | Lucide React | 1.16 |
| Backend Framework | Express.js | 5.1 |
| Runtime | Node.js (ESM) | 18+ |
| Database | PostgreSQL (Neon Serverless) | — |
| AI / LLM | Google Gemini 2.5 Flash | `@google/genai` 2.7 |
| Computer Vision | Roboflow Inference API | REST |
| Authentication | bcryptjs + JOSE (JWT) | — |
| Rate Limiting | express-rate-limit | 8.5 |
| Input Validation | express-validator | 7.3 |
| HTTP Client | Axios | 1.16 |
| Testing | Vitest + fast-check | 4.1 |

---

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9+ (or yarn / pnpm)
- A **PostgreSQL** database — [Neon](https://neon.tech) (free tier works) or local PostgreSQL
- A **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com)
- A **Roboflow API key** — [Roboflow](https://roboflow.com) (for QC vision features)

### 1. Clone the repository

```bash
git clone https://github.com/aryarefman/cyberhack-digendong-bokem.git
cd cyberhack-digendong-bokem
```

### 2. Install dependencies

Install dependencies for the backend and frontend separately:

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Configure environment variables

Create `backend/.env`:

```env
# PostgreSQL connection string (Neon format or local)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# JWT signing secret — use a long random string in production
JWT_SECRET=your_jwt_secret_here

# Google Gemini API key (server-side usage)
GEMINI_API_KEY=your_gemini_api_key_here

# Roboflow API key (for QC vision analysis)
ROBOFLOW_API_KEY=your_roboflow_api_key_here

# Server port (default: 4000)
PORT=4000
```

Create `frontend/.env.local`:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Google Gemini API key (browser-side chatbot)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Initialize the database

```bash
cd backend
npm run init-db
```

This creates all relational tables and seeds:
- **4 demo users** (see [Demo Accounts](#demo-accounts))
- **17 inventory items** distributed across Zones A–E
- **30 warehouse slots** with occupancy state
- **120 temperature readings** (24 hours × 5 zones) with a simulated Zone D anomaly
- **10 audit log entries** covering common operations

### 5. Start the development servers

Open two terminal windows:

```bash
# Terminal 1 — Backend API (http://localhost:4000)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:3002)
cd frontend
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) and log in with any demo account below.

---

## Environment Variables

| Variable | Location | Required | Description |
|---|---|:---:|---|
| `DATABASE_URL` | `backend/.env` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | `backend/.env` | ✅ | Secret used to sign JWT tokens |
| `GEMINI_API_KEY` | `backend/.env` | ✅ | Google Gemini API key (server-side) |
| `ROBOFLOW_API_KEY` | `backend/.env` | ✅ | Roboflow API key for QC vision models |
| `PORT` | `backend/.env` | — | API server port (default: `4000`) |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | ✅ | Backend API base URL |
| `NEXT_PUBLIC_GEMINI_API_KEY` | `frontend/.env.local` | ✅ | Gemini key for browser-side chatbot |

> **Security note:** Never commit `.env` or `.env.local` files. Both are listed in `.gitignore`.

---

## Demo Accounts

| Email | Password | Role | Access Level |
|---|---|---|---|
| `admin@aromasys.id` | `demo123` | **Admin** | Full access — all modules, user management, delete |
| `qc@aromasys.id` | `demo123` | **QC** | Edit inventory, quality control, audit trail |
| `ppic@aromasys.id` | `demo123` | **PPIC** | Read all modules, audit trail, reports |
| `operator@aromasys.id` | `demo123` | **Operator** | Dashboard, floor plan view, cold-chain, data ingestion |

---

## Project Structure

```
cyberhack-digendong-bokem/
│
├── backend/                          # Express.js REST API
│   ├── scripts/
│   │   └── init-db.js                # Database initialization & seeding
│   └── src/
│       ├── lib/
│       │   └── db.js                 # PostgreSQL connection pool (pg)
│       ├── middleware/
│       │   ├── auth.js               # JWT verification middleware
│       │   ├── correlationId.js      # Request ID injection for tracing
│       │   ├── rateLimit.js          # Rate limiting per endpoint group
│       │   └── validate.js           # express-validator helpers
│       ├── routes/
│       │   ├── auth.js               # POST /login, /register
│       │   ├── inventory.js          # CRUD inventory items
│       │   ├── slots.js              # Warehouse slot assignment
│       │   ├── cold-chain.js         # Temperature readings
│       │   ├── dashboard.js          # Aggregated stats endpoint
│       │   ├── audit.js              # Audit log read/write
│       │   ├── qc.js                 # QC analysis & history (Roboflow)
│       │   ├── zones.js              # Floor plan zone persistence
│       │   ├── floor-plan-upload.js  # Multipart image + PDF processing
│       │   ├── profile.js            # User profile & language settings
│       │   ├── maintenance.js        # Maintenance ticket creation
│       │   ├── notifications.js      # Notification read/write
│       │   └── ingestion-history.js  # Data ingestion records
│       ├── utils/
│       │   └── jwt.js                # JWT sign/verify (JOSE, HS256)
│       └── server.js                 # Express app entry point
│
├── frontend/                         # Next.js 16 application
│   ├── public/                       # Static assets (images, icons)
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/            # Login page
│       │   │   └── register/         # Registration page
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx        # Sidebar, header, auth guard, notifications
│       │   │   ├── overview/         # Dashboard overview
│       │   │   ├── floor-plan/       # Interactive digital twin floor plan
│       │   │   ├── inventory-master/ # Inventory CRUD
│       │   │   ├── fifo-expiry/      # FIFO & expiry tracking
│       │   │   ├── cold-chain/       # Temperature monitoring
│       │   │   ├── qc/               # Quality control + Roboflow AI vision
│       │   │   ├── data-ingestion/   # File upload & AI OCR
│       │   │   ├── auto-report/      # Report generator
│       │   │   ├── audit-trail/      # Audit log viewer
│       │   │   ├── user-management/  # User CRUD (Admin only)
│       │   │   └── settings/         # Profile, language, notifications
│       │   ├── layout.tsx            # Root layout
│       │   └── page.tsx              # Landing page
│       ├── components/
│       │   ├── ChatbotOverlay.tsx    # Gemini AI chatbot sliding panel
│       │   ├── ConfirmDialog.tsx     # Reusable confirmation modal
│       │   ├── Portal.tsx            # React portal for modals/overlays
│       │   └── UpdateStockModal.tsx  # Stock update modal
│       ├── lib/
│       │   ├── api.ts                # Typed fetch wrapper with auth header injection
│       │   ├── auth.tsx              # Auth context + login/register/logout/RBAC
│       │   ├── constants.ts          # Zone temperature thresholds, shared config
│       │   ├── gemini.ts             # Gemini AI call wrapper (vision + text)
│       │   ├── i18n.ts               # Internationalisation hook (EN / ID)
│       │   ├── notifications.tsx     # Notification context & generator
│       │   └── zones.ts              # Floor plan zone positioning utilities
│       └── types/
│           └── index.ts              # TypeScript interfaces & shared types
│
└── README.md
```

---

## API Reference

All authenticated endpoints require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/login` | — | Authenticate with email + password; returns JWT |
| `POST` | `/api/auth/register` | — | Create a new user account |

### Inventory

| Method | Endpoint | Auth | Roles | Description |
|---|---|:---:|---|---|
| `GET` | `/api/inventory` | — | All | List all inventory items |
| `POST` | `/api/inventory` | ✅ | QC, Admin | Create a new inventory item |
| `PUT` | `/api/inventory` | ✅ | QC, Admin | Update an existing item |
| `DELETE` | `/api/inventory` | ✅ | QC, Admin | Delete an item |

### Warehouse Slots

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/slots` | — | Get all warehouse slot states |
| `POST` | `/api/slots` | ✅ | Assign a material to a slot |

### Dashboard & Analytics

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/dashboard/stats` | — | Zone summary, weekly trend, expiry alerts, quick stats |

### Cold-Chain

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/cold-chain` | — | All temperature readings grouped by zone |

### Quality Control

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/qc/analyze` | ✅ | Submit base64 image for Roboflow AI analysis; optionally auto-saves |
| `POST` | `/api/qc/inspect` | ✅ | Manually save a QC inspection result |
| `GET` | `/api/qc/history` | ✅ | Retrieve past inspection records |

### Floor Plan & Zones

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/zones` | ✅ | Load persisted floor layout (floors + zones) |
| `PUT` | `/api/zones` | ✅ | Persist floor layout changes |
| `POST` | `/api/floor-plan-upload` | ✅ | Upload floor plan image + PDF for AI zone extraction |

### Audit

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/audit` | ✅ | Retrieve audit log entries |
| `POST` | `/api/audit` | ✅ | Write a new audit log entry |

### Profile & Settings

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/profile` | ✅ | Get current user profile |
| `PUT` | `/api/profile` | ✅ | Update name / avatar |
| `PUT` | `/api/profile/password` | ✅ | Change password |
| `GET` | `/api/profile/settings/language` | ✅ | Get persisted language preference |
| `PUT` | `/api/profile/settings/language` | ✅ | Update language preference |

### Maintenance & Notifications

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/maintenance` | ✅ | Create a maintenance ticket for a zone |
| `GET` | `/api/notifications` | ✅ | Get notifications for the authenticated user |
| `POST` | `/api/ingestion-history` | ✅ | Record a data ingestion event |

---

## Role-Based Access Control

Access is enforced server-side in the `auth.js` middleware and mirrored in the UI layer.

| Module | Operator | QC | PPIC | Admin |
|---|:---:|:---:|:---:|:---:|
| Dashboard (read) | ✅ | ✅ | ✅ | ✅ |
| Floor Plan (view) | ✅ | ✅ | ✅ | ✅ |
| Floor Plan (edit zones) | — | ✅ | — | ✅ |
| Inventory (read) | ✅ | ✅ | ✅ | ✅ |
| Inventory (create / update) | — | ✅ | — | ✅ |
| Inventory (delete) | — | ✅ | — | ✅ |
| FIFO & Expiry | ✅ | ✅ | ✅ | ✅ |
| Cold-Chain Monitor | ✅ | ✅ | ✅ | ✅ |
| Quality Control | — | ✅ | — | ✅ |
| Data Ingestion | ✅ | ✅ | ✅ | ✅ |
| Auto-Report | ✅ | ✅ | ✅ | ✅ |
| Audit Trail | — | — | ✅ | ✅ |
| User Management | — | — | — | ✅ |
| Settings (own profile) | ✅ | ✅ | ✅ | ✅ |

---

## Security

| Control | Implementation |
|---|---|
| Password hashing | bcryptjs — 10 salt rounds |
| Authentication tokens | JWT (JOSE, HS256) — verified on every protected request |
| Route authorization | Server-side RBAC middleware validates role before each endpoint |
| SQL injection prevention | Parameterized queries via `node-postgres` (`pg`) — no string interpolation in SQL |
| Input validation | express-validator schema validation on all POST/PUT routes |
| Rate limiting | express-rate-limit — 100 req / 15 min for general routes; stricter on `/auth` |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1` |
| CORS | Configured to allow only the known frontend origin |
| Credential hygiene | All secrets via environment variables — never committed to version control |
| File upload safety | MIME type and size validation (client + server) before any processing |

---

## Running Tests

```bash
cd frontend
npm test            # Run all tests once
npm run test:watch  # Watch mode (re-runs on file change)
```

Tests are written with [Vitest](https://vitest.dev) and [fast-check](https://github.com/dubzzz/fast-check) for property-based testing of utility functions.

---

## Build & Deployment

```bash
# Production build — frontend
cd frontend
npm run build
npm start           # Serves on port 3000 by default

# Production start — backend
cd backend
NODE_ENV=production npm start
```

**Recommended hosting:**

| Service | Provider |
|---|---|
| Frontend | [Vercel](https://vercel.com) (native Next.js) or Netlify |
| Backend | [Railway](https://railway.app), [Render](https://render.com), or Fly.io |
| Database | [Neon](https://neon.tech) — serverless PostgreSQL, free tier available |

Set all environment variables in your hosting platform's dashboard before deploying.

---

## Team

Developed by the **Teknologi Informasi** team:

| Name | Contribution |
|---|---|
| **Arya Bisma Putra Refman** | Lead Developer — Full Stack Architecture |
| **Ica Zika Hamizah** | Frontend Development & UI/UX |
| **M. Hikari Reiziq R.** | Backend API & Database Design |
| **Ahmad Rafi Fadhillah D** | AI Integration, QC Module & Vision Pipeline |

---

## License

This project is licensed under the **MIT License**.  
Copyright © 2026 AromaSys — Sima Arome Logistics. All rights reserved.
