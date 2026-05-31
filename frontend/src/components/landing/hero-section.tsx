"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

export function HeroSection() {
  const { t } = useLanguage();
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const handleCardClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCard(activeCard === index ? null : index);
  };

  return (
    <div className="flex-1 flex items-center px-6 md:px-16 py-10 relative z-10">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Side: Brand Logo, Titles, Description */}
        <div className="lg:col-span-6 space-y-6 text-left z-10">
          {/* Brand Logo above title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-28 h-28 md:w-36 md:h-36 mb-2"
          >
            <img src="/logo-cerah.png" alt="AromaSys Logo" className="w-full h-full object-contain" />
          </motion.div>

          {/* Animated Hero Typography */}
          <div className="space-y-1">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-6xl md:text-8xl font-bold font-['Poppins'] leading-none text-white"
            >
              {t("landingTitle1")}
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="text-6xl md:text-8xl font-bold font-['Poppins'] leading-none text-[#BCF389] mt-2"
            >
              {t("landingTitle2")}
            </motion.h1>
          </div>

          {/* Descriptive Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="text-zinc-300 text-lg md:text-xl font-medium font-['Poppins'] leading-relaxed tracking-wide max-w-xl"
          >
            <p>
              {t("landingSub")}
            </p>
          </motion.div>
        </div>

        {/* Right Side: Stacked and Overlapping Aesthetic Preview Images */}
        <div 
          onClick={() => setActiveCard(null)}
          className="lg:col-span-6 relative flex justify-center items-center h-[450px] md:h-[550px] w-full mt-10 lg:mt-0 select-none lg:-translate-x-16 xl:-translate-x-32"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            className="w-full h-full flex items-center justify-center relative"
          >
            <motion.div 
              className="relative w-full h-full flex items-center justify-center"
              whileHover={activeCard === null ? "spread" : undefined}
              initial="initial"
            >
              {/* Card 1: Dashboard Overview */}
              <motion.div
                variants={{
                  initial: { rotate: -15, x: -200, y: 80, scale: 0.95 },
                  spread: { rotate: -20, x: -290, y: 120, scale: 0.98 },
                  active: { rotate: 0, x: 0, y: 0, scale: 1.45 }
                }}
                animate={activeCard === 1 ? "active" : undefined}
                onClick={(e) => handleCardClick(1, e)}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                className="absolute w-[320px] sm:w-[440px] md:w-[540px] lg:w-[480px] xl:w-[600px] aspect-[1.6] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
                style={{ zIndex: activeCard === 1 ? 100 : 10 }}
              >
                <div className="h-6 bg-zinc-900/90 flex items-center gap-1.5 px-3.5 border-b border-zinc-800/60">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <img src="/ld.png" alt="Overview" className="w-full h-[calc(100%-24px)] object-contain bg-zinc-950" />
              </motion.div>

              {/* Card 2: Interactive Floor Plan */}
              <motion.div
                variants={{
                  initial: { rotate: 10, x: 170, y: -80, scale: 0.95 },
                  spread: { rotate: 15, x: 270, y: -130, scale: 0.98 },
                  active: { rotate: 0, x: 0, y: 0, scale: 1.45 }
                }}
                animate={activeCard === 2 ? "active" : undefined}
                onClick={(e) => handleCardClick(2, e)}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                className="absolute w-[320px] sm:w-[440px] md:w-[540px] lg:w-[480px] xl:w-[600px] aspect-[1.6] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
                style={{ zIndex: activeCard === 2 ? 100 : 20 }}
              >
                <div className="h-6 bg-zinc-900/90 flex items-center gap-1.5 px-3.5 border-b border-zinc-800/60">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <img src="/ld (2).png" alt="Floor Plan" className="w-full h-[calc(100%-24px)] object-contain bg-zinc-950" />
              </motion.div>

              {/* Card 3: FIFO & Expiry */}
              <motion.div
                variants={{
                  initial: { rotate: -8, x: -100, y: 130, scale: 0.95 },
                  spread: { rotate: -12, x: -160, y: 220, scale: 0.98 },
                  active: { rotate: 0, x: 0, y: 0, scale: 1.45 }
                }}
                animate={activeCard === 3 ? "active" : undefined}
                onClick={(e) => handleCardClick(3, e)}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                className="absolute w-[320px] sm:w-[440px] md:w-[540px] lg:w-[480px] xl:w-[600px] aspect-[1.6] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
                style={{ zIndex: activeCard === 3 ? 100 : 30 }}
              >
                <div className="h-6 bg-zinc-900/90 flex items-center gap-1.5 px-3.5 border-b border-zinc-800/60">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <img src="/ld (3).png" alt="FIFO & Expiry" className="w-full h-[calc(100%-24px)] object-contain bg-zinc-950" />
              </motion.div>

              {/* Card 4: Cold-Chain Monitor */}
              <motion.div
                variants={{
                  initial: { rotate: 5, x: 100, y: 50, scale: 0.95 },
                  spread: { rotate: 8, x: 160, y: 110, scale: 0.98 },
                  active: { rotate: 0, x: 0, y: 0, scale: 1.45 }
                }}
                animate={activeCard === 4 ? "active" : undefined}
                onClick={(e) => handleCardClick(4, e)}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                className="absolute w-[320px] sm:w-[440px] md:w-[540px] lg:w-[480px] xl:w-[600px] aspect-[1.6] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
                style={{ zIndex: activeCard === 4 ? 100 : 40 }}
              >
                <div className="h-6 bg-zinc-900/90 flex items-center gap-1.5 px-3.5 border-b border-zinc-800/60">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <img src="/ld (4).png" alt="Cold Chain" className="w-full h-[calc(100%-24px)] object-contain bg-zinc-950" />
              </motion.div>

              {/* Card 5: AI Copilot Assistant */}
              <motion.div
                variants={{
                  initial: { rotate: 0, x: 0, y: 0, scale: 0.95 },
                  spread: { rotate: 4, x: 40, y: -60, scale: 1.02 },
                  active: { rotate: 0, x: 0, y: 0, scale: 1.45 }
                }}
                animate={activeCard === 5 ? "active" : undefined}
                onClick={(e) => handleCardClick(5, e)}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                className="absolute w-[320px] sm:w-[440px] md:w-[540px] lg:w-[480px] xl:w-[600px] aspect-[1.6] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
                style={{ zIndex: activeCard === 5 ? 100 : 45 }}
              >
                <div className="h-6 bg-zinc-900/90 flex items-center gap-1.5 px-3.5 border-b border-zinc-800/60">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <img src="/ld (5).png" alt="AI Copilot" className="w-full h-[calc(100%-24px)] object-contain bg-zinc-950" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
