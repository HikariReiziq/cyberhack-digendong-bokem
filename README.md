# 🌿 AromaSys — Warehouse Management & Intelligence Platform

> Platform manajemen gudang cerdas untuk industri produksi aroma & parfum, dibangun dengan Next.js 16, React 19, PostgreSQL (Neon), dan Gemini AI.

---

## 📋 Deskripsi

AromaSys adalah aplikasi web enterprise-grade yang mengintegrasikan **Digital Twin**, **LLM Production Copilot (Gemini AI)**, dan **Enterprise Settings (RBAC & Audit)** dalam satu platform terpadu untuk manajemen gudang pabrik aroma/parfum.

---

## 🚀 Fitur Utama

| Modul | Fitur |
|-------|-------|
| **Dashboard** | Statistik real-time, grafik tren stok mingguan (Recharts), zone summary, expiry alerts |
| **Digital Twin — Floor Plan** | Denah gudang interaktif, AI placement suggestion, upload custom floor plan |
| **Digital Twin — FIFO & Expiry** | Tracking kedaluwarsa, pagination, filter, export CSV |
| **Digital Twin — Cold-Chain** | Monitor suhu real-time per zona, anomaly detection, maintenance ticket |
| **Copilot — AI Chat** | Chatbot Gemini AI dengan live database context |
| **Copilot — Data Ingestion** | Multi-file upload, OCR via Gemini AI, duplicate detection, batch commit |
| **Copilot — Auto-Report** | Generate laporan otomatis, preview, download CSV/PDF |
| **Settings — Inventory** | CRUD master data, detail card modal, image upload |
| **Settings — Audit Trail** | Log aktivitas immutable, filter, export, avatar display |
| **Settings — Profile** | Upload foto profil, edit akun, ganti password |
| **Settings — Notifications** | Notification badge dinamis, mark as read, persist localStorage |

---

## 🔐 Role-Based Access Control (RBAC)

| Fitur | Operator | QC | PPIC | Admin |
|-------|:--------:|:--:|:----:|:-----:|
| Dashboard & semua view | ✅ | ✅ | ✅ | ✅ |
| Edit/Hapus Inventory & Floor Plan | ❌ | ✅ | ❌ | ✅ |
| Audit Trail | ❌ | ❌ | ✅ | ✅ |
| Semua fitur | ❌ | ❌ | ❌ | ✅ |

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| Frontend | React 19, Lucide Icons, Recharts |
| Database | PostgreSQL (Neon Serverless) |
| AI/LLM | Google Gemini 2.5 Flash |
| Auth | bcryptjs + custom middleware |
| Styling | Custom CSS Design System |

---

## 📦 Instalasi & Setup

### Prerequisites
- Node.js 18+
- npm atau yarn
- Akun Neon PostgreSQL (atau PostgreSQL lokal)

### 1. Clone repository
```bash
git clone https://github.com/your-repo/cyberhack-digendong-bokem.git
cd cyberhack-digendong-bokem
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Buat file `.env.local` di root project:
```env
DATABASE_URL=postgresql://your_user:your_password@your-host/your_db?sslmode=require
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Inisialisasi database
```bash
node scripts/init-db.js
```
Script ini akan membuat semua tabel dan seed data awal (15 inventory items, 4 users, 30 slots, temperature readings, audit logs).

### 5. Jalankan development server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000)

---

## 👤 Akun Demo

| Email | Password | Role |
|-------|----------|------|
| operator@aromasys.id | demo123 | Operator |
| qc@aromasys.id | demo123 | QC |
| ppic@aromasys.id | demo123 | PPIC |
| admin@aromasys.id | demo123 | Admin |

---

## 📁 Struktur Project

```
cyberhack-digendong-bokem/
├── backend/                  # REST API Backend (Express.js)
│   ├── src/
│   │   ├── routes/           # API Routers (auth, qc, inventory, slots, etc.)
│   │   ├── middleware/       # Auth & validation middlewares
│   │   ├── lib/              # Database connection pool
│   │   └── server.js         # Entry point
│   ├── scripts/              # DB Init & Seed scripts
│   └── package.json          
├── frontend/                 # Next.js 16 Web Application
│   ├── public/               # Static assets & media
│   ├── src/
│   │   ├── app/              # Next.js App Router layout/pages
│   │   │   ├── (auth)/       # Authentication pages (login/register)
│   │   │   ├── (dashboard)/  # Dashboard pages (overview, floor-plan, qc, dsb.)
│   │   │   ├── layout.tsx    
│   │   │   └── page.tsx      # Landing page
│   │   ├── components/       # Shared UI components
│   │   ├── lib/              # Client utilities (api connection, auth, i18n)
│   │   └── types/            # TypeScript interfaces
│   └── package.json
├── package.json              # Workspace root configuration
└── README.md
```

---

## 🔒 Security Features

- ✅ Password hashing (bcryptjs, 10 rounds)
- ✅ Server-side RBAC middleware
- ✅ Security headers (X-Frame-Options, X-XSS-Protection, nosniff)
- ✅ Environment variables for credentials
- ✅ Input validation on all API routes
- ✅ SQL parameterized queries (no injection)
- ✅ Client-side file validation (type + size)

---

## 📊 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | Public | Login with email + password |
| POST | /api/auth/register | Public | Register new user |
| GET | /api/inventory | Public | List inventory items |
| POST | /api/inventory | Auth | Add new item |
| PUT | /api/inventory | QC/Admin | Update item |
| DELETE | /api/inventory | QC/Admin | Delete item |
| GET | /api/slots | Public | Get warehouse slots |
| GET | /api/cold-chain | Public | Get temperature readings |
| GET | /api/dashboard/stats | Public | Dashboard statistics |
| GET/POST | /api/audit | Public/Auth | Audit logs |
| GET/PUT | /api/profile | Public | User profile |
| POST | /api/maintenance | Auth | Create maintenance ticket |
| POST | /api/floor-plan-upload | Auth | Upload floor plan |
| POST | /api/qc/analyze | Auth | Analyze material quality using Roboflow models |
| POST | /api/qc/inspect | Auth | Save quality control result manually |
| GET | /api/qc/history | Auth | Retrieve quality control history |

---

## 🏗️ Build & Deploy

```bash
# Jalankan development server (frontend & backend secara bersamaan)
npm run dev

# Build untuk produksi
npm run build

# Jalankan server produksi
npm start
```

---

## 👥 Anggota Tim

**Teknologi Informasi (Information Technology):**
* **ARYA BISMA PUTRA REFMAN**
* **ICA ZIKA HAMIZAH**
* **M. HIKARI REIZIQ R.**
* **AHMAD RAFI FADHILLAH D**

---

## 📄 License

MIT License
