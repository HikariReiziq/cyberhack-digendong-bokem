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
  PieChart,
  Pie,
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
        <div className="h-[200px] sm:h-[280px] flex items-center justify-center text-sm text-[#79747E]">
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#1C1B1F]">Weekly Stock Trend</h3>
        <Link href="/inventory-master" className="text-sm text-[#2C742F] font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="w-full h-[200px] sm:h-[280px]">
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
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8] h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#1C1B1F]">Zone Summary</h3>
        <Link href="/cold-chain" className="text-sm text-[#2C742F] font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="w-full h-[180px] sm:h-[220px]">
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
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-[#1C1B1F]">Expiry Alerts</h3>
          <span className="text-xs bg-red-100 text-[#EA4B48] px-2.5 py-0.5 rounded-full font-semibold">
            {data.length} items
          </span>
        </div>
        <Link href="/fifo-expiry" className="text-sm text-[#2C742F] font-semibold hover:underline">
          View All
        </Link>
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

function CircleStat({
  value,
  label,
  percentage,
  color,
}: {
  value: number;
  label: string;
  percentage: number;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const chartData = [{ v: clamped }, { v: 100 - clamped }];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="82%"
              startAngle={90}
              endAngle={-270}
              dataKey="v"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill="#F3F4F6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-[#1C1B1F]">{value}</span>
        </div>
      </div>
      <span className="text-[11px] text-[#79747E] font-medium text-center leading-tight max-w-[80px]">
        {label}
      </span>
    </div>
  );
}

function QuickStats({
  data,
  totalItems,
}: {
  data?: { totalCategories: number; avgDaysToExpiry: number; expiredCount: number };
  totalItems?: number;
}) {
  if (!data) return null;

  const avgColor =
    data.avgDaysToExpiry > 30
      ? "#2C742F"
      : data.avgDaysToExpiry > 14
      ? "#F59E0B"
      : "#EA4B48";

  const stats = [
    {
      value: data.totalCategories,
      label: "Total Categories",
      percentage: Math.min(100, (data.totalCategories / 20) * 100),
      color: "#2C742F",
    },
    {
      value: data.avgDaysToExpiry,
      label: "Avg Days to Expiry",
      percentage: Math.min(100, (data.avgDaysToExpiry / 90) * 100),
      color: avgColor,
    },
    {
      value: data.expiredCount,
      label: "Expired Items",
      percentage: totalItems
        ? Math.min(100, (data.expiredCount / totalItems) * 100)
        : data.expiredCount > 0
        ? 100
        : 0,
      color: data.expiredCount > 0 ? "#EA4B48" : "#2C742F",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#D7E5D8] shadow-sm h-full">
      <h3 className="text-lg font-bold text-[#1C1B1F] mb-6">Quick Stats</h3>
      <div className="flex items-center justify-around gap-2">
        {stats.map(({ value, label, percentage, color }) => (
          <CircleStat key={label} value={value} label={label} percentage={percentage} color={color} />
        ))}
      </div>
    </div>
  );
}

// ─── ActivityTimeline ────────────────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: Array<{ id: number; time: string; user: string; detail: string }> }) {
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8] h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1C1B1F]">Recent Activity</h3>
          <Link href="/audit-trail" className="text-sm text-[#2C742F] font-semibold hover:underline">
            View All
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-[#79747E]">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#D7E5D8] h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-lg font-bold text-[#1C1B1F]">Recent Activity</h3>
        <Link href="/audit-trail" className="text-sm text-[#2C742F] font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-4 flex-1 overflow-y-auto">
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
  const { t, lang } = useLanguage();

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
      setError(t('dashboardConnFailed'));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(fetchDashboardData);
  }, []);

  // Computed stats from inventory + DB
  const stats = useMemo(() => {
    const totalSlots = dashboardStats?.zoneSummary?.reduce((sum, z) => sum + z.totalSlots, 0) || 30;
    const occupiedSlots = inventory.filter((i) => i.location && i.location !== "UNASSIGNED").length;
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
          <p className="text-sm font-bold text-[#1C1B1F]">{t('failedLoadDashboard')}</p>
          <p className="text-xs text-[#79747E] mt-1">{error}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-5 py-2 rounded-lg bg-[#2C742F] text-white text-sm font-semibold hover:bg-[#235a26] transition-colors mt-2"
        >
          {t('retry')}
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
                <span className="text-lg text-[#79747E] font-light">{t('lots')}</span>
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
                {weeklyChange >= 0 ? `+${weeklyChange}` : weeklyChange} {t('thisWeek')}
              </span>
            ) : (
              <span className="text-[#79747E] font-medium">{t('loadingTrend')}</span>
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
                <span className="text-lg text-[#79747E] font-light">{t('items')}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center">
              <CalendarClock size={22} className="text-[#EA4B48]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <AlertTriangle size={14} className="text-[#EA4B48]" />
            <span className="text-[#EA4B48] font-semibold">
              {criticalCount > 0 && t('criticalCountText').replace('{count}', String(criticalCount))}
              {criticalCount > 0 && warningCount > 0 && ", "}
              {warningCount > 0 && t('warningCountText').replace('{count}', String(warningCount))}
              {criticalCount === 0 && warningCount === 0 && t('allSafe')}
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
              {t('emptySlotsRemaining').replace('{count}', String(stats.totalSlots - stats.occupiedSlots))}
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
                <span className="text-lg text-[#79747E] font-light">{lang === 'id' ? 'zona' : 'zones'}</span>
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
              ? t('tempAnomalyDetected')
              : t('allZonesNormal')}
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

      {/* Quick Stats (left) + Zone Summary (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <QuickStats data={dashboardStats?.quickStats} totalItems={inventory.length} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <ZoneSummaryCards data={dashboardStats?.zoneSummary} />
        </motion.div>
      </div>

      {/* Expiry Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <ExpiryAlertsPanel data={dashboardStats?.expiryAlerts} />
      </motion.div>

      {/* Main Content Grid — 2:1 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left: Items Requiring Immediate Use */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#D7E5D8] overflow-hidden flex flex-col"
        >
          <div className="px-6 py-4 border-b border-[#D7E5D8] flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#1C1B1F]">{t('itemsRequiringImmediateUse')}</h3>
            <Link
              href="/fifo-expiry"
              className="text-sm text-[#2C742F] font-semibold hover:underline"
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#79747E] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">{t('colName')}</th>
                  <th className="px-6 py-3">{lang === 'id' ? 'ID Lot' : 'Lot ID'}</th>
                  <th className="px-6 py-3">{t('daysLeft')}</th>
                  <th className="px-6 py-3">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {immediateUseItems.length > 0 ? (
                  immediateUseItems.map((item) => {
                    const days = Math.ceil(
                      (new Date(item.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const daysLabel = days <= 0 ? t('expired') : `${days} ${t('daysLeft')}`;
                    const statusClass =
                      days <= 7 ? "critical" : days <= 30 ? "warning" : "monitor";
                    const statusLabel =
                      days <= 7 ? t('critical') : days <= 30 ? t('warning') : (lang === 'id' ? 'Pantau' : 'Monitor');

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
                      {t('noImmediateUseItems')}
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
          className="flex flex-col"
        >
          <ActivityTimeline activities={displayActivities} />
        </motion.div>
      </div>
    </div>
  );
}
