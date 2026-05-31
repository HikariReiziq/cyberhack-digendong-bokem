'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { ZONES, CATEGORIES } from '@/lib/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Snowflake,
  Flame, AlertTriangle, Upload, ImageIcon,
  Droplet, Lock, ArrowRightLeft, Bot,
  FileUp, Check,
  RefreshCw, ArrowUpRight, Undo2, RotateCcw,
  Eye, EyeOff
} from 'lucide-react';
import { api } from '@/lib/api';
import { callAI } from '@/lib/gemini';
import { useLanguage } from '@/lib/i18n';
import {
  type InteractiveZone,
  type Material,
  STORAGE_KEYS,
  MAX_ZONES,
  CATEGORY_ZONE_MAP,
  detectZoneMismatch,
  calculateDragPosition,
  calculateResizeRight,
  calculateResizeLeft,
  calculateResizeTop,
  calculateResizeBottom,
} from '@/lib/zones';
import ZoneDetailsModal from './ZoneDetailsModal';
import AIRecommendationPanel, { type AIRecommendation } from './AIRecommendationPanel';
import Portal from '@/components/Portal';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Slot, InventoryItem } from '@/types';

interface DragState {
  zoneId: string;
  type: 'move' | 'resize-top' | 'resize-right' | 'resize-bottom' | 'resize-left';
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  canvasW: number;
  canvasH: number;
}

interface CustomFloorPlan {
  imageDataUrl: string;
  fileName?: string;
  uploadedAt?: string;
  zones?: any[];
}

const ROOMS = [
  { id: 'A-1', name: 'LOADING DOCK', zone: 'A', theme: 'blue', gridColumn: '1 / 13', gridRow: '1' },
  { id: 'A-2', name: 'Equipment Set Up', zone: 'A', theme: 'blue', gridColumn: '1 / 4', gridRow: '2 / 5', iconType: 'machinery' },
  { id: 'B-1', name: 'Tray Setting 1', zone: 'B', theme: 'purple', gridColumn: '4 / 7', gridRow: '2', hasStatusDot: true },
  { id: 'B-2', name: 'Tray Setting 2', zone: 'B', theme: 'purple', gridColumn: '7 / 10', gridRow: '2' },
  { id: 'D-1', name: 'Cold Storage', zone: 'D', theme: 'cyan', gridColumn: '10 / 13', gridRow: '2 / 5', iconType: 'snowflake', hasCapacityBar: true },
  { id: 'C-1', name: 'Hot Extraction', zone: 'C', theme: 'warm', gridColumn: '4 / 10', gridRow: '3 / 5', iconType: 'flame' },
  { id: 'C-3', name: 'Non-Production Machinery', zone: 'C', theme: 'green', gridColumn: '1 / 4', gridRow: '5' },
  { id: 'C-4', name: 'Locker Room', zone: 'C', theme: 'green', gridColumn: '4 / 8', gridRow: '5', iconType: 'door' },
  { id: 'C-5', name: 'QC & Lab', zone: 'C', theme: 'green', gridColumn: '8 / 10', gridRow: '5' },
  { id: 'C-2', name: 'Packaging & Shipping', zone: 'C', theme: 'green', gridColumn: '10 / 13', gridRow: '5 / 7', iconType: 'machinery' },
  { id: 'A-3', name: 'Receiving', zone: 'A', theme: 'blue', gridColumn: '1 / 4', gridRow: '6' },
  { id: 'E-1', name: 'Hazard Storage', zone: 'E', theme: 'hazard', gridColumn: '4 / 10', gridRow: '6', iconType: 'warning', isHazard: true },
];

interface Floor {
  id: string;
  name: string;
  customFloorPlan: CustomFloorPlan | null;
  interactiveZones: InteractiveZone[];
}

export default function FloorPlanPage() {
  const { user, canEdit, canDelete, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [temperatureData, setTemperatureData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotPopup, setSelectedSlotPopup] = useState(false);
  const [interactiveZones, setInteractiveZones] = useState<InteractiveZone[]>([]);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<InteractiveZone | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignItemId, setAssignItemId] = useState('');
  const [customFloorPlan, setCustomFloorPlan] = useState<CustomFloorPlan | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showBlueprintImage, setShowBlueprintImage] = useState(true);
  
  // Custom floors states
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editFloorNameInput, setEditFloorNameInput] = useState<string>('');

  // Custom zones drag & resize states
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [zoneMaterials, setZoneMaterials] = useState<Material[]>([]);
  const [deletedDefaultZones, setDeletedDefaultZones] = useState<string[]>([]);
  const [undoHistory, setUndoHistory] = useState<InteractiveZone[][]>([]);
  
  // PDF upload states
  const [uploadImageFile, setUploadImageFile] = useState<File | null>(null);
  const [uploadImagePreview, setUploadImagePreview] = useState<string | null>(null);
  const [uploadPdfFile, setUploadPdfFile] = useState<File | null>(null);
  const [uploadDragActiveImage, setUploadDragActiveImage] = useState(false);
  const [uploadDragActivePdf, setUploadDragActivePdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchLotQuery, setSearchLotQuery] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [addData, setAddData] = useState({
    selectedLotId: '',
    hasTempSensor: false,
    tempApiUrl: '',
    hasHumidSensor: false,
    humidApiUrl: ''
  });
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'Hapus', variant: 'danger', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Hapus', variant: 'danger' | 'warning' = 'danger') => {
    setConfirmState({ isOpen: true, title, message, confirmLabel, variant, onConfirm });
  };
  const closeConfirm = () => setConfirmState(s => ({ ...s, isOpen: false }));

  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseGridColumnAndRow = (gridCol: string, gridRow: string) => {
    const colParts = gridCol.split('/');
    const colStart = parseInt(colParts[0].trim()) - 1;
    let colEnd = colStart + 1;
    if (colParts.length > 1) {
      colEnd = parseInt(colParts[1].trim()) - 1;
    }

    const rowParts = gridRow.split('/');
    const rowStart = parseInt(rowParts[0].trim()) - 1;
    let rowEnd = rowStart + 1;
    if (rowParts.length > 1) {
      rowEnd = parseInt(rowParts[1].trim()) - 1;
    }

    return { colStart, colEnd, rowStart, rowEnd };
  };

  const getDefaultZones = (parsedDeleted: string[] = deletedDefaultZones) => {
    return ROOMS.filter(r => !parsedDeleted.includes(r.id)).map((room) => {
      const { colStart, colEnd, rowStart, rowEnd } = parseGridColumnAndRow(room.gridColumn, room.gridRow);

      const gap = 0.8; // gap percentage to keep spacing clean and un-cluttered
      const x = (colStart / 12) * 100 + gap / 2;
      const width = ((colEnd - colStart) / 12) * 100 - gap;
      const y = (rowStart / 6) * 100 + gap / 2;
      const height = ((rowEnd - rowStart) / 6) * 100 - gap;

      return {
        id: room.id,
        name: room.name,
        position: { 
          x: parseFloat(x.toFixed(2)), 
          y: parseFloat(y.toFixed(2)), 
          width: parseFloat(Math.max(width, 5).toFixed(2)), 
          height: parseFloat(Math.max(height, 5).toFixed(2)) 
        },
        hasTempSensor: false,
        hasHumidSensor: false,
        isSetup: true,
        materials: [],
        theme: room.theme,
        zone: room.zone,
        iconType: 'iconType' in room ? room.iconType : undefined,
        hasStatusDot: 'hasStatusDot' in room ? room.hasStatusDot : undefined,
      };
    });
  };

  // Load custom configurations on mount and migrate older single floor data if needed
  useEffect(() => {
    const savedFloors = localStorage.getItem('aromasys_floors');
    const savedActiveId = localStorage.getItem('aromasys_active_floor_id');
    const deleted = localStorage.getItem(STORAGE_KEYS.DELETED_DEFAULT_ZONES);
    let parsedDeleted: string[] = [];
    if (deleted) {
      try {
        parsedDeleted = JSON.parse(deleted);
        if (parsedDeleted.includes('C-2')) {
          parsedDeleted = parsedDeleted.filter((id: string) => id !== 'C-2');
          localStorage.setItem(STORAGE_KEYS.DELETED_DEFAULT_ZONES, JSON.stringify(parsedDeleted));
        }
        setDeletedDefaultZones(parsedDeleted);
      } catch {}
    }

    const loadDefaultZones = () => getDefaultZones(parsedDeleted);

    if (savedFloors) {
      try {
        const parsedFloors: Floor[] = JSON.parse(savedFloors);
        // Ensure every floor has interactive zones initialized if empty and no plan
        // Also verify C-2 is added in default layout floors
        const normalizedFloors = parsedFloors.map(f => {
          let zones = f.interactiveZones || [];
          if (zones.length === 0 && !f.customFloorPlan) {
            zones = loadDefaultZones();
          } else if (!f.customFloorPlan && !zones.some(z => z.id === 'C-2')) {
            const c2Default = loadDefaultZones().find(z => z.id === 'C-2');
            if (c2Default) {
              zones = [...zones, c2Default];
            }
          }
          return { ...f, interactiveZones: zones };
        });
        setFloors(normalizedFloors);
        localStorage.setItem('aromasys_floors', JSON.stringify(normalizedFloors));
        if (savedActiveId && normalizedFloors.some(f => f.id === savedActiveId)) {
          setActiveFloorId(savedActiveId);
        } else if (normalizedFloors.length > 0) {
          setActiveFloorId(normalizedFloors[0].id);
          localStorage.setItem('aromasys_active_floor_id', normalizedFloors[0].id);
        }
      } catch (err) {
        console.error('Failed to load floors:', err);
      }
    } else {
      // Migrate from single floor or generate default
      const oldPlan = localStorage.getItem(STORAGE_KEYS.FLOOR_PLAN);
      const oldZones = localStorage.getItem(STORAGE_KEYS.INTERACTIVE_ZONES);
      let parsedPlan: CustomFloorPlan | null = null;
      try { if (oldPlan) parsedPlan = JSON.parse(oldPlan); } catch {}
      let parsedZones: InteractiveZone[] = [];
      try { if (oldZones) parsedZones = JSON.parse(oldZones); } catch {}

      let initialZones = parsedZones;
      if (initialZones.length === 0 && !parsedPlan) {
        initialZones = loadDefaultZones();
      } else if (!parsedPlan && !initialZones.some(z => z.id === 'C-2')) {
        const c2Default = loadDefaultZones().find(z => z.id === 'C-2');
        if (c2Default) {
          initialZones = [...initialZones, c2Default];
        }
      }

      const initialFloor: Floor = {
        id: 'floor-1',
        name: 'Layout 1',
        customFloorPlan: parsedPlan,
        interactiveZones: initialZones
      };

      const defaultFloors = [initialFloor];
      setFloors(defaultFloors);
      localStorage.setItem('aromasys_floors', JSON.stringify(defaultFloors));
      setActiveFloorId('floor-1');
      localStorage.setItem('aromasys_active_floor_id', 'floor-1');
    }
  }, []);

  // Update active zones and floor plan based on the active floor selection
  useEffect(() => {
    if (!activeFloorId || floors.length === 0) return;
    const currentFloor = floors.find(f => f.id === activeFloorId);
    if (currentFloor) {
      setInteractiveZones(currentFloor.interactiveZones || []);
      setCustomFloorPlan(currentFloor.customFloorPlan || null);
    }
  }, [activeFloorId, floors]);

  // Sync floor plan zones to backend DB (debounced)
  const syncZonesToDB = (currentFloors: Floor[]) => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      api.put('/zones', { floors: currentFloors }).catch(() => {});
    }, 1500);
  };

  // Unified helpers to update zones and floor plans in local state, global floors array, and local storage
  const updateActiveFloorZones = (newZones: InteractiveZone[]) => {
    setInteractiveZones(newZones);
    setFloors(prevFloors => {
      const updated = prevFloors.map(f => f.id === activeFloorId ? { ...f, interactiveZones: newZones } : f);
      localStorage.setItem('aromasys_floors', JSON.stringify(updated));
      syncZonesToDB(updated);
      return updated;
    });
  };

  const updateActiveFloorPlan = (newPlan: CustomFloorPlan | null) => {
    setCustomFloorPlan(newPlan);
    setFloors(prevFloors => {
      const updated = prevFloors.map(f => f.id === activeFloorId ? { ...f, customFloorPlan: newPlan } : f);
      localStorage.setItem('aromasys_floors', JSON.stringify(updated));
      syncZonesToDB(updated);
      return updated;
    });
  };

  // Add, rename, and delete floor functions
  const addFloor = () => {
    const newFloorId = `floor-${Date.now()}`;
    const newFloorName = `Layout ${floors.length + 1}`;
    const newFloor: Floor = {
      id: newFloorId,
      name: newFloorName,
      customFloorPlan: null,
      interactiveZones: getDefaultZones(),
    };
    const updated = [...floors, newFloor];
    setFloors(updated);
    localStorage.setItem('aromasys_floors', JSON.stringify(updated));
    localStorage.setItem('aromasys_active_floor_id', newFloorId);
    setActiveFloorId(newFloorId);
    syncZonesToDB(updated);
    setToast(`Layout baru "${newFloorName}" berhasil ditambahkan.`);
  };

  const saveFloorName = (floorId: string) => {
    if (editingFloorId === null) return;
    if (!editFloorNameInput.trim()) {
      setEditingFloorId(null);
      return;
    }
    const updated = floors.map(f => f.id === floorId ? { ...f, name: editFloorNameInput.trim() } : f);
    setFloors(updated);
    localStorage.setItem('aromasys_floors', JSON.stringify(updated));
    syncZonesToDB(updated);
    setEditingFloorId(null);
    setToast('Nama layout berhasil diperbarui.');
  };

  const deleteFloor = (floorId: string, floorName: string) => {
    if (floors.length <= 1) {
      setToast('Gagal menghapus. Minimal harus ada 1 layout.');
      return;
    }
    showConfirm(
      'Hapus Layout',
      `Apakah Anda yakin ingin menghapus layout "${floorName}" beserta seluruh zonanya?`,
      () => {
        closeConfirm();
        const updated = floors.filter(f => f.id !== floorId);
        setFloors(updated);
        localStorage.setItem('aromasys_floors', JSON.stringify(updated));
        if (activeFloorId === floorId) {
          const nextActiveId = updated[0].id;
          setActiveFloorId(nextActiveId);
          localStorage.setItem('aromasys_active_floor_id', nextActiveId);
        }
        syncZonesToDB(updated);
        setToast(`Layout "${floorName}" telah dihapus.`);
      }
    );
  };

  // Fetch slots and inventory from backend API
  const fetchSlots = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ success: boolean; slots: Slot[] }>('/slots');
      if (data.success) setSlots(data.slots ?? []);
    } catch {}
    finally { setIsLoading(false); }
  };

  const fetchInventory = async () => {
    try {
      const data = await api.get<{ success: boolean; items: InventoryItem[] }>('/inventory');
      if (data.success) setInventoryItems(data.items ?? []);
    } catch {}
  };

  // Load temperature data for AI recommendations
  const fetchTemperatureData = async () => {
    try {
      const data = await api.get<{ success: boolean; temperatures?: any; readings?: any[] }>('/cold-chain');
      if (data.success) {
        const temps = (data as any).temperatures || {};
        setTemperatureData(temps);
      }
    } catch {}
  };

  // Load zones from DB if localStorage is empty (first time or cleared)
  const loadZonesFromDB = async () => {
    try {
      const stored = localStorage.getItem('aromasys_floors');
      if (stored) return; // localStorage has data, skip DB load
      const data = await api.get<{ success: boolean; data: any }>('/zones');
      if (data.success && data.data) {
        const floors: Floor[] = data.data;
        setFloors(floors);
        localStorage.setItem('aromasys_floors', JSON.stringify(floors));
        if (floors.length > 0) {
          setActiveFloorId(floors[0].id);
          localStorage.setItem('aromasys_active_floor_id', floors[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSlots();
    fetchInventory();
    fetchTemperatureData();
    loadZonesFromDB();
  }, []);

  // Dismiss toast after 3.5s
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Drag and resize mouse move listeners
  const handlePointerDown = (e: React.MouseEvent, zone: InteractiveZone, type: DragState['type']) => {
    e.stopPropagation();
    if (!canEdit()) return;
    if (!canvasRef.current) return;
    
    // Save current state to undo history before any drag modifications
    setUndoHistory(prev => [...prev, interactiveZones]);
    
    const rect = canvasRef.current.getBoundingClientRect();
    setDragState({
      zoneId: zone.id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: zone.position.x,
      origY: zone.position.y,
      origW: zone.position.width,
      origH: zone.position.height,
      canvasW: rect.width,
      canvasH: rect.height
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: MouseEvent) => {
      const dx = ((e.clientX - dragState.startX) / dragState.canvasW) * 100;
      const dy = ((e.clientY - dragState.startY) / dragState.canvasH) * 100;

      setInteractiveZones(prev => prev.map(z => {
        if (z.id !== dragState.zoneId) return z;
        const startPos = {
          x: dragState.origX,
          y: dragState.origY,
          width: dragState.origW,
          height: dragState.origH,
        };

        let newPos = z.position;

        if (dragState.type === 'move') {
          newPos = calculateDragPosition(startPos, { dx, dy });
        } else if (dragState.type === 'resize-right') {
          newPos = calculateResizeRight(startPos, dx);
        } else if (dragState.type === 'resize-bottom') {
          newPos = calculateResizeBottom(startPos, dy);
        } else if (dragState.type === 'resize-left') {
          newPos = calculateResizeLeft(startPos, -dx);
        } else if (dragState.type === 'resize-top') {
          newPos = calculateResizeTop(startPos, -dy);
        }
        return { ...z, position: newPos };
      }));
    };

    const handlePointerUp = () => {
      setDragState(null);
      setInteractiveZones(prev => {
        setFloors(prevFloors => {
          const updated = prevFloors.map(f => f.id === activeFloorId ? { ...f, interactiveZones: prev } : f);
          localStorage.setItem('aromasys_floors', JSON.stringify(updated));
          syncZonesToDB(updated);
          return updated;
        });
        return prev;
      });
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [dragState, activeFloorId]);

  // Zone CRUD Operations
  function addCustomZone() {
    if (interactiveZones.length >= MAX_ZONES) { setToast(`Max ${MAX_ZONES} zones reached.`); return; }
    // Save undo state
    setUndoHistory(prev => [...prev, interactiveZones]);
    const newZone: InteractiveZone = {
      id: `Z-${Date.now().toString().slice(-4)}`,
      name: '',
      position: { x: 40, y: 40, width: 20, height: 20 },
      hasTempSensor: false,
      hasHumidSensor: false,
      materials: []
    };
    const updated = [...interactiveZones, newZone];
    updateActiveFloorZones(updated);
    setEditingZone(newZone);
    setZoneMaterials([]);
    setShowZoneModal(true);
  }

  function deleteZone(id: string) {
    const zone = interactiveZones.find(z => z.id === id);
    const zoneName = zone?.name || 'zona ini';
    showConfirm(
      'Hapus Zona',
      `Apakah Anda yakin ingin menghapus "${zoneName}"? Tindakan ini tidak dapat dibatalkan.`,
      () => {
        closeConfirm();
        setUndoHistory(prev => [...prev, interactiveZones]);
        const updated = interactiveZones.filter(z => z.id !== id);
        updateActiveFloorZones(updated);
        setToast('Zone deleted.');
      }
    );
  }

  function undoLastAction() {
    if (undoHistory.length === 0) return;
    const previousState = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));
    updateActiveFloorZones(previousState);
    setToast('Undo successful.');
  }

  const handleEditZoneClick = (zone: InteractiveZone) => {
    setEditingZone(zone);
    setZoneMaterials(zone.materials ?? []);
    setShowZoneModal(true);
  };

  const handleSaveZone = (zoneData: InteractiveZone) => {
    const updatedZones = [...interactiveZones];
    const existIdx = updatedZones.findIndex(z => z.id === zoneData.id);

    const newZoneEntry = {
      ...zoneData,
      position: editingZone?.position ?? { x: 40, y: 40, width: 20, height: 20 },
      materials: zoneMaterials
    };

    if (existIdx >= 0) {
      updatedZones[existIdx] = newZoneEntry;
    } else {
      updatedZones.push(newZoneEntry);
    }

    updateActiveFloorZones(updatedZones);

    // Persist material location changes to DB (best-effort)
    for (const mat of zoneMaterials) {
      const existing = inventoryItems.find(i => i.id === mat.id);
      if (existing && (existing as any).location !== zoneData.id) {
        api.put('/inventory', {
          id: existing.id,
          name: existing.name,
          category: existing.category,
          qty: existing.qty,
          unit: existing.unit,
          location: zoneData.id,
          zone: zoneData.zone || (zoneData.id.charAt(0).match(/[A-E]/) ? zoneData.id.charAt(0) : 'C'),
          dateIn: (existing as any).dateIn || new Date().toISOString().split('T')[0],
          expiry: (existing as any).expiry || new Date().toISOString().split('T')[0],
          status: (existing as any).status || 'Aman',
          user: { name: user?.name || 'Admin', role: user?.role || 'Admin' }
        }).catch(() => {});
      }
    }

    setShowZoneModal(false);
    setToast(`Zone ${zoneData.name} saved!`);
  };

  const handleAddMaterialToZone = (material: Material) => {
    setZoneMaterials([...zoneMaterials, material]);
  };

  const handleRemoveMaterialFromZone = (materialId: string) => {
    setZoneMaterials(zoneMaterials.filter(m => m.id !== materialId));
  };

  // Default rooms list filtering — removes from both interactiveZones and the deleted list
  function handleDeleteDefaultZone(zoneId: string) {
    const updatedDeleted = [...deletedDefaultZones, zoneId];
    setDeletedDefaultZones(updatedDeleted);
    localStorage.setItem(STORAGE_KEYS.DELETED_DEFAULT_ZONES, JSON.stringify(updatedDeleted));
    // Also remove from active zones so it disappears immediately
    const updatedZones = interactiveZones.filter(z => z.id !== zoneId);
    updateActiveFloorZones(updatedZones);
    setSelectedSlotPopup(false);
    setSelectedSlotId(null);
    setToast('Room dihapus dari layout.');
  }

  const resetToDefault = () => {
    showConfirm(
      'Reset ke Default',
      'Apakah Anda yakin ingin mengatur ulang semua layout dan zona ke default? Semua perubahan kustom Anda akan hilang.',
      () => {
        closeConfirm();
        doReset();
      },
      'Reset',
      'warning'
    );
  };

  const doReset = () => {
    localStorage.removeItem(STORAGE_KEYS.DELETED_DEFAULT_ZONES);
    localStorage.removeItem('aromasys_applied_recommendations');
    setDeletedDefaultZones([]);
    const defaultZones = getDefaultZones([]);
    const initialFloor: Floor = {
      id: 'floor-1',
      name: 'Layout 1',
      customFloorPlan: null,
      interactiveZones: defaultZones
    };
    const defaultFloors = [initialFloor];
    setFloors(defaultFloors);
    localStorage.setItem('aromasys_floors', JSON.stringify(defaultFloors));
    setActiveFloorId('floor-1');
    localStorage.setItem('aromasys_active_floor_id', 'floor-1');
    setInteractiveZones(defaultZones);
    setCustomFloorPlan(null);
    setUndoHistory([]);
    syncZonesToDB(defaultFloors);
    setToast('Semua layout telah diatur ulang ke default.');
  };

  // Sync database inventory items to all interactive zones
  useEffect(() => {
    if (inventoryItems.length === 0 || interactiveZones.length === 0) return;

    let changed = false;
    const updatedZones = interactiveZones.map(z => {
      const dbMaterials = inventoryItems.filter(i => String(i.location) === String(z.id));
      const dbMappedMaterials = dbMaterials.map(match => ({
        id: String(match.id),
        name: match.name,
        qty: match.qty,
        unit: match.unit,
        maxCapacity: 500
      }));

      const currentMaterials = z.materials || [];
      // Order-independent comparison using Sets of IDs + qty check
      const currentSet = new Map(currentMaterials.map(m => [String(m.id), m.qty]));
      const dbSet = new Map(dbMappedMaterials.map(m => [String(m.id), m.qty]));
      const isDifferent = currentSet.size !== dbSet.size ||
        [...dbSet.entries()].some(([id, qty]) => currentSet.get(id) !== qty);

      if (isDifferent) {
        changed = true;
        return { ...z, materials: dbMappedMaterials };
      }
      return z;
    });

    if (changed) {
      updateActiveFloorZones(updatedZones);
    }
  }, [inventoryItems, activeFloorId]);

  const isZoneCapacityLow = (zone: InteractiveZone) => {
    const materials = zone.materials || [];
    if (materials.length === 0) return false;
    const totalCurrentStock = materials.reduce((sum, m) => sum + (m.qty ?? 0), 0);
    const totalMaxCapacity = materials.reduce((sum, m) => sum + (m.maxCapacity ?? 500), 0) || 500;
    const pct = (totalCurrentStock / totalMaxCapacity) * 100;
    return pct >= 90;
  };

  const getZoneThemeStyles = (zone: InteractiveZone) => {
    // If the zone has an explicit theme, use it
    if (zone.theme) {
      const styles: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
        green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-950', hoverBg: 'hover:bg-emerald-500/20' },
        neutral: { bg: 'bg-stone-500/10', border: 'border-stone-500/50', text: 'text-stone-900', hoverBg: 'hover:bg-stone-500/20' },
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-950', hoverBg: 'hover:bg-blue-500/20' },
        warm: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-950', hoverBg: 'hover:bg-orange-500/20' },
        hazard: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-950', hoverBg: 'hover:bg-red-500/20' },
        purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-950', hoverBg: 'hover:bg-purple-500/20' },
        cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', text: 'text-cyan-950', hoverBg: 'hover:bg-cyan-500/20' },
      };
      return styles[zone.theme] || styles.neutral;
    }

    // Otherwise, try to infer from ID or Name (e.g. Zone letter)
    const zoneLetter = zone.zone || zone.name?.match(/^Zone\s+([A-E])/i)?.[1] || zone.id?.charAt(0);
    const letterMap: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
      A: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-950', hoverBg: 'hover:bg-blue-500/20' },
      B: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-950', hoverBg: 'hover:bg-purple-500/20' },
      C: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-950', hoverBg: 'hover:bg-emerald-500/20' },
      D: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', text: 'text-cyan-950', hoverBg: 'hover:bg-cyan-500/20' },
      E: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-950', hoverBg: 'hover:bg-red-500/20' },
    };
    return letterMap[zoneLetter || ''] || { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-950', hoverBg: 'hover:bg-emerald-500/20' };
  };

  const renderInteractiveZone = (zone: InteractiveZone) => {
    const isSelected = selectedSlotId === zone.id;
    const isSetup = zone.isSetup;
    
    // Resolve theme styles
    const themeStyles = getZoneThemeStyles(zone);

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      if (!hex || !hex.startsWith('#')) return 'transparent';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const isCustomColor = !!zone.color;
    
    // Build background and border style dynamically if manually colored
    const customStyle = isCustomColor ? {
      backgroundColor: hexToRgba(zone.color!, 0.1),
      borderColor: hexToRgba(zone.color!, 0.5),
      color: zone.color!,
    } : {};

    const style = {
      left: `${zone.position.x}%`,
      top: `${zone.position.y}%`,
      width: `${zone.position.width}%`,
      height: `${zone.position.height}%`,
      position: 'absolute' as const,
      zIndex: isSelected ? 30 : 10,
      ...customStyle
    };

    // Retrieve materials
    const materials = zone.materials || [];
    
    // Badge styles
    const zoneLetter = zone.zone || zone.name?.match(/^Zone\s+([A-E])/i)?.[1] || (['A','B','C','D','E'].includes(zone.id?.charAt(0)) ? zone.id.charAt(0) : null);
    const badgeText = zoneLetter ? `ZONE ${zoneLetter}` : 'CUSTOM';
    const badgeBorderCls = {
      A: 'border-blue-300 text-blue-800',
      B: 'border-purple-300 text-purple-800',
      C: 'border-emerald-300 text-emerald-800',
      D: 'border-cyan-300 text-cyan-800',
      E: 'border-red-300 text-red-800',
    }[zoneLetter as string] || 'border-emerald-300 text-emerald-800';

    const isLowCapacity = isZoneCapacityLow(zone);

    return isSetup ? (
      <div
        key={zone.id}
        style={style}
        onMouseDown={e => { if (canEdit()) handlePointerDown(e, zone, 'move'); }}
        className={`border-2 rounded-xl p-2 flex flex-col justify-between transition-all text-left cursor-move ${
          isLowCapacity ? 'animate-capacity-blink border-red-500/90' : ''
        } ${
          isCustomColor 
            ? 'hover:ring-2 hover:ring-[#2C742F]' 
            : `${themeStyles.bg} ${themeStyles.border} ${themeStyles.text} ${themeStyles.hoverBg} hover:ring-2 hover:ring-[#2C742F]`
        } ${isSelected ? 'ring-2 ring-[#2C742F] ring-offset-1' : ''}`}
      >
        {/* Arrow icon for opening zone details */}
        <button
          onClick={(e) => { e.stopPropagation(); handleSlotClick(zone.id); }}
          onMouseDown={e => e.stopPropagation()}
          className="absolute top-1 right-1 z-20 p-0.5 rounded bg-white/80 hover:bg-white shadow-sm border border-stone-250 transition-colors"
          title="View zone details"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-stone-750" />
        </button>

        <div className="flex justify-between items-center w-full">
          <div className={`text-[8px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded bg-white/85 border ${badgeBorderCls} w-fit`}>
            {badgeText}
          </div>
          {zone.hasStatusDot && materials.length === 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[7px] text-[#79747E] font-bold">LIVE</span>
            </div>
          )}
        </div>

        <span className="text-[10px] font-bold leading-tight line-clamp-2 mt-1">{zone.name}</span>
        {materials && materials.length > 0 ? (
          <span className="text-[8px] font-bold truncate mt-0.5 opacity-85">
            {materials[0].name} {materials.length > 1 ? `(+${materials.length - 1})` : ''}
          </span>
        ) : (
          <span className="text-[8px] font-semibold mt-0.5 opacity-55">Kosong</span>
        )}

        {renderRoomIcon(zone.iconType)}

        {/* Inline Edit/Delete for all zones */}
        {canEdit() && (
          <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => handleEditZoneClick(zone)}
              className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] font-bold hover:bg-blue-700 transition-colors"
              title="Edit zone"
            >
              Edit
            </button>
            <button
              onClick={() => deleteZone(zone.id)}
              className="p-0.5 bg-red-100 text-[#EA4B48] rounded hover:bg-red-200 transition-colors"
              title="Hapus zone"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Drag/Resize Handles */}
        {canEdit() && (
          <>
            <div className="resize-handle absolute top-0 left-0 right-0 h-[5px] cursor-ns-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-top')} />
            <div className="resize-handle absolute top-0 bottom-0 right-0 w-[5px] cursor-ew-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-right')} />
            <div className="resize-handle absolute bottom-0 left-0 right-0 h-[5px] cursor-ns-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-bottom')} />
            <div className="resize-handle absolute top-0 bottom-0 left-0 w-[5px] cursor-ew-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-left')} />
          </>
        )}
      </div>
    ) : (
      <div
        key={zone.id}
        style={style}
        onMouseDown={e => { if (canEdit()) handlePointerDown(e, zone, 'move'); }}
        className={`absolute flex flex-col items-center justify-center cursor-move border-2 rounded-xl text-center p-2 transition-all ${
          isSelected 
            ? 'border-[#2C742F] bg-[#2C742F]/15 text-emerald-950 font-bold' 
            : dragState?.zoneId === zone.id 
              ? 'border-[#AAE970] border-dashed bg-[#AAE970]/5' 
              : isCustomColor 
                ? 'bg-white/10 text-stone-850'
                : `${themeStyles.border} bg-white/10 hover:bg-white/20 text-stone-850`
        }`}
      >
        {/* Arrow icon for opening zone details */}
        <button
          onClick={(e) => { e.stopPropagation(); handleSlotClick(zone.id); }}
          onMouseDown={e => e.stopPropagation()}
          className="absolute top-1 right-1 z-20 p-0.5 rounded bg-white/80 hover:bg-white shadow-sm border border-emerald-350 transition-colors"
          title="View zone details"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-[#2C742F]" />
        </button>
        <span className="text-[10px] font-extrabold text-[#2C742F] uppercase pointer-events-none">{zone.name || 'New Zone'}</span>
        {canEdit() && (
          <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => handleEditZoneClick(zone)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold hover:bg-blue-700 transition-colors">Edit</button>
            <button onClick={() => deleteZone(zone.id)} className="p-0.5 bg-red-100 text-[#EA4B48] rounded hover:bg-red-200 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Drag/Resize Handles */}
        {canEdit() && (
          <>
            <div className="resize-handle absolute top-0 left-0 right-0 h-[5px] cursor-ns-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-top')} />
            <div className="resize-handle absolute top-0 bottom-0 right-0 w-[5px] cursor-ew-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-right')} />
            <div className="resize-handle absolute bottom-0 left-0 right-0 h-[5px] cursor-ns-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-bottom')} />
            <div className="resize-handle absolute top-0 bottom-0 left-0 w-[5px] cursor-ew-resize" onMouseDown={e => handlePointerDown(e, zone, 'resize-left')} />
          </>
        )}
      </div>
    );
  };

  // Find currently selected slot/room/custom-zone
  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) return null;
    const dbSlot = slots.find(s => s.id === selectedSlotId);
    const room = ROOMS.find(r => r.id === selectedSlotId);
    const customZone = interactiveZones.find(z => z.id === selectedSlotId);

    if (customZone) {
      return {
        ...customZone,
        isCustom: true,
        zone: customZone.zone || 'Custom'
      };
    }
    return dbSlot ? { ...dbSlot, name: room?.name ?? dbSlot.id, isCustom: false } : null;
  }, [slots, selectedSlotId, interactiveZones]);

  // Calculate statistics for selected room/zone
  const selectedRoomStats = useMemo(() => {
    if (!selectedSlot) return { qty: 0, capacityPct: 0, occupied: false, materials: [] };
    
    let materials: any[] = [];
    if ('materials' in selectedSlot && selectedSlot.materials) {
      materials = selectedSlot.materials;
    } else if ('itemId' in selectedSlot && selectedSlot.itemId) {
      const match = inventoryItems.find(i => i.id === selectedSlot.itemId);
      if (match) materials = [match];
    }

    let totalQty = 0;
    materials.forEach(m => totalQty += (parseFloat(m.qty) || 0));

    const capacityPct = Math.min(100, Math.round((totalQty / 500) * 100));
    const hasCritical = materials.some(m => m.status === 'Kritis' || m.status === 'Expired');

    return {
      qty: totalQty,
      capacityPct,
      occupied: materials.length > 0,
      status: hasCritical ? 'Kritis' : (materials.length > 0 ? 'Aman' : 'N/A'),
      materials
    };
  }, [selectedSlot, inventoryItems]);

  // Get placement recommendations based on category constraints
  function getPlacementSuggestion(cat: string) {
    let suggestion = 'Zona C (Bahan Umum)';
    if (['Kimia', 'Pengawet'].includes(cat)) suggestion = 'Zona E (Bahan Berbahaya)';
    if (['Susu', 'Cokelat'].includes(cat)) suggestion = 'Zona D (Cold Storage)';
    if (['Tepung', 'Gula'].includes(cat)) suggestion = 'Zona A (Bahan Kering)';
    if (['Minyak', 'Pewarna', 'Essence'].includes(cat)) suggestion = 'Zona B (Bahan Cair)';
    return suggestion;
  }

  // AI recommendations are now handled by the AIRecommendationPanel component
  // which calls Gemini dynamically based on inventory and zone state

  // Callback when AI recommendation is applied
  const handleApplyRecommendation = (rec: AIRecommendation) => {
    // Check if it's a custom zone placement
    const customZone = interactiveZones.find(z => z.id === rec.targetSlotId || z.name.toLowerCase() === rec.targetZone.toLowerCase());
    
    if (customZone && rec.type === 'placement') {
      const invItem = inventoryItems.find(i => i.id === rec.itemId);
      if (invItem) {
        const updated = interactiveZones.map(z => {
          if (z.id === customZone.id) {
            const currentMaterials = z.materials ?? [];
            // Avoid duplicate
            if (currentMaterials.some(m => m.id === invItem.id)) return z;
            return {
              ...z,
              materials: [
                ...currentMaterials,
                {
                  id: invItem.id,
                  name: invItem.name,
                  qty: invItem.qty,
                  unit: invItem.unit,
                  maxCapacity: 500
                }
              ]
            };
          }
          return z;
        });
        updateActiveFloorZones(updated);
        setToast(`✓ "${rec.itemName}" ditempatkan di custom zone "${customZone.name}"`);
      }
    }

    // Refresh slots and inventory after applying a recommendation
    fetchSlots();
    fetchInventory();
  };

  // Get the zone letter for the currently selected slot
  const getSelectedSlotZone = (): string | null => {
    if (!selectedSlotId) return null;
    const slot = slots.find(s => s.id === selectedSlotId);
    if (slot) return slot.zone;
    // For custom zones, try to infer from zone name
    const customZone = interactiveZones.find(z => z.id === selectedSlotId);
    if (customZone) {
      // Try to extract zone letter from name
      const match = customZone.name.match(/^([A-E])/i);
      return match ? match[1].toUpperCase() : 'C';
    }
    return null;
  };

  // Get inventory items that aren't assigned to any slot
  const getAvailableInventory = () => {
    // Only exclude items already inside THIS zone, so items in other zones can still be reassigned
    const currentZoneIds = new Set<string>();
    if (selectedSlotId) {
      const zone = interactiveZones.find(z => z.id === selectedSlotId);
      (zone?.materials ?? []).forEach(m => currentZoneIds.add(String(m.id)));
      const slot = slots.find(s => s.id === selectedSlotId);
      if (slot?.itemId) currentZoneIds.add(String(slot.itemId));
    }
    return inventoryItems.filter(item => !currentZoneIds.has(String(item.id)));
  };

  // Add Item to Slot database handler
  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) return;
    if (!addData.selectedLotId) {
      setToast('Silakan pilih material terlebih dahulu!');
      return;
    }

    const invItem = inventoryItems.find(i => String(i.id) === String(addData.selectedLotId));
    if (!invItem) return;

    try {
      if (selectedSlot?.isCustom) {
        // Save to local custom zone materials list AND update DB
        await api.put('/inventory', {
          id: invItem.id,
          name: invItem.name,
          category: invItem.category,
          qty: invItem.qty,
          unit: invItem.unit,
          location: selectedSlotId,
          zone: (selectedSlot as any).zone || 'C',
          dateIn: (invItem as any).dateIn || new Date().toISOString().split('T')[0],
          expiry: (invItem as any).expiry || new Date().toISOString().split('T')[0],
          status: (invItem as any).status || 'Aman',
          user: { name: user?.name || 'Admin', role: user?.role || 'Admin' }
        });

        const updated = interactiveZones.map(z => {
          if (z.id === selectedSlotId) {
            const currentMaterials = z.materials ?? [];
            if (currentMaterials.some(m => m.id === invItem.id)) return z;
            return {
              ...z,
              materials: [
                ...currentMaterials,
                {
                  id: invItem.id,
                  name: invItem.name,
                  qty: invItem.qty,
                  unit: invItem.unit,
                  maxCapacity: 500
                }
              ]
            };
          }
          return z;
        });
        updateActiveFloorZones(updated);
        setToast(`Material ${invItem.name} ditambahkan ke ${selectedSlot.name}!`);
        fetchInventory();
      } else {
        // Save to PostgreSQL slots database table
        const res = await api.post<{ success: boolean; slots: Slot[] }>('/slots', {
          id: selectedSlotId,
          item: { id: invItem.id }
        });
        if (res.success) {
          fetchSlots();
          setToast(`Material ${invItem.name} ditempatkan di Slot ${selectedSlotId}!`);
        }
      }
      setShowAddForm(false);
      setAddData({ selectedLotId: '', hasTempSensor: false, tempApiUrl: '', hasHumidSensor: false, humidApiUrl: '' });
      setSearchLotQuery('');
    } catch {
      setToast('Gagal menempatkan material.');
    }
  };

  // Delete Item from Slot database handler
  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (!canEdit()) return;
    showConfirm(
      'Hapus Material',
      `Hapus "${itemName}" dari slot ini?`,
      () => {
        closeConfirm();
        (async () => {
          try {
            if (selectedSlot?.isCustom) {
              const invItem = inventoryItems.find(i => i.id === itemId);
              if (invItem) {
                await api.put('/inventory', {
                  id: invItem.id, name: invItem.name, category: invItem.category,
                  qty: invItem.qty, unit: invItem.unit, location: 'UNASSIGNED', zone: 'C',
                  dateIn: (invItem as any).dateIn || new Date().toISOString().split('T')[0],
                  expiry: (invItem as any).expiry || new Date().toISOString().split('T')[0],
                  status: (invItem as any).status || 'Aman',
                  user: { name: user?.name || 'Admin', role: user?.role || 'Admin' }
                });
              }
              const updated = interactiveZones.map(z =>
                z.id === selectedSlotId ? { ...z, materials: (z.materials ?? []).filter(m => m.id !== itemId) } : z
              );
              updateActiveFloorZones(updated);
              setToast(`Material ${itemName} dihapus dari slot.`);
              fetchInventory();
            } else {
              const res = await api.delete<{ success: boolean }>(`/inventory?id=${itemId}&userName=${encodeURIComponent(user?.name ?? 'Admin')}&userRole=${encodeURIComponent(user?.role ?? 'Admin')}`);
              if (res.success) { fetchSlots(); fetchInventory(); setToast(`Material ${itemName} dihapus.`); }
            }
          } catch { setToast('Gagal menghapus material.'); }
        })();
      }
    );
  };

  // Image Drag & Drop Handlers
  const handleUploadImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadDragActiveImage(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(png|jpe?g|webp)$/i.test(file.name)) {
      setUploadImageFile(file);
      const reader = new FileReader();
      reader.onload = ev => setUploadImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadImageFile(file);
      const reader = new FileReader();
      reader.onload = ev => setUploadImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // PDF Drag & Drop Handlers
  const handleUploadPdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadDragActivePdf(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.pdf$/i.test(file.name)) {
      setUploadPdfFile(file);
    }
  };

  const handleUploadPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadPdfFile(file);
  };

  // Upload Floor Plan submission
  const handleUploadSubmit = async () => {
    if (!uploadImageFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadImageFile);
      });

      let extractedZones: Array<{ id?: string; name: string; position: { x: number; y: number; width: number; height: number } }> = [];

      if (uploadPdfFile) {
        // Image + PDF: send to backend for enhanced zone detection
        const formData = new FormData();
        formData.append('image', uploadImageFile);
        formData.append('pdf', uploadPdfFile);
        
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/floor-plan-upload`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.success && data.zones) {
            extractedZones = data.zones;
          } else if (data.error) {
            throw new Error(data.error);
          }
        } catch (err) {
          console.error('Backend floor plan processing error:', err);
          setUploadError(err instanceof Error ? err.message : 'Failed to process floor plan with PDF. Please try again.');
          setIsUploading(false);
          return;
        }
      } else {
        // Image only: call Gemini directly for zone detection
        const geminiPrompt = 'Analyze this warehouse floor plan image. Detect all distinct zones/areas and return them as a JSON array. Each zone should have: name (string), position (object with x, y, width, height as percentages 0-100 of the image dimensions). Return ONLY the JSON array, no other text.';
        
        try {
          // Determine mime type from file
          const mimeType = uploadImageFile.type || 'image/png';
          const responseText = await callAI(geminiPrompt, 'floor-plan', imageDataUrl, mimeType);
          
          // Parse the JSON response from Gemini
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              extractedZones = parsed.map((z: { name?: string; position?: { x?: number; y?: number; width?: number; height?: number } }) => ({
                name: z.name || 'Detected Zone',
                position: {
                  x: Math.max(0, Math.min(100, z.position?.x ?? 0)),
                  y: Math.max(0, Math.min(100, z.position?.y ?? 0)),
                  width: Math.max(5, Math.min(100, z.position?.width ?? 20)),
                  height: Math.max(5, Math.min(100, z.position?.height ?? 20)),
                }
              }));
            }
          }
        } catch (err) {
          console.error('Gemini zone detection error:', err);
          setUploadError('Layanan AI sedang tidak tersedia. Floor plan akan disimpan dalam mode upload-only tanpa deteksi zona otomatis. Anda dapat menambahkan zona secara manual setelah upload.');
          
          const planData: CustomFloorPlan = {
            imageDataUrl,
            fileName: uploadImageFile.name,
            uploadedAt: new Date().toISOString(),
            zones: []
          };
          updateActiveFloorPlan(planData);
          setShowUploadPanel(false);
          setUploadImageFile(null);
          setUploadImagePreview(null);
          setUploadPdfFile(null);
          setIsUploading(false);
          setToast('Floor plan uploaded (mode upload-only — tambahkan zona secara manual).');
          return;
        }
      }

      const planData: CustomFloorPlan = {
        imageDataUrl,
        fileName: uploadImageFile.name,
        uploadedAt: new Date().toISOString(),
        zones: extractedZones
      };

      updateActiveFloorPlan(planData);

      if (extractedZones.length > 0) {
        const mapped: InteractiveZone[] = extractedZones.map(z => ({
          id: z.id || `Z-${Math.random().toString(36).substring(2, 6)}`,
          name: z.name || 'Detected Zone',
          position: z.position || { x: 40, y: 40, width: 20, height: 20 },
          hasTempSensor: false,
          hasHumidSensor: false,
          materials: []
        }));
        updateActiveFloorZones(mapped);
      }

      setShowUploadPanel(false);
      setUploadImageFile(null);
      setUploadImagePreview(null);
      setUploadPdfFile(null);
      setUploadError(null);
      setToast(`Floor plan uploaded successfully!${extractedZones.length > 0 ? ` ${extractedZones.length} zones detected by AI.` : ''}`);
    } catch {
      setUploadError('Failed to upload floor plan. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSlotClick = (slotId: string) => {
    setSelectedSlotId(slotId);
    setSelectedSlotPopup(true);
    setShowAddForm(false);
    setSearchLotQuery('');
  };

  const closePopup = () => {
    setSelectedSlotPopup(false);
    setSelectedSlotId(null);
  };

  function renderRoomIcon(iconType?: string) {
    switch (iconType) {
      case 'snowflake': return <Snowflake className="w-5 h-5 absolute bottom-2 right-2 text-current opacity-30 pointer-events-none animate-spin-slow" />;
      case 'flame': return <Flame className="w-5 h-5 absolute bottom-2 right-2 text-current opacity-35 pointer-events-none animate-bounce" />;
      case 'door': return <Lock className="w-4 h-4 absolute bottom-2 right-2 text-current opacity-20 pointer-events-none" />;
      case 'wash': return <Droplet className="w-4 h-4 absolute bottom-2 right-2 text-current opacity-20 pointer-events-none" />;
      case 'machinery': return <ArrowRightLeft className="w-4 h-4 absolute bottom-2 right-2 text-current opacity-20 pointer-events-none" />;
      default: return null;
    }
  }

  return (
    <div className="space-y-6 pb-16 text-left">
      {/* CSS Overlay for hotspot resize handles and blinking animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        .resize-handle:hover {
          background-color: rgba(16, 185, 129, 0.4);
        }
        @keyframes capacity-blink {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
            border-color: rgba(239, 68, 68, 0.95) !important;
            background-color: rgba(239, 68, 68, 0.2) !important;
          }
          50% {
            opacity: 0.65;
            box-shadow: 0 0 2px rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.3) !important;
            background-color: rgba(239, 68, 68, 0.05) !important;
          }
        }
        .animate-capacity-blink {
          animation: capacity-blink 1.2s infinite ease-in-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
      `}} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800 tracking-tight">{t('interactiveFloorPlan')}</h1>
          <p className="text-xs text-stone-500 mt-1 font-semibold">{t('floorPlanSub')}</p>
        </div>
        <div className="flex gap-2">
          {canEdit() && (
            <button onClick={() => setShowUploadPanel(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all shadow-sm active:scale-95">
              <Upload className="w-4 h-4 text-stone-500" /> {t('uploadPlan')}
            </button>
          )}
          {isAdmin() && (
            <button onClick={resetToDefault}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-white text-xs font-bold text-stone-750 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
              title="Reset layout ke default">
              <RotateCcw className="w-4 h-4 text-stone-500" /> {t('backToDefault')}
            </button>
          )}
          {canEdit() && (
            <>
              <button onClick={undoLastAction} disabled={undoHistory.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="Undo langkah sebelumnya">
                <Undo2 className="w-4 h-4 text-stone-500" /> {t('undo')}
              </button>
              <button onClick={addCustomZone}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2C742F] text-white text-xs font-bold hover:bg-[#366306] transition-all shadow-sm active:scale-95">
                <Plus className="w-4 h-4" /> {t('addZone')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Floor Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#2C742F]/10 mb-2 scrollbar-thin">
        {floors.map((floor) => {
          const isActive = floor.id === activeFloorId;
          const isEditing = editingFloorId === floor.id;

          return (
            <div
              key={floor.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-[#2C742F] text-white border-[#2C742F] shadow-sm'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editFloorNameInput}
                  onChange={(e) => setEditFloorNameInput(e.target.value)}
                  onBlur={() => saveFloorName(floor.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveFloorName(floor.id);
                    if (e.key === 'Escape') setEditingFloorId(null);
                  }}
                  className={`bg-transparent border-b border-current outline-none text-xs font-bold w-24 text-center focus:ring-0 ${
                    isActive ? 'text-white border-white/50' : 'text-stone-800 border-stone-300'
                  }`}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    className="cursor-pointer select-none"
                    onClick={() => {
                      setActiveFloorId(floor.id);
                      localStorage.setItem('aromasys_active_floor_id', floor.id);
                    }}
                    onDoubleClick={() => {
                      if (canEdit()) {
                        setEditingFloorId(floor.id);
                        setEditFloorNameInput(floor.name);
                      }
                    }}
                  >
                    {floor.name}
                  </span>
                  
                  {canEdit() && (
                    <button
                      onClick={() => {
                        setEditingFloorId(floor.id);
                        setEditFloorNameInput(floor.name);
                      }}
                      className={`p-0.5 rounded-full transition-colors ${
                        isActive ? 'text-white/60 hover:text-white' : 'text-stone-400 hover:text-stone-600'
                      }`}
                      title="Edit Nama Layout"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}

                  {canEdit() && floors.length > 1 && (
                    <button
                      onClick={() => deleteFloor(floor.id, floor.name)}
                      className={`p-0.5 rounded-full transition-colors ${
                        isActive ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-stone-400 hover:text-[#EA4B48] hover:bg-red-50'
                      }`}
                      title="Hapus Layout"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canEdit() && (
          <button
            onClick={addFloor}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-dashed border-[#2C742F]/40 bg-white/50 text-xs font-bold text-[#2C742F] hover:bg-[#2C742F]/5 transition-all shadow-sm active:scale-95 shrink-0"
            title="Tambah Layout Baru"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Layout
          </button>
        )}
      </div>

      {/* Floor Plan Display Card */}
      <div className="bg-[#F5FBF3] rounded-2xl border border-[#AAE970]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] p-4 space-y-3 relative">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[360px] gap-3 flex-col">
            <div className="w-10 h-10 border-4 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#79747E] font-semibold">Loading warehouse model...</p>
          </div>
        ) : (
          <>
            {/* 1. Blueprint Image Section (reference only, above canvas) */}
            {customFloorPlan?.imageDataUrl && (
              <div className="space-y-2">
                {/* Blueprint header bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Denah Upload{customFloorPlan.fileName ? ` — ${customFloorPlan.fileName}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBlueprintImage(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-stone-200 bg-white text-[10px] font-bold text-stone-600 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
                    >
                      {showBlueprintImage ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showBlueprintImage ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                    {canEdit() && (
                      <button
                        onClick={() => showConfirm(
                          'Hapus Gambar Denah',
                          'Hapus gambar denah ini? Zona interaktif yang sudah ada akan tetap dipertahankan.',
                          () => { closeConfirm(); updateActiveFloorPlan(null); setShowBlueprintImage(true); setToast('Gambar denah dihapus.'); }
                        )}
                        className="flex items-center gap-1 px-3 py-1 rounded-full border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 transition-all shadow-sm active:scale-95"
                        title="Hapus Gambar Denah"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    )}
                  </div>
                </div>

                {/* Blueprint image */}
                <AnimatePresence>
                  {showBlueprintImage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="w-full border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <img src={customFloorPlan.imageDataUrl} alt="Denah lantai" className="w-full h-auto block" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 2. Interactive Zones Canvas — always visible for editing */}
            <div
              className="relative w-full border border-stone-200 rounded-xl bg-white min-h-[680px] shadow-inner"
              ref={canvasRef}
              style={{
                backgroundImage: 'radial-gradient(#2C742F12 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            >
              {interactiveZones.map(zone => renderInteractiveZone(zone))}
            </div>
          </>
        )}
      </div>

      {/* Zone Legend */}
      <div className="flex flex-wrap gap-2.5">
        {ZONES.map(z => (
          <div key={z.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5FBF3] border border-[#AAE970]/10 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
            <span className="text-xs font-semibold text-stone-700">Zone {z.id}</span>
            <span className="text-[10px] font-bold text-stone-500">{z.tempMin}–{z.tempMax}°C</span>
          </div>
        ))}
      </div>

      {/* Custom Zones Info */}
      {interactiveZones.length > 0 && (
        <div className="bg-[#F5FBF3] rounded-2xl border border-[#AAE970]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] p-5 space-y-3">
          <h3 className="font-bold text-sm text-[#1C1B1F]">Custom Zones ({interactiveZones.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {interactiveZones.map(zone => (
              <div key={zone.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-150 bg-white shadow-sm hover:border-[#AAE970]/40 transition-all">
                <div>
                  <p className="text-xs font-bold text-stone-800">{zone.name}</p>
                  <p className="text-[10px] font-semibold text-[#79747E] mt-0.5">{zone.materials?.length ?? 0} materials assigned</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleSlotClick(zone.id)}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold transition-all">View</button>
                  {canEdit() && (
                    <button onClick={() => handleEditZoneClick(zone)}
                      className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                  )}
                  {canDelete() && (
                    <button onClick={() => deleteZone(zone.id)}
                      className="p-1 rounded-lg bg-red-50 text-[#EA4B48] hover:bg-red-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations Panel - Dynamic with Gemini */}
      <AIRecommendationPanel
        slots={slots}
        inventoryItems={inventoryItems}
        selectedSlotId={selectedSlotId}
        selectedSlotZone={getSelectedSlotZone()}
        interactiveZones={interactiveZones}
        customFloorPlan={customFloorPlan}
        activeFloorName={floors.find(f => f.id === activeFloorId)?.name || 'Layout 1'}
        onApplyRecommendation={handleApplyRecommendation}
        onToast={setToast}
        temperatureData={temperatureData}
      />

      {/* Floating Popup Slot/Room Details Card Overlay */}
      <AnimatePresence>
        {selectedSlotPopup && selectedSlot && (
          <Portal>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closePopup}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-left border border-[#AAE970]/10"
            >
              {/* Header */}
              <div className="bg-[#F5FBF3] p-5 border-b border-[#AAE970]/10 flex justify-between items-start relative">
                <button onClick={closePopup} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-stone-250 bg-white/60 text-stone-500 hover:text-stone-800 shadow-sm transition-all focus:outline-none">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex gap-4">
                  <div className="w-11 h-11 bg-emerald-50 border border-[#2C742F]/10 rounded-xl flex items-center justify-center text-[#2C742F] shrink-0 shadow-sm">
                    {selectedSlot.id === 'D-1' ? (
                      <Snowflake className="w-6 h-6" />
                    ) : selectedSlot.id === 'E-1' ? (
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    ) : (
                      <Droplet className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-green-950 text-base leading-tight mt-0.5">{selectedSlot.name}</h3>
                    <p className="text-[10px] font-extrabold text-[#79747E] uppercase tracking-wider mt-1.5">
                      Zone {selectedSlot.zone} • {selectedSlot.isCustom ? 'Custom Zone' : 'Default Room'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Layout Modification Actions */}
              {canEdit() && (
                <div className="px-5 pt-4 flex gap-2 w-full">
                  <button
                    onClick={() => { handleEditZoneClick(selectedSlot as InteractiveZone); closePopup(); }}
                    className="flex-1 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm"
                  >
                    Edit Zone Info
                  </button>
                  <button
                    onClick={() => {
                      if (selectedSlot.isCustom) {
                        deleteZone(selectedSlot.id);
                        closePopup();
                      } else {
                        handleDeleteDefaultZone(selectedSlot.id);
                      }
                    }}
                    className="flex-1 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Zona
                  </button>
                </div>
              )}

              {/* Details Body */}
              <div className="p-5 space-y-4 overflow-y-auto max-h-[360px]">
                {/* Capacity utilization bar */}
                <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-150 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-stone-500">Kapasitas Zona</span>
                    <strong className={selectedRoomStats.capacityPct > 90 ? 'text-[#EA4B48]' : 'text-green-950'}>
                      {selectedRoomStats.capacityPct}% ({selectedRoomStats.qty} / 500)
                    </strong>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selectedRoomStats.capacityPct > 90 ? 'bg-[#EA4B48]' : 'bg-[#2C742F]'
                      }`}
                      style={{ width: `${selectedRoomStats.capacityPct}%` }}
                    />
                  </div>
                </div>

                {/* Assigned Items */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Item Terdaftar ({selectedRoomStats.materials.length})</h4>
                    {!showAddForm && canEdit() && (
                      <button onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1 px-3 py-1 rounded-full border border-stone-200 bg-white text-[10px] font-bold text-[#2C742F] hover:bg-stone-50 shadow-sm transition-all active:scale-95">
                        <Plus className="w-3.5 h-3.5" /> Add Material
                      </button>
                    )}
                  </div>

                  {!showAddForm ? (
                    selectedRoomStats.materials.length > 0 ? (
                      <div className="divide-y divide-stone-100 pr-1">
                        {selectedRoomStats.materials.map(m => (
                          <div key={m.id} className="flex justify-between items-center py-2.5">
                            <div>
                              <p className="text-xs font-bold text-stone-800">{m.name}</p>
                              <p className="text-[10px] font-semibold text-stone-500 mt-0.5">Lot ID: {m.id} | {m.qty} {m.unit}</p>
                            </div>
                            {canEdit() && (
                              <button onClick={() => handleDeleteItem(m.id, m.name)}
                                className="p-1 rounded-lg text-stone-400 hover:text-[#EA4B48] hover:bg-red-50 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-stone-400 font-semibold italic border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                        Kosong
                      </div>
                    )
                  ) : (
                    /* Search and Add Form */
                    <form onSubmit={handleSaveNewItem} className="space-y-3 p-3 bg-stone-50 rounded-xl border border-stone-200 animate-fadeIn">
                      <div>
                        <label className="text-[9px] font-bold text-stone-500 uppercase block mb-1">Nama Material / Lot ID</label>
                        <input
                          type="text"
                          placeholder="Cari material..."
                          value={searchLotQuery}
                          onChange={e => { setSearchLotQuery(e.target.value); setAddData({ ...addData, selectedLotId: '' }); }}
                          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
                        />

                        {searchLotQuery && !addData.selectedLotId && (() => {
                          const q = searchLotQuery.toLowerCase();
                          const results = getAvailableInventory().filter(m =>
                            m.name.toLowerCase().includes(q) ||
                            String(m.id).toLowerCase().includes(q) ||
                            (m.category || '').toLowerCase().includes(q)
                          );
                          return (
                            <div className="mt-1.5 max-h-40 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg divide-y divide-stone-100">
                              {results.length === 0 ? (
                                <div className="p-3 text-center text-[10px] font-semibold text-stone-400">
                                  Tidak ada material ditemukan
                                </div>
                              ) : results.map(m => {
                                const currentLoc = (m as any).location;
                                const isElsewhere = currentLoc && currentLoc !== 'UNASSIGNED' && currentLoc !== selectedSlotId;
                                return (
                                  <div
                                    key={m.id}
                                    onClick={() => {
                                      setSearchLotQuery(`${m.name} (${m.id})`);
                                      setAddData({ ...addData, selectedLotId: String(m.id) });
                                      setAiSuggestion(getPlacementSuggestion(m.category));
                                    }}
                                    className="p-2.5 hover:bg-[#F5FBF3] cursor-pointer text-left transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-stone-800">{m.name}</span>
                                      {isElsewhere && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                                          {currentLoc}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] font-semibold text-stone-400 mt-0.5">
                                      {m.id} · {m.category} · {m.qty} {m.unit}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {aiSuggestion && addData.selectedLotId && (
                        <>
                          <div className="flex gap-2 p-2 bg-[#F5FBF3] border border-[#AAE970]/10 rounded-lg text-[10px] font-semibold text-[#2C742F]">
                            <Bot className="w-4.5 h-4.5 shrink-0 text-[#2C742F] animate-bounce" />
                            <span>AI Recommendation: {aiSuggestion}</span>
                          </div>
                          {/* ZoneMismatchWarning: show when item category doesn't match current zone */}
                          {(() => {
                            const selectedItem = inventoryItems.find(i => i.id === addData.selectedLotId);
                            const currentZone = selectedSlot?.zone || getSelectedSlotZone();
                            if (selectedItem && currentZone && detectZoneMismatch(selectedItem.category, currentZone)) {
                              const recommendedZone = CATEGORY_ZONE_MAP[selectedItem.category];
                              return (
                                <div className="flex gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-semibold text-amber-700">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                  <span>⚠️ Zone Mismatch: &quot;{selectedItem.name}&quot; ({selectedItem.category}) sebaiknya di Zona {recommendedZone}, bukan Zona {currentZone}.</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}

                      <div className="flex gap-2 pt-1.5">
                        <button type="submit"
                          className="flex-1 py-2 bg-[#2C742F] hover:bg-[#366306] text-white rounded-full text-xs font-bold shadow-sm transition-all">Simpan</button>
                        <button type="button" onClick={() => { setShowAddForm(false); setAiSuggestion(null); }}
                          className="flex-1 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-full text-xs font-semibold transition-all">Batal</button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* PDF + Floor Plan Image Upload Modal Panel */}
      <AnimatePresence>
        {showUploadPanel && (
          <Portal>
          <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col text-left border border-stone-200"
            >
              {/* Header */}
              <div className="bg-[#F5FBF3] p-5 border-b border-[#AAE970]/10 flex justify-between items-center rounded-t-3xl">
                <div>
                  <h3 className="font-extrabold text-green-950 text-base">Upload Warehouse Layout Model</h3>
                  <p className="text-[10px] font-bold text-stone-500 mt-1">Configure layout blueprints and extract active metadata.</p>
                </div>
                <button onClick={() => { setShowUploadPanel(false); setUploadImageFile(null); setUploadImagePreview(null); setUploadPdfFile(null); setUploadError(null); }}
                  className="p-1.5 rounded-full hover:bg-stone-200 bg-white shadow-sm text-stone-400 hover:text-stone-750 transition-all focus:outline-none">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Body: Side-by-side drop zones */}
              <div className="p-6 flex flex-row gap-4 overflow-y-auto max-h-[75vh]">
                
                {/* Column 1: Image Blueprint */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#2C742F]" />
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Floor Plan Image</h4>
                  </div>
                  <p className="text-[10px] font-semibold text-stone-400">Upload the blueprint map image (PNG, JPG, WEBP).</p>
                  
                  {uploadImageFile ? (
                    <div className="flex flex-col items-center gap-2 p-3 bg-stone-50 border border-stone-200 rounded-2xl relative overflow-hidden">
                      {uploadImagePreview && <img src={uploadImagePreview} alt="Preview" className="w-full max-h-32 object-contain rounded-lg bg-white" />}
                      <span className="text-[10px] font-bold text-stone-600 truncate max-w-full mt-1.5">{uploadImageFile.name}</span>
                      <button onClick={() => { setUploadImageFile(null); setUploadImagePreview(null); }}
                        className="px-3 py-1 bg-red-50 text-[#EA4B48] hover:bg-red-100 rounded-full text-[9px] font-bold transition-all mt-1">Remove Image</button>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => { e.preventDefault(); setUploadDragActiveImage(true); }}
                      onDragLeave={() => setUploadDragActiveImage(false)}
                      onDrop={handleUploadImageDrop}
                      onClick={() => imageInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all min-h-[160px] ${
                        uploadDragActiveImage ? 'border-[#2C742F] bg-[#D7E5D8]/30' : 'border-stone-200 hover:border-[#2C742F]/30 bg-stone-50/50'
                      }`}
                    >
                      <FileUp className="w-8 h-8 text-stone-400" />
                      <p className="text-xs font-bold text-stone-700">Drop image here or click</p>
                      <span className="text-[9px] font-semibold text-stone-400">PNG, JPG, WEBP (Max 10MB)</span>
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImageChange} />
                    </div>
                  )}
                </div>

                {/* Column 2: PDF Metadata */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-red-600" />
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Zone Metadata PDF</h4>
                  </div>
                  <p className="text-[10px] font-semibold text-stone-400">Provide document with names/bounds details to parse automatically.</p>
                  
                  {uploadPdfFile ? (
                    <div className="flex flex-col items-center justify-center gap-3.5 p-6 bg-stone-50 border border-stone-200 rounded-2xl min-h-[160px]">
                      <div className="w-12 h-12 bg-red-100 text-red-700 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                        <FileUp className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-bold text-stone-600 truncate max-w-full">{uploadPdfFile.name}</span>
                      <button onClick={() => setUploadPdfFile(null)}
                        className="px-3 py-1 bg-red-50 text-[#EA4B48] hover:bg-red-100 rounded-full text-[9px] font-bold transition-all">Remove PDF</button>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => { e.preventDefault(); setUploadDragActivePdf(true); }}
                      onDragLeave={() => setUploadDragActivePdf(false)}
                      onDrop={handleUploadPdfDrop}
                      onClick={() => pdfInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all min-h-[160px] ${
                        uploadDragActivePdf ? 'border-red-500 bg-red-50/10' : 'border-stone-200 hover:border-red-400/30 bg-stone-50/50'
                      }`}
                    >
                      <FileUp className="w-8 h-8 text-stone-400" />
                      <p className="text-xs font-bold text-stone-700">Drop PDF document here or click</p>
                      <span className="text-[9px] font-semibold text-stone-400">PDF Document (Max 10MB)</span>
                      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadPdfChange} />
                    </div>
                  )}
                </div>

              </div>

              {/* Error Display with Retry */}
              {uploadError && (
                <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-800">AI Analysis Failed</p>
                    <p className="text-[10px] text-red-600 mt-0.5 break-words">{uploadError}</p>
                  </div>
                  <button
                    onClick={() => { setUploadError(null); handleUploadSubmit(); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-full text-[10px] font-bold transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* Actions Footer */}
              <div className="bg-stone-50 p-4 border-t border-stone-200 flex justify-end gap-2.5">
                <button
                  onClick={() => { setShowUploadPanel(false); setUploadImageFile(null); setUploadImagePreview(null); setUploadPdfFile(null); setUploadError(null); }}
                  className="px-4 py-2 border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs rounded-full active:scale-95 transition-all outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadSubmit}
                  disabled={!uploadImageFile || isUploading}
                  className="px-4 py-2 bg-[#2C742F] hover:bg-[#366306] text-white font-bold text-xs rounded-full active:scale-95 transition-all shadow-[0px_4px_12px_rgba(44,116,47,0.15)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading Model...</span>
                    </>
                  ) : (
                    <span>Upload Floor Plan</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Zone Details Modal */}
      <AnimatePresence>
        {showZoneModal && editingZone && (
          <Portal>
            <ZoneDetailsModal
              zone={editingZone}
              onClose={() => setShowZoneModal(false)}
              onSave={handleSaveZone}
              onAddMaterial={handleAddMaterialToZone}
              onRemoveMaterial={handleRemoveMaterialFromZone}
              existingMaterials={zoneMaterials}
            />
          </Portal>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Dynamic Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-[#2C742F] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold z-50 flex items-center gap-2"
          >
            <Check className="w-4.5 h-4.5" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
