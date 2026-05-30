import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signJwt } from '@/utils/jwt';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Strictly require both email and password — no role-only login shortcut
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan password wajib diisi' },
        { status: 400 }
      );
    }

    const res = await pool.query(
      'SELECT id, name, email, password, role, avatar FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = res.rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Kredensial tidak valid' },
        { status: 401 }
      );
    }

    // Compare password with bcrypt hash
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Kredensial tidak valid' },
        { status: 401 }
      );
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
    }, '2h'); // Expires in 2 hours

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null
      }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2 // 2 hours in seconds
    });

    return response;
  } catch (error) {
    console.error('Error in login API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
