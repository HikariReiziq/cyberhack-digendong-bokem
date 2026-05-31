import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import pool from '../lib/db.js';
import { signJwt, verifyJwt } from '../utils/jwt.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Normalize role aliases to canonical DB values
function normalizeRole(r) {
  if (!r) return 'Operator';
  const upper = r.toUpperCase();
  if (upper === 'WAREHOUSE_STAFF' || upper === 'OPERATOR') return 'Operator';
  if (upper === 'QUALITY_CONTROL' || upper === 'QC') return 'QC';
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'PPIC') return 'PPIC';
  return 'Operator';
}

// Allowed roles for registration and user management
const ALLOWED_ROLES = ['Operator', 'QC', 'Admin', 'PPIC', 'WAREHOUSE_STAFF', 'QUALITY_CONTROL', 'ADMIN'];

// Validation rules
const loginValidation = [
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const registerValidation = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required'),
];

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginValidation), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email dan password wajib diisi' });
    }

    const result = await pool.query(
      'SELECT id, name, email, password, role, avatar FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, error: 'Kredensial tidak valid' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Kredensial tidak valid' });
    }

    // Audit log: successful login
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [new Date().toISOString().replace('T', ' ').substring(0, 16), user.name, user.role, 'Login', `User ${user.name} logged in successfully`, 'Auth']
    );

    // Sign JWT
    const token = await signJwt({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }, '2h');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    console.error('Error in login API:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerValidation), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Semua field wajib diisi' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Role tidak valid. Allowed: ${ALLOWED_ROLES.join(', ')}` });
    }

    // Normalize role to canonical DB value (e.g. WAREHOUSE_STAFF → Operator)
    const normalizedRole = normalizeRole(role);

    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, normalizedRole]
    );
    const user = result.rows[0];

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [new Date().toISOString().replace('T', ' ').substring(0, 16), user.name, user.role, 'Register', `New user ${user.name} (${user.role}) registered`, 'Auth']
    );

    // Sign JWT for auto-login after register
    const token = await signJwt({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }, '2h');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error in register API:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/auth/refresh
// Accepts a valid (non-expired) token, returns a new token with extended 2h expiry
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided', code: 'AUTH_FAILED' });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyJwt(token);

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'AUTH_FAILED' });
    }

    // Issue a new token with extended expiry
    const newToken = await signJwt({
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    }, '2h');

    return res.json({ success: true, token: newToken });
  } catch (error) {
    console.error('Error in token refresh:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
