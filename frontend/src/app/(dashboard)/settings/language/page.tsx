"use client";

import { useLanguage } from "@/lib/i18n";
import { Globe, Check, Languages } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LanguageSettingsPage() {
  const { lang, setLanguage, t } = useLanguage();
  const [toast, setToast] = useState<string | null>(null);

  const handleSelectLanguage = (newLang: "en" | "id") => {
    if (lang === newLang) return; // Skip if already selected
    setLanguage(newLang);
    setToast(
      newLang === "id"
        ? t("langSuccessId")
        : t("langSuccessEn")
    );
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-8 pb-16 text-left relative font-sans max-w-3xl"
    >
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#2C742F]/10 via-[#2C742F]/5 to-transparent p-6 rounded-3xl border border-[#2C742F]/10 shadow-sm flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2C742F]/10 flex items-center justify-center text-[#2C742F]">
              <Languages size={18} />
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-800 tracking-tight">
              {t("languageSettingsTitle")}
            </h1>
          </div>
          <p className="text-sm text-stone-500 font-medium">
            {t("languageSettingsSub")}
          </p>
        </div>
        <div className="absolute right-6 opacity-5 pointer-events-none hidden md:block">
          <Globe size={120} className="text-[#2C742F] animate-[spin_60s_linear_infinite]" />
        </div>
      </div>

      {/* Language Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Bahasa Indonesia Option */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleSelectLanguage("id")}
          className={`relative border-2 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-md ${
            lang === "id"
              ? "border-[#2C742F] bg-[#F5FBF3] shadow-[#2C742F]/5"
              : "border-stone-100 bg-white hover:bg-stone-50/50 hover:shadow-lg"
          }`}
        >
          <div className="flex items-center gap-5">
            {/* Pure CSS Indonesia Flag representation */}
            <div className="w-14 h-10 rounded-lg overflow-hidden border border-stone-200 shadow-sm shrink-0 flex flex-col">
              <div className="bg-[#EA4B48] flex-1 w-full" />
              <div className="bg-white flex-1 w-full" />
            </div>

            <div>
              <p className="text-base font-bold text-stone-800">Bahasa Indonesia</p>
              <p className="text-xs text-stone-400 font-medium mt-0.5">Indonesian</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lang === "id" ? (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-7 h-7 rounded-full bg-[#2C742F] flex items-center justify-center text-white shadow-md shadow-[#2C742F]/20"
              >
                <Check size={16} className="stroke-[3]" />
              </motion.div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-stone-200 bg-white" />
            )}
          </div>

          {/* Active subtle background glow */}
          {lang === "id" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#2C742F]/5 to-transparent pointer-events-none" />
          )}
        </motion.div>

        {/* English Option */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleSelectLanguage("en")}
          className={`relative border-2 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all duration-300 shadow-md ${
            lang === "en"
              ? "border-[#2C742F] bg-[#F5FBF3] shadow-[#2C742F]/5"
              : "border-stone-100 bg-white hover:bg-stone-50/50 hover:shadow-lg"
          }`}
        >
          <div className="flex items-center gap-5">
            {/* Pure CSS UK/US inspired minimalist global flag representation */}
            <div className="w-14 h-10 rounded-lg overflow-hidden border border-stone-200 shadow-sm shrink-0 bg-[#0B2265] relative flex items-center justify-center">
              {/* Minimalist modern UK flag look in CSS */}
              <div className="absolute w-full h-1.5 bg-white flex items-center justify-center">
                <div className="w-full h-0.5 bg-[#EA4B48]" />
              </div>
              <div className="absolute h-full w-1.5 bg-white flex items-center justify-center">
                <div className="h-full w-0.5 bg-[#EA4B48]" />
              </div>
              {/* Diagonal crosses representation */}
              <div className="absolute w-full h-0.5 bg-white/70 rotate-25" />
              <div className="absolute w-full h-0.5 bg-white/70 -rotate-25" />
            </div>

            <div>
              <p className="text-base font-bold text-stone-800">English</p>
              <p className="text-xs text-stone-400 font-medium mt-0.5">United Kingdom / United States</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lang === "en" ? (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-7 h-7 rounded-full bg-[#2C742F] flex items-center justify-center text-white shadow-md shadow-[#2C742F]/20"
              >
                <Check size={16} className="stroke-[3]" />
              </motion.div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-stone-200 bg-white" />
            )}
          </div>

          {/* Active subtle background glow */}
          {lang === "en" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#2C742F]/5 to-transparent pointer-events-none" />
          )}
        </motion.div>
      </div>

      {/* Elegant Info Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-stone-50 border border-stone-100 rounded-2xl p-5 text-stone-500 text-xs font-semibold flex items-start gap-3.5 leading-relaxed"
      >
        <Globe size={18} className="text-[#2C742F] shrink-0 mt-0.5" />
        <div>
          <p className="text-stone-700 font-bold mb-1">
            {lang === "id" ? "Sinkronisasi Akun Otomatis" : "Automatic Account Sync"}
          </p>
          <p>
            {lang === "id" 
              ? "Preferensi bahasa Anda disimpan secara real-time ke akun cloud dan disinkronkan di semua perangkat Anda. Seluruh menu, dashboard, laporan, dan obrolan AI akan secara otomatis menyesuaikan dengan preferensi terpilih."
              : "Your language preference is saved in real-time to your cloud account and synchronized across all your devices. All menus, dashboards, reports, and AI chat will automatically adjust to your chosen preference."}
          </p>
        </div>
      </motion.div>

      {/* Premium Toast Notification using AnimatePresence */}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-[#2C742F] text-white rounded-2xl shadow-xl shadow-[#2C742F]/10 border border-emerald-500/20 text-sm font-extrabold animate-pulse-subtle"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Check size={13} className="stroke-[3]" />
              </div>
              <span>{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

