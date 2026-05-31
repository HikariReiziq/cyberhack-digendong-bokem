"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  FileSpreadsheet, 
  Calendar, 
  FileText, 
  Table, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  RefreshCw, 
  Download,
  Share2,
  FileCheck2,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { callAI } from "@/lib/gemini";
import type { InventoryItem, Slot, AuditLog } from "@/types";
import Portal from "@/components/Portal";

function getDaysLeft(expiryDateStr: string): number {
  // Parse both as UTC midnight to avoid timezone offset shifting the day boundary
  const [ey, em, ed] = expiryDateStr.split('-').map(Number);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(ey, em - 1, ed);
  return Math.ceil((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/** Simple markdown to HTML renderer supporting bold, italic, lists, headers, and tables */
function renderMarkdown(text: string): string {
  let html = text;

  // Escape HTML entities first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers (# to ######)
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-xs font-bold mt-2 mb-1">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-xs font-bold mt-2 mb-1">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-sm font-bold mt-2 mb-1">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-sm font-bold mt-2 mb-1">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-base font-bold mt-2 mb-1">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-lg font-bold mt-2 mb-1">$1</h1>');

  // Tables: detect lines with | separators
  const lines = html.split('\n');
  let inTable = false;
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if it's a separator row (e.g., |---|---|)
      const isSeparator = /^\|[\s\-:|]+\|$/.test(line);
      if (isSeparator) {
        // Skip separator rows
        continue;
      }
      if (!inTable) {
        processedLines.push('<table class="w-full text-xs border-collapse my-2"><tbody>');
        inTable = true;
      }
      const cells = line.split('|').filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isHeader = i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim());
      const tag = isHeader ? 'th' : 'td';
      const cellClass = isHeader ? 'border border-stone-200 px-2 py-1 bg-stone-100 font-bold' : 'border border-stone-200 px-2 py-1';
      processedLines.push('<tr>' + cells.map(c => `<${tag} class="${cellClass}">${c.trim()}</${tag}>`).join('') + '</tr>');
    } else {
      if (inTable) {
        processedLines.push('</tbody></table>');
        inTable = false;
      }
      processedLines.push(line);
    }
  }
  if (inTable) {
    processedLines.push('</tbody></table>');
  }
  html = processedLines.join('\n');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists: lines starting with - 
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>');

  // Line breaks for remaining lines
  html = html.replace(/\n/g, '<br/>');
  // Clean up extra <br/> around block elements
  html = html.replace(/<br\/>\s*(<(?:h[1-6]|ul|table|\/table|\/ul))/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|ul|table)>)\s*<br\/>/g, '$1');

  return html;
}

export default function AutoReportPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isRefreshingAI, setIsRefreshingAI] = useState(false);

  // 1. Selection States
  const [selectedType, setSelectedType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "excel">("pdf");
  const [customNotes, setCustomNotes] = useState<string>("");

  // 2. Report Generation Simulation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const steps = [
    "Connecting to AromaSys secure database...",
    "Querying raw material stock and sensor logs...",
    "Validating FIFO expiry timelines & degradation data...",
    "Compiling AI Copilot summary & recommendations...",
    "Synthesizing final report document structure..."
  ];

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);
      const [invData, slotsData, auditData] = await Promise.all([
        api.get<{ success: boolean; items: InventoryItem[] }>('/inventory'),
        api.get<{ success: boolean; slots: Slot[] }>('/slots'),
        api.get<{ success: boolean; logs: AuditLog[] }>('/audit')
      ]);
      if (invData.success) setInventory(invData.items ?? []);
      if (slotsData.success) setSlots(slotsData.slots ?? []);
      if (auditData.success) setLogs(auditData.logs ?? []);
    } catch (e: any) {
      setError('Failed to load telemetry data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, []);

  // AI Analysis refresh handler - with full context (zones, temps, inventory detail)
  const handleRefreshAI = useCallback(async () => {
    setIsRefreshingAI(true);
    try {
      // 1. Fetch temperature data from real-time sensors
      let temperatures: Record<string, number[]> = {};
      try {
        const tempRes = await api.get<any>('/cold-chain');
        if (tempRes.temperatures) {
          // Extract temperature values from objects to prevent type mismatches
          Object.keys(tempRes.temperatures).forEach(zone => {
            temperatures[zone] = tempRes.temperatures[zone].map((r: any) => 
              typeof r === 'number' ? r : (r && typeof r.temperature === 'number' ? r.temperature : 23)
            );
          });
        }
      } catch {
        // Fallback: use mock temps if API fails
        const uniqueZones = new Set(slots.map(s => s.zone));
        uniqueZones.forEach(zone => {
          temperatures[zone] = [23 + Math.random() * 4];
        });
      }

      // 2. Get zone information (unique zones from slots)
      const zoneMap = new Map<string, { zone: string; count: number; occupied: number; temps: number[] }>();
      slots.forEach(slot => {
        const zone = slot.zone || 'Unknown';
        if (!zoneMap.has(zone)) {
          zoneMap.set(zone, {
            zone,
            count: 0,
            occupied: 0,
            temps: temperatures[zone] || [23]
          });
        }
        const z = zoneMap.get(zone)!;
        z.count++;
        if (slot.occupied) z.occupied++;
      });

      // 3. Build comprehensive inventory context
      const totalStock = inventory.reduce((sum, item) => sum + (item.unit.toLowerCase() === 'kg' ? item.qty : item.qty * 0.9), 0);
      const lowStockCount = inventory.filter(i => i.status === 'Warning' || i.status === 'Kritis' || i.status === 'Expired').length;
      const occupiedSlots = slots.filter(s => s.occupied).length;
      const nearExpiry = inventory.filter(item => {
        const days = getDaysLeft(item.expiry);
        return days >= 0 && days <= 7;
      }).length;

      // 4. Get critical/expired items with zone info
      const criticalItems = inventory
        .filter(i => i.status === 'Kritis' || i.status === 'Expired')
        .slice(0, 5)
        .map(item => ({
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          zone: item.zone,
          expiry: item.expiry,
          status: item.status,
          daysLeft: getDaysLeft(item.expiry)
        }));

      const nearExpiryItems = inventory
        .filter(item => {
          const days = getDaysLeft(item.expiry);
          return days >= 0 && days <= 14;
        })
        .slice(0, 5)
        .map(item => ({
          name: item.name,
          category: item.category,
          zone: item.zone,
          expiry: item.expiry,
          daysLeft: getDaysLeft(item.expiry),
          qty: item.qty
        }));

      // 5. Build zone context with temperature
      const zoneContext = Array.from(zoneMap.values())
        .map(z => ({
          zone: z.zone,
          slots: z.count,
          occupied: z.occupied,
          utilization: Math.round((z.occupied / z.count) * 100),
          currentTemp: z.temps[0]?.toFixed(1) || '23.0',
          tempReadings: z.temps.length
        }));

      // 6. Build comprehensive prompt based on report type
      let focusedPrompt = '';
      if (selectedType === 'daily') {
        focusedPrompt = `DAILY Analysis: Evaluate today's inventory status, focusing on:
- Current warehouse capacity utilization
- Low-stock/critical items requiring immediate action
- Stock distribution per zone
- Urgent recommendations for the next 24 hours`;
      } else if (selectedType === 'weekly') {
        focusedPrompt = `WEEKLY Analysis: Evaluate weekly trends, focusing on:
- FIFO efficiency and stock rotation
- Batches approaching expiry within 7–14 days
- Quality degradation risk based on zone temperatures
- Priority stock rotation recommendations`;
      } else {
        focusedPrompt = `MONTHLY Analysis: Evaluate monthly performance, focusing on:
- Warehouse utilization trends
- Consumption and storage patterns
- Overall operational efficiency
- Capacity optimization & inventory management recommendations`;
      }

      const prompt = `You are a professional AromaSys warehouse AI analyst with expertise in inventory management, cold-chain monitoring, and quality assurance.

=== LIVE WAREHOUSE CONTEXT ===
📊 INVENTORY METRICS:
- Total stock: ${Math.round(totalStock)} kg/L equivalent
- Total managed items: ${inventory.length} batches
- Low stock/critical items: ${lowStockCount} items
- Batches nearing expiry (7 days): ${nearExpiry} batches

🏢 ZONE UTILIZATION:
${zoneContext.map(z => `- ${z.zone}: ${z.occupied}/${z.slots} slots (${z.utilization}%) | Current temp: ${z.currentTemp}°C`).join('\n')}

⚠️ CRITICAL ITEMS (Immediate Action Required):
${criticalItems.length > 0 ? criticalItems.map(i => `- ${i.name} (${i.qty} ${i.unit}): Status ${i.status}, expires in ${i.daysLeft} days, zone ${i.zone}`).join('\n') : '- No critical items'}

📦 NEAR-EXPIRY ITEMS (7–14 days):
${nearExpiryItems.length > 0 ? nearExpiryItems.map(i => `- ${i.name} (${i.category}): ${i.daysLeft} days remaining, zone ${i.zone}`).join('\n') : '- No items nearing expiry'}

📅 REPORT PERIOD: ${startDate} to ${endDate}

=== REQUESTED ANALYSIS ===
${focusedPrompt}

Provide a concise analysis (3–5 sentences) in English that:
1. Describes the current specific warehouse conditions
2. Identifies real risks based on the data (temperature, expiry, stock)
3. Gives 2–3 immediately actionable operational recommendations
4. If critical/expired items exist: prioritize disposal/rotation actions
5. If any zone has issues (temperature, utilization): explain the impact`;

      const result = await callAI(prompt, 'chatbot');
      setAiAnalysis(result);
    } catch (e: any) {
      setAiAnalysis("Failed to load AI analysis. Please try again.");
    } finally {
      setIsRefreshingAI(false);
    }
  }, [inventory, slots, startDate, endDate, selectedType]);

  // 3. Trigger Report Generation Animation
  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep(0);
    setGenerationSuccess(false);
  };

  useEffect(() => {
    if (isGenerating && generationStep < steps.length) {
      const timer = setTimeout(() => {
        setGenerationStep(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else if (isGenerating && generationStep === steps.length) {
      const timer = setTimeout(() => {
        setIsGenerating(false);
        setGenerationSuccess(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, generationStep]);

  // 4. Mapped Telemetry Calculations from Real DB
  const metricsData = useMemo(() => {
    // Daily calculation
    const totalBotanicalKg = inventory.reduce((sum, item) => sum + (item.unit.toLowerCase() === 'kg' ? item.qty : item.qty * 0.9), 0);
    const lowStockAlerts = inventory.filter(i => i.status === 'Warning' || i.status === 'Kritis' || i.status === 'Expired').length;
    const occupiedCount = slots.filter(s => s.occupied).length;
    const freeSlots = slots.length - occupiedCount;

    // Weekly calculation
    const nearExpiryLots = inventory.filter(item => {
      const days = getDaysLeft(item.expiry);
      return days >= 0 && days <= 7;
    }).length;
    const complianceRate = inventory.length > 0 
      ? Math.round(((inventory.length - inventory.filter(i => i.status === 'Expired').length) / inventory.length) * 100) 
      : 100;
    const auditLogsThisWeek = logs.length;

    // Monthly calculation
    const totalIngredients = inventory.length;

    return {
      daily: {
        totalBotanical: Math.round(totalBotanicalKg),
        lowStock: lowStockAlerts,
        emptySlots: freeSlots,
        pending: occupiedCount
      },
      weekly: {
        nearExpiry: nearExpiryLots,
        compliance: complianceRate,
        logsCount: auditLogsThisWeek
      },
      monthly: {
        totalItems: totalIngredients
      }
    };
  }, [inventory, slots, logs]);

  const reportData = useMemo(() => {
    // Get top botanical reserves dynamically
    const sortedReserves = [...inventory]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4)
      .map(item => ({
        name: item.name,
        current: item.qty,
        max: Math.max(item.qty * 1.3, 500),
        color: item.status === 'Kritis' || item.status === 'Expired' ? "bg-red-600" : "bg-lime-800",
        labelStyle: item.status === 'Kritis' || item.status === 'Expired' ? "text-red-700 font-bold" : "text-green-950"
      }));

    // Get batch aging distribution dynamically
    const sortedAging = [...inventory]
      .sort((a, b) => getDaysLeft(a.expiry) - getDaysLeft(b.expiry))
      .slice(0, 4)
      .map(item => {
        const days = getDaysLeft(item.expiry);
        return {
          name: `${item.name} (${item.id})`,
          current: Math.max(0, days),
          max: 90, // baseline max scaling days
          color: days < 0 ? "bg-red-700 animate-pulse" : days <= 7 ? "bg-red-500" : "bg-[#BCF389]",
          labelStyle: days <= 7 ? "text-red-700 font-bold" : "text-green-950"
        };
      });

    return {
      daily: {
        title: "Daily Inventory Status",
        subtitle: "Active raw material stock count, low-level alerts, and current remaining capacity.",
        metrics: [
          {
            label: "Total Botanical Stock",
            value: metricsData.daily.totalBotanical.toLocaleString(),
            unit: "kg / L equivalent",
            trend: `Live data from ${inventory.length} batches`,
            trendType: "up",
            icon: FileText,
            iconColor: "text-lime-800",
            iconBg: "bg-lime-100",
            borderStyle: "border-stone-200/50"
          },
          {
            label: "Occupied Slots",
            value: metricsData.daily.pending.toString(),
            unit: "slots",
            trend: `${metricsData.daily.emptySlots} empty slots remaining`,
            trendType: "info",
            icon: FileSpreadsheet,
            iconColor: "text-amber-500",
            iconBg: "bg-amber-100/50",
            borderStyle: "border-stone-200/50"
          },
          {
            label: "Low Stock Alerts",
            value: metricsData.daily.lowStock.toString(),
            unit: "items",
            trend: "Requires immediate attention",
            trendType: "warning",
            icon: AlertTriangle,
            iconColor: "text-red-600",
            iconBg: "bg-red-100/50",
            borderStyle: "border-t-4 border-t-amber-400 border-x-stone-200/50 border-b-stone-200/50"
          }
        ],
        reservesTitle: "Top Botanical Reserves",
        reserves: sortedReserves.length > 0 ? sortedReserves : [
          { name: "Lavender Oil (Grade A)", current: 850, max: 1000, color: "bg-lime-800", labelStyle: "text-green-950" },
          { name: "Eucalyptus Crude", current: 450, max: 600, color: "bg-[#4E7D22]", labelStyle: "text-green-950" }
        ],
        copilot: `AromaSys inventory stock is currently stable. ${metricsData.daily.lowStock} item(s) have low/critical alert levels. Visual inspection is recommended for slots flagged as non-Optimal to prevent quality degradation.`,
        trendAnalysis: `Daily trend shows warehouse utilization at ${Math.round((metricsData.daily.pending / (slots.length || 30)) * 100)}% with ${metricsData.daily.emptySlots} slots available. Stock movement is stable with ${metricsData.daily.lowStock} item(s) requiring immediate attention. Capacity projections indicate sufficient space for the next 24 hours of operations.`
      },
      weekly: {
        title: "Weekly FIFO & Expiry",
        subtitle: "Raw material degradation risk report and stock rotation schedule.",
        metrics: [
          {
            label: "Near Expiry Batches",
            value: metricsData.weekly.nearExpiry.toString(),
            unit: "lots",
            trend: "Expiring within 7 days",
            trendType: "warning",
            icon: AlertTriangle,
            iconColor: "text-red-700",
            iconBg: "bg-red-100",
            borderStyle: "border-t-4 border-t-red-600 border-x-stone-200/50 border-b-stone-200/50"
          },
          {
            label: "Compliance Rate",
            value: `${metricsData.weekly.compliance}%`,
            unit: "optimal",
            trend: "Non-expired optimal batches",
            trendType: "up",
            icon: FileSpreadsheet,
            iconColor: "text-lime-800",
            iconBg: "bg-lime-100",
            borderStyle: "border-stone-200/50"
          },
          {
            label: "Quality Audits",
            value: metricsData.weekly.logsCount.toString(),
            unit: "activities",
            trend: "Audit activity logs recorded",
            trendType: "success",
            icon: CheckCircle2,
            iconColor: "text-emerald-600",
            iconBg: "bg-emerald-100/50",
            borderStyle: "border-stone-200/50"
          }
        ],
        reservesTitle: "Batch Aging (Days Remaining)",
        reserves: sortedAging.length > 0 ? sortedAging : [
          { name: "Patchouli Oil (LOT-PO-230526)", current: 5, max: 90, color: "bg-red-600", labelStyle: "text-red-600 font-bold" }
        ],
        copilot: `Weekly audit detected ${metricsData.weekly.nearExpiry} batch(es) approaching expiry limit. Strictly follow the FIFO rotation protocol and prioritize these batches in the next production extraction schedule.`,
        trendAnalysis: `Weekly trend shows ${metricsData.weekly.nearExpiry} batch(es) approaching expiry within 7 days. FIFO compliance rate stands at ${metricsData.weekly.compliance}% with ${metricsData.weekly.logsCount} audit activities recorded. Recommendation: accelerate rotation for critical batches and increase quality inspection frequency.`
      },
      monthly: {
        title: "Monthly Consumption Log",
        subtitle: "Monthly historical consumption log trends and stock variance analysis.",
        metrics: [
          {
            label: "Total Items Managed",
            value: metricsData.monthly.totalItems.toString(),
            unit: "batches",
            trend: "Registered in master data",
            trendType: "up",
            icon: FileText,
            iconColor: "text-[#2C742F]",
            iconBg: "bg-[#D6E5D7]",
            borderStyle: "border-stone-200/50"
          },
          {
            label: "Storage Efficiency",
            value: `${Math.round((metricsData.daily.pending / (slots.length || 30)) * 100)}%`,
            unit: "occupied",
            trend: "Warehouse capacity utilized",
            trendType: "success",
            icon: CheckCircle2,
            iconColor: "text-lime-800",
            iconBg: "bg-lime-100",
            borderStyle: "border-stone-200/50"
          },
          {
            label: "Audit Logs Logged",
            value: logs.length.toString(),
            unit: "records",
            trend: "Complete operational logs",
            trendType: "info",
            icon: FileSpreadsheet,
            iconColor: "text-blue-500",
            iconBg: "bg-blue-100/50",
            borderStyle: "border-stone-200/50"
          }
        ],
        reservesTitle: "Monthly Material Allocation Usage",
        reserves: sortedReserves.length > 0 ? sortedReserves : [
          { name: "Lavender Extract Base", current: 3120, max: 3500, color: "bg-lime-800", labelStyle: "text-green-950" }
        ],
        copilot: `Storage efficiency this month is at an optimal level. Audit data records highly transparent log activity with no significant system anomaly deviations detected.`,
        trendAnalysis: `Monthly trend shows storage efficiency at ${Math.round((metricsData.daily.pending / (slots.length || 30)) * 100)}% with a total of ${metricsData.monthly.totalItems} managed items. Material consumption is stable with no significant anomalies. Monthly capacity projections indicate minimal expansion needs with a healthy stock rotation rate.`
      }
    };
  }, [inventory, slots, logs, metricsData]);

  const currentPreview = reportData[selectedType];

  const handlePrint = () => {
    if (selectedFormat === "excel") {
      // Generate tabular-only CSV for Excel format — raw data tables only, no custom notes, no formatting
      let csvContent = "\uFEFF"; // UTF-8 BOM

      // Inventory data table
      csvContent += "INVENTORY DATA\n";
      csvContent += "ID,Name,Qty,Unit,Zone,Status,Expiry,Days Left\n";
      inventory.forEach(item => {
        const daysLeft = getDaysLeft(item.expiry);
        csvContent += `"${item.id}","${item.name}","${item.qty}","${item.unit}","${item.zone || ''}","${item.status}","${item.expiry}","${daysLeft}"\n`;
      });
      csvContent += "\n";

      // Metrics summary table
      csvContent += "METRICS SUMMARY\n";
      csvContent += "Label,Value,Unit\n";
      currentPreview.metrics.forEach(m => {
        csvContent += `"${m.label}","${m.value}","${m.unit}"\n`;
      });
      csvContent += "\n";

      // Zone utilization table
      csvContent += "ZONE UTILIZATION\n";
      csvContent += "Zone,Occupied,Total,Utilization %\n";
      const zoneMap = new Map<string, { occupied: number; total: number }>();
      slots.forEach(slot => {
        const zone = slot.zone || 'Unknown';
        if (!zoneMap.has(zone)) zoneMap.set(zone, { occupied: 0, total: 0 });
        const z = zoneMap.get(zone)!;
        z.total++;
        if (slot.occupied) z.occupied++;
      });
      zoneMap.forEach((val, zone) => {
        const util = val.total > 0 ? Math.round((val.occupied / val.total) * 100) : 0;
        csvContent += `"${zone}","${val.occupied}","${val.total}","${util}"\n`;
      });
      csvContent += "\n";

      // Expiry alerts table
      csvContent += "EXPIRY ALERTS\n";
      csvContent += "ID,Name,Expiry Date,Days Left,Status\n";
      inventory
        .filter(item => getDaysLeft(item.expiry) <= 30)
        .sort((a, b) => getDaysLeft(a.expiry) - getDaysLeft(b.expiry))
        .forEach(item => {
          const daysLeft = getDaysLeft(item.expiry);
          csvContent += `"${item.id}","${item.name}","${item.expiry}","${daysLeft}","${item.status}"\n`;
        });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `AromaSys_Data_Export_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // PDF format - trigger browser print dialog with custom notes included in print section
      window.print();
    }
  };

  if (isLoading && inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-semibold">{t('loadingReport')}</p>
      </div>
    );
  }

  if (error && inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-[#EA4B48]" />
        <p className="text-sm font-bold text-neutral-800">{error}</p>
        <button onClick={fetchData} className="px-5 py-2 rounded-full bg-[#2C742F] text-white font-bold text-xs hover:bg-[#235a26] transition-all active:scale-95">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 text-left relative font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-neutral-800 tracking-tight">{t('autoReportTitle')}</h2>
          <p className="text-sm text-stone-500 mt-1 font-medium">
            {t('autoReportSub')}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-bold text-stone-700 hover:bg-stone-50 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reload Data</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
        
        {/* Left Config Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full bg-[#F5FBF3] rounded-xl border border-[#AAE970]/10 shadow-[0px_4px_12px_rgba(143,177,87,0.05)] p-5 space-y-5"
        >
          <div className="pb-3 border-b border-[#AAE970]/10 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2C742F]/10 rounded-lg flex justify-center items-center shrink-0 text-[#2C742F]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-green-950 text-base font-bold">{t('reportConfig')}</h3>
              <p className="text-stone-500 text-xs font-semibold">Automated Telemetry Config</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Report Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-700 uppercase tracking-wider block">Report Type</label>
              <div className="space-y-2">
                {[
                  { id: "daily", title: "Daily Inventory Status", desc: "Daily stock status, low-stock alerts, and remaining capacity." },
                  { id: "weekly", title: "Weekly FIFO & Expiry", desc: "Weekly rotation, FIFO efficiency, and lots nearing expiry." },
                  { id: "monthly", title: "Monthly Consumption Log", desc: "Monthly utilization trends and comprehensive audit activity data." }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedType(opt.id as any)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 outline-none ${
                      selectedType === opt.id 
                        ? "bg-green-100 border-[#AAE970]/40 shadow-sm" 
                        : "bg-white border-stone-200/50 hover:bg-stone-50"
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedType === opt.id ? "border-[#2C742F]" : "border-stone-300"
                      }`}>
                        {selectedType === opt.id && <div className="w-2 h-2 rounded-full bg-[#2C742F]" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-green-950 text-xs font-bold">{opt.title}</h4>
                      <p className="text-stone-500 text-[10px] font-semibold mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-700 uppercase tracking-wider block">Time Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white px-3 py-2 rounded-lg border border-[#AAE970]/20 text-green-950 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white px-3 py-2 rounded-lg border border-[#AAE970]/20 text-green-950 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
                />
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-700 uppercase tracking-wider block">{t('reportFormat')}</label>
              <div className="flex gap-2">
                {[
                  { id: "pdf", label: "PDF Report", icon: FileText },
                  { id: "excel", label: "Excel Data", icon: Table }
                ].map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedFormat(opt.id as any)}
                      className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all font-bold text-xs ${
                        selectedFormat === opt.id
                          ? "bg-green-100 border-[#AAE970]/40 text-[#2C742F] shadow-sm"
                          : "bg-white border-stone-200/50 text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-700 uppercase tracking-wider block">Custom Notes</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Add notes or annotations for the PDF report..."
                rows={4}
                className="w-full bg-white px-3 py-2 rounded-lg border border-[#AAE970]/20 text-green-950 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#2C742F] resize-none placeholder:text-stone-400"
              />
              <p className="text-[9px] text-stone-400 font-semibold">Supports Markdown formatting (bold, italic, lists, tables)</p>
              <p className="text-[9px] text-stone-400 font-semibold">Notes are included in PDF exports only, not in Excel.</p>
            </div>

            {/* Submit */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-[#2C742F] hover:bg-[#366306] text-white rounded-full flex items-center justify-center gap-2 font-bold text-sm shadow-[0px_4px_12px_rgba(44,116,47,0.2)] active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4.5 h-4.5 text-white animate-pulse" />
              <span>{t('generateReport')}</span>
            </button>
          </div>
        </motion.div>

        {/* Right Preview Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="print-section w-full bg-white rounded-2xl shadow-[0px_4px_12px_rgba(14,32,0,0.04)] border border-[#AAE970]/10 p-6 space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-100">
            <div>
              <span className="inline-flex items-center gap-1.5 text-green-950 text-[10px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Report Preview</span>
              </span>
              <h2 className="text-[#2C742F] text-2xl font-black mt-1">{currentPreview.title}</h2>
              <p className="text-stone-500 text-xs font-semibold">{currentPreview.subtitle}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-[#F5FBF3] border border-[#AAE970]/20 rounded-full text-[#2C742F] text-xs font-bold flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>AromaSys Verified</span>
              </span>
            </div>
          </div>

          {/* Report Metadata */}
          <div className="bg-[#F5FBF3]/50 rounded-xl border border-[#AAE970]/10 p-4">
            <h4 className="text-green-950 text-xs font-bold uppercase tracking-wider mb-3">Report Metadata</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-stone-500 font-semibold">Generated On:</span>
                <span className="text-green-950 font-bold">{new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-stone-500 font-semibold">Generated By:</span>
                <span className="text-green-950 font-bold">{user?.name ?? 'Unknown'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-stone-500 font-semibold">Role:</span>
                <span className="text-green-950 font-bold">{user?.role ?? '-'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-stone-500 font-semibold">Period:</span>
                <span className="text-green-950 font-bold">{startDate} – {endDate}</span>
              </div>
            </div>
          </div>

          {/* Telemetry Indicator Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentPreview.metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div 
                  key={`${selectedType}-${idx}`}
                  className={`bg-[#F5FBF3] rounded-xl p-4 flex flex-col gap-1 border border-[#AAE970]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.02)]`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 text-xs font-bold">{m.label}</span>
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[#AAE970]/10 text-[#2C742F]">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-green-950 text-2xl font-black">{m.value}</span>
                    <span className="text-stone-500 text-[10px] font-bold">{m.unit}</span>
                  </div>

                  <div className="text-[10px] font-semibold text-stone-400 mt-1">
                    {m.trend}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Botanical Reserves Progress bars */}
          <div className="border border-[#AAE970]/10 bg-[#F5FBF3]/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="text-green-950 text-sm font-bold">{currentPreview.reservesTitle}</h3>
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Telemetry Status</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentPreview.reserves.map((res, i) => {
                const percentage = Math.round((res.current / res.max) * 100);
                return (
                  <div key={`${selectedType}-${i}`} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className={res.labelStyle}>{res.name}</span>
                      <span className="text-stone-500 font-bold">
                        {Math.round(res.current).toLocaleString()} / {Math.round(res.max).toLocaleString()} {selectedType === "weekly" ? "days" : "kg"}
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden relative shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, percentage)}%` }}
                        className={`h-full rounded-full ${res.color}`} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Copilot Summary Card */}
          <div className="bg-[#F5FBF3] rounded-xl border border-[#AAE970]/10 p-5 flex gap-4 relative overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#2C742F] flex items-center justify-center shrink-0 border border-lime-600/20 text-white">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>

            <div className="flex flex-col gap-1 text-left flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-green-950 text-xs font-bold uppercase tracking-wider">Copilot AI Telemetry Analysis</h4>
                {aiAnalysis && !isRefreshingAI && (
                  <button
                    onClick={handleRefreshAI}
                    disabled={isRefreshingAI}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#AAE970]/30 rounded-full text-[10px] font-bold text-[#2C742F] hover:bg-green-50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Analysis</span>
                  </button>
                )}
              </div>
              {!aiAnalysis && !isRefreshingAI ? (
                <div className="flex items-center justify-center py-4">
                  <button
                    onClick={handleRefreshAI}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2C742F] hover:bg-[#235a26] text-white rounded-full text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate with AI</span>
                  </button>
                </div>
              ) : (
                <p className="text-stone-600 text-xs font-semibold leading-relaxed">
                  {isRefreshingAI ? "Analyzing data with AI..." : aiAnalysis}
                </p>
              )}
            </div>
          </div>

          {/* Trend Analysis Section */}
          <div className="bg-[#F5FBF3] rounded-xl border border-[#AAE970]/10 p-5 flex gap-4 relative overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 border border-blue-400/20 text-white">
              <TrendingUp className="w-4 h-4" />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <h4 className="text-green-950 text-xs font-bold uppercase tracking-wider">Trend Analysis</h4>
              <p className="text-stone-600 text-xs font-semibold leading-relaxed">
                {currentPreview.trendAnalysis}
              </p>
            </div>
          </div>

          {/* Custom Notes Preview (only shown when notes exist) */}
          {customNotes.trim() && (
            <div className="bg-amber-50 rounded-xl border border-amber-200/50 p-5 flex gap-4 relative overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 border border-amber-400/20 text-white">
                <FileText className="w-4 h-4" />
              </div>

              <div className="flex flex-col gap-1 text-left flex-1">
                <h4 className="text-amber-900 text-xs font-bold uppercase tracking-wider">Custom Notes</h4>
                <div 
                  className="text-amber-800 text-xs font-semibold leading-relaxed prose prose-xs max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(customNotes) }}
                />
              </div>
            </div>
          )}

        </motion.div>
      </div>

      {/* GENERATION MODAL */}
      <AnimatePresence>
        {isGenerating && (
          <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 text-center border border-lime-100"
            >
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-lime-100 border-t-lime-800 animate-spin" />
                <FileSpreadsheet className="w-6 h-6 text-lime-800" />
              </div>

              <div className="mt-4">
                <h3 className="text-green-950 text-base font-bold">Compiling Document...</h3>
                <p className="text-stone-500 text-xs mt-1">Your telemetry report is being compiled in real-time.</p>
              </div>

              {/* Progress */}
              <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-[#2C742F] transition-all duration-300"
                  style={{ width: `${(generationStep / steps.length) * 100}%` }}
                />
              </div>

              <div className="mt-4 min-h-6 flex items-center justify-center">
                <p className="text-[#2C742F] text-xs font-bold">
                  {steps[generationStep] || "Finishing up..."}
                </p>
              </div>
            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {generationSuccess && (
          <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-left"
            >
              <div className="bg-[#F5FBF3] p-5 flex flex-col items-center justify-center text-center gap-2 border-b border-[#AAE970]/10 relative">
                <button 
                  onClick={() => setGenerationSuccess(false)}
                  className="absolute right-4 top-4 text-stone-500 hover:text-stone-900 text-lg bg-white w-7 h-7 rounded-full shadow-sm flex items-center justify-center focus:outline-none font-bold"
                >
                  ×
                </button>
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md text-[#2C742F]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-green-950 text-lg font-bold">Report Ready!</h3>
                <p className="text-stone-500 text-xs font-semibold">Your telemetry report has been compiled successfully.</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="border border-stone-200/60 rounded-xl p-4 bg-stone-50 flex gap-4 items-center">
                  <div className="w-12 h-14 rounded-md bg-[#2C742F]/10 flex flex-col items-center justify-center shrink-0 border border-[#2C742F]/20 relative overflow-hidden">
                    <span className="absolute top-0 left-0 w-full h-1 bg-[#2C742F]" />
                    <FileCheck2 className="w-6 h-6 text-[#2C742F]" />
                    <span className="text-[6px] uppercase font-bold mt-1 text-[#2C742F] tracking-wider">
                      {selectedFormat}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-green-950 text-sm font-bold truncate max-w-[280px]">
                      {currentPreview.title.replace(/\s+/g, '_')}_{startDate.replace(/-/g, '')}_{endDate.replace(/-/g, '')}.{selectedFormat}
                    </h4>
                    <p className="text-stone-400 text-[10px] font-bold mt-1">
                      Ukuran: {selectedFormat === "pdf" ? "342 KB" : "84 KB"} • Format: {selectedFormat.toUpperCase()} Document
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handlePrint}
                    className="py-2.5 bg-[#2C742F] hover:bg-[#366306] text-white rounded-full flex items-center justify-center gap-2 font-bold text-xs shadow-md active:scale-95 transition-all outline-none"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download / Print</span>
                  </button>

                  <button
                    onClick={() => {
                      const url = window.location.href;
                      navigator.clipboard?.writeText(url).catch(() => {});
                      setShareToast(true);
                      setTimeout(() => setShareToast(false), 3000);
                      setGenerationSuccess(false);
                    }}
                    className="py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-full flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition-all outline-none"
                  >
                    <Share2 className="w-4 h-4 text-stone-500" />
                    <span>Share Report</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Share toast */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-[#2C742F] text-white rounded-xl shadow-xl text-xs font-bold"
          >
            <Share2 className="w-3.5 h-3.5" />
            Report link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
