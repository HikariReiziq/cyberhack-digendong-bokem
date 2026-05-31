import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const today = new Date();
function daysFromNow(days) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function daysAgo(days) {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const INVENTORY = [
  { id: 'INV-001', name: 'Tepung Terigu Cakra', category: 'Tepung', qty: 500, unit: 'kg', location: 'A-1', zone: 'A', dateIn: daysAgo(30), expiry: daysFromNow(60), status: 'Aman' },
  { id: 'INV-002', name: 'Gula Pasir Putih', category: 'Gula', qty: 300, unit: 'kg', location: 'A-2', zone: 'A', dateIn: daysAgo(45), expiry: daysFromNow(15), status: 'Warning' },
  { id: 'INV-003', name: 'Minyak Goreng Sawit', category: 'Minyak', qty: 200, unit: 'liter', location: 'B-1', zone: 'B', dateIn: daysAgo(20), expiry: daysFromNow(90), status: 'Aman' },
  { id: 'INV-004', name: 'Pewarna Makanan Merah', category: 'Pewarna', qty: 50, unit: 'liter', location: 'B-2', zone: 'B', dateIn: daysAgo(60), expiry: daysFromNow(5), status: 'Kritis' },
  { id: 'INV-005', name: 'Vanilla Essence', category: 'Essence', qty: 25, unit: 'liter', location: 'C-1', zone: 'C', dateIn: daysAgo(10), expiry: daysFromNow(120), status: 'Aman' },
  { id: 'INV-006', name: 'Sodium Benzoat', category: 'Pengawet', qty: 100, unit: 'kg', location: 'E-1', zone: 'E', dateIn: daysAgo(15), expiry: daysFromNow(180), status: 'Aman' },
  { id: 'INV-007', name: 'Susu Bubuk Full Cream', category: 'Susu', qty: 150, unit: 'kg', location: 'D-1', zone: 'D', dateIn: daysAgo(5), expiry: daysFromNow(45), status: 'Aman' },
  { id: 'INV-008', name: 'Cokelat Bubuk Premium', category: 'Cokelat', qty: 80, unit: 'kg', location: 'D-2', zone: 'D', dateIn: daysAgo(25), expiry: daysFromNow(3), status: 'Kritis' },
  { id: 'INV-009', name: 'Kayu Manis Bubuk', category: 'Rempah', qty: 30, unit: 'kg', location: 'C-2', zone: 'C', dateIn: daysAgo(40), expiry: daysFromNow(25), status: 'Warning' },
  { id: 'INV-010', name: 'Asam Sitrat', category: 'Kimia', qty: 60, unit: 'kg', location: 'E-2', zone: 'E', dateIn: daysAgo(8), expiry: daysFromNow(200), status: 'Aman' },
  { id: 'INV-011', name: 'Tepung Maizena', category: 'Tepung', qty: 200, unit: 'kg', location: 'A-3', zone: 'A', dateIn: daysAgo(12), expiry: daysFromNow(75), status: 'Aman' },
  { id: 'INV-012', name: 'Gula Merah', category: 'Gula', qty: 100, unit: 'kg', location: 'A-4', zone: 'A', dateIn: daysAgo(50), expiry: daysFromNow(-2), status: 'Expired' },
  { id: 'INV-013', name: 'Minyak Kelapa', category: 'Minyak', qty: 120, unit: 'liter', location: 'B-3', zone: 'B', dateIn: daysAgo(35), expiry: daysFromNow(40), status: 'Aman' },
  { id: 'INV-014', name: 'Butter Unsalted', category: 'Susu', qty: 75, unit: 'kg', location: 'D-3', zone: 'D', dateIn: daysAgo(3), expiry: daysFromNow(20), status: 'Warning' },
  { id: 'INV-015', name: 'Pewarna Kuning Sunset', category: 'Pewarna', qty: 40, unit: 'liter', location: 'B-4', zone: 'B', dateIn: daysAgo(70), expiry: daysFromNow(-5), status: 'Expired' },
];

const USERS = [
  { name: 'Budi Santoso', email: 'operator@aromasys.id', password: 'demo123', role: 'Operator' },
  { name: 'Siti Rahayu', email: 'qc@aromasys.id', password: 'demo123', role: 'QC' },
  { name: 'Ahmad Fauzi', email: 'ppic@aromasys.id', password: 'demo123', role: 'PPIC' },
  { name: 'Diana Putri', email: 'admin@aromasys.id', password: 'demo123', role: 'Admin' },
];

const AUDIT_LOGS = [
  { timestamp: daysAgo(0) + ' 09:15', username: 'Budi Santoso', role: 'Operator', action: 'Tambah Stok', detail: 'Menambahkan Tepung Terigu Cakra 500kg di Slot A-1', module: 'Digital Twin' },
  { timestamp: daysAgo(0) + ' 10:30', username: 'Siti Rahayu', role: 'QC', action: 'Edit Data', detail: 'Mengubah jumlah Gula Pasir Putih dari 350kg menjadi 300kg', module: 'Settings' },
  { timestamp: daysAgo(1) + ' 08:00', username: 'Ahmad Fauzi', role: 'PPIC', action: 'Generate Report', detail: 'Generate laporan inventori periode Mei 2025', module: 'Copilot' },
  { timestamp: daysAgo(1) + ' 14:20', username: 'Diana Putri', role: 'Admin', action: 'Hapus Data', detail: 'Menghapus data Pewarna Biru (expired 3 bulan)', module: 'Settings' },
  { timestamp: daysAgo(2) + ' 11:45', username: 'Budi Santoso', role: 'Operator', action: 'Upload Dokumen', detail: 'Upload nota pengiriman #NT-2025-0234', module: 'Copilot' },
  { timestamp: daysAgo(2) + ' 16:00', username: 'Siti Rahayu', role: 'QC', action: 'Tambah Stok', detail: 'Menambahkan Susu Bubuk Full Cream 150kg di Slot D-1', module: 'Digital Twin' },
  { timestamp: daysAgo(3) + ' 09:00', username: 'Diana Putri', role: 'Admin', action: 'Edit Role', detail: 'Mengubah role user Eko dari Operator menjadi QC', module: 'Settings' },
  { timestamp: daysAgo(3) + ' 13:30', username: 'Ahmad Fauzi', role: 'PPIC', action: 'Export Data', detail: 'Export data FIFO & Expiry ke Excel', module: 'Digital Twin' },
  { timestamp: daysAgo(4) + ' 07:30', username: 'Budi Santoso', role: 'Operator', action: 'Tambah Stok', detail: 'Menambahkan Cokelat Bubuk Premium 80kg di Slot D-2', module: 'Digital Twin' },
  { timestamp: daysAgo(5) + ' 15:00', username: 'Siti Rahayu', role: 'QC', action: 'Tiket Maintenance', detail: 'Buat tiket maintenance untuk Cold Storage Zona D — suhu anomali', module: 'Digital Twin' },
];

function generateTempData(zoneId, baseTemp, variance, points = 24) {
  const data = [];
  for (let i = 0; i < points; i++) {
    const hour = i;
    const temp = baseTemp + (Math.random() * variance * 2 - variance);
    const anomaly = zoneId === 'D' && i >= 18 && i <= 21;
    data.push({
      zone: zoneId,
      hour: `${hour.toString().padStart(2, '0')}:00`,
      temperature: anomaly ? baseTemp + variance * 3 : parseFloat(temp.toFixed(1)),
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour).toISOString(),
    });
  }
  return data;
}

const TEMPERATURE_DATA = [
  ...generateTempData('A', 25, 2),
  ...generateTempData('B', 20, 2),
  ...generateTempData('C', 23, 2),
  ...generateTempData('D', 0, 2),
  ...generateTempData('E', 20, 2),
];

async function init() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  
  try {
    console.log('Dropping existing tables if any...');
    await client.query('DROP TABLE IF EXISTS ingestion_history CASCADE;');
    await client.query('DROP TABLE IF EXISTS app_settings CASCADE;');
    await client.query('DROP TABLE IF EXISTS qc_inspections CASCADE;');
    await client.query('DROP TABLE IF EXISTS notification_reads CASCADE;');
    await client.query('DROP TABLE IF EXISTS maintenance_tickets CASCADE;');
    await client.query('DROP TABLE IF EXISTS temperature_readings CASCADE;');
    await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await client.query('DROP TABLE IF EXISTS slots CASCADE;');
    await client.query('DROP TABLE IF EXISTS inventory CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    
    console.log('Creating tables...');
    
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        avatar TEXT DEFAULT NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE app_settings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        settings_key VARCHAR(100) NOT NULL,
        settings_value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, settings_key)
      );
    `);

    await client.query(`
      CREATE TABLE inventory (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        qty DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        location VARCHAR(50) NOT NULL,
        zone VARCHAR(50) NOT NULL,
        date_in DATE NOT NULL,
        expiry DATE NOT NULL,
        status VARCHAR(50) NOT NULL,
        image TEXT DEFAULT NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE slots (
        id VARCHAR(50) PRIMARY KEY,
        zone VARCHAR(50) NOT NULL,
        row CHAR(1) NOT NULL,
        col INTEGER NOT NULL,
        occupied BOOLEAN DEFAULT FALSE,
        item_id VARCHAR(50) REFERENCES inventory(id) ON DELETE SET NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE temperature_readings (
        id SERIAL PRIMARY KEY,
        zone VARCHAR(50) NOT NULL,
        hour VARCHAR(10) NOT NULL,
        temperature DECIMAL(5, 2) NOT NULL,
        timestamp TIMESTAMP NOT NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp VARCHAR(30) NOT NULL,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        detail TEXT NOT NULL,
        module VARCHAR(100) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE maintenance_tickets (
        id SERIAL PRIMARY KEY,
        zone VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'open'
      );
    `);

    await client.query(`
      CREATE TABLE notification_reads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_id VARCHAR(100) NOT NULL,
        read_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, notification_id)
      );
    `);

    await client.query(`
      CREATE TABLE qc_inspections (
        id SERIAL PRIMARY KEY,
        material_id VARCHAR(100) NOT NULL,
        material_type VARCHAR(50) NOT NULL,
        result VARCHAR(10) NOT NULL,
        confidence DECIMAL(5, 2) NOT NULL,
        notes TEXT,
        image TEXT,
        inspected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        inspected_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE ingestion_history (
        id VARCHAR(50) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50),
        category VARCHAR(100),
        record_count INTEGER DEFAULT 0,
        uploaded_by VARCHAR(100),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'Validated',
        notes TEXT
      );
    `);
    
    console.log('Seeding initial data...');
    
    for (const u of USERS) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        [u.name, u.email, hashedPassword, u.role]
      );
    }
    
    for (const item of INVENTORY) {
      await client.query(
        'INSERT INTO inventory (id, name, category, qty, unit, location, zone, date_in, expiry, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [item.id, item.name, item.category, item.qty, item.unit, item.location, item.zone, item.dateIn, item.expiry, item.status]
      );
    }
    
    const ROWS = ['A', 'B', 'C', 'D', 'E'];
    const COLS = 6;
    for (const row of ROWS) {
      for (let col = 1; col <= COLS; col++) {
        const slotId = `${row}-${col}`;
        const item = INVENTORY.find(i => i.location === slotId);
        await client.query(
          'INSERT INTO slots (id, zone, row, col, occupied, item_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [slotId, row, row, col, item ? true : false, item ? item.id : null]
        );
      }
    }
    
    for (const t of TEMPERATURE_DATA) {
      await client.query(
        'INSERT INTO temperature_readings (zone, hour, temperature, timestamp) VALUES ($1, $2, $3, $4)',
        [t.zone, t.hour, t.temperature, t.timestamp]
      );
    }
    
    for (const log of AUDIT_LOGS) {
      await client.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [log.timestamp, log.username, log.role, log.action, log.detail, log.module]
      );
    }
    
    console.log('Database successfully initialized and seeded! 🎉');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
