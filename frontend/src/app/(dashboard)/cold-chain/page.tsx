"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Check, 
  AlertTriangle, 
  Info, 
  Droplet, 
  TrendingUp, 
  Thermometer,
  X,
  ShieldAlert,
  Sliders,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import Portal from "@/components/Portal";
import type { TemperatureReading } from "@/types";
import { ZONE_TEMP_THRESHOLDS } from "@/lib/constants";

const ZONE_METADATA: Record<string, { title: string; subtitle: string; min: number; max: number }> = {
  A: { title: "Zone A", subtitle: ZONE_TEMP_THRESHOLDS.A.label, ...ZONE_TEMP_THRESHOLDS.A },
  B: { title: "Zone B", subtitle: ZONE_TEMP_THRESHOLDS.B.label, ...ZONE_TEMP_THRESHOLDS.B },
  C: { title: "Zone C", subtitle: ZONE_TEMP_THRESHOLDS.C.label, ...ZONE_TEMP_THRESHOLDS.C },
  D: { title: "Zone D", subtitle: ZONE_TEMP_THRESHOLDS.D.label, ...ZONE_TEMP_THRESHOLDS.D },
  E: { title: "Zone E", subtitle: ZONE_TEMP_THRESHOLDS.E.label, ...ZONE_TEMP_THRESHOLDS.E },
};

interface ZoneUIData {
  id: string;
  title: string;
  subtitle: string;
  status: "Stable" | "Warning" | "Critical";
  statusStyle: string;
  dotBg: string;
  icon: any;
  iconBg: string;
  temp: string;
  tempColor: string;
  targetRange: string;
  humidity: string;
  buttonText: string;
  buttonBg: string;
  sparkline: Array<{ heightPct: number; isAnom: boolean; active: boolean; tempVal: number }>;
  alertText: string;
  alertIcon: any;
  alertIconColor: string;
  detailsDescription: string;
  minLimit: number;
  maxLimit: number;
}

export default function ColdChainPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeModalZone, setActiveModalZone] = useState<ZoneUIData | null>(null);
  const [temperatures, setTemperatures] = useState<Record<string, TemperatureReading[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<string>('all');

  // Ticket creation state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketZoneId, setTicketZoneId] = useState("A");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("high");
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  async function fetchTemperatures() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<{ success: boolean; temperatures: Record<string, TemperatureReading[]> }>('/cold-chain');
      if (data.success) {
        setTemperatures(data.temperatures);
      } else {
        setError('Gagal memuat data sensor.');
      }
    } catch {
      setError('Tidak dapat menghubungkan ke sensor.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(fetchTemperatures);
    // Auto-refresh every 60 seconds to keep sensor data current
    const interval = setInterval(fetchTemperatures, 60_000);
    return () => clearInterval(interval);
  }, []);

  const zones: ZoneUIData[] = useMemo(() => {
    return Object.entries(ZONE_METADATA).map(([zoneId, meta]) => {
      const readings = temperatures[zoneId] ?? [];
      const currentReading = readings[readings.length - 1];
      const currentTemp = currentReading ? currentReading.temperature : (meta.min + meta.max) / 2;
      const avgTemp = readings.length ? (readings.reduce((s, r) => s + r.temperature, 0) / readings.length) : currentTemp;

      const anomalies = readings.filter(r => r.temperature > meta.max || r.temperature < meta.min);
      
      let status: "Stable" | "Warning" | "Critical" = "Stable";
      if (anomalies.length > 0) {
        status = "Critical";
      } else if (currentTemp > meta.max - 2 || currentTemp < meta.min + 2) {
        status = "Warning";
      }

      // Sparkline sampling (6 evenly-spaced points, always include the latest)
      const SPARKLINE_POINTS = 6;
      const sampledReadings = [];
      if (readings.length <= SPARKLINE_POINTS) {
        sampledReadings.push(...readings);
      } else {
        for (let i = 0; i < SPARKLINE_POINTS; i++) {
          const idx = Math.round((i / (SPARKLINE_POINTS - 1)) * (readings.length - 1));
          sampledReadings.push(readings[idx]);
        }
      }

      const minVal = readings.length ? Math.min(...readings.map(r => r.temperature)) : meta.min;
      const maxVal = readings.length ? Math.max(...readings.map(r => r.temperature)) : meta.max;
      const range = maxVal - minVal || 1;

      const sparkline = sampledReadings.map((r, idx) => {
        const heightPct = Math.max(20, Math.round(((r.temperature - minVal) / range) * 80) + 20);
        const isAnom = r.temperature > meta.max || r.temperature < meta.min;
        const active = idx === sampledReadings.length - 1;
        return { heightPct, isAnom, active, tempVal: r.temperature };
      });

      // Pad sparkline if less than 6
      while (sparkline.length < 6) {
        sparkline.unshift({ heightPct: 40, isAnom: false, active: false, tempVal: currentTemp });
      }

      // Config status styling
      const statusStyle = status === "Critical" 
        ? "bg-rose-200 text-red-800 border-red-700/20" 
        : status === "Warning"
          ? "bg-amber-400/10 text-green-950 border-amber-400/30"
          : "bg-green-100/30 text-lime-800 border-lime-800/10";

      const dotBg = status === "Critical" ? "bg-red-700" : status === "Warning" ? "bg-amber-400" : "bg-lime-300";
      const icon = status === "Critical" ? AlertTriangle : status === "Warning" ? Info : Check;
      const iconBg = status === "Critical" 
        ? "bg-red-700 text-white shadow-sm" 
        : status === "Warning"
          ? "bg-amber-400 text-green-950"
          : "bg-lime-300 text-[#2C742F]";

      const tempColor = status === "Critical" ? "text-red-800" : status === "Warning" ? "text-green-950" : "text-[#2C742F]";
      const buttonBg = status === "Critical" 
        ? "bg-red-700 hover:bg-red-800 text-white shadow-md" 
        : status === "Warning"
          ? "bg-amber-500 hover:bg-amber-600 text-white"
          : "bg-[#2C742F] hover:bg-[#2C742F]/90 text-white";

      // Mock humidity based on zone
      const humVal = zoneId === 'D' ? '82%' : zoneId === 'B' ? '58%' : '42%';
      const alertText = status === "Critical" ? "Temp Rising" : `Humidity: ${humVal}`;
      const alertIcon = status === "Critical" ? TrendingUp : Droplet;
      const alertIconColor = status === "Critical" ? "text-red-700" : "text-stone-700";

      let detailsDescription = `Cooling units are operating at optimal load. Compressor cycle stable. No anomalous fluctuations recorded.`;
      if (status === "Critical") {
        detailsDescription = `CRITICAL DEVIATION DETECTED! Temperature has spiked to ${currentTemp.toFixed(1)}°C, which is outside the target range of ${meta.min}°C to ${meta.max}°C. Immediate climate purge required.`;
      } else if (status === "Warning") {
        detailsDescription = `Atmospheric logs show temperature approaching boundary margin (${currentTemp.toFixed(1)}°C). HVAC fan cycle checklist scheduled to stabilize microclimate.`;
      }

      return {
        id: zoneId,
        title: meta.title,
        subtitle: meta.subtitle,
        status,
        statusStyle,
        dotBg,
        icon,
        iconBg,
        temp: `${currentTemp.toFixed(1)}°C`,
        tempColor,
        targetRange: `${meta.min}°C to ${meta.max}°C`,
        humidity: humVal,
        buttonText: status === "Critical" ? "Take Action" : "Details",
        buttonBg,
        sparkline,
        alertText,
        alertIcon,
        alertIconColor,
        detailsDescription,
        minLimit: meta.min,
        maxLimit: meta.max
      };
    });
  }, [temperatures]);

  const displayedZones = activeZone === 'all' ? zones : zones.filter(z => z.id === activeZone);

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTicket(true);
    setTicketError(null);
    try {
      await api.post('/maintenance', {
        zone: ticketZoneId,
        description: ticketDesc || `Suhu anomali terdeteksi di Zona ${ticketZoneId}`,
        priority: ticketPriority,
        createdBy: user?.name || "Operator"
      });
      setTicketSuccess(true);
      setTimeout(() => {
        setShowTicketModal(false);
        setTicketDesc("");
        setTicketSuccess(false);
        setTicketError(null);
        fetchTemperatures();
      }, 2000);
    } catch {
      setTicketError("Gagal mengirim tiket. Periksa koneksi dan coba lagi.");
    } finally {
      setSubmittingTicket(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">{t('loadingTelemetry')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 text-left relative">
      
      {/* Title Header with Action Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-neutral-800 tracking-tight font-sans">{t('coldChainTitle')}</h2>
        <button
          onClick={() => { setTicketZoneId("D"); setShowTicketModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-md active:scale-95 transition-all focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createTicket')}</span>
        </button>
      </div>

      {/* Zone Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'A', 'B', 'C', 'D', 'E'].map((zone) => (
          <button
            key={zone}
            onClick={() => setActiveZone(zone)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeZone === zone
                ? 'bg-[#2C742F] text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {zone === 'all' ? 'All Zones' : zone}
          </button>
        ))}
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedZones.map((zone, idx) => {
          const Icon = zone.icon;
          const AlertIcon = zone.alertIcon;
          return (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.08 }}
              className="bg-[#F5FBF3] rounded-3xl p-6 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] border border-[#2C742F]/10 flex flex-col justify-between items-start h-[360px] relative group hover:scale-[1.01] transition-transform duration-200"
            >
              {/* Header: Title & Info */}
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${zone.iconBg}`}>
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-neutral-800 text-lg font-bold font-sans leading-none">{zone.title}</span>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${zone.statusStyle}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${zone.dotBg}`} />
                  {zone.status}
                </span>
              </div>

              {/* Subtitle */}
              <div className="text-left w-full mt-2">
                <span className="text-neutral-800 text-[10px] font-bold tracking-wider block opacity-70">
                  {zone.subtitle}
                </span>
              </div>

              {/* Temperature block */}
              <div className="flex justify-between items-end w-full mt-3">
                <span className={`${zone.tempColor} text-5xl font-extrabold font-sans leading-none shrink-0`}>
                  {zone.temp}
                </span>
                <div className="flex flex-col items-end text-right">
                  <span className="text-neutral-800 text-[10px] font-bold leading-none opacity-50">Target Range</span>
                  <span className="text-zinc-500 text-sm font-bold tracking-wide mt-1 block">{zone.targetRange}</span>
                </div>
              </div>

              {/* Sparkline Bar Graph Chart */}
              <div className="w-full flex items-end gap-1.5 h-16 mt-8 pt-2 border-b border-[#2C742F]/10">
                {zone.sparkline.map((bar, barIdx) => (
                  <div 
                    key={barIdx} 
                    className="flex-1 flex flex-col justify-end h-full"
                    title={`${bar.tempVal.toFixed(1)}°C`}
                  >
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        bar.isAnom 
                          ? "bg-[#EA4B48]" 
                          : bar.active 
                            ? "bg-[#2C742F]" 
                            : "bg-emerald-100/60"
                      }`}
                      style={{ height: `${bar.heightPct}%` }}
                    />
                  </div>
                ))}
              </div>

              {/* Footer Section */}
              <div className="w-full pt-4 mt-auto flex justify-between items-center border-t border-stone-200/10">
                {/* Left Alert Info */}
                <div className="flex items-center gap-1.5">
                  <AlertIcon className={`w-4.5 h-4.5 shrink-0 ${zone.alertIconColor}`} />
                  <span className={`text-xs font-semibold ${zone.alertIconColor}`}>{zone.alertText}</span>
                </div>

                {/* Details / Action Button */}
                <button 
                  onClick={() => setActiveModalZone(zone)}
                  className={`px-5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-all shadow-sm ${zone.buttonBg}`}
                >
                  {zone.buttonText}
                </button>
              </div>

            </motion.div>
          );
        })}
      </div>

      {/* Dynamic Popup Modal for Details & Take Action */}
      <AnimatePresence>
        {activeModalZone && (
          <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-stone-200/50 shadow-2xl relative text-left z-50"
            >
              {/* Absolute Close Button */}
              <button 
                onClick={() => setActiveModalZone(null)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-full w-8 h-8 flex items-center justify-center transition-all focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex items-start gap-4 pb-4 border-b border-stone-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${activeModalZone.iconBg}`}>
                  <Thermometer className="w-6 h-6" />
                </div>
                <div className="pr-8">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">TELEMETRY ARCHIVE</span>
                  <h3 className="text-xl font-bold text-[#2C742F] font-sans mt-0.5">{activeModalZone.title} - Cold-Chain</h3>
                  <span className="text-stone-500 text-xs font-semibold block mt-0.5">{activeModalZone.subtitle}</span>
                </div>
              </div>

              {/* Telemetry Status Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-[#F5FBF3] border border-[#2C742F]/10 flex flex-col items-center text-center">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider block leading-none">CURRENT TEMP</span>
                  <span className={`text-2xl font-black ${activeModalZone.tempColor} mt-2`}>{activeModalZone.temp}</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5FBF3] border border-[#2C742F]/10 flex flex-col items-center text-center">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider block leading-none">TARGET BOUNDS</span>
                  <span className="text-sm font-bold text-stone-700 mt-3">{activeModalZone.targetRange}</span>
                </div>
              </div>

              {/* Status Banner */}
              <div className="mt-5">
                {activeModalZone.status === "Critical" ? (
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 animate-bounce" />
                    <div>
                      <span className="font-bold block">Action Override Required</span>
                      <span className="opacity-90 mt-0.5 block">Zone has broken standard bounds! Compressor purge required immediately.</span>
                    </div>
                  </div>
                ) : activeModalZone.status === "Warning" ? (
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                    <div>
                      <span className="font-bold block">Marginal Fluctuations Logged</span>
                      <span className="opacity-90 mt-0.5 block">HVAC airflow stage checklist scheduled for next system cycle.</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-lime-200 bg-lime-50/50 text-xs text-lime-800 flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 text-lime-700 animate-pulse" />
                    <div>
                      <span className="font-bold block">Environmental Balance Stable</span>
                      <span className="opacity-90 mt-0.5 block">Zone temperature holds an excellent cooling lock factor.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description Logs */}
              <div className="mt-5 space-y-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">OPERATIONAL LOGS</span>
                <p className="text-stone-700 text-xs leading-relaxed font-normal bg-stone-50 border border-stone-200/40 p-3 rounded-xl">
                  {activeModalZone.detailsDescription}
                </p>
              </div>

              {/* Modal Control Actions */}
              <div className="mt-6 pt-5 border-t border-stone-100 flex gap-3">
                <button 
                  onClick={() => setActiveModalZone(null)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold text-xs active:scale-95 transition-all focus:outline-none"
                >
                  Tutup Panel
                </button>
                {activeModalZone.status === "Critical" ? (
                  <button 
                    onClick={() => {
                      setTicketZoneId(activeModalZone.id);
                      setShowTicketModal(true);
                      setActiveModalZone(null);
                    }}
                    className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-full font-bold text-xs active:scale-95 transition-all shadow-md focus:outline-none"
                  >
                    Kirim Tiket HVAC
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setActiveModalZone(null);
                    }}
                    className="flex-1 py-2.5 bg-[#2C742F] hover:bg-[#2C742F]/90 text-white rounded-full font-bold text-xs active:scale-95 transition-all shadow-md focus:outline-none"
                  >
                    Acknowledge
                  </button>
                )}
              </div>

            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Ticket Creation Modal */}
      <AnimatePresence>
        {showTicketModal && (
          <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-stone-200/50 shadow-2xl relative text-left z-50"
            >
              <button 
                onClick={() => setShowTicketModal(false)}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-full w-8 h-8 flex items-center justify-center transition-all focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-xl font-bold text-[#2C742F] mb-4">Buat Tiket Maintenance</h3>
              
              {ticketSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-sm my-6">
                  Tiket berhasil dibuat! Mengalihkan...
                </div>
              ) : (
                <form onSubmit={handleTicketSubmit} className="space-y-4">
                  {ticketError && (
                    <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-extrabold text-[10px]">!</span>
                      {ticketError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Zona</label>
                    <select
                      value={ticketZoneId}
                      onChange={(e) => setTicketZoneId(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
                    >
                      {Object.keys(ZONE_METADATA).map(id => (
                        <option key={id} value={id}>Zona {id} - {ZONE_METADATA[id].title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Prioritas</label>
                    <div className="flex gap-2">
                      {['low', 'medium', 'high'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTicketPriority(p)}
                          className={`flex-1 py-2 text-xs font-bold rounded-full capitalize border transition-all ${
                            ticketPriority === p 
                              ? p === 'high' ? 'bg-red-700 border-red-700 text-white' : p === 'medium' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Deskripsi Masalah</label>
                    <textarea
                      required
                      rows={3}
                      value={ticketDesc}
                      onChange={(e) => setTicketDesc(e.target.value)}
                      placeholder="Contoh: HVAC Unit compressor abnormal cycling, suhu melonjak."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="w-full py-3 rounded-full bg-red-700 hover:bg-red-800 text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {submittingTicket ? "Mengirim..." : "Kirim Tiket"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

    </div>
  );
}
