"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  User as UserIcon,
  Search,
  Trash2,
  Camera,
  Pencil,
  AlertTriangle,
  X,
  UploadCloud
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { api } from "@/lib/api";

// Inline types to avoid cross-module dark-theme component imports
type UserRole = "ADMIN" | "QUALITY_CONTROL" | "WAREHOUSE_STAFF" | "PPIC";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const MOCK_USERS: User[] = [
  { id: "u-1", name: "Admin Operator", email: "admin@simaarome.com", role: "ADMIN", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200" },
  { id: "u-2", name: "QC Inspector", email: "qc@simaarome.com", role: "QUALITY_CONTROL", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200" },
  { id: "u-3", name: "Warehouse Staff", email: "staff@simaarome.com", role: "WAREHOUSE_STAFF", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200" },
];

const ROLE_MAP: Record<string, string> = {
  ADMIN: 'Admin',
  QUALITY_CONTROL: 'QC',
  WAREHOUSE_STAFF: 'Operator',
  PPIC: 'PPIC',
};

export default function UserManagementPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [search, setSearch] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("WAREHOUSE_STAFF");
  const [formAvatar, setFormAvatar] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: "", desc: "" });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("WAREHOUSE_STAFF");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modal state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !['Admin', 'ADMIN'].includes(user.role || ''))) {
      router.replace('/overview');
    }
  }, [user, loading, router]);

  const fetchUsers = async () => {
    setFetchError(null);
    try {
      const data = await api.get<{ success: boolean; users: any[]; error?: string }>('/profile/users');
      if (data.success) {
        const mappedUsers = data.users.map((u: any) => {
          let mappedRole: UserRole = "WAREHOUSE_STAFF";
          const roleUpper = (u.role || '').toUpperCase();
          if (roleUpper === 'ADMIN') mappedRole = 'ADMIN';
          else if (roleUpper === 'QC' || roleUpper === 'QUALITY_CONTROL') mappedRole = 'QUALITY_CONTROL';
          else if (roleUpper === 'PPIC') mappedRole = 'PPIC';
          
          return {
            id: String(u.id),
            name: u.name,
            email: u.email,
            role: mappedRole,
            avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2C742F&color=fff&size=200`
          };
        });
        setUsers(mappedUsers);
      } else {
        setFetchError(data.error || 'Gagal memuat data pengguna');
        setUsers([]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setFetchError('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formName) errors.formName = "Name is required";
    if (!formEmail) errors.formEmail = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formEmail)) {
      errors.formEmail = "Invalid email format";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSaving(true);

    api.post<{ success: boolean; error?: string }>('/profile/users', {
      name: formName,
      email: formEmail,
      role: formRole,
      avatar: formAvatar || undefined
    })
    .then(data => {
      if (data.success) {
        fetchUsers();
        setFormName("");
        setFormEmail("");
        setFormAvatar(null);
        setIsSaving(false);
        setToastMessage({ title: "Staff Added Successfully", desc: "New employee credentials have been registered." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        setFormErrors({ formEmail: data.error || "Gagal mendaftar" });
        setIsSaving(false);
      }
    })
    .catch(() => {
      const newStaff: User = {
        id: `u-${Date.now()}`,
        name: formName,
        email: formEmail,
        role: formRole,
        avatar: formAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formName)}&background=2C742F&color=fff&size=200`,
      };
      const updated = [...users, newStaff];
      setUsers(updated);
      localStorage.setItem("sima_arome_users_list", JSON.stringify(updated));

      setFormName("");
      setFormEmail("");
      setFormAvatar(null);
      setIsSaving(false);
      setToastMessage({ title: "Staff Added (Offline)", desc: "Saved locally." });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    });
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(true);
    try {
      const data = await api.delete<{ success: boolean; error?: string }>(`/profile/users/${userId}`);
      if (data.success) {
        fetchUsers();
        setToastMessage({ title: "Staff Removed", desc: "Employee record deleted from database." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        setToastMessage({ title: "Delete Failed", desc: data.error || "Failed to delete user" });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    } catch {
      const updated = users.filter((u) => u.id !== userId);
      setUsers(updated);
      localStorage.setItem("sima_arome_users_list", JSON.stringify(updated));
      setToastMessage({ title: "Staff Removed (Offline)", desc: "Deleted locally." });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setDeleteConfirmUser(null);
      setIsDeleting(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split("\n");
      const parsedUsers: Array<{ name: string; email: string; role: string }> = [];

      let startIndex = 0;
      const headers = lines[0].toLowerCase().split(",");
      const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("nama"));
      const emailIdx = headers.findIndex(h => h.includes("email"));
      const roleIdx = headers.findIndex(h => h.includes("role") || h.includes("jabatan"));

      if (nameIdx !== -1 && emailIdx !== -1 && roleIdx !== -1) {
        startIndex = 1; // Skip header row
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
        if (cells.length < 3) continue;

        const name = cells[nameIdx !== -1 ? nameIdx : 0];
        const email = cells[emailIdx !== -1 ? emailIdx : 1];
        const role = cells[roleIdx !== -1 ? roleIdx : 2];

        if (name && email && role) {
          parsedUsers.push({ name, email, role });
        }
      }

      if (parsedUsers.length === 0) {
        setToastMessage({ title: "CSV Import Failed", desc: "No valid employee rows found. Please use columns: name, email, role" });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      try {
        const data = await api.post<{ success: boolean; insertedCount: number; skippedCount: number; error?: string }>('/profile/users/bulk', { users: parsedUsers });

        if (data.success) {
          fetchUsers();
          setToastMessage({
            title: "CSV Imported Successfully",
            desc: `Added ${data.insertedCount} users, skipped ${data.skippedCount} duplicates.`
          });
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        } else {
          setToastMessage({ title: "CSV Import Failed", desc: data.error || "Failed to bulk upload users" });
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
        }
      } catch (err) {
        console.error("Bulk upload error:", err);
        setToastMessage({ title: "Upload Error", desc: "Error uploading CSV to server." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditAvatar(user.avatar);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditName("");
    setEditEmail("");
    setEditRole("WAREHOUSE_STAFF");
    setEditAvatar(null);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsEditSaving(true);

    try {
      const data = await api.put<{ success: boolean; error?: string; user?: any }>('/profile/admin-edit', {
        targetUserId: editingUser.id,
        name: editName,
        email: editEmail,
        role: editRole,
        avatar: editAvatar || undefined,
      });

      if (data.success) {
        fetchUsers();

        // If the edited user is the currently logged-in user, sync localStorage so navbar/chatbot/profile update
        const currentUser = localStorage.getItem("aromasys_user");
        const parsedCurrentUser = currentUser ? JSON.parse(currentUser) : null;
        if (parsedCurrentUser && String(parsedCurrentUser.id) === String(editingUser.id)) {
          const synced = {
            ...parsedCurrentUser,
            name: editName,
            email: editEmail,
            role: data.user?.role ?? parsedCurrentUser.role,
            ...(editAvatar ? { avatar: editAvatar } : {}),
            ...(data.user?.avatar ? { avatar: data.user.avatar } : {}),
          };
          localStorage.setItem("aromasys_user", JSON.stringify(synced));
          window.dispatchEvent(new Event('aromasys_avatar_updated'));
        }

        setToastMessage({ title: "Profile Updated", desc: "Employee profile has been updated successfully." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        closeEditModal();
      } else {
        setToastMessage({ title: "Update Failed", desc: data.error || "Failed to update profile." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    } catch {
      // Fallback: update locally if backend is unreachable
      const updated = users.map((u) =>
        u.id === editingUser.id
          ? { ...u, name: editName, email: editEmail, role: editRole, avatar: editAvatar || u.avatar }
          : u
      );
      setUsers(updated);
      localStorage.setItem("sima_arome_users_list", JSON.stringify(updated));

      // Sync current user localStorage if editing self
      const currentUser = localStorage.getItem("aromasys_user");
      const parsedCurrentUser = currentUser ? JSON.parse(currentUser) : null;
      if (parsedCurrentUser && String(parsedCurrentUser.id) === String(editingUser.id)) {
        const synced = {
          ...parsedCurrentUser,
          name: editName,
          email: editEmail,
          role: editRole,
          ...(editAvatar ? { avatar: editAvatar } : {}),
        };
        localStorage.setItem("aromasys_user", JSON.stringify(synced));
        window.dispatchEvent(new Event('aromasys_avatar_updated'));
      }

      setToastMessage({ title: "Profile Updated (Offline)", desc: "Changes saved locally." });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      closeEditModal();
    } finally {
      setIsEditSaving(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const roleOptions = [
    { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
    { value: "QUALITY_CONTROL", label: "Quality Control" },
    { value: "PPIC", label: "Production Planner (PPIC)" },
    { value: "ADMIN", label: "Operations Manager (Admin)" },
  ];

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "bg-amber-100 border-amber-200 text-amber-700";
      case "QUALITY_CONTROL":
        return "bg-blue-100 border-blue-200 text-blue-700";
      case "PPIC":
        return "bg-purple-100 border-purple-200 text-purple-700";
      default:
        return "bg-emerald-100 border-[#2C742F]/10 text-[#2C742F]";
    }
  };

  const inputCls = "w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-[#1C1B1F] focus:outline-none focus:ring-1 focus:ring-[#2C742F]/30 bg-white placeholder:text-[#79747E]/50";

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Alert */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 p-4 bg-[#2C742F] border border-emerald-300/30 text-white rounded-xl shadow-2xl"
          >
            <ShieldCheck className="w-5 h-5 text-[#AAE970] flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold">{toastMessage.title || "Staff Added Successfully"}</p>
              <p className="opacity-80">{toastMessage.desc || "New employee credentials have been registered."}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-extrabold text-[#1C1B1F] tracking-tight">{t('userManagementTitle')}</h2>
        <p className="text-xs text-[#79747E] mt-1 font-medium">{t('userManagementSub')}</p>
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
          <button onClick={fetchUsers} className="ml-auto text-xs underline hover:no-underline">Coba Lagi</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Form add staff */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-[#F5FBF3] border border-[#AAE970]/15 rounded-2xl p-5 md:p-6 space-y-4 relative overflow-hidden shadow-[6px_6px_54px_rgba(0,0,0,0.04)]"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#2C742F] to-[#AAE970] opacity-50" />

            <div className="flex items-center gap-2.5 pb-2 border-b border-[#AAE970]/10">
              <UserPlus className="w-4 h-4 text-[#2C742F]" />
              <h3 className="text-sm font-bold text-[#1C1B1F] uppercase tracking-wider">Add New Staff</h3>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Avatar Upload */}
              <div>
                <label className="text-xs font-semibold text-[#79747E] block mb-2">Profile Photo</label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#2C742F]/10 border-2 border-dashed border-[#2C742F]/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#2C742F] transition-all"
                      onClick={() => avatarInputRef.current?.click()}>
                      {formAvatar ? (
                        <img src={formAvatar} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-[#2C742F]/50" />
                      )}
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          setFormErrors(prev => ({ ...prev, avatar: 'Max 2MB' }));
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormAvatar(ev.target?.result as string);
                          setFormErrors(prev => { const { avatar, ...rest } = prev; return rest; });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <button type="button" onClick={() => avatarInputRef.current?.click()}
                      className="text-xs font-semibold text-[#2C742F] hover:underline">
                      {formAvatar ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    <p className="text-[10px] text-[#79747E] mt-0.5">JPG, PNG, WebP. Max 2MB.</p>
                    {formErrors.avatar && <p className="text-xs text-[#EA4B48] mt-0.5 font-semibold">{formErrors.avatar}</p>}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-[#79747E] block mb-1">Employee Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#79747E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Ahmad Hidayat"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`${inputCls} pl-9`}
                  />
                </div>
                {formErrors.formName && <p className="text-xs text-[#EA4B48] mt-1 font-semibold">{formErrors.formName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-[#79747E] block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#79747E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="e.g. ahmad@simaarome.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={`${inputCls} pl-9`}
                  />
                </div>
                {formErrors.formEmail && <p className="text-xs text-[#EA4B48] mt-1 font-semibold">{formErrors.formEmail}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-semibold text-[#79747E] block mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className={inputCls}
                >
                  {roleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#2C742F] hover:bg-[#366306] text-white font-bold text-sm transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Register Staff
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Staff registry listing */}
        <div className="lg:col-span-3 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
            className="bg-[#F5FBF3] border border-[#AAE970]/15 rounded-2xl p-5 md:p-6 space-y-4 flex flex-col min-h-[480px] shadow-[6px_6px_54px_rgba(0,0,0,0.04)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#AAE970]/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#2C742F]" />
                <h3 className="text-sm font-bold text-[#1C1B1F] uppercase tracking-wider">Authorized Employees</h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* CSV Import */}
                <input
                  type="file"
                  accept=".csv"
                  id="csv-upload"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
                <label
                  htmlFor="csv-upload"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-250 hover:border-[#2C742F]/35 bg-white hover:bg-emerald-50/20 text-[#2C742F] text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import CSV</span>
                </label>

                {/* Search bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#79747E]" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    className="pl-9 pr-3 py-1.5 w-full sm:w-36 bg-white border border-stone-200 rounded-xl text-xs text-[#1C1B1F] placeholder:text-[#79747E]/50 focus:outline-none focus:ring-1 focus:ring-[#2C742F]/30 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-[#79747E] text-center py-20 font-semibold">No matching employee records found.</p>
              ) : (
                filteredUsers.map((user, idx) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="p-3.5 rounded-xl bg-white border border-stone-100 flex items-center justify-between gap-4 hover:border-[#AAE970]/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#2C742F]/10"
                      />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-bold text-[#1C1B1F] leading-tight truncate">{user.name}</p>
                        <p className="text-xs text-[#79747E] truncate mt-0.5">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getRoleBadge(user.role)}`}>
                        {ROLE_MAP[user.role] ?? user.role.replace("_", " ")}
                      </span>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-1.5 rounded-lg border border-stone-200 hover:border-blue-200 bg-white hover:bg-blue-50 text-stone-400 hover:text-blue-600 transition-all focus:outline-none"
                        title="Edit Staff"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmUser(user)}
                        className="p-1.5 rounded-lg border border-stone-200 hover:border-red-200 bg-white hover:bg-red-50 text-stone-400 hover:text-[#EA4B48] transition-all focus:outline-none"
                        title="Remove Staff"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

      </div>

      {/* Edit User Modal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {editingUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-fadeIn"
              onClick={closeEditModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold text-[#1C1B1F] uppercase tracking-wider">Edit Employee</h3>
                  <button type="button" onClick={closeEditModal} className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleEditUser} className="space-y-4">
                  {/* Edit Avatar */}
                  <div>
                    <label className="text-xs font-semibold text-[#79747E] block mb-2">Profile Photo</label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-[#2C742F]/10 border-2 border-dashed border-[#2C742F]/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#2C742F] transition-all"
                          onClick={() => editAvatarInputRef.current?.click()}>
                          {editAvatar ? (
                            <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-4 h-4 text-[#2C742F]/50" />
                          )}
                        </div>
                        <input
                          ref={editAvatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setEditAvatar(ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                      <button type="button" onClick={() => editAvatarInputRef.current?.click()}
                        className="text-xs font-semibold text-[#2C742F] hover:underline">
                        Change Photo
                      </button>
                    </div>
                  </div>

                  {/* Edit Name */}
                  <div>
                    <label className="text-xs font-semibold text-[#79747E] block mb-1">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#79747E] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>

                  {/* Edit Email */}
                  <div>
                    <label className="text-xs font-semibold text-[#79747E] block mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#79747E] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </div>

                  {/* Edit Role */}
                  <div>
                    <label className="text-xs font-semibold text-[#79747E] block mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className={inputCls}
                    >
                      {roleOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="flex-1 py-2.5 rounded-full border border-stone-200 text-sm font-semibold text-[#79747E] hover:bg-stone-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isEditSaving}
                      className="flex-1 py-2.5 rounded-full bg-[#2C742F] hover:bg-[#366306] text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isEditSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {deleteConfirmUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4"
              onClick={() => !isDeleting && setDeleteConfirmUser(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 12 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative flex flex-col items-center text-center space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shadow-sm">
                  <AlertTriangle className="w-6 h-6" />
                </div>

                {/* User info */}
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-[#1C1B1F] text-base leading-tight">
                    Remove Employee?
                  </h3>
                  <div className="flex items-center gap-2.5 justify-center bg-stone-50 border border-stone-100 rounded-xl px-3 py-2">
                    <img
                      src={deleteConfirmUser.avatar}
                      alt={deleteConfirmUser.name}
                      className="w-8 h-8 rounded-full object-cover border border-stone-200"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#1C1B1F] leading-tight">{deleteConfirmUser.name}</p>
                      <p className="text-[10px] text-[#79747E]">{deleteConfirmUser.email}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-stone-400 leading-normal">
                    This action cannot be undone. The employee record and access will be permanently deleted.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 w-full pt-1">
                  <button
                    onClick={() => setDeleteConfirmUser(null)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-800 transition-all font-bold text-xs focus:outline-none disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all font-bold text-xs focus:outline-none shadow-md shadow-red-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
