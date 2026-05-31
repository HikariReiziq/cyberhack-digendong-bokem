"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Check, 
  AlertTriangle,
  Info,
  Edit3,
  Trash2,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import Portal from "@/components/Portal";
import ConfirmDialog from "@/components/ConfirmDialog";
import UpdateStockModal from "@/components/UpdateStockModal";
import { api } from "@/lib/api";
import type { InventoryItem, Slot, InventoryStatus } from "@/types";

export default function InventoryMasterPage() {
  const { user, canEdit, canDelete } = useAuth();
  const { t } = useLanguage();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  // Form fields
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "Tepung",
    qty: "",
    unit: "Kg",
    location: "UNASSIGNED",
    zone: "A",
    dateIn: "",
    expiry: "",
    status: "Aman" as InventoryStatus,
    image: null as string | null
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; itemId: string; itemName: string }>({ isOpen: false, itemId: '', itemName: '' });
  const showDeleteConfirm = (id: string, name: string) => setConfirmState({ isOpen: true, itemId: id, itemName: name });
  const closeDeleteConfirm = () => setConfirmState(s => ({ ...s, isOpen: false }));

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isUpdateStockOpen, setIsUpdateStockOpen] = useState(false);

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);
      const [invData, slotsData] = await Promise.all([
        api.get<{ success: boolean; items: InventoryItem[] }>('/inventory'),
        api.get<{ success: boolean; slots: Slot[] }>('/slots')
      ]);
      if (invData.success) setItems(invData.items ?? []);
      if (slotsData.success) setSlots(slotsData.slots ?? []);
    } catch (e: any) {
      setError('Gagal memuat data dari server.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, []);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All Categories" || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Unique categories list
  const categoriesList = ["All Categories", "Tepung", "Gula", "Minyak", "Pewarna", "Essence", "Pengawet", "Susu", "Cokelat", "Rempah", "Kimia"];

  // Paginated items
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredItems.length, totalPages, currentPage]);

  // Open modal for Create
  const handleCreateOpen = () => {
    if (!canEdit()) {
      triggerToast("Anda tidak memiliki izin untuk menambah data", "error");
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const expiryDate = nextMonth.toISOString().split('T')[0];

    setEditingItem(null);
    setFormData({
      id: `LOT-${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      name: "",
      category: "Tepung",
      qty: "",
      unit: "Kg",
      location: "UNASSIGNED",
      zone: "A",
      dateIn: today,
      expiry: expiryDate,
      status: "Aman",
      image: null
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleEditOpen = (item: InventoryItem) => {
    if (!canEdit()) {
      triggerToast("Anda tidak memiliki izin untuk mengubah data", "error");
      return;
    }
    setEditingItem(item);
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category,
      qty: item.qty.toString(),
      unit: item.unit,
      location: item.location || "UNASSIGNED",
      zone: item.zone || "A",
      dateIn: item.dateIn || new Date().toISOString().split('T')[0],
      expiry: item.expiry || "",
      status: item.status || "Aman",
      image: item.image || null
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const doDeleteItem = async () => {
    const { itemId: id, itemName: name } = confirmState;
    closeDeleteConfirm();
    setDeletingId(id);
    try {
      const queryParams = new URLSearchParams({ id, userName: user?.name || 'Unknown', userRole: user?.role || 'Operator' });
      const res = await api.delete<{ success: boolean; error?: string }>(`/inventory?${queryParams.toString()}`);
      if (res.success) {
        triggerToast(`Berhasil menghapus "${name}" dari inventori`, "info");
        fetchData();
      } else {
        triggerToast(res.error || 'Gagal menghapus data', 'error');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Gagal menghapus data', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Delete Handler
  const handleDeleteItem = (id: string, name: string) => {
    if (!canDelete()) { triggerToast("Anda tidak memiliki izin untuk menghapus data", "error"); return; }
    if (deletingId) return;
    showDeleteConfirm(id, name);
  };

  // Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: Record<string, string> = {};
    if (!formData.id.trim()) errors.id = "Lot / Batch ID wajib diisi";
    if (!formData.name.trim()) errors.name = "Nama bahan baku wajib diisi";
    if (!formData.qty || isNaN(Number(formData.qty)) || Number(formData.qty) <= 0) {
      errors.qty = "Masukkan jumlah yang valid (lebih dari 0)";
    }
    if (!formData.expiry) errors.expiry = "Tanggal kedaluwarsa wajib diisi";
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      triggerToast("Mohon perbaiki kesalahan pengisian form", "error");
      return;
    }

    const calculatedZone = formData.location !== 'UNASSIGNED' ? formData.location.split('-')[0] : formData.zone;

    const payload = {
      id: formData.id.trim(),
      name: formData.name.trim(),
      category: formData.category,
      qty: parseFloat(formData.qty),
      unit: formData.unit,
      location: formData.location,
      zone: calculatedZone,
      dateIn: formData.dateIn,
      expiry: formData.expiry,
      status: formData.status,
      image: formData.image,
      user: {
        name: user?.name || 'Unknown',
        role: user?.role || 'Operator'
      }
    };

    setIsSaving(true);
    try {
      if (editingItem) {
        const res = await api.put<{ success: boolean; error?: string }>('/inventory', payload);
        if (res.success) {
          triggerToast(`Berhasil memperbarui inventori "${formData.name}"`);
          setModalOpen(false);
          fetchData();
        } else {
          triggerToast(res.error || 'Gagal memperbarui data', 'error');
        }
      } else {
        const res = await api.post<{ success: boolean; error?: string }>('/inventory', payload);
        if (res.success) {
          triggerToast(`Berhasil menambahkan "${formData.name}" ke inventori`);
          setModalOpen(false);
          fetchData();
        } else {
          triggerToast(res.error || 'Gagal menambahkan data', 'error');
        }
      }
    } catch (err: any) {
      triggerToast(err.message || 'Gagal menyimpan data', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      triggerToast("File gambar tidak boleh lebih dari 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ ...prev, image: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Filter available slots for selection: empty, or occupied by current editing item
  const availableSlots = useMemo(() => {
    return slots.filter(s => !s.occupied || (editingItem && s.itemId === editingItem.id));
  }, [slots, editingItem]);

  if (isLoading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">{t('loadingInventory')}</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-[#EA4B48]" />
        <p className="text-sm font-bold text-neutral-800">{error}</p>
        <button onClick={fetchData} className="px-5 py-2 rounded-full bg-[#2C742F] text-white font-bold text-xs hover:bg-[#235a26] transition-all active:scale-95">
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 text-left relative font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(44, 116, 47, 0.12);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(44, 116, 47, 0.25);
        }
      `}} />
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 border ${
              toast.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : toast.type === "error"
                ? "bg-rose-50 border-rose-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {toast.type === "success" && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
            {toast.type === "info" && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-neutral-800 text-3xl font-bold font-sans"
      >
        {t('inventoryMasterTitle')}
      </motion.div>

      {/* Controls Row with entrance animation */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
        className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        {/* Left Search & Category Dropdown */}
        <div className="flex-1 max-w-[576px] flex justify-start items-start gap-3 w-full">
          {/* Search Pill */}
          <div className="flex-1 relative inline-flex flex-col justify-start items-start">
            <input
              type="text"
              placeholder={t('searchInventory2')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline outline-1 outline-offset-[-1px] outline-lime-400/20 text-[#1C1B1F] text-sm font-normal font-sans placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
            <div className="h-5 left-[12px] top-[11px] absolute flex flex-col justify-start items-start opacity-50">
              <Search className="w-3.5 h-3.5 text-stone-700" />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="w-48 relative inline-flex flex-col justify-start items-start">
            <button
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="w-full pl-3 pr-8 py-2 relative bg-white rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline outline-1 outline-offset-[-1px] outline-lime-400/20 inline-flex justify-between items-center text-green-950 text-sm font-normal font-sans leading-5 focus:outline-none"
            >
              <span className="truncate">{selectedCategory}</span>
              <ChevronDown className="w-4 h-4 text-stone-700 shrink-0 absolute right-3" />
            </button>

            <AnimatePresence>
              {categoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCategoryDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 mt-10 w-full bg-white border border-stone-200 rounded-lg shadow-lg z-20 p-2 space-y-1 max-h-48 overflow-y-auto"
                  >
                    {categoriesList.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                          selectedCategory === cat 
                            ? "bg-[#2C742F]/10 text-[#2C742F]" 
                            : "text-[#1C1B1F] hover:bg-stone-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add New Record Button */}
        {canEdit() && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUpdateStockOpen(true)}
              className="px-5 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-[43px] flex justify-center items-center gap-2 text-[#1C1B1F] text-xs font-semibold font-sans leading-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform duration-100 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <span>{t('updateStock')}</span>
            </button>
            <button
              onClick={handleCreateOpen}
              className="px-6 py-2.5 bg-green-800 hover:bg-green-900 rounded-[43px] flex justify-center items-center gap-2 text-white text-xs font-semibold font-sans leading-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform duration-100 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>{t('addNewRecord')}</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Table Container Card - styled with #F5FBF3 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="w-full bg-[#F5FBF3] rounded-xl shadow-[0px_4px_12px_rgba(143,177,87,0.05)] border border-[#AAE970]/10 overflow-hidden flex flex-col justify-start items-start"
      >
        {/* Table wrapper with scroll */}
        <div className="w-full overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-[#2C742F]/5 border-b border-[#AAE970]/10 text-stone-700 text-sm font-bold tracking-wide">
                <th className="px-6 py-4 w-12 sticky top-0 bg-[#F5FBF3] z-10 border-b border-[#AAE970]/10" />
                <th className="px-6 py-4 w-48 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Nama Bahan</th>
                <th className="px-6 py-4 w-36 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Kategori</th>
                <th className="px-6 py-4 w-28 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Jumlah</th>
                <th className="px-6 py-4 w-20 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Unit</th>
                <th className="px-6 py-4 w-36 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Batch / Lot ID</th>
                <th className="px-6 py-4 w-32 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Lokasi Slot</th>
                <th className="px-6 py-4 w-32 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Kedaluwarsa</th>
                <th className="px-6 py-4 w-32 sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Status</th>
                <th className="px-6 py-4 w-28 text-center sticky top-0 bg-[#F5FBF3] z-10 font-sans border-b border-[#AAE970]/10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#AAE970]/10">
              {paginatedItems.map((item, idx) => {
                let categoryBadge = "bg-lime-300/30 text-lime-800";
                
                let statusBadge = "";
                let statusDot = "";
                if (item.status === "Aman") {
                  statusBadge = "bg-emerald-100 text-emerald-800 outline-emerald-800/10";
                  statusDot = "bg-emerald-600";
                } else if (item.status === "Warning") {
                  statusBadge = "bg-[#FF8900]/10 text-[#FF8900] outline-[#FF8900]/20";
                  statusDot = "bg-[#FF8900]";
                } else if (item.status === "Kritis") {
                  statusBadge = "bg-rose-100 text-rose-700 outline-rose-700/20";
                  statusDot = "bg-rose-600";
                } else if (item.status === "Expired") {
                  statusBadge = "bg-red-700/10 text-red-700 outline-red-700/20";
                  statusDot = "bg-red-700";
                }

                return (
                  <motion.tr 
                    key={item.id} 
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: idx * 0.04 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    {/* Image Preview */}
                    <td className="px-4 py-3">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-[#AAE970]/20" />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center border border-[#AAE970]/10">
                          <ImageIcon className="w-5 h-5 text-[#2C742F]/40" />
                        </div>
                      )}
                    </td>

                    {/* Material Name */}
                    <td className="px-6 py-3 text-green-950 text-sm font-semibold font-sans whitespace-pre-line">
                      {item.name}
                    </td>

                    {/* Category */}
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans inline-flex justify-start items-center ${categoryBadge}`}>
                        {item.category}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-6 py-3 text-stone-700 text-sm font-semibold font-sans">
                      {item.qty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </td>

                    {/* Unit */}
                    <td className="px-6 py-3 text-stone-700 text-sm font-normal font-sans">
                      {item.unit}
                    </td>

                    {/* Lot ID */}
                    <td className="px-6 py-3 text-lime-800 text-sm font-semibold font-sans">
                      {item.id}
                    </td>

                    {/* Slot Location */}
                    <td className="px-6 py-3 text-stone-700 text-sm font-semibold font-sans">
                      {item.location && item.location !== 'UNASSIGNED' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/30">
                          Slot {item.location}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Expiry */}
                    <td className="px-6 py-3 text-stone-700 text-sm font-medium font-sans">
                      {item.expiry ? new Date(item.expiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full outline outline-1 outline-offset-[-1px] text-xs font-bold font-sans ${statusBadge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                        <span>{item.status}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit() && (
                          <button
                            onClick={() => handleEditOpen(item)}
                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 transition-colors shadow-sm"
                            title="Ubah Data"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                          </button>
                        )}
                        {canDelete() && (
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg border border-rose-100 bg-white hover:bg-rose-50/50 text-red-600 hover:text-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Hapus Data"
                          >
                            {deletingId === item.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-stone-500 font-semibold text-sm">
                    Tidak ada bahan baku yang cocok ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Row */}
        <div className="self-stretch px-5 py-3.5 border-t border-[#2C742F]/10 flex items-center justify-between">
          <p className="text-xs text-stone-500 font-medium">
            Menampilkan{" "}
            <span className="font-bold text-[#1C1B1F]">
              {filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredItems.length)}
            </span>{" "}
            dari <span className="font-bold text-[#1C1B1F]">{filteredItems.length}</span> data
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-300/60 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
                  currentPage === page
                    ? "bg-[#2C742F] border-[#2C742F] text-white"
                    : "border-stone-300/60 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-300/60 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Dynamic Slide-Over / Modal CRUD Dialog */}
      <AnimatePresence>
        {modalOpen && (
          <Portal>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 m-auto max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl z-50 border border-stone-200/40 text-left flex flex-col justify-start custom-scrollbar"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-stone-100 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-neutral-800">
                    {editingItem ? "Edit Data Bahan Baku" : "Registrasi Bahan Baku Baru"}
                  </h3>
                </div>
                <button 
                  onClick={() => setModalOpen(false)} 
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {/* Lot ID */}
                <div className="space-y-1.5">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Batch / Lot ID *</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingItem}
                    className={`w-full px-3.5 py-2 bg-white rounded-xl border ${
                      formErrors.id ? "border-red-500 focus:ring-red-500" : "border-stone-300 focus:border-[#2C742F]"
                    } focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors disabled:bg-stone-50 disabled:text-stone-400`}
                    placeholder="e.g. LOT-8821A"
                  />
                  {formErrors.id && (
                    <span className="text-red-600 text-xs font-semibold">{formErrors.id}</span>
                  )}
                </div>

                {/* Material Name */}
                <div className="space-y-1.5">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Nama Bahan *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3.5 py-2 bg-white rounded-xl border ${
                      formErrors.name ? "border-red-500 focus:ring-red-500" : "border-stone-300 focus:border-[#2C742F]"
                    } focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors`}
                    placeholder="e.g. Lavender Angustifolia"
                  />
                  {formErrors.name && (
                    <span className="text-red-600 text-xs font-semibold">{formErrors.name}</span>
                  )}
                </div>

                {/* Category Dropdown select */}
                <div className="space-y-1.5">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Kategori</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-stone-300 focus:border-[#2C742F] focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors"
                  >
                    <option value="Tepung">Tepung</option>
                    <option value="Gula">Gula</option>
                    <option value="Minyak">Minyak</option>
                    <option value="Pewarna">Pewarna</option>
                    <option value="Essence">Essence</option>
                    <option value="Pengawet">Pengawet</option>
                    <option value="Susu">Susu</option>
                    <option value="Cokelat">Cokelat</option>
                    <option value="Rempah">Rempah</option>
                    <option value="Kimia">Kimia</option>
                  </select>
                </div>

                {/* Quantity & Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Jumlah *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.qty}
                      onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                      className={`w-full px-3.5 py-2 bg-white rounded-xl border ${
                        formErrors.qty ? "border-red-500" : "border-stone-300 focus:border-[#2C742F]"
                      } focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors`}
                      placeholder="e.g. 450.5"
                    />
                    {formErrors.qty && (
                      <span className="text-red-600 text-xs font-semibold">{formErrors.qty}</span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Unit</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-stone-300 focus:border-[#2C742F] focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors"
                    >
                      <option value="Liters">Liters</option>
                      <option value="Kg">Kg</option>
                      <option value="ml">ml</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>

                {/* Slot Location */}
                <div className="space-y-1.5">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Lokasi Slot Gudang</label>
                  <select
                    value={formData.location}
                    onChange={(e) => {
                      const loc = e.target.value;
                      const matchedSlot = slots.find(s => s.id === loc);
                      setFormData({ 
                        ...formData, 
                        location: loc,
                        zone: matchedSlot ? matchedSlot.zone : "A"
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-stone-300 focus:border-[#2C742F] focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors"
                  >
                    <option value="UNASSIGNED">Belum Ditempatkan (Unassigned)</option>
                    {availableSlots.map(s => (
                      <option key={s.id} value={s.id}>Slot {s.id} (Zona {s.zone})</option>
                    ))}
                  </select>
                </div>

                {/* Intake Date & Expiry Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Tanggal Masuk</label>
                    <input
                      type="date"
                      value={formData.dateIn}
                      onChange={(e) => setFormData({ ...formData, dateIn: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white rounded-xl border border-stone-300 focus:border-[#2C742F] focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Tanggal Kedaluwarsa *</label>
                    <input
                      type="date"
                      value={formData.expiry}
                      onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                      className={`w-full px-3.5 py-2 bg-white rounded-xl border ${
                        formErrors.expiry ? "border-red-500" : "border-stone-300 focus:border-[#2C742F]"
                      } focus:outline-none text-sm text-[#1C1B1F] font-semibold transition-colors`}
                    />
                    {formErrors.expiry && (
                      <span className="text-red-600 text-xs font-semibold">{formErrors.expiry}</span>
                    )}
                  </div>
                </div>

                {/* Status — auto-calculated from expiry date on backend */}
                <div className="space-y-1.5">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Status Kedaluwarsa</label>
                  {(() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const exp = formData.expiry ? new Date(formData.expiry) : null;
                    const daysLeft = exp ? Math.ceil((exp.getTime() - today.getTime()) / 86400000) : null;
                    const auto = daysLeft === null ? 'Aman' : daysLeft < 0 ? 'Expired' : daysLeft <= 7 ? 'Kritis' : daysLeft <= 30 ? 'Warning' : 'Aman';
                    const colorMap: Record<string, string> = { Expired: 'bg-red-50 text-red-700 border-red-200', Kritis: 'bg-orange-50 text-orange-700 border-orange-200', Warning: 'bg-amber-50 text-amber-700 border-amber-200', Aman: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                    return (
                      <div className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-between ${colorMap[auto]}`}>
                        <span>{auto === 'Aman' ? 'Optimal (Aman)' : auto === 'Warning' ? 'Warning — Mendekati Expired' : auto === 'Kritis' ? 'Kritis — Segera Tindak' : 'Expired — Kedaluwarsa'}</span>
                        <span className="text-[10px] font-semibold opacity-70">Auto dari tanggal expiry</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-stone-700 text-xs font-bold uppercase tracking-wider block">Gambar Bahan Baku (Maks 2MB)</label>
                  <div className="flex items-center gap-4">
                    {formData.image ? (
                      <div className="relative w-20 h-20 border border-[#AAE970]/30 rounded-xl overflow-hidden group shrink-0">
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                          className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <label className="w-20 h-20 border border-dashed border-stone-300 hover:border-[#2C742F] rounded-xl flex flex-col items-center justify-center cursor-pointer bg-stone-50 transition-colors shrink-0">
                        <Upload className="w-6 h-6 text-stone-400" />
                        <span className="text-[10px] text-stone-400 font-bold mt-1">Upload</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    )}
                    <div className="text-xs text-stone-400">
                      Format didukung: JPG, PNG, WebP. Gambar digunakan sebagai thumbnail visual bahan baku di sistem digital twin.
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50 active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-green-800 hover:bg-green-900 text-white text-sm font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{editingItem ? "Simpan Perubahan" : "Registrasi Batch"}</span>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Update Stock Modal */}
      <UpdateStockModal
        isOpen={isUpdateStockOpen}
        onClose={() => setIsUpdateStockOpen(false)}
        items={items}
        onSave={async (item, data) => {
          setIsUpdateStockOpen(false);
          try {
            const newLocation = data.location || item.location;
            const newZone = newLocation !== 'UNASSIGNED' ? newLocation.split('-')[0] : item.zone;
            const payload = {
              id: item.id,
              name: item.name,
              category: item.category,
              qty: item.qty + Number(data.addQty),
              unit: item.unit,
              location: newLocation,
              zone: newZone,
              dateIn: data.dateIn,
              expiry: data.expiry,
              status: item.status,
              user: { name: user?.name || 'Unknown', role: user?.role || 'Operator' }
            };
            const res = await api.put<{ success: boolean }>('/inventory', payload);
            if (res.success) {
              triggerToast(`Stock "${item.name}" berhasil diupdate (+${data.addQty} ${item.unit})`);
              fetchData();
            } else {
              triggerToast('Gagal update stock', 'error');
            }
          } catch {
            triggerToast('Gagal update stock', 'error');
          }
        }}
      />

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title="Hapus Item"
        message={`Hapus "${confirmState.itemName}" dari inventori? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={doDeleteItem}
        onCancel={closeDeleteConfirm}
      />
    </div>
  );
}
