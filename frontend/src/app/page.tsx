"use client";

import { LandingHeader, HeroSection, LandingFooter } from "@/components/landing";

export default function LandingPage() {
  return (
    <main 
      className="min-h-screen flex flex-col justify-between relative overflow-hidden select-none font-sans"
      style={{
        backgroundImage: "url('/landing%20page%20bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/35 z-0" />
      
      <LandingHeader />
      <HeroSection />
      <LandingFooter />
    </main>
  );
}
