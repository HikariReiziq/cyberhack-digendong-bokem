"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

export function LandingFooter() {
  const { t } = useLanguage();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="w-full px-6 md:px-16 py-6 text-left relative z-20 text-[10px] text-white/40 font-bold uppercase tracking-widest"
    >
      <span>{t("copyright")}</span>
    </motion.footer>
  );
}
