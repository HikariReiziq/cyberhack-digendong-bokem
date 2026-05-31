"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Sprout,
  Leaf,
  AlertTriangle,
  Download
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { InventoryItem } from "@/types";

function getDaysLeft(expiryDateStr: string): number {
  // Parse both as UTC midnight to avoid timezone offset shifting the day boundary
  const [ey, em, ed] = expiryDateStr.split('-').map(Number);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(ey, em - 1, ed);
  return Math.ceil((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function getCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("minyak") || cat.includes("essence") || cat.includes("oil") || cat.includes("extract")) {
    return Droplet;
  }
  if (cat.includes("rempah") || cat.includes("spices") || cat.includes("tepung")) {
    return Sprout;
  }
  return Leaf;
}

export default function FifoExpiryPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSort, setSelectedSort] = useState("urgency-asc");
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  async function fetchInventory() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<{ success: boolean; items: InventoryItem[] }>('/inventory');
      if (data.success) {
        setInventory(data.items ?? []);
      } else {
        setError('Gagal memuat data inventori.');
      }
    } catch {
      setError('Gagal menghubungkan ke server inventori.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(fetchInventory);
  }, []);

  const sortOptions = [
    { value: "urgency-asc", label: "Urgency (High-Low)" },
    { value: "urgency-desc", label: "Urgency (Low-High)" },
    { value: "intake-desc", label: "Intake Date (Newest)" },
    { value: "intake-asc", label: "Intake Date (Oldest)" },
    { value: "name-asc", label: "Alphabetical (A-Z)" }
  ];

  const mappedItems = useMemo(() => {
    return inventory.map(item => {
      const days = getDaysLeft(item.expiry);
      let status: "Critical" | "Monitor" | "Optimal" = "Optimal";
      // Progress bar: proportional — 0 days = 100%, 30+ days = ~10%, capped at 100
      const progress = days <= 0 ? 100 : Math.max(8, Math.min(95, Math.round((1 - days / 60) * 100)));
      let progressColor = "bg-[#BCF389]";
      let daysColor = "text-lime-800";
      let badgeStyle = "bg-green-100/20 text-lime-800 border-lime-800/20";
      let dotBg = "bg-lime-500";
      let actionText = "Stabil";

      if (days < 0 || item.status === 'Expired') {
        status = "Critical";
        progressColor = "bg-[#BA1A1A]";
        daysColor = "text-red-700 font-bold";
        badgeStyle = "bg-rose-200 text-red-800 border-red-700/20";
        dotBg = "bg-red-700 animate-pulse";
        actionText = "Expired";
      } else if (days === 0) {
        status = "Critical";
        progressColor = "bg-[#BA1A1A]";
        daysColor = "text-red-700 font-bold";
        badgeStyle = "bg-rose-200 text-red-800 border-red-700/20";
        dotBg = "bg-red-700 animate-pulse";
        actionText = "Kadaluwarsa Hari Ini";
      } else if (days <= 7 || item.status === 'Kritis') {
        status = "Critical";
        progressColor = "bg-[#BA1A1A]";
        daysColor = "text-red-700 font-bold";
        badgeStyle = "bg-rose-200/50 text-red-800 border-red-700/20";
        dotBg = "bg-red-700";
        actionText = "Tindakan Segera";
      } else if (days <= 30 || item.status === 'Warning') {
        status = "Monitor";
        progressColor = "bg-black";
        daysColor = "text-zinc-950";
        badgeStyle = "bg-stone-100 text-stone-500 border-stone-500/30";
        dotBg = "bg-neutral-950";
        actionText = "Jadwal Penggunaan";
      }

      const daysText = days < 0
        ? `Expired (${Math.abs(days)} hari lalu)`
        : days === 0
        ? 'Kadaluwarsa Hari Ini'
        : `${days} Hari Tersisa`;

      const intakeFormatted = new Date(item.dateIn).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });

      return {
        id: item.id,
        material: item.name,
        lot: item.id,
        qty: item.qty,
        unit: item.unit,
        intakeDate: intakeFormatted,
        intakeTime: new Date(item.dateIn).getTime(),
        location: item.location || "UNASSIGNED",
        zone: item.zone || "",
        category: item.category || "",
        dbStatus: item.status,      // original DB value (Aman/Warning/Kritis/Expired)
        status,                     // mapped display value (Critical/Monitor/Optimal)
        daysLeft: days,
        daysText,
        actionText,
        progress,
        progressColor,
        daysColor,
        badgeStyle,
        dotBg,
        icon: getCategoryIcon(item.category),
        iconBg: status === "Critical" ? "bg-rose-200 text-red-800" : "bg-green-100 text-lime-800"
      };
    });
  }, [inventory]);

  const filteredItems = useMemo(() => {
    return mappedItems.filter(item => {
      const matchesSearch = item.material.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.lot.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = selectedStatus === "All" || item.status === selectedStatus;
      const matchesZone = selectedZone === "" || item.zone === selectedZone;
      const matchesCategory = selectedCategory === "" || item.category === selectedCategory;
      return matchesSearch && matchesFilter && matchesZone && matchesCategory;
    });
  }, [mappedItems, searchQuery, selectedStatus, selectedZone, selectedCategory]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (selectedSort === "urgency-asc") {
        return a.daysLeft - b.daysLeft;
      }
      if (selectedSort === "urgency-desc") {
        return b.daysLeft - a.daysLeft;
      }
      if (selectedSort === "intake-desc") {
        return b.intakeTime - a.intakeTime;
      }
      if (selectedSort === "intake-asc") {
        return a.intakeTime - b.intakeTime;
      }
      if (selectedSort === "name-asc") {
        return a.material.localeCompare(b.material);
      }
      return 0;
    });
  }, [filteredItems, selectedSort]);

  // Real CSV spreadsheet exporter and trigger download
  function handleExport() {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ID,Nama Bahan,Kategori,Qty,Unit,Lokasi,Zona,Tgl Masuk,Sisa Hari,Status\n";
    sortedItems.forEach(item => {
      const daysText = item.daysLeft < 0
        ? `Expired (${Math.abs(item.daysLeft)} hari lalu)`
        : item.daysLeft === 0 ? 'Kadaluwarsa Hari Ini'
        : `${item.daysLeft} hari`;
      // Use DB status (Aman/Warning/Kritis/Expired) for export consistency
      csvContent += `"${item.id}","${item.material}","${item.category}","${item.qty}","${item.unit}","${item.location}","${item.zone}","${item.intakeDate}","${daysText}","${item.dbStatus}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FIFO_Expiry_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;

  // Dynamic zones and categories from actual data
  const availableZones = useMemo(() => {
    const zones = [...new Set(inventory.map(i => i.zone).filter(Boolean))].sort();
    return zones;
  }, [inventory]);

  const availableCategories = useMemo(() => {
    const cats = [...new Set(inventory.map(i => i.category).filter(Boolean))].sort();
    return cats;
  }, [inventory]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">{t('loadingFifo')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-[#EA4B48]" />
        <p className="text-sm font-bold text-neutral-800">{error}</p>
        <button onClick={fetchInventory} className="px-5 py-2 rounded-full bg-[#2C742F] text-white font-bold text-xs">Coba Lagi</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 text-left relative">
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
      
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-neutral-800 tracking-tight font-sans">{t('fifoExpiryTitle')}</h2>
      </div>

      {/* Main Container Card - styled with #F5FBF3 and dynamic entrance animation */}
      <motion.div 
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full bg-[#F5FBF3] rounded-xl shadow-[0px_4px_12px_rgba(143,177,87,0.05)] border border-lime-400/20 overflow-hidden flex flex-col justify-start items-start"
      >
        
        {/* Controls Header Row */}
        <div className="w-full px-5 py-4 border-b border-[#2C742F]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Left Controls: Search & Filter */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search inputs */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari lot, material..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-stone-300/60 focus:border-brand-sage-green focus:outline-none text-sm text-[#1C1B1F] placeholder:text-stone-500/70"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            </div>
 
            {/* Filter Toggle */}
            <div className="relative">
              <button 
                onClick={() => setFilterOpen(!filterOpen)}
                className="px-3.5 py-2 rounded-lg border border-stone-300/60 bg-white flex items-center gap-2 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all text-sm font-semibold focus:outline-none"
              >
                <SlidersHorizontal className="w-4 h-4 text-stone-700" />
                <span>Filter</span>
              </button>
 
              <AnimatePresence>
                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 mt-2 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-20 p-2 space-y-1"
                    >
                      {["All", "Critical", "Monitor", "Optimal"].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setSelectedStatus(status);
                            setFilterOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                            selectedStatus === status 
                              ? "bg-[#2C742F]/10 text-[#2C742F]" 
                              : "text-[#1C1B1F] hover:bg-stone-50"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Zone Filter — dynamic from data */}
            <select
              className="px-3.5 py-2 rounded-lg border border-stone-300/60 bg-white text-stone-700 hover:bg-stone-50 transition-all text-sm font-semibold focus:outline-none cursor-pointer"
              value={selectedZone}
              onChange={e => { setSelectedZone(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by zone"
            >
              <option value="">Semua Zona</option>
              {availableZones.map(z => <option key={z} value={z}>Zona {z}</option>)}
            </select>

            {/* Category Filter — dynamic from data */}
            <select
              className="px-3.5 py-2 rounded-lg border border-stone-300/60 bg-white text-stone-700 hover:bg-stone-50 transition-all text-sm font-semibold focus:outline-none cursor-pointer"
              value={selectedCategory}
              onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by category"
            >
              <option value="">Semua Kategori</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
 
          {/* Right Controls: Sort Indicator & Dropdown */}
          <div className="flex items-center gap-3 relative">
            
            {/* Refresh Button */}
            <button
              onClick={() => fetchInventory()}
              className="px-3.5 py-2 rounded-lg border border-stone-300/60 bg-white hover:bg-stone-50 text-stone-700 flex items-center gap-2 text-sm font-bold active:scale-95 transition-all outline-none focus:outline-none shrink-0"
              title="Refresh data dari database"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExport}
              disabled={sortedItems.length === 0}
              className="px-3.5 py-2 rounded-lg bg-[#2C742F] hover:bg-[#235a26] text-white flex items-center gap-2 text-sm font-bold active:scale-95 transition-all outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Download className="w-4 h-4 text-white" />
              <span>{t('exportCsv')}</span>
            </button>

            <div className="flex items-center gap-2 relative">
              <span className="text-stone-700 text-sm font-semibold">Urutkan:</span>
              <button 
                onClick={() => setSortOpen(!sortOpen)}
                className="px-3 py-1.5 bg-[#2C742F]/10 hover:bg-[#2C742F]/15 rounded-md flex items-center gap-1.5 text-[#2C742F] text-xs font-bold cursor-pointer transition-all active:scale-95 outline-none focus:outline-none"
              >
                <span>{sortOptions.find(opt => opt.value === selectedSort)?.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#2C742F]" />
              </button>
 
            <AnimatePresence>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white border border-stone-200 rounded-xl shadow-lg z-20 p-2 space-y-1 text-left"
                  >
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSelectedSort(opt.value);
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                          selectedSort === opt.value 
                            ? "bg-[#2C742F]/10 text-[#2C742F]" 
                            : "text-[#1C1B1F] hover:bg-stone-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
 
        {/* Data Table Wrapper with scroll */}
        <div className="w-full overflow-y-auto max-h-[500px] border-b border-[#2C742F]/10 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#2C742F]/5 border-b border-[#2C742F]/10 text-stone-700 text-sm font-bold uppercase tracking-wider">
                <th className="px-6 py-4 w-60 sticky top-0 bg-[#F5FBF3] z-10">{t('colMaterial')}</th>
                <th className="px-6 py-4 w-40 sticky top-0 bg-[#F5FBF3] z-10">{t('colIntakeDate')}</th>
                <th className="px-6 py-4 w-40 sticky top-0 bg-[#F5FBF3] z-10">{t('colSlot')}</th>
                <th className="px-6 py-4 w-40 sticky top-0 bg-[#F5FBF3] z-10">Status</th>
                <th className="px-6 py-4 w-64 sticky top-0 bg-[#F5FBF3] z-10">{t('colTimeline')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C742F]/10">
              {paginatedItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.05 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    {/* Material & Lot with spacious vertical py-6 padding */}
                    <td className="px-6 py-6 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-[#2C742F]/10 ${item.iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-green-950 text-sm font-bold">{item.material}</span>
                        <span className="text-stone-500 text-[11px] font-semibold tracking-wide">{item.lot}</span>
                      </div>
                    </td>
 
                    {/* Intake Date with spacious py-6 */}
                    <td className="px-6 py-6 text-stone-700 text-sm font-semibold">
                      {item.intakeDate}
                    </td>
 
                    {/* Location Slot with spacious py-6 */}
                    <td className="px-6 py-6">
                      <span className="px-2.5 py-1 bg-emerald-100/30 rounded border border-lime-400/20 text-stone-700 text-xs font-semibold">
                        {item.location}
                      </span>
                    </td>
 
                    {/* Status Badge with spacious py-6 */}
                    <td className="px-6 py-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${item.badgeStyle}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.dotBg}`} />
                        {item.status}
                      </span>
                    </td>
 
                    {/* Expiry Timeline progress with spacious py-6 */}
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex justify-between items-center text-[10px] font-semibold">
                          <span className={`${item.daysColor}`}>{item.daysText}</span>
                          <span className="text-stone-500">{item.actionText}</span>
                        </div>
                        <div className="w-full h-2 bg-[#AAE970]/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.progressColor}`} style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
 
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-stone-500 font-semibold text-sm">
                    Tidak ada lot bahan baku yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
 
        {/* Footer Pagination Row */}
        <div className="w-full px-5 py-4 border-t border-[#2C742F]/10 flex justify-between items-center text-left">
          <div className="text-stone-700 text-xs font-semibold">
            Menampilkan {Math.min(sortedItems.length, (currentPage - 1) * itemsPerPage + 1)} sampai {Math.min(sortedItems.length, currentPage * itemsPerPage)} dari {sortedItems.length} entries
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Prev button */}
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 rounded border border-stone-200/60 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 transition-all ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Page number */}
            <span className="text-stone-700 text-xs font-bold px-3">
              Halaman {currentPage} dari {totalPages}
            </span>

            {/* Next button */}
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`w-8 h-8 rounded border border-stone-200/60 bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 transition-all ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
 
      </motion.div>
 
    </div>
  );
}
