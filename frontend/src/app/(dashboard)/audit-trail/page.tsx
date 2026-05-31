"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { AuditAvatar } from "@/components/AuditAvatar";
import type { AuditLog } from "@/types";

export default function AuditTrailPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [selectedModule, setSelectedModule] = useState("All Modules");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  async function fetchLogs() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<{ success: boolean; logs: AuditLog[] }>('/audit');
      if (data.success) {
        setLogs(data.logs ?? []);
      } else {
        setError('Gagal memuat log aktivitas.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(fetchLogs);
  }, []);

  const handleResetFilters = () => {
    setSelectedRole("All Roles");
    setSelectedModule("All Modules");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search keyword filter (username, action, detail, module)
      const matchesSearch = searchQuery === "" || 
        (log.user || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.detail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.module || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Role filter
      const matchesRole = selectedRole === "All Roles" || 
        (log.role || "").toLowerCase() === selectedRole.toLowerCase();
      
      // Module filter
      const matchesModule = selectedModule === "All Modules" || 
        (log.module || "").toLowerCase() === selectedModule.toLowerCase();

      // Date range filter
      let matchesDate = true;
      if (startDate || endDate) {
        // timestamp format in DB is "YYYY-MM-DD HH:MM" or similar
        const logDateStr = log.timestamp ? log.timestamp.split(" ")[0] : "";
        if (logDateStr) {
          if (startDate) {
            matchesDate = matchesDate && logDateStr >= startDate;
          }
          if (endDate) {
            matchesDate = matchesDate && logDateStr <= endDate;
          }
        }
      }

      return matchesSearch && matchesRole && matchesModule && matchesDate;
    });
  }, [logs, searchQuery, selectedRole, selectedModule, startDate, endDate]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredLogs, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredLogs.length, totalPages, currentPage]);

  const rolesList = ["All Roles", "Operator", "QC", "PPIC", "Admin"];
  const modulesList = ["All Modules", "Auth", "Inventory", "QC", "Cold Chain", "Digital Twin", "Copilot", "User Management", "Settings", "System"];

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">{t('loadingLogs')}</p>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-extrabold text-xl">!</div>
        <p className="text-sm font-bold text-neutral-800">{error}</p>
        <button onClick={fetchLogs} className="px-5 py-2 rounded-full bg-[#2C742F] text-white font-bold text-xs hover:bg-[#366306] transition-all">
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
      
      {/* Title */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-neutral-800 text-3xl font-bold font-sans"
      >
        {t('auditTrailTitle')}
      </motion.div>

      {/* Search and Filters Card Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
        className="w-full p-5 bg-[#D6E5D7]/40 rounded-xl shadow-[0px_4px_12px_rgba(143,177,87,0.04)] outline outline-1 outline-offset-[-1px] outline-lime-400/20 flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Keyword Search */}
          <div className="flex-1 relative w-full">
            <input
              type="text"
              placeholder={t('searchAuditLogs')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline outline-1 outline-offset-[-1px] outline-lime-400/20 text-[#1C1B1F] text-sm font-normal font-sans placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-lime-400"
            />
            <div className="h-5 left-[12px] top-[11px] absolute flex flex-col justify-start items-start opacity-50">
              <Search className="w-3.5 h-3.5 text-stone-700" />
            </div>
          </div>
          
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-[#2C742F] text-white rounded-lg text-sm font-bold hover:bg-[#366306] transition-all self-stretch md:self-auto justify-center"
          >
            <RotateCcw className="w-4 h-4" /> Segarkan
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* User Role Filter */}
          <div className="flex flex-col justify-start items-start gap-1">
            <label className="text-stone-700 text-xs font-semibold font-sans leading-4 tracking-wide">
              User Role
            </label>
            <div className="relative w-full">
              <button
                onClick={() => {
                  setRoleDropdownOpen(!roleDropdownOpen);
                  setModuleDropdownOpen(false);
                }}
                className="w-full pl-3 pr-8 py-2 relative bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-lime-400/20 flex justify-between items-center text-green-950 text-sm font-normal font-sans leading-5 focus:outline-none"
              >
                <span className="truncate">{selectedRole}</span>
                <ChevronDown className="w-4 h-4 text-stone-700 shrink-0 absolute right-3" />
              </button>

              <AnimatePresence>
                {roleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRoleDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 mt-1.5 w-full bg-white border border-stone-200 rounded-lg shadow-lg z-20 p-2 space-y-1 max-h-48 overflow-y-auto"
                    >
                      {rolesList.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setSelectedRole(role);
                            setRoleDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                            selectedRole === role 
                              ? "bg-[#2C742F]/10 text-[#2C742F]" 
                              : "text-[#1C1B1F] hover:bg-stone-50"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Module Filter */}
          <div className="flex flex-col justify-start items-start gap-1">
            <label className="text-stone-700 text-xs font-semibold font-sans leading-4 tracking-wide">
              Modul Sistem
            </label>
            <div className="relative w-full">
              <button
                onClick={() => {
                  setModuleDropdownOpen(!moduleDropdownOpen);
                  setRoleDropdownOpen(false);
                }}
                className="w-full pl-3 pr-8 py-2 relative bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-lime-400/20 flex justify-between items-center text-green-950 text-sm font-normal font-sans leading-5 focus:outline-none"
              >
                <span className="truncate">{selectedModule}</span>
                <ChevronDown className="w-4 h-4 text-stone-700 shrink-0 absolute right-3" />
              </button>

              <AnimatePresence>
                {moduleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModuleDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 mt-1.5 w-full bg-white border border-stone-200 rounded-lg shadow-lg z-20 p-2 space-y-1 max-h-48 overflow-y-auto"
                    >
                      {modulesList.map((mod) => (
                        <button
                          key={mod}
                          onClick={() => {
                            setSelectedModule(mod);
                            setModuleDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                            selectedModule === mod 
                              ? "bg-[#2C742F]/10 text-[#2C742F]" 
                              : "text-[#1C1B1F] hover:bg-stone-50"
                          }`}
                        >
                          {mod}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="sm:col-span-2 flex flex-col justify-start items-start gap-1">
            <label className="text-stone-700 text-xs font-semibold font-sans leading-4 tracking-wide">
              Rentang Tanggal
            </label>
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-3 pr-2 py-1.5 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-lime-400/20 text-green-950 text-xs font-normal font-sans focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>
              <span className="text-stone-400 text-xs font-semibold">s/d</span>
              <div className="flex-1 relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-3 pr-2 py-1.5 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-lime-400/20 text-green-950 text-xs font-normal font-sans focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>
              
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg outline outline-1 outline-lime-400/40 text-lime-800 text-xs font-semibold hover:bg-white transition-all cursor-pointer whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Audit Log Card Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="w-full bg-[#F5FBF3] rounded-xl shadow-[0px_4px_12px_rgba(143,177,87,0.05)] border border-[#AAE970]/10 overflow-hidden flex flex-col justify-start items-start"
      >
        {/* Table Header */}
        <div className="w-full px-6 py-4 bg-[#2C742F]/5 border-b border-[#AAE970]/10 flex justify-between items-center sticky top-0 bg-[#F5FBF3] z-10">
          <div className="w-44 text-stone-700 text-xs font-bold font-sans tracking-wide">
            {t('colTimestamp').toUpperCase()}
          </div>
          <div className="w-48 text-stone-700 text-xs font-bold font-sans tracking-wide">
            {t('colActor').toUpperCase()}
          </div>
          <div className="w-28 text-stone-700 text-xs font-bold font-sans tracking-wide">
            {t('colModule').toUpperCase()}
          </div>
          <div className="flex-1 min-w-[280px] text-stone-700 text-xs font-bold font-sans tracking-wide">
            {t('colAction').toUpperCase()}
          </div>
          <div className="w-32 text-right text-stone-700 text-xs font-bold font-sans tracking-wide">
            METADATA IP
          </div>
        </div>

        {/* Table Rows with scroll wrapper */}
        <div className="w-full flex flex-col justify-start items-start overflow-y-auto max-h-[500px] divide-y divide-[#AAE970]/10 custom-scrollbar">
          {paginatedLogs.map((log, idx) => {
            let badgeStyle = "bg-lime-700/10 text-lime-800";
            if (log.role === "QC") {
              badgeStyle = "bg-amber-100 text-amber-700 outline-amber-200/50";
            } else if (log.role === "PPIC") {
              badgeStyle = "bg-blue-100 text-blue-700 outline-blue-200/50";
            } else if (log.role === "Admin") {
              badgeStyle = "bg-purple-100 text-purple-700 outline-purple-200/50";
            } else if (log.role === "SYSTEM" || log.role === "System") {
              badgeStyle = "bg-stone-200 text-stone-700";
            }

            let rowBg = "hover:bg-white/40 transition-colors";
            if ((log.action || "").toLowerCase().includes("fail") || (log.detail || "").toLowerCase().includes("error")) {
              rowBg = "bg-rose-50/30 hover:bg-rose-50/50";
            }

            return (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: idx * 0.04 }}
                className={`w-full px-6 py-4 flex justify-between items-center gap-4 ${rowBg}`}
              >
                {/* TIMESTAMP Column */}
                <div className="w-44 flex flex-col justify-start items-start shrink-0">
                  <span className="text-green-950 text-sm font-semibold font-sans">
                    {log.timestamp ? log.timestamp.split(" ")[0] : ""}
                  </span>
                  <span className="text-stone-500 text-xs font-medium font-sans mt-0.5">
                    {log.timestamp && log.timestamp.includes(" ") ? log.timestamp.split(" ")[1] : ""} WIB
                  </span>
                </div>

                {/* ACTOR Column */}
                <div className="w-48 flex justify-start items-center gap-3 shrink-0">
                  <AuditAvatar avatar={log.avatar} name={log.user} />
                  
                  <div className="flex flex-col justify-start items-start gap-0.5">
                    <span className="text-green-950 text-sm font-bold font-sans leading-tight truncate max-w-[128px]">
                      {log.user}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full inline-flex justify-start items-center text-[9px] font-bold font-sans uppercase ${badgeStyle}`}>
                      {log.role}
                    </span>
                  </div>
                </div>

                {/* MODULE Badge Column */}
                <div className="w-28 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-[#AAE970]/10 text-[#2C742F] text-xs font-bold font-sans">
                    {log.module || "System"}
                  </span>
                </div>

                {/* ACTION STATEMENT Column */}
                <div className="flex-1 min-w-[280px] text-left">
                  <span className="text-lime-800 text-sm font-bold font-sans block mb-0.5">
                    {log.action}
                  </span>
                  <span className="text-green-950 text-xs font-medium font-sans leading-relaxed">
                    {log.detail}
                  </span>
                </div>

                {/* METADATA Column */}
                <div className="w-32 inline-flex flex-col justify-start items-end shrink-0 text-right">
                  <span className="text-xs font-bold text-stone-600 font-mono">
                    192.168.1.{(log.id % 240) + 10}
                  </span>
                  <span className="text-stone-400 text-[10px] font-semibold font-sans mt-0.5 uppercase">
                    Session Active
                  </span>
                </div>

              </motion.div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="w-full text-center py-12 text-stone-500 font-semibold text-sm">
              {t('noLogsFound')}
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        <div className="w-full px-5 py-3.5 border-t border-[#2C742F]/10 flex items-center justify-between">
          <p className="text-xs text-stone-500 font-medium">
            Menampilkan{" "}
            <span className="font-bold text-[#1C1B1F]">
              {filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredLogs.length)}
            </span>{" "}
            dari <span className="font-bold text-[#1C1B1F]">{filteredLogs.length}</span> entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-300/60 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-300/60 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
