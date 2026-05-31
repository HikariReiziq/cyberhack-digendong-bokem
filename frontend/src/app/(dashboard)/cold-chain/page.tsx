"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Check,
  AlertTriangle,
  Info,
  Droplet,
  TrendingUp,
  TrendingDown,
  Thermometer,
  X,
  ShieldAlert,
  Plus,
  Activity,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
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

// Static humidity by zone (mock — replace with real sensor if available)
const ZONE_HUMIDITY: Record<string, number> = { A: 42, B: 58, C: 45, D: 82, E: 38 };

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
  humidity: number;
  buttonBg: string;
  svgPoints: string;
  svgColor: string;
  anomalyCount: number;
  readingCount: number;
  avgTemp: string;
  minTemp: string;
  maxTemp: string;
  deviation: number;
  chartData: Array<{ hour: string; temp: number }>;
  minLimit: number;
  maxLimit: number;
  lastReadingTime: string;
}

export default function ColdChainPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeModalZone, setActiveModalZone] = useState<ZoneUIData | null>(null);
  const [temperatures, setTemperatures] = useState<Record<string, TemperatureReading[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeZone, setActiveZone] = useState<string>("all");

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
      const data = await api.get<{ success: boolean; temperatures: Record<string, TemperatureReading[]> }>("/cold-chain");
      if (data.success) {
        setTemperatures(data.temperatures);
        setLastRefreshed(new Date());
      }
    } catch {}
    finally { setIsLoading(false); }
  }

  useEffect(() => {
    Promise.resolve().then(fetchTemperatures);
    const interval = setInterval(fetchTemperatures, 60_000);
    return () => clearInterval(interval);
  }, []);

  const zones: ZoneUIData[] = useMemo(() => {
    return Object.entries(ZONE_METADATA).map(([zoneId, meta]) => {
      const readings = temperatures[zoneId] ?? [];
      const currentReading = readings[readings.length - 1];
      const midpoint = (meta.min + meta.max) / 2;
      const currentTemp = currentReading?.temperature ?? midpoint;

      const avgTempVal = readings.length
        ? readings.reduce((s, r) => s + r.temperature, 0) / readings.length
        : currentTemp;
      const minTempVal = readings.length ? Math.min(...readings.map(r => r.temperature)) : meta.min;
      const maxTempVal = readings.length ? Math.max(...readings.map(r => r.temperature)) : meta.max;
      const anomalyCount = readings.filter(r => r.temperature > meta.max || r.temperature < meta.min).length;

      let status: "Stable" | "Warning" | "Critical" = "Stable";
      if (anomalyCount > 0) status = "Critical";
      else if (currentTemp > meta.max - 2 || currentTemp < meta.min + 2) status = "Warning";

      // SVG polyline for smooth sparkline (viewBox 0 0 100 36)
      const SAMPLES = 12;
      const sampledReadings: TemperatureReading[] = [];
      if (readings.length <= SAMPLES) {
        sampledReadings.push(...readings);
      } else {
        for (let i = 0; i < SAMPLES; i++) {
          sampledReadings.push(readings[Math.round((i / (SAMPLES - 1)) * (readings.length - 1))]);
        }
      }
      while (sampledReadings.length < SAMPLES) {
        sampledReadings.unshift({ temperature: midpoint, hour: "", timestamp: "" } as any);
      }

      const VB_W = 100;
      const VB_H = 36;
      const PAD = 3;
      const plotH = VB_H - PAD * 2;
      const scaleMin = Math.min(minTempVal, meta.min);
      const scaleMax = Math.max(maxTempVal, meta.max);
      const scaleRange = scaleMax - scaleMin || 1;
      const svgPoints = sampledReadings.map((r, i) => {
        const x = sampledReadings.length > 1 ? (i / (sampledReadings.length - 1)) * VB_W : VB_W / 2;
        const y = PAD + plotH - ((r.temperature - scaleMin) / scaleRange) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      const svgColor = status === "Critical" ? "#EF4444" : status === "Warning" ? "#F59E0B" : "#2C742F";

      // Chart data for recharts modal (all readings or sampled if too many)
      const CHART_SAMPLES = 24;
      let chartReadings = readings;
      if (readings.length > CHART_SAMPLES) {
        chartReadings = [];
        for (let i = 0; i < CHART_SAMPLES; i++) {
          chartReadings.push(readings[Math.round((i / (CHART_SAMPLES - 1)) * (readings.length - 1))]);
        }
      }
      const chartData = chartReadings.map(r => ({
        hour: r.hour ?? "",
        temp: parseFloat(r.temperature.toFixed(1)),
      }));

      const statusStyle =
        status === "Critical"
          ? "bg-rose-100 text-red-800 border-red-300"
          : status === "Warning"
          ? "bg-amber-50 text-amber-800 border-amber-300"
          : "bg-emerald-50 text-emerald-800 border-emerald-200";

      const dotBg =
        status === "Critical" ? "bg-red-500" : status === "Warning" ? "bg-amber-400" : "bg-emerald-400";

      const icon = status === "Critical" ? AlertTriangle : status === "Warning" ? Info : Check;
      const iconBg =
        status === "Critical"
          ? "bg-red-100 text-red-600"
          : status === "Warning"
          ? "bg-amber-100 text-amber-600"
          : "bg-emerald-100 text-emerald-600";

      const tempColor =
        status === "Critical" ? "text-red-600" : status === "Warning" ? "text-amber-600" : "text-emerald-700";

      const buttonBg =
        status === "Critical"
          ? "bg-red-600 hover:bg-red-700 text-white"
          : status === "Warning"
          ? "bg-amber-500 hover:bg-amber-600 text-white"
          : "bg-[#2C742F] hover:bg-[#235a26] text-white";

      const lastReadingTime =
        currentReading?.timestamp
          ? new Date(currentReading.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : currentReading?.hour ?? "—";

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
        targetRange: `${meta.min}°C – ${meta.max}°C`,
        humidity: ZONE_HUMIDITY[zoneId] ?? 45,
        buttonBg,
        svgPoints,
        svgColor,
        anomalyCount,
        readingCount: readings.length,
        avgTemp: `${avgTempVal.toFixed(1)}°C`,
        minTemp: `${minTempVal.toFixed(1)}°C`,
        maxTemp: `${maxTempVal.toFixed(1)}°C`,
        deviation: parseFloat((currentTemp - midpoint).toFixed(1)),
        chartData,
        minLimit: meta.min,
        maxLimit: meta.max,
        lastReadingTime,
      };
    });
  }, [temperatures]);

  const displayedZones = activeZone === "all" ? zones : zones.filter(z => z.id === activeZone);
  const stableCount = zones.filter(z => z.status === "Stable").length;
  const warningCount = zones.filter(z => z.status === "Warning").length;
  const criticalCount = zones.filter(z => z.status === "Critical").length;

  const lastRefreshedStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "—";

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTicket(true);
    setTicketError(null);
    try {
      await api.post("/maintenance", {
        zone: ticketZoneId,
        description: ticketDesc || `Suhu anomali terdeteksi di Zona ${ticketZoneId}`,
        priority: ticketPriority,
        createdBy: user?.name || "Operator",
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
        <p className="text-sm text-stone-500 font-semibold">{t("loadingTelemetry")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 text-left relative">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-neutral-800 tracking-tight">{t("coldChainTitle")}</h2>
          <p className="text-xs text-stone-500 font-semibold mt-1">{t("coldChainSub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemperatures}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-stone-200 bg-white text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
            title="Refresh sensor data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => { setTicketZoneId("D"); setShowTicketModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("createTicket")}
          </button>
        </div>
      </div>

      {/* System Health Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Check className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-700">{stableCount}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Stable</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Info className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-700">{warningCount}</p>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Warning</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-red-600">{criticalCount}</p>
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Critical</p>
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-stone-500" />
          </div>
          <div>
            <p className="text-sm font-black text-stone-700">{lastRefreshedStr}</p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Last Refresh</p>
          </div>
        </div>
      </div>

      {/* Zone Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "A", "B", "C", "D", "E"].map((zone) => (
          <button
            key={zone}
            onClick={() => setActiveZone(zone)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeZone === zone
                ? "bg-[#2C742F] text-white shadow-sm"
                : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            {zone === "all" ? "All Zones" : `Zone ${zone}`}
          </button>
        ))}
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedZones.map((zone, idx) => {
          const Icon = zone.icon;
          const deviationAbs = Math.abs(zone.deviation);
          const deviationLabel =
            deviationAbs < 0.5
              ? "On target"
              : zone.deviation > 0
              ? `+${zone.deviation}°C above ideal`
              : `${zone.deviation}°C below ideal`;
          const deviationColor =
            deviationAbs < 0.5
              ? "text-emerald-600"
              : deviationAbs < 2
              ? "text-amber-600"
              : "text-red-600";

          return (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.07 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-[#D7E5D8] flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${zone.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-800 leading-none">{zone.title}</p>
                    <p className="text-[9px] font-semibold text-stone-400 mt-0.5 leading-none truncate max-w-[130px]">
                      {zone.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {zone.anomalyCount > 0 && (
                    <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full border border-red-200">
                      {zone.anomalyCount} anom
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${zone.statusStyle}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${zone.dotBg}`} />
                    {zone.status}
                  </span>
                </div>
              </div>

              {/* Temperature + Deviation */}
              <div className="flex items-end justify-between">
                <div>
                  <span className={`text-4xl font-black leading-none ${zone.tempColor}`}>{zone.temp}</span>
                  <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${deviationColor}`}>
                    {zone.deviation > 0.5 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : zone.deviation < -0.5 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {deviationLabel}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Target</p>
                  <p className="text-xs font-bold text-stone-600 mt-0.5">{zone.targetRange}</p>
                </div>
              </div>

              {/* SVG Polyline Sparkline */}
              <div className="w-full rounded-xl bg-stone-50 border border-stone-100 overflow-hidden px-2 py-1.5">
                <svg viewBox="0 0 100 36" className="w-full h-10" preserveAspectRatio="none">
                  {/* Threshold band */}
                  <rect x="0" y="0" width="100" height="36" fill="transparent" />
                  {/* Gradient fill under line */}
                  <defs>
                    <linearGradient id={`grad-${zone.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={zone.svgColor} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={zone.svgColor} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {zone.svgPoints && (
                    <>
                      <polygon
                        points={`0,36 ${zone.svgPoints} 100,36`}
                        fill={`url(#grad-${zone.id})`}
                      />
                      <polyline
                        points={zone.svgPoints}
                        fill="none"
                        stroke={zone.svgColor}
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
                <p className="text-[8px] font-semibold text-stone-400 text-right mt-0.5">
                  {zone.readingCount} readings · last {zone.lastReadingTime}
                </p>
              </div>

              {/* Mini Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Avg", value: zone.avgTemp, color: "text-stone-700" },
                  { label: "Min", value: zone.minTemp, color: "text-blue-600" },
                  { label: "Max", value: zone.maxTemp, color: "text-red-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-stone-50 rounded-lg px-2 py-1.5 text-center border border-stone-100">
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-wide">{label}</p>
                    <p className={`text-xs font-black ${color} mt-0.5`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                <div className="flex items-center gap-3 text-[10px] font-semibold text-stone-500">
                  <span className="flex items-center gap-1">
                    <Droplet className="w-3 h-3 text-blue-400" />
                    {zone.humidity}% RH
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart2 className="w-3 h-3 text-stone-400" />
                    {zone.anomalyCount > 0 ? (
                      <span className="text-red-500 font-bold">{zone.anomalyCount} anomalies</span>
                    ) : (
                      <span className="text-emerald-600">No anomalies</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModalZone(zone)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold active:scale-95 transition-all shadow-sm ${zone.buttonBg}`}
                >
                  {zone.status === "Critical" ? t("takeAction") : "Details"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {activeModalZone && (
          <Portal>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
              onClick={() => setActiveModalZone(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-lg border border-stone-200 shadow-2xl relative text-left overflow-hidden"
              >
                {/* Modal Header */}
                <div className="bg-[#F5FBF3] px-6 py-4 border-b border-[#D7E5D8] flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeModalZone.iconBg}`}>
                      <Thermometer className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-800">{activeModalZone.title} — Telemetry</h3>
                      <p className="text-[10px] font-semibold text-stone-500 mt-0.5">{activeModalZone.subtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModalZone(null)}
                    className="p-1.5 rounded-full hover:bg-stone-200 bg-white/60 text-stone-400 hover:text-stone-700 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Current", value: activeModalZone.temp, color: activeModalZone.tempColor, sub: activeModalZone.status },
                      { label: "Average", value: activeModalZone.avgTemp, color: "text-stone-700", sub: `${activeModalZone.readingCount} readings` },
                      { label: "Target", value: activeModalZone.targetRange, color: "text-stone-600", sub: "safe range" },
                      { label: "Min Recorded", value: activeModalZone.minTemp, color: "text-blue-600", sub: "session low" },
                      { label: "Max Recorded", value: activeModalZone.maxTemp, color: "text-red-500", sub: "session high" },
                      {
                        label: "Anomalies",
                        value: String(activeModalZone.anomalyCount),
                        color: activeModalZone.anomalyCount > 0 ? "text-red-600" : "text-emerald-600",
                        sub: activeModalZone.anomalyCount > 0 ? "out-of-range" : "clean session",
                      },
                    ].map(({ label, value, color, sub }) => (
                      <div key={label} className="bg-stone-50 border border-stone-100 rounded-xl p-3 text-center">
                        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-wide">{label}</p>
                        <p className={`text-sm font-black mt-1 leading-tight ${color}`}>{value}</p>
                        <p className="text-[8px] font-semibold text-stone-400 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Temperature Chart */}
                  {activeModalZone.chartData.length > 1 && (
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                        Temperature over time ({activeModalZone.chartData.length} points)
                      </p>
                      <div className="w-full h-[160px] bg-stone-50 rounded-xl border border-stone-100 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activeModalZone.chartData} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                  offset="5%"
                                  stopColor={activeModalZone.status === "Critical" ? "#EF4444" : activeModalZone.status === "Warning" ? "#F59E0B" : "#2C742F"}
                                  stopOpacity={0.18}
                                />
                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9CA3AF" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} tickLine={false} axisLine={false} unit="°" />
                            <Tooltip
                              contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }}
                              formatter={(v: any) => [`${v}°C`, "Temp"]}
                            />
                            <ReferenceLine
                              y={activeModalZone.maxLimit}
                              stroke="#EF4444"
                              strokeDasharray="4 3"
                              strokeWidth={1.2}
                              label={{ value: `Max ${activeModalZone.maxLimit}°`, position: "right", fontSize: 8, fill: "#EF4444" }}
                            />
                            <ReferenceLine
                              y={activeModalZone.minLimit}
                              stroke="#3B82F6"
                              strokeDasharray="4 3"
                              strokeWidth={1.2}
                              label={{ value: `Min ${activeModalZone.minLimit}°`, position: "right", fontSize: 8, fill: "#3B82F6" }}
                            />
                            <Area
                              type="monotone"
                              dataKey="temp"
                              stroke={activeModalZone.status === "Critical" ? "#EF4444" : activeModalZone.status === "Warning" ? "#F59E0B" : "#2C742F"}
                              strokeWidth={1.8}
                              fill="url(#tempGrad)"
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Humidity + Status Banner */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <Droplet className="w-5 h-5 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-[8px] font-bold text-blue-400 uppercase tracking-wide">Humidity</p>
                        <p className="text-lg font-black text-blue-600">{activeModalZone.humidity}%</p>
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-3 rounded-xl p-3 border ${
                        activeModalZone.status === "Critical"
                          ? "bg-red-50 border-red-200"
                          : activeModalZone.status === "Warning"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      {activeModalZone.status === "Critical" ? (
                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />
                      ) : activeModalZone.status === "Warning" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      )}
                      <div>
                        <p
                          className={`text-[8px] font-bold uppercase tracking-wide ${
                            activeModalZone.status === "Critical" ? "text-red-400" : activeModalZone.status === "Warning" ? "text-amber-500" : "text-emerald-500"
                          }`}
                        >
                          System
                        </p>
                        <p
                          className={`text-xs font-black ${
                            activeModalZone.status === "Critical" ? "text-red-700" : activeModalZone.status === "Warning" ? "text-amber-700" : "text-emerald-700"
                          }`}
                        >
                          {activeModalZone.status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Description */}
                  <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    activeModalZone.status === "Critical"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : activeModalZone.status === "Warning"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}>
                    {activeModalZone.status === "Critical"
                      ? `CRITICAL: Temperature at ${activeModalZone.temp} — ${activeModalZone.anomalyCount} readings outside bounds [${activeModalZone.targetRange}]. Compressor purge or HVAC override required immediately.`
                      : activeModalZone.status === "Warning"
                      ? `Temperature approaching boundary margin at ${activeModalZone.temp} (target: ${activeModalZone.targetRange}). HVAC airflow checklist recommended before next cycle.`
                      : `All readings within target range ${activeModalZone.targetRange}. Cooling system operating normally — no corrective action required.`}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-stone-100 flex gap-3 bg-stone-50">
                  <button
                    onClick={() => setActiveModalZone(null)}
                    className="flex-1 py-2.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-full font-bold text-xs transition-all active:scale-95"
                  >
                    Close
                  </button>
                  {activeModalZone.status === "Critical" ? (
                    <button
                      onClick={() => {
                        setTicketZoneId(activeModalZone.id);
                        setShowTicketModal(true);
                        setActiveModalZone(null);
                      }}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs transition-all shadow-sm active:scale-95"
                    >
                      Create Maintenance Ticket
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveModalZone(null)}
                      className="flex-1 py-2.5 bg-[#2C742F] hover:bg-[#235a26] text-white rounded-full font-bold text-xs transition-all shadow-sm active:scale-95"
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

      {/* Ticket Modal */}
      <AnimatePresence>
        {showTicketModal && (
          <Portal>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 shadow-2xl relative text-left"
              >
                <button
                  onClick={() => setShowTicketModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                <h3 className="text-lg font-bold text-[#2C742F] mb-4">Buat Tiket Maintenance</h3>

                {ticketSuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-sm my-6">
                    Tiket berhasil dibuat! Mengalihkan...
                  </div>
                ) : (
                  <form onSubmit={handleTicketSubmit} className="space-y-4">
                    {ticketError && (
                      <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
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
                        {Object.keys(ZONE_METADATA).map((id) => (
                          <option key={id} value={id}>
                            Zone {id} — {ZONE_METADATA[id].subtitle}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Prioritas</label>
                      <div className="flex gap-2">
                        {["low", "medium", "high"].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTicketPriority(p)}
                            className={`flex-1 py-2 text-xs font-bold rounded-full capitalize border transition-all ${
                              ticketPriority === p
                                ? p === "high"
                                  ? "bg-red-600 border-red-600 text-white"
                                  : p === "medium"
                                  ? "bg-amber-500 border-amber-500 text-white"
                                  : "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
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
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C742F] resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingTicket}
                      className="w-full py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
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
