import { Router } from 'express';
import { body, query } from 'express-validator';
import bcrypt from 'bcryptjs';
import pool from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const AVATAR_MAX_LENGTH = 2796202;

function normalizeRole(r) {
  const lower = (r || '').trim().toLowerCase();
  if (lower === 'admin') return 'Admin';
  if (lower === 'qc' || lower === 'quality_control') return 'QC';
  if (lower === 'ppic') return 'PPIC';
  if (lower === 'operator' || lower === 'warehouse_staff') return 'Operator';
  return r;
}
const AVATAR_FORMAT_REGEX = /^data:image\/(png|jpeg|webp);base64,/;

// Validation rules
const getProfileValidation = [
  query('userId').notEmpty().withMessage('userId parameter is required'),
];

const updateProfileValidation = [
  body('userId').notEmpty().withMessage('userId is required'),
];

const adminEditValidation = [
  body('targetUserId').notEmpty().withMessage('targetUserId is required'),
];

// GET /api/profile?userId=...
router.get('/', requireAuth, validate(getProfileValidation), async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId parameter is required' });
    }

    // Access control: non-Admins can only view their own profile
    if (req.user.role !== 'Admin' && parseInt(userId) !== parseInt(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Anda tidak memiliki akses ke data ini' });
    }

    const result = await pool.query(
      'SELECT id, name, email, role, avatar FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/profile
router.put('/', requireAuth, validate(updateProfileValidation), async (req, res) => {
  try {
    const { userId, name, email, currentPassword, newPassword, avatar } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    // Access control: non-Admins can only update their own profile
    if (req.user.role !== 'Admin' && parseInt(userId) !== parseInt(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Anda tidak memiliki akses ke data ini' });
    }

    // Avatar update flow
    if (avatar !== undefined) {
      const isBase64 = AVATAR_FORMAT_REGEX.test(avatar);
      const isUrl = /^https?:\/\/.+/.test(avatar);
      if (!isBase64 && !isUrl) {
        return res.status(400).json({ success: false, error: 'Format gambar tidak didukung atau URL tidak valid.' });
      }

      if (avatar.length > AVATAR_MAX_LENGTH) {
        return res.status(400).json({ success: false, error: 'Avatar file size exceeds 2MB limit' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT id, name, role FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await client.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);

        const avatarUserName = userRes.rows[0].name || 'User';
        const userRole = userRes.rows[0].role || 'User';
        await client.query(
          'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
          [new Date().toISOString().replace('T', ' ').substring(0, 16), avatarUserName, userRole, 'Upload Avatar', 'Updated profile photo', 'Settings']
        );

        await client.query('COMMIT');

        const updatedAvatarRes = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = $1', [userId]);
        return res.json({ success: true, user: updatedAvatarRes.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    if (newPassword) {
      // Password change flow
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT password, name, role FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, userRes.rows[0].password);
        if (!isValidPassword) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

        const pwUserName = userRes.rows[0].name || 'User';
        const userRole = userRes.rows[0].role || 'User';
        await client.query(
          'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
          [new Date().toISOString().replace('T', ' ').substring(0, 16), pwUserName, userRole, 'Change Password', 'Password changed successfully', 'Settings']
        );

        await client.query('COMMIT');
        return res.json({ success: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Profile update flow
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userRole = userRes.rows[0].role || 'User';

        await client.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, userId]);

        await client.query(
          'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
          [new Date().toISOString().replace('T', ' ').substring(0, 16), name || 'Unknown', userRole, 'Edit Profile', 'Updated profile information', 'Settings']
        );

        await client.query('COMMIT');

        const updatedProfileRes = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = $1', [userId]);
        return res.json({ success: true, user: updatedProfileRes.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/profile/admin-edit — Admin edits another user's profile
router.put('/admin-edit', requireRole(['Admin', 'ADMIN']), validate(adminEditValidation), async (req, res) => {
  try {
    const { targetUserId, name, email, role, avatar } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required' });
    }

    // Fetch target user
    const targetRes = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = $1', [targetUserId]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target user not found' });
    }

    const targetUser = targetRes.rows[0];

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramIdx = 1;
    const changedFields = [];

    if (name !== undefined && name !== targetUser.name) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name);
      changedFields.push('name');
    }
    if (email !== undefined && email !== targetUser.email) {
      updates.push(`email = $${paramIdx++}`);
      values.push(email);
      changedFields.push('email');
    }
    if (role !== undefined) {
      const normalizedRole = normalizeRole(role);
      if (normalizedRole !== targetUser.role) {
        updates.push(`role = $${paramIdx++}`);
        values.push(normalizedRole);
        changedFields.push('role');
      }
    }
    if (avatar !== undefined && avatar !== targetUser.avatar) {
      updates.push(`avatar = $${paramIdx++}`);
      values.push(avatar);
      changedFields.push('avatar');
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes detected' });
    }

    // Execute update
    values.push(targetUserId);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    );

    // Get admin name from the authenticated user
    const adminName = req.user.name || req.user.username || 'Admin';
    const employeeName = name || targetUser.name || 'Employee';
    const fieldsStr = changedFields.join(', ');

    // Create audit log entry
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        adminName,
        'Admin',
        'Admin Edit Profile',
        `Admin updated ${fieldsStr} for ${employeeName}`,
        'User Management'
      ]
    );

    // Fetch the updated user to return
    const updatedUserRes = await pool.query('SELECT id, name, email, role, avatar FROM users WHERE id = $1', [targetUserId]);
    const updatedUser = updatedUserRes.rows[0];

    return res.json({ success: true, updatedFields: changedFields, user: updatedUser });
  } catch (error) {
    console.error('Error in admin profile edit:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/profile/users — Admin lists all users
router.get('/users', requireRole(['Admin', 'ADMIN']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar FROM users ORDER BY id ASC'
    );
    return res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/profile/users — Admin registers a new user
router.post('/users', requireRole(['Admin', 'ADMIN']), async (req, res) => {
  try {
    const { name, email, role, avatar } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, and role are required' });
    }

    // Check if email already exists
    const checkEmail = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const normalizedRole = normalizeRole(role);
    const defaultHashedPassword = await bcrypt.hash('demo123', 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, avatar',
      [name, email, defaultHashedPassword, normalizedRole, avatar || null]
    );

    const adminName = req.user.name || req.user.username || 'Admin';
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        adminName,
        'Admin',
        'Admin Add User',
        `Admin added user ${name} (${normalizedRole})`,
        'User Management'
      ]
    );

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error adding user:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/profile/users/:id — Admin deletes a user
router.delete('/users/:id', requireRole(['Admin', 'ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Fetch target user first for auditing
    const checkRes = await pool.query('SELECT name, role FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const targetUser = checkRes.rows[0];

    // Prevent admin from deleting themselves
    if (parseInt(id) === parseInt(req.user.id)) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    const adminName = req.user.name || req.user.username || 'Admin';
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        adminName,
        'Admin',
        'Admin Delete User',
        `Admin deleted user ${targetUser.name} (${targetUser.role})`,
        'User Management'
      ]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/profile/users/bulk — Admin bulk inserts users (from CSV)
router.post('/users/bulk', requireRole(['Admin', 'ADMIN']), async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Users array is required and cannot be empty' });
    }

    const defaultHashedPassword = await bcrypt.hash('demo123', 10);
    let insertedCount = 0;
    let skippedCount = 0;
    const insertedUsers = [];

    for (const u of users) {
      const { name, email, role } = u;
      if (!name || !email || !role) {
        skippedCount++;
        continue;
      }

      // Check if email already exists
      const checkEmail = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (checkEmail.rows.length > 0) {
        skippedCount++;
        continue;
      }

      // Normalize role casing to match database expectation (e.g. Admin, QC, PPIC, Operator)
      let dbRole = 'Operator';
      const rLower = role.trim().toLowerCase();
      if (rLower === 'admin' || rLower === 'operations manager (admin)') dbRole = 'Admin';
      else if (rLower === 'qc' || rLower === 'quality control') dbRole = 'QC';
      else if (rLower === 'ppic' || rLower === 'production planner (ppic)') dbRole = 'PPIC';
      else if (rLower === 'operator' || rLower === 'warehouse staff') dbRole = 'Operator';
      else {
        // Fallback to capitalizing the word
        dbRole = role.charAt(0).toUpperCase() + role.slice(1);
      }

      const result = await pool.query(
        'INSERT INTO users (name, email, password, role, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, avatar',
        [name.trim(), email.trim(), defaultHashedPassword, dbRole, null]
      );
      insertedUsers.push(result.rows[0]);
      insertedCount++;
    }

    const adminName = req.user.name || req.user.username || 'Admin';
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        adminName,
        'Admin',
        'Admin Bulk Add Users',
        `Admin bulk added ${insertedCount} users (skipped ${skippedCount})`,
        'User Management'
      ]
    );

    return res.json({ success: true, insertedCount, skippedCount, users: insertedUsers });
  } catch (error) {
    console.error('Error bulk adding users:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/profile/settings — Get user notification preferences
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT settings_value FROM app_settings WHERE user_id = $1 AND settings_key = 'notification_preferences'",
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return res.json({
        success: true,
        settings: {
          email: true,
          inApp: true,
          expiry: true,
          coldChain: true
        }
      });
    }

    return res.json({ success: true, settings: result.rows[0].settings_value });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/profile/settings — Save user notification preferences
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' });
    }

    // Wrap in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO app_settings (user_id, settings_key, settings_value, updated_at)
         VALUES ($1, 'notification_preferences', $2, NOW())
         ON CONFLICT (user_id, settings_key)
         DO UPDATE SET settings_value = EXCLUDED.settings_value, updated_at = NOW()`,
        [userId, JSON.stringify(settings)]
      );

      // Audit Log
      await client.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          new Date().toISOString().replace('T', ' ').substring(0, 16),
          req.user.name || 'User',
          req.user.role || 'User',
          'Update Settings',
          'Updated notification preferences',
          'Settings'
        ]
      );

      await client.query('COMMIT');
      return res.json({ success: true, settings });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/profile/settings/:key — Get user settings by key
router.get('/settings/:key', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.params;

    const result = await pool.query(
      "SELECT settings_value FROM app_settings WHERE user_id = $1 AND settings_key = $2",
      [userId, key]
    );

    if (result.rows.length === 0) {
      // Return default preferences based on key
      let defaultVal = {};
      if (key === 'notification_preferences') {
        defaultVal = { email: true, inApp: true, expiry: true, coldChain: true };
      } else if (key === 'language') {
        defaultVal = { language: 'id' };
      }
      return res.json({ success: true, settings: defaultVal });
    }

    return res.json({ success: true, settings: result.rows[0].settings_value });
  } catch (error) {
    console.error(`Error fetching settings for key ${req.params.key}:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/profile/settings/:key — Save user settings by key
router.put('/settings/:key', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' });
    }

    // Wrap in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO app_settings (user_id, settings_key, settings_value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, settings_key)
         DO UPDATE SET settings_value = EXCLUDED.settings_value, updated_at = NOW()`,
        [userId, key, JSON.stringify(settings)]
      );

      // Audit Log action mapping
      let action = 'Update Settings';
      let detail = `Updated settings for ${key}`;
      if (key === 'language') {
        action = 'Change Language';
        detail = `Changed language to ${settings.language === 'en' ? 'English' : 'Bahasa Indonesia'}`;
      } else if (key === 'notification_preferences') {
        action = 'Update Notifications';
        detail = 'Updated notification preferences';
      }

      await client.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          new Date().toISOString().replace('T', ' ').substring(0, 16),
          req.user.name || 'User',
          req.user.role || 'User',
          action,
          detail,
          'Settings'
        ]
      );

      await client.query('COMMIT');
      return res.json({ success: true, settings });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error updating settings for key ${req.params.key}:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
