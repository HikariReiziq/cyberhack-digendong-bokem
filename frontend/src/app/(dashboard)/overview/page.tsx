"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import {
  Package,
  CalendarClock,
  Warehouse,
  Thermometer,
  AlertTriangle,
  TrendingUp,
  Droplets,
} from "lucide-react";
import { calculateUtilization } from "@/lib/dashboard";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { ZONE_TEMP_THRESHOLDS } from "@/lib/constants";
import type { InventoryItem, AuditLog } from "@/types";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStatsResponse {
  success: boolean;
  weeklyTrend: Array<{ date: string; count: number }>;
  zoneSummary: Array<{
    zone: string;
    itemCount: number;
    totalSlots: number;
    capacityPercent: number;
  }>;
  expiryAlerts: Array<{
    id: string;
    name: string;
    zone: string;
    daysLeft: number;
  }>;
  quickStats: {
    totalCategories: number;
    avgDaysToExpiry: number;
    expiredCount: number;
  };
}

// ─── WeeklyStockChart ────────────────────────────────────────────────────────

function WeeklyStockChart({ data }: { data?: Array<{ date: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
        <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Weekly Stock Trend</h3>
        <div className="h-[280px] flex items-center justify-center text-sm text-[#79747E]">
          No trend data available
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    label: new Date(item.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
      <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Weekly Stock Trend</h3>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#79747E" }}
              axisLine={{ stroke: "#C2C9B6" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#79747E" }}
              axisLine={{ stroke: "#C2C9B6" }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid rgba(44,116,47,0.3)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              labelFormatter={(label) => `Date: ${label}`}
              formatter={(value) => [`${value} items`, "Active Stock"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#2C742F"
              strokeWidth={2.5}
              dot={{ fill: "#2C742F", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#2C742F" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── ZoneSummaryCards ────────────────────────────────────────────────────────

function ZoneSummaryCards({
  data,
}: {
  data?: Array<{ zone: string; itemCount: number; totalSlots: number; capacityPercent: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
        <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Zone Summary</h3>
        <div className="flex items-center justify-center h-32 text-sm text-[#79747E]">
          No zone data available
        </div>
      </div>
    );
  }

  const chartData = data.map((zone) => {
    const utilization = calculateUtilization(zone.itemCount, zone.totalSlots);
    return {
      name: zone.zone,
      capacity: utilization,
    };
  });

  const getBarColor = (capacity: number) => {
    if (capacity > 80) return "#EA4B48";
    if (capacity >= 50) return "#F59E0B";
    return "#2C742F";
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
      <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Zone Summary</h3>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#79747E" }}
              axisLine={{ stroke: "#C2C9B6" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#79747E" }}
              axisLine={{ stroke: "#C2C9B6" }}
              tickLine={false}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid rgba(44,116,47,0.3)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              formatter={(value: any) => [`${value}%`, "Capacity"]}
              labelFormatter={(label) => `Zone ${label}`}
            />
            <Bar dataKey="capacity" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.capacity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── ExpiryAlertsPanel ───────────────────────────────────────────────────────

function ExpiryAlertsPanel({
  data,
}: {
  data?: Array<{ id: string; name: string; zone: string; daysLeft: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
        <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Expiry Alerts</h3>
        <div className="flex items-center justify-center h-32 text-sm text-[#79747E]">
          No expiry alerts
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#1C1B1F]">Expiry Alerts</h3>
        <span className="text-xs bg-red-100 text-[#EA4B48] px-2.5 py-0.5 rounded-full font-semibold">
          {data.length} items
        </span>
      </div>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-4">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
          >
            <div className="min-w-0 pr-3">
              <p className="text-sm font-semibold text-[#1C1B1F] truncate">{item.name}</p>
              <p className="text-xs text-[#79747E] mt-0.5">Zone {item.zone}</p>
            </div>
            <span
              className={`text-sm font-bold shrink-0 ${
                item.daysLeft <= 7
                  ? "text-[#EA4B48]"
                  : item.daysLeft <= 14
                  ? "text-amber-500"
                  : "text-[#79747E]"
              }`}
            >
              {item.daysLeft} days left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QuickStats ──────────────────────────────────────────────────────────────

function QuickStats({
  data,
}: {
  data?: { totalCategories: number; avgDaysToExpiry: number; expiredCount: number };
}) {
  if (!data) return null;

  const items = [
    {
      value: data.totalCategories,
      label: "Total Categories",
    },
    {
      value: data.avgDaysToExpiry,
      label: "Avg Days to Expiry",
    },
    {
      value: data.expiredCount,
      label: "Expired Items",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Quick Stats</h3>
      <div className="grid grid-cols-3 gap-4">
        {items.map(({ value, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 p-4 rounded-lg border border-gray-100 text-center"
          >
            <span className="text-2xl font-bold text-[#1C1B1F]">{value}</span>
            <span className="text-[11px] text-[#79747E] font-medium leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ActivityTimeline ────────────────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: Array<{ id: number; time: string; user: string; detail: string }> }) {
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
        <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center h-32 text-sm text-[#79747E]">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8]">
      <h3 className="text-lg font-bold text-[#1C1B1F] mb-4">Recent Activity</h3>
      <div className="space-y-4 max-h-64 overflow-y-auto">
        {activities.map((act) => (
          <div key={act.id} className="flex items-start gap-3">
            <span className="text-xs text-[#79747E] font-medium w-12 shrink-0 pt-0.5">
              {act.time}
            </span>
            <div className="relative flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2C742F] shrink-0 mt-1" />
              <div className="w-px h-full bg-[#D7E5D8] absolute top-3" />
            </div>
            <div className="min-w-0 pb-3">
              <span className="text-sm font-semibold text-[#2C742F]">{act.user}</span>
              <p className="text-xs text-[#1C1B1F]/70 mt-0.5 leading-relaxed">{act.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [coldChainAlertsCount, setColdChainAlertsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    const [invRes, auditRes, tempRes, statsRes] = await Promise.allSettled([
      api.get<{ success: boolean; items: InventoryItem[] }>("/inventory"),
      api.get<{ success: boolean; logs: AuditLog[] }>("/audit"),
      api.get<{ success: boolean; temperatures: Record<string, Array<{ temperature: number }>> }>("/cold-chain"),
      api.get<DashboardStatsResponse>("/dashboard/stats"),
    ]);

    let anySuccess = false;

    if (invRes.status === "fulfilled" && invRes.value.success) {
      setInventory(invRes.value.items ?? []);
      anySuccess = true;
    }
    if (auditRes.status === "fulfilled" && auditRes.value.success) {
      setActivities(auditRes.value.logs?.slice(0, 5) ?? []);
      anySuccess = true;
    }
    if (statsRes.status === "fulfilled" && statsRes.value.success) {
      setDashboardStats(statsRes.value);
      anySuccess = true;
    }
    if (tempRes.status === "fulfilled" && tempRes.value.success) {
      let anomalies = 0;
      Object.entries(tempRes.value.temperatures ?? {}).forEach(([zoneId, readings]) => {
        const bounds = ZONE_TEMP_THRESHOLDS[zoneId] ?? { min: -10, max: 40 };
        if (readings.some((r: any) => r.temperature > bounds.max || r.temperature < bounds.min)) {
          anomalies++;
        }
      });
      setColdChainAlertsCount(anomalies);
      anySuccess = true;
    }

    if (!anySuccess) {
      setError("Unable to connect to the server. Please try again later.");
    }

    setIsLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(fetchDashboardData);
  }, []);

  // Computed stats from inventory + DB
  const stats = useMemo(() => {
    const totalSlots = dashboardStats?.zoneSummary?.reduce((sum, z) => sum + z.totalSlots, 0) || 30;
    const occupiedSlots = inventory.length;
    const capacity = Math.min(100, Math.round((occupiedSlots / totalSlots) * 100));
    return { capacity, totalSlots, occupiedSlots };
  }, [inventory, dashboardStats]);

  const activeItemsCount = useMemo(
    () => inventory.filter((i) => i.status !== "Expired").length,
    [inventory]
  );

  const criticalCount = useMemo(
    () => inventory.filter((i) => i.status === "Kritis").length,
    [inventory]
  );

  const warningCount = useMemo(
    () => inventory.filter((i) => i.status === "Warning").length,
    [inventory]
  );

  const expiringSoonCount = useMemo(
    () => criticalCount + warningCount,
    [criticalCount, warningCount]
  );

  // Weekly stock change: compare last day vs first day of trend
  const weeklyChange = useMemo(() => {
    const trend = dashboardStats?.weeklyTrend;
    if (!trend || trend.length < 2) return null;
    return trend[trend.length - 1].count - trend[0].count;
  }, [dashboardStats]);

  // Items requiring immediate use (Expired or Kritis)
  const immediateUseItems = useMemo(() => {
    return inventory
      .filter((i) => i.status === "Expired" || i.status === "Kritis" || i.status === "Warning")
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())
      .slice(0, 5);
  }, [inventory]);

  // Process activities for timeline display
  const displayActivities = useMemo(() => {
    return activities.map((log) => {
      let timeStr = "";
      if (log.timestamp) {
        const parts = log.timestamp.split(" ");
        timeStr = parts[1] || parts[0] || log.timestamp;
        if (timeStr.includes(":")) timeStr = timeStr.slice(0, 5);
      }
      return {
        id: log.id,
        time: timeStr,
        user: log.username || log.user || "System",
        detail: log.detail,
      };
    });
  }, [activities]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-[#1C1B1F]">{t('loadingDashboard')}</p>
          <p className="text-xs text-[#79747E] mt-1">{t('fetchingData')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertTriangle size={48} className="text-[#EA4B48]" />
        <div>
          <p className="text-sm font-bold text-[#1C1B1F]">Failed to Load Dashboard</p>
          <p className="text-xs text-[#79747E] mt-1">{error}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-5 py-2 rounded-lg bg-[#2C742F] text-white text-sm font-semibold hover:bg-[#235a26] transition-colors mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-[Poppins,sans-serif]">
      {/* Page Title */}
      <h1 className="text-[32px] font-bold text-[#1C1B1F] tracking-tight">{t('overviewTitle')}</h1>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Active Stock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-[#D7E5D8] flex flex-col justify-between h-[160px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-[#79747E] font-medium">{t('totalActiveStock')}</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl font-bold text-[#1C1B1F]">{activeItemsCount}</span>
                <span className="text-lg text-[#79747E] font-light">lots</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-[#D7E5D8] flex items-center justify-center">
              <Package size={22} className="text-[#2C742F]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp size={16} className={weeklyChange !== null && weeklyChange < 0 ? "text-[#EA4B48]" : "text-[#2C742F]"} />
            {weeklyChange !== null ? (
              <span className={`font-semibold ${weeklyChange < 0 ? "text-[#EA4B48]" : "text-[#2C742F]"}`}>
                {weeklyChange >= 0 ? `+${weeklyChange}` : weeklyChange} this week
              </span>
            ) : (
              <span className="text-[#79747E] font-medium">Loading trend...</span>
            )}
          </div>
        </motion.div>

        {/* Card 2: Nearing Expiry */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-[#D7E5D8] flex flex-col justify-between h-[160px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-[#79747E] font-medium">{t('nearingExpiry')}</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl font-bold text-[#1C1B1F]">{expiringSoonCount}</span>
                <span className="text-lg text-[#79747E] font-light">items</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center">
              <CalendarClock size={22} className="text-[#EA4B48]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <AlertTriangle size={14} className="text-[#EA4B48]" />
            <span className="text-[#EA4B48] font-semibold">
              {criticalCount > 0 && `${criticalCount} kritis`}
              {criticalCount > 0 && warningCount > 0 && ", "}
              {warningCount > 0 && `${warningCount} warning`}
              {criticalCount === 0 && warningCount === 0 && "Semua aman"}
            </span>
          </div>
        </motion.div>

        {/* Card 3: Warehouse Capacity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-[#D7E5D8] flex flex-col justify-between h-[160px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-[#79747E] font-medium">{t('warehouseCapacity')}</span>
            </div>
            <div className="w-11 h-11 rounded-lg bg-[#D7E5D8] flex items-center justify-center">
              <Warehouse size={22} className="text-[#2C742F]" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2C742F] rounded-full transition-all"
                style={{ width: `${stats.capacity}%` }}
              />
            </div>
            <p className="text-xs text-[#79747E] font-medium">
              {stats.totalSlots - stats.occupiedSlots} empty slots remaining
            </p>
          </div>
        </motion.div>

        {/* Card 4: Cold-Chain Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-[#D7E5D8] flex flex-col justify-between h-[160px]"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm text-[#79747E] font-medium">{t('coldChainAlerts')}</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className={`text-3xl font-bold ${coldChainAlertsCount > 0 ? "text-[#EA4B48]" : "text-[#1C1B1F]"}`}>
                  {coldChainAlertsCount}
                </span>
                <span className="text-lg text-[#79747E] font-light">zones</span>
              </div>
            </div>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
              coldChainAlertsCount > 0 ? "bg-[#EA4B48]" : "bg-[#D7E5D8]"
            }`}>
              <Thermometer size={22} className={coldChainAlertsCount > 0 ? "text-white" : "text-[#2C742F]"} />
            </div>
          </div>
          <div className="text-xs text-[#79747E] font-medium">
            {coldChainAlertsCount > 0
              ? "temperature anomaly detected in storage"
              : "All zones within normal range"}
          </div>
        </motion.div>
      </div>

      {/* Weekly Stock Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <WeeklyStockChart data={dashboardStats?.weeklyTrend} />
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <QuickStats data={dashboardStats?.quickStats} />
      </motion.div>

      {/* Zone Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <ZoneSummaryCards data={dashboardStats?.zoneSummary} />
      </motion.div>

      {/* Expiry Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <ExpiryAlertsPanel data={dashboardStats?.expiryAlerts} />
      </motion.div>

      {/* Main Content Grid — 2:1 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items Requiring Immediate Use */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#D7E5D8] overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-[#D7E5D8] flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#1C1B1F]">Items Requiring Immediate Use</h3>
            <Link
              href="/fifo-expiry"
              className="text-sm text-[#2C742F] font-semibold hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#79747E] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Material</th>
                  <th className="px-6 py-3">Lot ID</th>
                  <th className="px-6 py-3">Days Left</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {immediateUseItems.length > 0 ? (
                  immediateUseItems.map((item) => {
                    const days = Math.ceil(
                      (new Date(item.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const daysLabel = days <= 0 ? "Expired" : `${days} days left`;
                    const statusClass =
                      days <= 7 ? "critical" : days <= 30 ? "warning" : "monitor";
                    const statusLabel =
                      days <= 7 ? "Critical" : days <= 30 ? "Warning" : "Monitor";

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                statusClass === "critical"
                                  ? "bg-red-50 text-[#EA4B48]"
                                  : "bg-[#D7E5D8] text-[#2C742F]"
                              }`}
                            >
                              <Droplets size={16} />
                            </div>
                            <span className="text-sm font-semibold text-[#1C1B1F]">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-[#2C742F] font-medium">
                          {item.id}
                        </td>
                        <td className={`px-6 py-3.5 text-sm font-semibold ${
                          statusClass === "critical"
                            ? "text-[#EA4B48]"
                            : statusClass === "warning"
                            ? "text-amber-500"
                            : "text-[#79747E]"
                        }`}>
                          {daysLabel}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              statusClass === "critical"
                                ? "bg-red-100 text-[#EA4B48]"
                                : statusClass === "warning"
                                ? "bg-amber-100 text-amber-600"
                                : "bg-gray-100 text-[#79747E]"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#79747E]">
                      No items requiring immediate use
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Right: Recent Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <ActivityTimeline activities={displayActivities} />
        </motion.div>
      </div>
    </div>
  );
}
