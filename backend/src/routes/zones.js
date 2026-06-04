import { Router } from 'express';
import pool from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Ensure app_settings table exists (safe to run on every startup)
pool.query(`
  CREATE TABLE IF NOT EXISTS app_settings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings_key VARCHAR(100) NOT NULL,
    settings_value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, settings_key)
  )
`).catch(err => console.error('app_settings table init error:', err));

// GET /api/zones — fetch saved floor plan zones (shared across all roles)
router.get('/', requireAuth, async (req, res) => {
  try {
    // Fetch the floor plan zones saved by any Admin (most recently updated)
    const result = await pool.query(`
      SELECT settings_value 
      FROM app_settings 
      JOIN users ON users.id = app_settings.user_id 
      WHERE users.role = 'Admin' AND settings_key = $1
      ORDER BY app_settings.updated_at DESC 
      LIMIT 1
    `, ['floor_plan_zones']);

    if (result.rows.length === 0) {
      // Fallback to checking if the current user has any saved settings
      const fallbackResult = await pool.query(
        'SELECT settings_value FROM app_settings WHERE user_id = $1 AND settings_key = $2',
        [req.user.id, 'floor_plan_zones']
      );
      if (fallbackResult.rows.length === 0) {
        return res.json({ success: true, data: null });
      }
      return res.json({ success: true, data: fallbackResult.rows[0].settings_value });
    }

    return res.json({ success: true, data: result.rows[0].settings_value });
  } catch (err) {
    console.error('GET /api/zones error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/zones — save floor plan zones (only for Admin)
router.put('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, error: 'Only admins can edit the floor plan' });
    }
    const userId = req.user.id;
    const { floors } = req.body;

    if (!floors) {
      return res.status(400).json({ success: false, error: 'Missing floors data' });
    }

    await client.query('BEGIN');

    // 1. Save floor plan zones configuration to app_settings
    await client.query(
      `INSERT INTO app_settings (user_id, settings_key, settings_value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, settings_key)
       DO UPDATE SET settings_value = $3, updated_at = NOW()`,
      [userId, 'floor_plan_zones', JSON.stringify(floors)]
    );

    // 2. Extract all zone IDs across all floors
    const allZoneIds = new Set();
    const allZones = [];

    for (const floor of floors) {
      const zones = floor.interactiveZones || [];
      for (const z of zones) {
        if (z.id && !allZoneIds.has(z.id)) {
          allZoneIds.add(z.id);
          allZones.push(z);
        }
      }
    }

    // Helper function to map themes to zone letters (A-E)
    function getZoneLetter(z) {
      if (z.zone && z.zone.length === 1) return z.zone.toUpperCase();
      const theme = z.theme || 'green';
      const map = {
        blue: 'A',
        purple: 'B',
        warm: 'C',
        green: 'C',
        cyan: 'D',
        hazard: 'E',
        neutral: 'C'
      };
      return map[theme] || 'C';
    }

    const zoneIdsArray = Array.from(allZoneIds);

    // 3. Remove slots that are no longer in the floor plan layouts
    if (zoneIdsArray.length > 0) {
      // Clear location of items in slots that are being deleted
      await client.query(
        `UPDATE inventory 
         SET location = 'UNASSIGNED', zone = 'C' 
         WHERE location != 'UNASSIGNED' AND NOT (location = ANY($1::varchar[]))`,
        [zoneIdsArray]
      );
      // Delete the obsolete slots
      await client.query(
        `DELETE FROM slots 
         WHERE NOT (id = ANY($1::varchar[]))`,
        [zoneIdsArray]
      );
    } else {
      // If there are no zones in the layouts at all, unassign all items and clear slots
      await client.query(`UPDATE inventory SET location = 'UNASSIGNED', zone = 'C'`);
      await client.query(`DELETE FROM slots`);
    }

    // 4. Insert or update the active zones into the slots table
    for (const z of allZones) {
      const zoneLetter = getZoneLetter(z);
      const rowChar = zoneLetter.charAt(0);
      const colNum = parseInt(z.id.replace(/\D/g, '')) || 1;

      await client.query(
        `INSERT INTO slots (id, zone, row, col, occupied, item_id)
         VALUES ($1, $2, $3, $4, 
                 EXISTS(SELECT 1 FROM inventory WHERE location = $1), 
                 (SELECT id FROM inventory WHERE location = $1 LIMIT 1))
         ON CONFLICT (id)
         DO UPDATE SET zone = $2, row = $3, col = $4,
                       occupied = EXISTS(SELECT 1 FROM inventory WHERE location = EXCLUDED.id),
                       item_id = (SELECT id FROM inventory WHERE location = EXCLUDED.id LIMIT 1)`,
        [z.id, zoneLetter, rowChar, colNum]
      );
    }

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/zones error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
