import { Router } from 'express';
import pool from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/ingestion-history — list history for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, file_name, file_size, category, record_count, uploaded_by,
              uploaded_at, status, notes
       FROM ingestion_history
       WHERE user_id = $1
       ORDER BY uploaded_at DESC
       LIMIT 100`,
      [userId]
    );

    const records = result.rows.map(r => ({
      id: r.id,
      fileName: r.file_name,
      fileSize: r.file_size,
      category: r.category,
      recordCount: r.record_count,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.uploaded_at,
      status: r.status,
      notes: r.notes,
    }));

    return res.json({ success: true, records });
  } catch (error) {
    console.error('Error fetching ingestion history:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ingestion-history — save a new history record
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, fileName, fileSize, category, recordCount, uploadedBy, uploadedAt, status, notes } = req.body;

    if (!id || !fileName) {
      return res.status(400).json({ success: false, error: 'id and fileName are required' });
    }

    await pool.query(
      `INSERT INTO ingestion_history (id, file_name, file_size, category, record_count, uploaded_by, user_id, uploaded_at, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         file_name = EXCLUDED.file_name,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes`,
      [id, fileName, fileSize || null, category || null, recordCount || 0,
       uploadedBy || req.user.name, userId,
       uploadedAt ? new Date(uploadedAt) : new Date(),
       status || 'Validated', notes || null]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving ingestion history:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/ingestion-history/:id — delete a record
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM ingestion_history WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ingestion history:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
