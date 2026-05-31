import { AromaItem, IngestionRecord, WarehouseZone, User } from "../types";

export const APP_NAME = "Sima Arome";

// Shared zone temperature thresholds — single source of truth used by cold-chain page, overview, and AI panel
export const ZONE_TEMP_THRESHOLDS: Record<string, { min: number; max: number; label: string }> = {
  A: { min: 20, max: 30, label: 'Zona A – Bahan Kering' },
  B: { min: 15, max: 25, label: 'Zona B – Bahan Cair' },
  C: { min: 18, max: 28, label: 'Zona C – Bahan Umum' },
  D: { min: -5, max: 5,  label: 'Zona D – Cold Storage' },
  E: { min: 15, max: 25, label: 'Zona E – Bahan Berbahaya' },
};

export interface NavigationItem {
  name: string;
  href: string;
  iconName: "LayoutDashboard" | "Database" | "Warehouse" | "Users";
  description: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: "Overview",
    href: "/overview",
    iconName: "LayoutDashboard",
    description: "Sima Arome telemetry metrics & stock status overview"
  },
  {
    name: "Data Ingestion",
    href: "/data-ingestion",
    iconName: "Database",
    description: "Register new aroma batches and quality assessments"
  },
  {
    name: "Warehouse Map",
    href: "/floor-plan",
    iconName: "Warehouse",
    description: "Real-time physical zone maps and environmental metrics"
  },
  {
    name: "User Management",
    href: "/user-management",
    iconName: "Users",
    description: "Manage staff accounts, credentials, and roles"
  }
];

export const MOCK_USERS: User[] = [
  {
    id: "u-1",
    name: "Ahmad Hidayat",
    email: "ahmad.hidayat@simaarome.com",
    role: "ADMIN",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
  },
  {
    id: "u-2",
    name: "Clara Amalia",
    email: "clara.amalia@simaarome.com",
    role: "QUALITY_CONTROL",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
  },
  {
    id: "u-3",
    name: "Budi Santoso",
    email: "budi.santoso@simaarome.com",
    role: "WAREHOUSE_STAFF",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
  }
];

export const MOCK_AROMA_ITEMS: AromaItem[] = [
  {
    id: "a-1",
    name: "Pure Java Vetiver Oil",
    batchCode: "VTV-20260520-01",
    category: "Essential Oil",
    stockQuantity: 450,
    unit: "Liters",
    storageLocation: "Zone A - Bin 12",
    status: "Excellent",
    temperature: 21.4,
    humidity: 48,
    lastUpdated: "2026-05-28T09:12:00Z"
  },
  {
    id: "a-2",
    name: "Sulawesi Clove Bud Oil",
    batchCode: "CLB-20260522-04",
    category: "Essential Oil",
    stockQuantity: 720,
    unit: "Liters",
    storageLocation: "Zone A - Bin 15",
    status: "Excellent",
    temperature: 22.1,
    humidity: 50,
    lastUpdated: "2026-05-28T10:45:00Z"
  },
  {
    id: "a-3",
    name: "Sumatran Patchouli Leaf Extract",
    batchCode: "PTC-20260515-02",
    category: "Resin & Balsam",
    stockQuantity: 280,
    unit: "Kilograms",
    storageLocation: "Zone C - Temp Control",
    status: "Aged",
    temperature: 18.5,
    humidity: 42,
    lastUpdated: "2026-05-27T16:30:00Z"
  },
  {
    id: "a-4",
    name: "Premium Cinnamon Bark Extract",
    batchCode: "CNM-20260525-01",
    category: "Spices & Herbs",
    stockQuantity: 85,
    unit: "Kilograms",
    storageLocation: "Zone B - Dry Storage",
    status: "Low Stock",
    temperature: 24.2,
    humidity: 35,
    lastUpdated: "2026-05-28T08:00:00Z"
  },
  {
    id: "a-5",
    name: "Synthetic Ambergris Fixative",
    batchCode: "AMB-20260527-09",
    category: "Synthetic Extract",
    stockQuantity: 150,
    unit: "Liters",
    storageLocation: "Zone D - Chemical Vault",
    status: "Testing",
    temperature: 19.8,
    humidity: 45,
    lastUpdated: "2026-05-28T11:00:00Z"
  }
];

export const MOCK_INGESTION_RECORDS: IngestionRecord[] = [
  {
    id: "i-1",
    itemName: "Sweet Orange Peel Oil",
    batchCode: "SWO-20260528-02",
    category: "Essential Oil",
    quantity: 350,
    unit: "Liters",
    receivedDate: "2026-05-28T11:15:00Z",
    inspectorName: "Clara Amalia",
    status: "Testing",
    notes: "Requires GC-MS chromatogram check for limonene purity."
  },
  {
    id: "i-2",
    itemName: "Organic Bourbon Vanilla Pods",
    batchCode: "VNL-20260527-01",
    category: "Spices & Herbs",
    quantity: 120,
    unit: "Kilograms",
    receivedDate: "2026-05-27T14:30:00Z",
    inspectorName: "Clara Amalia",
    status: "Passed",
    notes: "Moisture content is 28%, perfect vanilla bean plumpness."
  },
  {
    id: "i-3",
    itemName: "Sandalwood Bark Distillate",
    batchCode: "SDW-20260526-03",
    category: "Essential Oil",
    quantity: 200,
    unit: "Liters",
    receivedDate: "2026-05-26T09:45:00Z",
    inspectorName: "Clara Amalia",
    status: "Passed",
    notes: "Excellent deep woodsy olfactory notes."
  },
  {
    id: "i-4",
    itemName: "Damask Rose Absolute",
    batchCode: "ROS-20260525-05",
    category: "Resin & Balsam",
    quantity: 15,
    unit: "Liters",
    receivedDate: "2026-05-25T16:00:00Z",
    inspectorName: "Ahmad Hidayat",
    status: "Rejected",
    notes: "Batch contains synthetic diluents, did not meet pure grade specs."
  }
];

export const MOCK_WAREHOUSE_ZONES: WarehouseZone[] = [
  {
    id: "z-1",
    name: "Zone A - Volatile Essential Oils",
    description: "Equipped with automated venting for sensitive high-volatile aromatic extracts.",
    capacityUsed: 1170,
    maxCapacity: 1500,
    temperature: 21.7,
    humidity: 49,
    alertLevel: "Normal"
  },
  {
    id: "z-2",
    name: "Zone B - Raw Herbs & Spices",
    description: "Dry, humidity-controlled zone designed to protect bulk solid raw materials.",
    capacityUsed: 85,
    maxCapacity: 500,
    temperature: 24.2,
    humidity: 35,
    alertLevel: "Normal"
  },
  {
    id: "z-3",
    name: "Zone C - Cold Press Aging",
    description: "Chilled ambient storage to sustain secondary fermentation and wood-barrel aging.",
    capacityUsed: 280,
    maxCapacity: 400,
    temperature: 18.5,
    humidity: 42,
    alertLevel: "Normal"
  },
  {
    id: "z-4",
    name: "Zone D - Synthetics & Reagents",
    description: "Isolated vault with double-contained shelving for synthetics and absolute solvents.",
    capacityUsed: 150,
    maxCapacity: 300,
    temperature: 26.8,
    humidity: 58,
    alertLevel: "Warning"
  }
];
