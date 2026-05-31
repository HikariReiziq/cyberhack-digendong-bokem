"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

export function LandingHeader() {
  const { lang, setLanguage, t } = useLanguage();

  return (
    <header className="w-full flex items-center justify-between px-6 md:px-16 py-8 relative z-20">
      {/* Brand Logo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3 text-white"
      >
        <img src="/logo-cerah.png" alt="AromaSys" className="w-8 h-8 object-contain" />
        <span className="font-extrabold text-sm md:text-base tracking-widest uppercase text-[#BCF389]">
          {t("landingTitle1")}
        </span>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3"
      >
        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(lang === "en" ? "id" : "en")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/20 hover:bg-white/10 text-white font-bold text-[10px] md:text-xs tracking-wider transition-all duration-200 focus:outline-none"
        >
          <Globe className="w-3.5 h-3.5 text-[#BCF389]" />
          <span>{lang === "en" ? "ID" : "EN"}</span>
        </button>

        <Link href="/register">
          <button className="px-5 py-2 md:px-7 md:py-2.5 rounded-full bg-[#2C742F] hover:bg-[#38913c] text-white font-bold text-[10px] md:text-xs tracking-wider transition-all duration-200 shadow-md active:scale-[0.98] focus:outline-none">
            {t("signUpBtn")}
          </button>
        </Link>
        <Link href="/login">
          <button className="px-5 py-2 md:px-7 md:py-2.5 rounded-full border-2 border-white hover:bg-white/10 text-white font-bold text-[10px] md:text-xs tracking-wider transition-all duration-200 active:scale-[0.98] focus:outline-none">
            {t("signInBtn")}
          </button>
        </Link>
      </motion.div>
    </header>
  );
}
