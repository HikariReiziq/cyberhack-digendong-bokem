# AromaSys — Software Requirements Document (V2)

> **Project:** AromaSys — Warehouse Management & Intelligence Platform  
> **Version:** 2.0 (Updated)  
> **Status:** In Progress  
> **Last Updated:** 29 Mei 2026  
> **Team:** Hikari, Arya, Icaz + AI Antigravity

---

## 1. Project Overview

AromaSys adalah aplikasi manajemen gudang berbasis web yang mengintegrasikan **Digital Twin**, **LLM Production Copilot**, dan **Enterprise Settings (RBAC & Audit)** dalam satu platform terpadu. Aplikasi ini dirancang untuk industri produksi/pabrik yang membutuhkan pelacakan inventori bahan baku, pemantauan suhu cold-chain, dan otomasi laporan.

---

## 2. Pencapaian Fase 1 (Telah Dikerjakan)

- ✅ **Pemindahan UI Chatbot:** Tombol dan antarmuka AI Chatbot dipindahkan dari pojok kanan bawah ke bagian atas (navbar) di sebelah tombol settings.
- ✅ **Sapaan Awal AI:** Chatbot Copilot diberi nama **Aro** dan di-set untuk selalu menyapa menggunakan bahasa Inggris pada sapaan awal.
- ✅ **Resolusi Error API (Rate Limit 429):** Mengganti API Key dan mengimplementasikan mekanisme **Model Fallback Chain** (`gemini-2.5-flash-lite`, `gemini-2.0-flash-lite`, `gemini-2.5-flash`, `gemini-2.0-flash`) untuk menangani limit kuota API.
- ✅ **Optimasi Context Window:** Merampingkan payload data inventory, zona, dan suhu yang dikirim ke LLM agar lebih menghemat penggunaan token.
- ✅ **Konsistensi Bahasa LLM:** Memisahkan system prompt menggunakan field `systemInstruction` untuk memaksa AI menjawab secara akurat menggunakan bahasa yang sama dengan yang diketik user.
- ✅ **Perbaikan Bug UI:** Menangani masalah React duplicate keys (error `501`) pada history pesan chatbot dengan meng-generate ID unik (berbasis timestamp).

---

## 3. Rencana Pengembangan Lanjutan (Fase 2)

### 3.1 Keamanan & Sesi (Authentication)
- **JWT Cookie Expiration:** 
  - Mengubah manajemen sesi untuk menggunakan JWT berbasis HTTP-only cookies.
  - Jika token expired atau user idle dalam waktu tertentu, user akan otomatis di-logout dan diarahkan kembali ke halaman login.

### 3.2 Manajemen Profil
- **Custom Profile Picture (URL):** 
  - Di halaman profil, tambahkan kolom input untuk "URL Foto Online".
  - Update komponen avatar agar bisa merender gambar dari URL eksternal yang diinputkan user, alih-alih menggunakan gambar statis.

### 3.3 Interactive Floor Plan (Denah Gudang)
- **Fitur "Add Zone":**
  - **Tombol Baru:** Tambahkan tombol "Add Zone" di halaman Interactive Floor Plan.
  - **Mekanisme Drag & Resize:** Saat diklik, akan muncul bentuk kotak/persegi panjang default di area kosong (tengah). Terdapat 4 titik kontrol (handle) di masing-masing sisi yang bisa di-drag user untuk mengubah panjang dan lebar (dimensi visual).
  - **Detail Zona (Form Modal & Action Edit):** Terdapat tombol aksi **Edit** pada zona yang dibuat. Di dalam detail zona, user harus mengisi form:
    - Huruf & Nomor Zona (Validasi harus unik, tidak boleh duplikat).
    - Checkbox: "Terdapat Sensor Suhu?" → Jika Yes, muncul field URL API untuk koneksi data suhu.
    - Checkbox: "Terdapat Sensor Humidity?" → Jika Yes, muncul field URL API untuk koneksi data kelembaban.
  - **Tambahkan Material ke Zona ("Add Material"):**
    - Di dalam zona, ada tombol "Add Material".
    - User melakukan pencarian (search) material.
    - Setelah dicari, muncul informasi material secara keseluruhan beserta Material Lot ID (contoh: `INV-XXX-X`).
    - Klik tombol Add untuk memasukkan bahan ke zona tersebut.
  - **Kalkulasi Capacity Utilization:**
    - Perhitungan kapasitas zona menggunakan formula persentase berdasarkan daftar list item yang didaftarkan ke zona tersebut.
    - *Contoh:* Zona D menampung Kayu Manis (Max kapasitas 30) dan Minyak Goreng (Max kapasitas 20 liter). Maka persentase penggunaan (Capacity Utilization) dihitung dari jumlah stok yang terisi dibagi total max kapasitas dari item-item tersebut (format persen).

### 3.4 Inventory Master (Master Data)
- **Pembaruan Kolom Data (Add/Edit Record):**
  - Menambahkan field baru: "Max Kapasitas" untuk material.
  - Menambahkan field pengaturan threshold status stok (indikator: Low, Normal, Optimal, High).
- **Fitur "Update Stock":**
  - Jika material sudah pernah disimpan, akan muncul tombol baru **"Update Stock"** (berdampingan dengan "Add new Record").
  - **Flow Update Stock:**
    1. Klik "Update Stock".
    2. Muncul modal berisi fitur Search "Material Name".
    3. Setelah material dipilih, tampil info read-only: Nama, Kategori, Qty saat ini, Satuan, dan Lokasi (Location Slot).
    4. User menginput data baru: "Add Quantity" (jumlah tambahan), "Location Slot" baru (opsional jika berubah), "Intake Date", dan "Expiry Date".
    5. Klik Save Update.
- **Auto-Generate Material Lot ID:**
  - Setiap terjadi "Update Stock", sistem akan meng-generate "Material Lot ID" baru.
  - Format penomoran berlanjut berdasarkan material. Contoh: `INV-XXX-2`. Update berikutnya menjadi `INV-XXX-3`. Rumus: `INV-[KODE]-(+1)`.

---

## 4. User Roles & Access Control (RBAC)

| Role | Deskripsi | Hak Akses Utama |
|------|-----------|-----------------|
| **Operator** | Pengguna harian gudang | Lihat semua menu, tidak bisa edit/hapus master data |
| **QC** | Quality Control | Lihat + edit/hapus data di Database Inventori |
| **PPIC** | Production Planning & Inventory Control | Lihat semua + akses Audit Trail |
| **Admin** | Administrator sistem | Akses penuh ke semua fitur dan pengaturan |

---

## 5. User Flow

```
[START]
  │
  ▼
[LOGIN / REGISTER PAGE]
  ├─ Input: Email & Password
  ├─ Tombol: Login, Daftar Akun, Lupa Password
  └─ Sistem: Cek kredensial → JWT divalidasi → redirect ke Dashboard
  │
  ▼
[GLOBAL DASHBOARD]  ← Halaman utama setelah login
  ├─ Widget 1: Ringkasan Kapasitas Gudang (real-time dari DB)
  ├─ Widget 2: Peringatan FIFO/Expired (merah = kritis, kuning = warning)
  ├─ Widget 3: Alert Suhu Cold-Chain (muncul otomatis jika ada anomali)
  ├─ Banner Alert: Suhu Kritis & Status Expired (otomatis)
  └─ Tombol Cepat: "Tanya Copilot", "Lihat Denah Gudang"
  │
  ▼
[SIDEBAR NAVIGASI — Persistent, selalu tampil di kiri layar]
  ├─ Menu: Warehouse Digital Twin
  ├─ Menu: LLM Production Copilot
  └─ Menu: Enterprise Settings
```

---

## 6. Ringkasan Hak Akses Per Fitur

| Fitur | Operator | QC | PPIC | Admin |
|-------|----------|----|------|-------|
| Login & Register | ✅ | ✅ | ✅ | ✅ |
| Global Dashboard | ✅ | ✅ | ✅ | ✅ |
| Denah Gudang (lihat) | ✅ | ✅ | ✅ | ✅ |
| Denah Gudang (edit/hapus/tambah zona) | ❌ | ✅ | ❌ | ✅ |
| Cold-Chain Monitor | ✅ | ✅ | ✅ | ✅ |
| FIFO & Expiry Tracker | ✅ | ✅ | ✅ | ✅ |
| Chatbot Asisten | ✅ | ✅ | ✅ | ✅ |
| Data Ingestion | ✅ | ✅ | ✅ | ✅ |
| Auto-Report | ✅ | ✅ | ✅ | ✅ |
| Database Inventori (lihat) | ✅ | ✅ | ✅ | ✅ |
| Database Inventori (edit/hapus/update stock) | ❌ | ✅ | ❌ | ✅ |
| Audit Trail | ❌ | ❌ | ✅ | ✅ |

---

## 7. Tech Stack (Rencana)

| Layer | Teknologi |
|-------|-----------|
| Frontend | React / Next.js (Turbopack) |
| Backend | Node.js (Next.js API Routes) |
| Database | Mock Database / JSON Context (saat ini) |
| OCR | Tesseract / Google Vision (TBD) |
| LLM | Google Gemini (2.0 / 2.5 Flash Lite) |
| Auth | JWT Cookies |

---

## 8. Catatan Tambahan

- **Banner Alert** di dashboard bersifat otomatis — tidak perlu trigger manual dari user
- **Persistent Sidebar** selalu tampil di semua halaman setelah login
- **Audit Trail** bersifat immutable — tidak ada UI edit/hapus untuk log
- **AI Saran Penempatan** di Denah Gudang menggunakan analisis berbasis kategori bahan (berbahaya / tidak berbahaya / perlu cold-chain)
- **Cek Duplikasi** di Data Ingestion dilakukan sebelum data masuk ke database — user harus konfirmasi manual jika ada potensi duplikat

---

*Dokumen ini adalah living document — update seiring perkembangan proyek.*
