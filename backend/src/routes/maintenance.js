import { Router } from 'express';
import pool from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/maintenance
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_tickets ORDER BY created_at DESC');
    return res.json({ success: true, tickets: result.rows });
  } catch (error) {
    console.error('Error fetching maintenance tickets:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/maintenance
router.post('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { zone, description, priority, createdBy } = req.body;

    if (!zone || !description || !priority || !createdBy) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required (zone, description, priority, createdBy)'
      });
    }

    const ticketRes = await client.query(
      `INSERT INTO maintenance_tickets (zone, description, priority, created_by) 
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [zone, description, priority, createdBy]
    );

    const ticket = ticketRes.rows[0];

    const userRole = req.user?.role || 'Operator';
    await client.query(
      `INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        createdBy, userRole, 'Tiket Maintenance',
        `Buat tiket maintenance untuk Zona ${zone} — ${description.substring(0, 80)}`,
        'Cold Chain'
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      ticket: {
        id: ticket.id, zone, description, priority,
        createdBy, createdAt: ticket.created_at, status: 'open'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating maintenance ticket:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

export default router;
