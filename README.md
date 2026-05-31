# AromaSys — Warehouse Intelligence Platform

> **Enterprise-grade** warehouse management system for the fragrance & essential oil manufacturing industry. AromaSys unifies a real-time **Digital Twin**, **Gemini AI Production Copilot**, **Roboflow Computer Vision QC**, and a complete **4-role RBAC security layer** into one intelligent operations console — purpose-built for Sima Arome's production facility.

[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://render.com)
[![Neon](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E5CC?logo=postgresql)](https://neon.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Role-Based Access Control](#role-based-access-control)
- [Security](#security)
- [Team](#team)

---

## Problem Statement

**Sima Arome** — a fragrance and essential oil manufacturer — manages dozens of raw material batches (botanical extracts, synthetic fixatives, cold-storage compounds) across a multi-zone warehouse. Their existing process relies on manual spreadsheets, which creates four critical failure points:

1. **Expired materials entering production** — no automated FIFO enforcement or expiry alerting
2. **Cold-chain failures going undetected** — temperature anomalies in cold-storage zones are only found during manual checks
3. **QC bottlenecks** — lab assessors spend 15–20 minutes per batch doing visual inspections manually
4. **Zero traceability** — no immutable record of who moved what, when, or why

These gaps create compliance risk, material waste, product quality incidents, and operational inefficiency across every shift.

---

## Solution Overview

AromaSys replaces the spreadsheet workflow with a full-stack digital operations console. The system is designed around four pillars:

| Pillar | What it does |
|---|---|
| **Digital Twin** | Interactive drag-and-drop floor plan that mirrors the physical warehouse in real time, with AI-powered zone placement recommendations |
| **Intelligent Monitoring** | Continuous cold-chain telemetry with anomaly detection, automatic maintenance ticketing, and live FIFO/expiry tracking |
| **AI-Powered QC** | Roboflow computer vision models (`plants-diseases-detection`, `rotten-fruit-detector`) analyze material images in seconds, with bounding-box defect overlays and confidence scoring |
| **Enterprise Governance** | 4-role RBAC (Operator / QC / PPIC / Admin), immutable audit trail, JWT auth, rate limiting, and full compliance logging |

---

---

## Screenshots

| Preview | Module |
|---|---|
| ![AI Production Copilot](frontend/public/ld.png) | **AI Production Copilot** — Gemini 2.5 Flash chatbot with live database context, markdown rendering, quick-insight prompts |
| ![Quality Control](frontend/public/ld%20(2).png) | **Quality Control (AI Vision)** — Roboflow computer vision for plant & fruit inspection, bounding box overlay, inspection history |
| ![Auto Report](frontend/public/ld%20(3).png) | **Auto-Report Generator** — Daily/weekly/monthly reports with AI analysis, health distribution, expiry alerts, PDF/CSV export |
| ![Data Ingestion](frontend/public/ld%20(4).png) | **Data Ingestion** — Multi-file drag-and-drop upload, Gemini OCR extraction, duplicate detection, ingestion history log |
| ![Interactive Floor Plan](frontend/public/ld%20(5).png) | **Interactive Floor Plan (Digital Twin)** — Drag-and-resize zone canvas, AI placement recommendations, multi-floor tab support |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│   Next.js 16 App Router · React 19 · TypeScript         │
│   Tailwind CSS · Recharts · Framer Motion               │
│   Deployed on: Vercel                                   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST API
┌───────────────────────▼─────────────────────────────────┐
│                      BACKEND                            │
│   Express.js 5 · Node.js ESM · JWT · RBAC               │
│   Rate Limiting · Input Validation · Security Headers   │
│   Deployed on: Render                                   │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼───────────────────┐
│  Neon PostgreSQL    │   │   External AI Services        │
│  Serverless DB      │   │   · Google Gemini 2.5 Flash   │
│  Connection Pool    │   │   · Roboflow Vision API       │
│  Parameterized SQL  │   └───────────────────────────────┘
└─────────────────────┘
```

---

## Features

### Dashboard & Analytics
- 4 real-time KPI cards: active stock, nearing expiry, warehouse capacity, cold-chain alert count
- Weekly stock trend line chart (Recharts)
- Quick Stats with donut circle charts — total categories, avg days to expiry, expired item count
- Zone Summary capacity bar chart
- Expiry Alerts panel with per-item days-remaining countdown
- Items Requiring Immediate Use table (Critical / Warning classification)
- Recent Activity timeline linked to Audit Trail

### Interactive Floor Plan (Digital Twin)
- Drag-and-resize zone canvas with percentage-based positioning persisted to database
- Multi-floor layout support with named tabs (add, rename, delete)
- Upload warehouse blueprint image → Gemini vision extracts zone coordinates automatically
- CSV metadata import for bulk zone configuration
- Zone detail popup: capacity bar, material list, search & assign materials
- AI placement recommendations based on material category × zone temperature × current occupancy
- Full undo history; zone legend with temperature ranges

### FIFO & Expiry Management
- Filterable/sortable table with expiry timeline progress bars
- Color urgency: Expired / Critical ≤7 days / Warning ≤30 days / Safe
- CSV export of current filtered dataset
- FIFO order enforced by intake date

### Cold-Chain Monitor
- Per-zone temperature readings auto-refreshing every 60 seconds
- System health summary row: Stable / Warning / Critical zone counts
- SVG polyline sparkline per card (colored by status), min/max/avg stats
- Recharts AreaChart in detail modal with red/blue threshold reference lines
- Humidity indicator per zone
- One-click maintenance ticket linked to the anomalous zone

### Quality Control (AI Vision)
- Live camera capture (environment-facing 720p) or file upload ≤2 MB
- **Plant tab** → Roboflow `plants-diseases-detection-and-classification/12`
- **Fruit tab** → Roboflow `rotten-fruit-detector/3`
- Bounding box overlay with class labels and confidence percentages
- Manual fallback inspection form when AI is unavailable
- Full inspection history with delete per record and Clear All

### AI Production Copilot
- Gemini 2.5 Flash with live DB context (stock levels, expiry dates, zone temperatures)
- Quick-insight prompt buttons: low stock, expiring lots, PPIC schedule, cold storage slots, full inventory report
- Markdown rendering with tables; PDF download from chat

### Data Ingestion
- Multi-file drag-and-drop upload (CSV, PDF, images)
- Gemini OCR extraction from unstructured documents
- Duplicate detection; ingestion history log

### Auto-Report Generator
- Three report types: Daily / Weekly FIFO & Expiry / Monthly Consumption Log
- Live preview: health distribution, expiry alert table, zone utilization grid, category breakdown bars
- AI Copilot analysis with structured Key Findings + Immediate Actions (formatted markdown)
- Export to PDF (new window, self-contained HTML) or CSV/Excel

### Audit Trail
- Immutable log of every user action across all modules
- Searchable by actor, action, detail; filterable by role and module
- Actor avatar display; pagination

### User Management & Settings
- Admin-only CRUD user management with role assignment
- Profile settings: name, avatar upload, password change
- Language switcher (EN / ID) persisted per user in the database
- Notification center with real-time badge, category filters, mark-as-read

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
| Database | PostgreSQL (Neon Serverless) | pg 8.21 |
| AI / LLM | Google Gemini 2.5 Flash | `@google/genai` 2.7 |
| Computer Vision | Roboflow Inference API | REST (serverless) |
| Authentication | bcryptjs + JOSE (JWT HS256) | — |
| Rate Limiting | express-rate-limit | 8.5 |
| Input Validation | express-validator | 7.3 |
| HTTP Client | Axios | 1.16 |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- **PostgreSQL** — [Neon](https://neon.tech) free tier recommended
- **Google Gemini API key** — [aistudio.google.com](https://aistudio.google.com)
- **Roboflow API key** — [roboflow.com](https://roboflow.com)

### 1. Clone

```bash
git clone https://github.com/aryarefman/cyberhack-digendong-bokem.git
cd cyberhack-digendong-bokem
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=<long-random-string>
GEMINI_API_KEY=<your-gemini-key>
ROBOFLOW_API_KEY=lDuRssH3aG7CEpQPKIef
FRONTEND_URL=http://localhost:3002
PORT=4000
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GEMINI_API_KEY=<your-gemini-key>
```

### 4. Initialize the database

```bash
cd backend
npm run init-db
```

Seeds: 4 demo users, 17 inventory items across Zones A–E, 30 warehouse slots, 120 temperature readings (24 h × 5 zones with Zone D anomaly), 10 audit log entries.

### 5. Run

Open two separate terminals:

```bash
# Terminal 1 — Backend (http://localhost:4000)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:3002)
cd frontend && npm run dev
```

---

## Environment Variables

| Variable | Location | Required | Description |
|---|---|:---:|---|
| `DATABASE_URL` | `backend/.env` | ✅ | Neon PostgreSQL connection string |
| `JWT_SECRET` | `backend/.env` | ✅ | Secret for signing JWT tokens |
| `GEMINI_API_KEY` | `backend/.env` | ✅ | Gemini key (server-side — QC analysis, floor plan, reports) |
| `ROBOFLOW_API_KEY` | `backend/.env` | ✅ | Roboflow key for QC vision models |
| `FRONTEND_URL` | `backend/.env` | ✅ | Frontend origin for CORS allowlist |
| `PORT` | `backend/.env` | — | API port (default: `4000`; Render sets this automatically) |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | ✅ | Backend API base URL |
| `NEXT_PUBLIC_GEMINI_API_KEY` | `frontend/.env.local` | ✅ | Gemini key (browser-side chatbot) |

> **Security:** `.env` and `.env.local` are in `.gitignore` and are never committed.

---

## Demo Accounts

| Email | Password | Role | Capabilities |
|---|---|---|---|
| `admin@aromasys.id` | `demo123` | **Admin** | Full access — all modules, user management, delete |
| `qc@aromasys.id` | `demo123` | **QC** | Edit inventory, QC inspections, audit trail |
| `ppic@aromasys.id` | `demo123` | **PPIC** | Read all modules, audit trail, auto-reports |
| `operator@aromasys.id` | `demo123` | **Operator** | Dashboard, floor plan view, cold-chain, data ingestion |

---

## Deployment

The live system runs on three managed services:

| Layer | Provider | Configuration |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Root directory: `frontend` · Build: `npm run build` · Start: `npm start` |
| **Backend API** | [Render](https://render.com) | Root directory: `backend` · Build: `npm ci` · Start: `node src/server.js` |
| **Database** | [Neon](https://neon.tech) | Serverless PostgreSQL · Region: ap-southeast-1 |

### Vercel — Frontend environment variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL        = https://<your-render-service>.onrender.com/api
NEXT_PUBLIC_GEMINI_API_KEY = <your-gemini-key>
```

### Render — Backend environment variables

Set these in Render Dashboard → Service → Environment:

```
DATABASE_URL       = postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET         = <long-random-string>
GEMINI_API_KEY     = <your-gemini-key>
ROBOFLOW_API_KEY   = lDuRssH3aG7CEpQPKIef
FRONTEND_URL       = https://<your-vercel-app>.vercel.app
PORT               = (set automatically by Render)
```

> **Important:** Set `FRONTEND_URL` on Render to your actual Vercel domain, otherwise CORS will block API calls from the frontend.

---

## Project Structure

```
cyberhack-digendong-bokem/
│
├── backend/                          # Express.js REST API (deployed on Render)
│   ├── scripts/
│   │   └── init-db.js                # Database initialization & seeding
│   └── src/
│       ├── lib/
│       │   └── db.js                 # PostgreSQL connection pool (pg)
│       ├── middleware/
│       │   ├── auth.js               # JWT verification + role enforcement
│       │   ├── correlationId.js      # Request tracing ID injection
│       │   ├── rateLimit.js          # Rate limiting per endpoint group
│       │   └── validate.js           # express-validator helpers
│       ├── routes/
│       │   ├── auth.js               # POST /login, /register
│       │   ├── inventory.js          # CRUD inventory items
│       │   ├── slots.js              # Warehouse slot assignment
│       │   ├── cold-chain.js         # Temperature telemetry
│       │   ├── dashboard.js          # Aggregated KPI stats
│       │   ├── audit.js              # Immutable audit log
│       │   ├── qc.js                 # Roboflow AI analysis + history
│       │   ├── zones.js              # Floor plan zone persistence
│       │   ├── floor-plan-upload.js  # Multipart image + PDF processing
│       │   ├── profile.js            # User profile & language settings
│       │   ├── maintenance.js        # Cold-chain maintenance tickets
│       │   ├── notifications.js      # Real-time notification log
│       │   └── ingestion-history.js  # Data ingestion records
│       ├── utils/
│       │   └── jwt.js                # JWT sign/verify (JOSE, HS256)
│       └── server.js                 # Express app entry point
│
├── frontend/                         # Next.js 16 App (deployed on Vercel)
│   ├── public/                       # Static assets, landing page images
│   └── src/
│       ├── app/
│       │   ├── (auth)/               # Login + Register pages
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx        # Sidebar, header, RBAC guard, notifications
│       │   │   ├── overview/         # Real-time dashboard KPIs & charts
│       │   │   ├── floor-plan/       # Digital twin interactive floor plan
│       │   │   ├── inventory-master/ # Full inventory CRUD
│       │   │   ├── fifo-expiry/      # FIFO + expiry tracking table
│       │   │   ├── cold-chain/       # Temperature monitoring + anomaly detection
│       │   │   ├── qc/               # AI vision quality control
│       │   │   ├── data-ingestion/   # File upload + AI OCR
│       │   │   ├── auto-report/      # AI-powered report generator
│       │   │   ├── audit-trail/      # Immutable activity log viewer
│       │   │   ├── user-management/  # Admin-only user CRUD
│       │   │   └── settings/         # Profile, language, notifications
│       │   ├── layout.tsx
│       │   └── page.tsx              # Animated landing page
│       ├── components/
│       │   ├── ChatbotOverlay.tsx    # Gemini AI chatbot panel
│       │   ├── ConfirmDialog.tsx     # Reusable destructive-action dialog
│       │   ├── Portal.tsx            # React portal for modals
│       │   └── UpdateStockModal.tsx
│       ├── lib/
│       │   ├── api.ts                # Typed fetch wrapper + auth header injection
│       │   ├── auth.tsx              # Auth context + RBAC helpers
│       │   ├── constants.ts          # Zone temperature thresholds (single source)
│       │   ├── gemini.ts             # Gemini multi-model fallback chain
│       │   ├── i18n.ts               # EN/ID translation hook
│       │   ├── notifications.tsx     # Real-time notification context
│       │   └── zones.ts              # Floor plan positioning utilities
│       └── types/
│           └── index.ts              # Shared TypeScript interfaces
│
├── LICENSE
└── README.md
```

---

## API Reference

All authenticated endpoints require `Authorization: Bearer <token>` (obtained from `/api/auth/login`).

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/login` | — | Returns JWT on valid email + password |
| `POST` | `/api/auth/register` | — | Creates a new user account |

### Inventory

| Method | Endpoint | Auth | Roles | Description |
|---|---|:---:|---|---|
| `GET` | `/api/inventory` | — | All | List all inventory items |
| `POST` | `/api/inventory` | ✅ | QC, Admin | Create inventory item |
| `PUT` | `/api/inventory` | ✅ | QC, Admin | Update inventory item |
| `DELETE` | `/api/inventory` | ✅ | QC, Admin | Delete inventory item |

### Warehouse & Dashboard

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/slots` | — | All warehouse slot states |
| `POST` | `/api/slots` | ✅ | Assign material to slot |
| `GET` | `/api/dashboard/stats` | — | KPI aggregates: zone summary, weekly trend, expiry alerts |
| `GET` | `/api/cold-chain` | — | Temperature readings grouped by zone |

### Quality Control

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/qc/analyze` | ✅ | Submit base64 image → Roboflow AI analysis |
| `POST` | `/api/qc/inspect` | ✅ | Manually save inspection result |
| `GET` | `/api/qc/history` | ✅ | Retrieve past inspection records |
| `DELETE` | `/api/qc/history/:id` | ✅ | Delete a single inspection record |
| `DELETE` | `/api/qc/history` | ✅ | Clear all inspection history |

### Floor Plan

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/zones` | ✅ | Load persisted floor layout |
| `PUT` | `/api/zones` | ✅ | Save floor layout changes |
| `POST` | `/api/floor-plan-upload` | ✅ | Upload image + PDF for AI zone extraction |

### Audit, Profile & Operations

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/audit` | ✅ | Retrieve audit log entries |
| `POST` | `/api/audit` | ✅ | Write audit log entry |
| `GET` | `/api/profile` | ✅ | Get current user |
| `PUT` | `/api/profile` | ✅ | Update name / avatar |
| `PUT` | `/api/profile/password` | ✅ | Change password |
| `GET/PUT` | `/api/profile/settings/language` | ✅ | Get/set language preference |
| `POST` | `/api/maintenance` | ✅ | Create cold-chain maintenance ticket |
| `GET` | `/api/notifications` | ✅ | Get notifications for authenticated user |

---

## Role-Based Access Control

Enforced server-side in `backend/src/middleware/auth.js` and mirrored in the frontend UI.

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
| Profile Settings | ✅ | ✅ | ✅ | ✅ |

---

## Security

| Control | Implementation |
|---|---|
| Password hashing | bcryptjs — 10 salt rounds |
| Auth tokens | JWT (JOSE, HS256) — verified on every protected request |
| Route authorization | Server-side role check before every protected endpoint |
| SQL injection | Parameterized queries via `node-postgres` — zero string interpolation in SQL |
| Input validation | express-validator schema on every POST/PUT route |
| Rate limiting | 100 req / 15 min general; stricter on `/api/auth` |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1` |
| CORS | Allowlist restricted to `FRONTEND_URL` env var |
| Secrets | All credentials via environment variables — never committed to version control |
| File uploads | MIME type + size validation (client + server) before any processing |

---

## Team

**Teknologi Informasi** — Universitas XYZ

| Name | Role |
|---|---|
| **Arya Bisma Putra Refman** | Lead Developer — Full Stack Architecture, AI Integration, DevOps |
| **Ica Zika Hamizah** | Frontend Development, UI/UX Design, Responsive Layout |
| **M. Hikari Reiziq R.** | Backend API, Database Schema, Security & Middleware |
| **Ahmad Rafi Fadhillah D** | Computer Vision Pipeline, QC Module, Roboflow Integration |

---

## License

This project is licensed under the **MIT License**.  
Copyright © 2026 AromaSys — Sima Arome Logistics. All rights reserved.
