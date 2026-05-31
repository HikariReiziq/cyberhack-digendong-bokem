import { Router } from 'express';
import pool from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // exactly 2MB
const VALID_IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,.+/;

// Calculate status from expiry date
function calcStatus(expiry) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  const daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 7) return 'Kritis';
  if (daysLeft <= 30) return 'Warning';
  return 'Aman';
}

// Validate image field, returns error string or null
function validateImage(image) {
  if (!VALID_IMAGE_PATTERN.test(image)) {
    return 'Format gambar tidak valid. Gunakan JPEG, PNG, atau WebP.';
  }
  if (image.length > IMAGE_MAX_BYTES) {
    return 'Ukuran gambar melebihi batas 2MB.';
  }
  return null;
}

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const { search = '', zone = '', category = '', status = '' } = req.query;

    let queryText = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryText += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(id) LIKE $${params.length})`;
    }
    if (zone) {
      params.push(zone);
      queryText += ` AND zone = $${params.length}`;
    }
    if (category) {
      params.push(category);
      queryText += ` AND category = $${params.length}`;
    }
    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    queryText += ' ORDER BY id ASC';
    const result = await pool.query(queryText, params);

    const items = result.rows.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      qty: parseFloat(item.qty),
      unit: item.unit,
      location: item.location,
      zone: item.zone,
      dateIn: item.date_in.toISOString().split('T')[0],
      expiry: item.expiry.toISOString().split('T')[0],
      status: item.status,
      image: item.image || null
    }));

    return res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/inventory
router.post('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id, name, category, qty, unit, location, zone, dateIn, expiry, image, user } = req.body;

    // Validate image if provided
    if (image) {
      const imgErr = validateImage(image);
      if (imgErr) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: imgErr });
      }
    }

    // Auto-calculate status from expiry date
    const status = calcStatus(expiry);

    await client.query(
      `INSERT INTO inventory (id, name, category, qty, unit, location, zone, date_in, expiry, status, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, name, category, qty, unit, location, zone, dateIn, expiry, status, image || null]
    );

    if (location && location !== 'UNASSIGNED') {
      await client.query('UPDATE slots SET occupied = true, item_id = $1 WHERE id = $2', [id, location]);
    }

    const detail = `Menambahkan ${name} (${qty} ${unit}) di Slot ${location}`;
    await client.query(
      `INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date().toISOString().replace('T', ' ').substring(0, 16), user?.name || 'Unknown', user?.role || 'Operator', 'Tambah Stok', detail, 'Inventory']
    );

    await client.query('COMMIT');
    return res.json({ success: true, status });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding to inventory:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/inventory
router.put('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id, name, category, qty, unit, location, zone, dateIn, expiry, user, image } = req.body;

    // Validate image if provided
    if (image !== undefined && image !== null) {
      const imgErr = validateImage(image);
      if (imgErr) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: imgErr });
      }
    }

    // Auto-calculate status from expiry date
    const status = calcStatus(expiry);

    const oldRes = await client.query('SELECT location FROM inventory WHERE id = $1', [id]);
    const oldLocation = oldRes.rows[0]?.location;

    if (image !== undefined) {
      await client.query(
        `UPDATE inventory SET name=$1, category=$2, qty=$3, unit=$4, location=$5, zone=$6, date_in=$7, expiry=$8, status=$9, image=$10 WHERE id=$11`,
        [name, category, qty, unit, location, zone, dateIn, expiry, status, image, id]
      );
    } else {
      await client.query(
        `UPDATE inventory SET name=$1, category=$2, qty=$3, unit=$4, location=$5, zone=$6, date_in=$7, expiry=$8, status=$9 WHERE id=$10`,
        [name, category, qty, unit, location, zone, dateIn, expiry, status, id]
      );
    }

    // Update slots: free old, occupy new (only for real slot IDs)
    if (oldLocation && oldLocation !== location) {
      if (oldLocation !== 'UNASSIGNED') {
        await client.query('UPDATE slots SET occupied = false, item_id = null WHERE id = $1', [oldLocation]);
      }
      if (location && location !== 'UNASSIGNED') {
        await client.query('UPDATE slots SET occupied = true, item_id = $1 WHERE id = $2', [id, location]);
      }
    }

    const detail = `Mengubah data bahan baku ${name} (ID: ${id})`;
    await client.query(
      `INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date().toISOString().replace('T', ' ').substring(0, 16), user?.name || 'Unknown', user?.role || 'Operator', 'Edit Data', detail, 'Inventory']
    );

    await client.query('COMMIT');
    return res.json({ success: true, status });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating inventory:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /api/inventory
router.delete('/', requireRole(['QC', 'Admin', 'PPIC']), async (req, res) => {
  const { id, userName = 'Unknown', userRole = 'Operator' } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'ID is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query('SELECT name, location FROM inventory WHERE id = $1', [id]);
    const item = itemRes.rows[0];
    if (!item) throw new Error('Bahan baku tidak ditemukan');

    // Only update slots if item was assigned to a real slot
    if (item.location && item.location !== 'UNASSIGNED') {
      await client.query('UPDATE slots SET occupied = false, item_id = null WHERE id = $1', [item.location]);
    }

    await client.query('DELETE FROM inventory WHERE id = $1', [id]);

    const detail = `Menghapus data bahan baku ${item.name} (ID: ${id}) dari database`;
    await client.query(
      `INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date().toISOString().replace('T', ' ').substring(0, 16), userName, userRole, 'Hapus Data', detail, 'Inventory']
    );

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting from inventory:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

export default router;
