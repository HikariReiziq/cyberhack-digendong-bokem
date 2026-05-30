import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

const AVATAR_MAX_LENGTH = 2796202;
const AVATAR_FORMAT_REGEX = /^data:image\/(png|jpeg|webp);base64,/;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const res = await pool.query(
      'SELECT id, name, email, role, avatar FROM users WHERE id = $1',
      [userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user: res.rows[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { userId, name, email, currentPassword, newPassword, avatar } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Avatar update flow
    if (avatar !== undefined) {
      // Validate avatar format (either base64 data URI or valid http/https URL)
      const isBase64 = AVATAR_FORMAT_REGEX.test(avatar);
      const isUrl = /^https?:\/\/.+/.test(avatar);
      if (!isBase64 && !isUrl) {
        return NextResponse.json(
          { success: false, error: 'Format gambar tidak didukung atau URL tidak valid.' },
          { status: 400 }
        );
      }

      // Validate avatar size
      if (avatar.length > AVATAR_MAX_LENGTH) {
        return NextResponse.json(
          { success: false, error: 'Avatar file size exceeds 2MB limit' },
          { status: 400 }
        );
      }

      const userRes = await pool.query(
        'SELECT id, name FROM users WHERE id = $1',
        [userId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      await pool.query(
        'UPDATE users SET avatar = $1 WHERE id = $2',
        [avatar, userId]
      );

      // Audit log: avatar upload
      const avatarUserName = userRes.rows[0].name || 'User';
      await pool.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [new Date().toISOString().replace('T', ' ').substring(0, 16), avatarUserName, 'User', 'Upload Avatar', 'Updated profile photo', 'Settings']
      );

      return NextResponse.json({ success: true });
    }

    if (newPassword) {
      // Password change flow with bcrypt
      const userRes = await pool.query(
        'SELECT password, name FROM users WHERE id = $1',
        [userId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      // Compare current password with stored hash
      const isValidPassword = await bcrypt.compare(currentPassword, userRes.rows[0].password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Hash new password before storing
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedNewPassword, userId]
      );

      // Audit log: password change
      const pwUserName = userRes.rows[0].name || 'User';
      await pool.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [new Date().toISOString().replace('T', ' ').substring(0, 16), pwUserName, 'User', 'Change Password', 'Password changed successfully', 'Settings']
      );
    } else {
      // Profile update flow
      const userRes = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      await pool.query(
        'UPDATE users SET name = $1, email = $2 WHERE id = $3',
        [name, email, userId]
      );

      // Audit log: profile update
      await pool.query(
        'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
        [new Date().toISOString().replace('T', ' ').substring(0, 16), name || 'Unknown', 'User', 'Edit Profile', 'Updated profile information', 'Settings']
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
