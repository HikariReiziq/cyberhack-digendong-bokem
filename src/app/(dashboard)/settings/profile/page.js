'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { User, Key, Bell, Save, Check, X, AlertCircle, Upload, Camera } from 'lucide-react';
import './profile.css';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export default function ProfilePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'account');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });

  // Avatar state
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current: '',
    newPassword: '',
    confirm: '',
  });
  const [passwordError, setPasswordError] = useState(null);

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    email: true,
    inApp: true,
  });

  // Sync user data when available
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      });
      setCurrentAvatar(user.avatar || null);
    }
  }, [user]);

  // Sync tab from URL query param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['account', 'password', 'notifications'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Avatar file selection handler
  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    // Validate file type
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Format tidak didukung. Gunakan JPG, PNG, atau GIF.');
      e.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Ukuran file melebihi batas maksimal 2MB.');
      e.target.value = '';
      return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setAvatarPreview(base64);
      setAvatarBase64(base64);
    };
    reader.onerror = () => {
      setAvatarError('Gagal membaca file. Silakan coba lagi.');
    };
    reader.readAsDataURL(file);
  }

  // Avatar save handler
  async function handleAvatarSave() {
    if (!user || !avatarBase64) return;

    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          avatar: avatarBase64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentAvatar(avatarBase64);
        setAvatarPreview(null);
        setAvatarBase64(null);
        // Update localStorage user object with new avatar
        const updatedUser = { ...user, avatar: avatarBase64 };
        localStorage.setItem('aromasys_user', JSON.stringify(updatedUser));
        // Notify topbar to update avatar
        window.dispatchEvent(new Event('aromasys_avatar_updated'));
        setToast({ type: 'success', message: 'Foto profil berhasil disimpan' });
      } else {
        setAvatarError(data.error || 'Gagal menyimpan foto profil');
        setToast({ type: 'error', message: data.error || 'Gagal menyimpan foto profil' });
      }
    } catch (err) {
      setAvatarError('Gagal terhubung ke server. Silakan coba lagi.');
      setToast({ type: 'error', message: 'Gagal terhubung ke server. Silakan coba lagi.' });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Cancel avatar preview
  function handleAvatarCancel() {
    setAvatarPreview(null);
    setAvatarBase64(null);
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Profile save handler
  async function handleProfileSave(e) {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: profileData.name,
          email: profileData.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: 'Profile updated successfully' });
        // Update localStorage user data
        const updatedUser = { ...user, name: profileData.name, email: profileData.email };
        localStorage.setItem('aromasys_user', JSON.stringify(updatedUser));
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to update profile' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Unable to connect to the server. Please try again later.' });
    } finally {
      setIsSaving(false);
    }
  }

  // Password change handler
  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!user) return;

    setPasswordError(null);

    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirm) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (!passwordData.current) {
      setPasswordError('Current password is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: passwordData.current,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: 'Password changed successfully' });
        setPasswordData({ current: '', newPassword: '', confirm: '' });
        setPasswordError(null);
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError('Unable to connect to the server. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="profile-page animate-fade">
      {/* Header */}
      <div className="profile-header">
        <h1 className="page-title">
          <User size={24} aria-hidden="true" />
          Profile Settings
        </h1>
        <p className="page-subtitle">Manage your account information and preferences</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="profile-tabs" role="tablist">
          <button
            className={`profile-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
            role="tab"
            aria-selected={activeTab === 'account'}
            aria-controls="tab-account"
          >
            <User size={16} aria-hidden="true" />
            Account
          </button>
          <button
            className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
            role="tab"
            aria-selected={activeTab === 'password'}
            aria-controls="tab-password"
          >
            <Key size={16} aria-hidden="true" />
            Password
          </button>
          <button
            className={`profile-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
            role="tab"
            aria-selected={activeTab === 'notifications'}
            aria-controls="tab-notifications"
          >
            <Bell size={16} aria-hidden="true" />
            Notifications
          </button>
        </div>

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="profile-tab-content" id="tab-account" role="tabpanel">
            {/* Avatar Upload Section */}
            <div className="profile-avatar-section">
              <h3 className="profile-section-title">Profile Photo</h3>
              <div className="profile-avatar-upload-area">
                <div className="profile-avatar-preview-container">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="profile-avatar-preview-img"
                    />
                  ) : currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Current avatar"
                      className="profile-avatar-preview-img"
                    />
                  ) : (
                    <div className="profile-avatar-initials-placeholder">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <button
                    type="button"
                    className="profile-avatar-camera-btn"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload photo"
                  >
                    <Camera size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="profile-avatar-upload-info">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    onChange={handleAvatarSelect}
                    className="profile-avatar-file-input"
                    aria-label="Select avatar image"
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} aria-hidden="true" />
                    Choose Photo
                  </button>
                  <span className="profile-avatar-hint" style={{ display: 'block', marginTop: '12px' }}>Atau masukkan URL Foto Online:</span>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://example.com/photo.jpg"
                    value={avatarPreview?.startsWith('http') ? avatarPreview : ''}
                    onChange={(e) => {
                      setAvatarPreview(e.target.value);
                      setAvatarBase64(e.target.value);
                    }}
                    style={{ marginBottom: '8px' }}
                  />
                  {avatarError && (
                    <div className="profile-avatar-error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      <span>{avatarError}</span>
                    </div>
                  )}
                  {avatarPreview && (
                    <div className="profile-avatar-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleAvatarSave}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <>
                            <div className="spinner" aria-hidden="true"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} aria-hidden="true" />
                            Save Photo
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleAvatarCancel}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* User Info Card */}
            <div className="profile-user-card">
              <div className="profile-avatar">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="User avatar" className="profile-avatar-img" />
                ) : (
                  user.name ? user.name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div className="profile-user-info">
                <h2 className="profile-user-name">{user.name}</h2>
                <p className="profile-user-email">{user.email}</p>
                <span className="badge badge-role profile-user-role">{user.role}</span>
              </div>
            </div>

            {/* Edit Form */}
            <form className="profile-form" onSubmit={handleProfileSave}>
              <div className="profile-form-group">
                <label className="field-label" htmlFor="profile-name">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className="input"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="profile-form-group">
                <label className="field-label" htmlFor="profile-email">
                  Email Address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  className="input"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="profile-form-group">
                <label className="field-label">Role</label>
                <input
                  type="text"
                  className="input"
                  value={user.role}
                  disabled
                  readOnly
                />
                <span className="field-helper">Role can only be changed by an administrator.</span>
              </div>

              <div className="profile-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner" aria-hidden="true"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} aria-hidden="true" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="profile-tab-content" id="tab-password" role="tabpanel">
            <form className="profile-password-form" onSubmit={handlePasswordChange}>
              {passwordError && (
                <div className="profile-password-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="profile-form-group">
                <label className="field-label" htmlFor="profile-current-password">
                  Current Password
                </label>
                <input
                  id="profile-current-password"
                  type="password"
                  className="input"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="profile-form-group">
                <label className="field-label" htmlFor="profile-new-password">
                  New Password
                </label>
                <input
                  id="profile-new-password"
                  type="password"
                  className="input"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                />
              </div>

              <div className="profile-form-group">
                <label className="field-label" htmlFor="profile-confirm-password">
                  Confirm New Password
                </label>
                <input
                  id="profile-confirm-password"
                  type="password"
                  className="input"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              <div className="profile-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner" aria-hidden="true"></div>
                      Changing...
                    </>
                  ) : (
                    <>
                      <Key size={16} aria-hidden="true" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="profile-tab-content" id="tab-notifications" role="tabpanel">
            <div className="profile-notifications">
              <div className="profile-notification-item">
                <div className="profile-notification-info">
                  <span className="profile-notification-label">Email Notifications</span>
                  <span className="profile-notification-desc">
                    Receive email alerts for inventory changes, expiry warnings, and system updates.
                  </span>
                </div>
                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                    aria-label="Toggle email notifications"
                  />
                  <span className="profile-toggle-slider"></span>
                </label>
              </div>

              <div className="profile-notification-item">
                <div className="profile-notification-info">
                  <span className="profile-notification-label">In-App Notifications</span>
                  <span className="profile-notification-desc">
                    Show real-time notifications in the dashboard for critical alerts and updates.
                  </span>
                </div>
                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={notifications.inApp}
                    onChange={(e) => setNotifications({ ...notifications, inApp: e.target.checked })}
                    aria-label="Toggle in-app notifications"
                  />
                  <span className="profile-toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`profile-toast animate-slide-right ${toast.type === 'error' ? 'profile-toast-error' : ''}`} role="alert">
          <div className="profile-toast-content">
            {toast.type === 'error' ? (
              <AlertCircle size={20} aria-hidden="true" />
            ) : (
              <Check size={20} aria-hidden="true" />
            )}
            <span className="profile-toast-message">{toast.message}</span>
          </div>
          <button
            className="profile-toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
