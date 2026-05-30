'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { ZONES, CATEGORIES } from '@/lib/mockData';
import {
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  X,
  Package,
  Check,
  Bot,
  Lightbulb,
  Snowflake,
  Flame,
  Lock,
  Droplet,
  AlertTriangle,
  ArrowRightLeft,
  Upload,
  ImageIcon,
  FileUp
} from 'lucide-react';
import './floor-plan.css';
import ZoneDetailsModal from './ZoneDetailsModal';

// 12 rooms mapping directly to specific database Slots for 100% dynamic connection
const ROOMS = [
  { id: 'A-1', name: 'LOADING DOCK', zone: 'A', theme: 'green', gridStyle: { gridColumn: '1 / 13', gridRow: '1' } },
  { id: 'A-2', name: 'Equipment Set Up', zone: 'A', theme: 'neutral', gridStyle: { gridColumn: '1 / 4', gridRow: '2 / 5' }, iconType: 'machinery' },
  { id: 'B-1', name: 'Tray Setting 1', zone: 'B', theme: 'neutral', gridStyle: { gridColumn: '4 / 7', gridRow: '2' }, hasStatusDot: true },
  { id: 'B-2', name: 'Tray Setting 2', zone: 'B', theme: 'neutral', gridStyle: { gridColumn: '7 / 10', gridRow: '2' } },
  { id: 'D-1', name: 'Cold Storage', zone: 'D', theme: 'green', gridStyle: { gridColumn: '10 / 13', gridRow: '2 / 5' }, iconType: 'snowflake', hasCapacityBar: true },
  { id: 'C-1', name: 'Hot Extraction', zone: 'C', theme: 'green', gridStyle: { gridColumn: '4 / 10', gridRow: '3 / 5' }, iconType: 'flame' },
  { id: 'C-3', name: 'Non-Production Machinery', zone: 'C', theme: 'neutral', gridStyle: { gridColumn: '1 / 4', gridRow: '5' } },
  { id: 'C-4', name: 'Locker Room', zone: 'C', theme: 'neutral', gridStyle: { gridColumn: '4 / 8', gridRow: '5' }, iconType: 'door' },
  { id: 'C-5', name: 'QC & Lab', zone: 'C', theme: 'green', gridStyle: { gridColumn: '8 / 10', gridRow: '5' } },
  { id: 'C-2', name: 'Pot Washing', zone: 'C', theme: 'neutral', gridStyle: { gridColumn: '10 / 13', gridRow: '5 / 7' }, iconType: 'wash' },
  { id: 'A-3', name: 'Receiving', zone: 'A', theme: 'green', gridStyle: { gridColumn: '1 / 4', gridRow: '6' } },
  { id: 'E-1', name: 'Hazard Storage', zone: 'E', theme: 'hazard', gridStyle: { gridColumn: '4 / 10', gridRow: '6' }, isHazard: true, iconType: 'warning' },
];

export default function FloorPlanPage() {
  const { user, canEdit, canDelete } = useAuth();

  // Dynamic slots loaded from the PostgreSQL database API
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selection & Popup states
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedSlotPopup, setSelectedSlotPopup] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addData, setAddData] = useState({ selectedLotId: '', hasTempSensor: false, tempApiUrl: '', hasHumidSensor: false, humidApiUrl: '' });
  const [searchLotQuery, setSearchLotQuery] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isApplyingAI, setIsApplyingAI] = useState(false);
  const [toast, setToast] = useState(null);

  // Last added inventory item and all items for dropdown
  const [lastIntakeItem, setLastIntakeItem] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [deletedDefaultZones, setDeletedDefaultZones] = useState([]);

  // Custom uploaded floor plan from localStorage
  const [customFloorPlan, setCustomFloorPlan] = useState(null);

  // Upload modal state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadImageFile, setUploadImageFile] = useState(null);
  const [uploadImagePreview, setUploadImagePreview] = useState(null);
  const [uploadPdfFile, setUploadPdfFile] = useState(null);
  const [uploadDragActiveImage, setUploadDragActiveImage] = useState(false);
  const [uploadDragActivePdf, setUploadDragActivePdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Add Zone / Zone Modal state
  const [interactiveZones, setInteractiveZones] = useState([]);
  const canvasRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZoneData, setEditingZoneData] = useState(null);
  const [zoneMaterials, setZoneMaterials] = useState([]);
  
  const handleAddZoneClick = () => {
    if (interactiveZones.length >= 30) {
      setToast('Batas maksimum 30 zona telah tercapai.');
      return;
    }
    const newZones = [...interactiveZones];
    const newZoneEntry = {
      id: `Z-${Date.now().toString().slice(-4)}`,
      name: `Zona Kustom ${newZones.length + 1}`,
      position: { x: 40, y: 40, width: 20, height: 20 },
      hasTempSensor: false,
      hasHumidSensor: false,
      materials: []
    };
    newZones.push(newZoneEntry);
    setInteractiveZones(newZones);
    localStorage.setItem('aromasys_interactive_zones', JSON.stringify(newZones));
  };

  const handleEditZoneClick = (zone) => {
    setEditingZoneData(zone);
    setZoneMaterials(zone.materials || []);
    setShowZoneModal(true);
  };

  const handleDeleteZone = (zoneId) => {
    const newZones = interactiveZones.filter(z => z.id !== zoneId);
    setInteractiveZones(newZones);
    localStorage.setItem('aromasys_interactive_zones', JSON.stringify(newZones));
    setToast('Zona berhasil dihapus.');
  };

  const handleSaveZone = (zoneData) => {
    const newZones = [...interactiveZones];
    const existIdx = newZones.findIndex(z => z.id === zoneData.id);
    
    const newZoneEntry = {
      ...zoneData,
      position: editingZoneData?.position || { x: 40, y: 40, width: 20, height: 20 },
      materials: zoneMaterials
    };

    if (existIdx >= 0) {
      newZones[existIdx] = newZoneEntry;
    } else {
      newZones.push(newZoneEntry);
    }
    
    setInteractiveZones(newZones);
    localStorage.setItem('aromasys_interactive_zones', JSON.stringify(newZones));
    setShowZoneModal(false);
    setToast(`Zona ${zoneData.name} berhasil disimpan!`);
  };

  const handleAddMaterialToZone = (material) => {
    setZoneMaterials([...zoneMaterials, material]);
  };

  const handleRemoveMaterialFromZone = (materialId) => {
    setZoneMaterials(zoneMaterials.filter(m => m.id !== materialId));
  };

  // Drag logic
  const handlePointerDown = (e, zone, type) => {
    e.stopPropagation();
    if (!canEdit()) return;
    if (!canvasRef.current) return;
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
    
    const handlePointerMove = (e) => {
      const dx = ((e.clientX - dragState.startX) / dragState.canvasW) * 100;
      const dy = ((e.clientY - dragState.startY) / dragState.canvasH) * 100;
      
      setInteractiveZones(prev => prev.map(z => {
        if (z.id !== dragState.zoneId) return z;
        const newPos = { ...z.position };
        
        if (dragState.type === 'move') {
          newPos.x = Math.max(0, Math.min(100 - newPos.width, dragState.origX + dx));
          newPos.y = Math.max(0, Math.min(100 - newPos.height, dragState.origY + dy));
        } else if (dragState.type === 'resize-right') {
          newPos.width = Math.max(5, Math.min(100 - newPos.x, dragState.origW + dx));
        } else if (dragState.type === 'resize-bottom') {
          newPos.height = Math.max(5, Math.min(100 - newPos.y, dragState.origH + dy));
        } else if (dragState.type === 'resize-left') {
          const newX = Math.max(0, Math.min(dragState.origX + dragState.origW - 5, dragState.origX + dx));
          const wDiff = dragState.origX - newX;
          newPos.x = newX;
          newPos.width = dragState.origW + wDiff;
        } else if (dragState.type === 'resize-top') {
          const newY = Math.max(0, Math.min(dragState.origY + dragState.origH - 5, dragState.origY + dy));
          const hDiff = dragState.origY - newY;
          newPos.y = newY;
          newPos.height = dragState.origH + hDiff;
        }
        return { ...z, position: newPos };
      }));
    };
    
    const handlePointerUp = () => {
      setDragState(null);
      setInteractiveZones(prev => {
        localStorage.setItem('aromasys_interactive_zones', JSON.stringify(prev));
        return prev;
      });
    };
    
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [dragState]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aromasys_interactive_zones');
      if (stored) setInteractiveZones(JSON.parse(stored));
    } catch (err) {}
    try {
      const stored = localStorage.getItem('aromasys_floor_plan');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.imageDataUrl) {
          setCustomFloorPlan(parsed);
        }
      }
    } catch (err) {}
    try {
      const deleted = localStorage.getItem('aromasys_deleted_default_zones');
      if (deleted) setDeletedDefaultZones(JSON.parse(deleted));
    } catch (err) {}
  }, []);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch slots from API
  const fetchSlots = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch inventory for dropdowns and AI suggestions
  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success && data.items) {
        setInventoryItems(data.items);
        if (data.items.length > 0) {
          // Find most recent intake based on dateIn for AI suggestion
          const sorted = [...data.items].sort((a, b) => new Date(b.dateIn) - new Date(a.dateIn));
          setLastIntakeItem(sorted[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  useEffect(() => {
    fetchSlots();
    fetchInventory();
  }, []);

  const getAvailableInventory = () => {
    const assignedIds = new Set();
    slots.forEach(s => {
      if (s.item?.id) assignedIds.add(s.item.id);
    });
    interactiveZones.forEach(z => {
      if (z.materials) {
        z.materials.forEach(m => assignedIds.add(m.id));
      }
    });
    return inventoryItems.filter(item => !assignedIds.has(item.id));
  };

  // Find currently selected slot in database state
  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) return null;
    const dbSlot = slots.find(s => s.id === selectedSlotId);
    const room = ROOMS.find(r => r.id === selectedSlotId);
    const customZone = interactiveZones.find(z => z.id === selectedSlotId);
    
    if (customZone) {
      return {
        ...customZone,
        isCustom: true
      };
    }
    return dbSlot || room;
  }, [slots, selectedSlotId, interactiveZones]);

  // Helper to get zone colors per desain.md
  function getZoneColors(zoneId) {
    switch (zoneId) {
      case 'D': return { fill: '#E8F4FC', border: '#2980B9', text: '#1A5276' };
      case 'E': return { fill: '#FADBD8', border: '#E74C3C', text: '#922B21' };
      case 'C': return { fill: '#E8F5EE', border: '#1A7A4A', text: '#0F4F30' };
      case 'A': return { fill: '#FEF9E7', border: '#F39C12', text: '#784212' };
      case 'B': return { fill: '#EBF5FB', border: '#2980B9', text: '#1A5276' };
      default: return { fill: '#FFFFFF', border: '#D5D8DC', text: '#1C2833' };
    }
  }

  function handleSlotClick(slot) {
    setSelectedSlotId(slot.id);
    setSelectedSlotPopup(true);
    setShowAddForm(false);
    setAiSuggestion(null);
  }

  function closePopup() {
    setSelectedSlotPopup(false);
    setShowAddForm(false);
    setAiSuggestion(null);
  }

  function getPlacementSuggestion(cat) {
    let suggestion = 'Zona C (Bahan Umum)';
    if (['Kimia', 'Pengawet'].includes(cat)) suggestion = 'Zona E (Bahan Berbahaya)';
    if (['Susu', 'Cokelat'].includes(cat)) suggestion = 'Zona D (Cold Storage)';
    if (['Tepung', 'Gula'].includes(cat)) suggestion = 'Zona A (Bahan Kering)';
    if (['Minyak', 'Pewarna', 'Essence'].includes(cat)) suggestion = 'Zona B (Bahan Cair)';
    return suggestion;
  }

  // Generate dynamic AI recommendation based on last intake and selected room
  const aiRecommendation = useMemo(() => {
    if (!selectedSlot) return null;
    const room = ROOMS.find(r => r.id === selectedSlotId);
    const isOccupied = selectedSlot.item;

    if (lastIntakeItem && !isOccupied) {
      const suggestedZone = getPlacementSuggestion(lastIntakeItem.category);
      const zoneMatch = suggestedZone.includes(`Zona ${selectedSlot.zone}`);
      return {
        itemName: lastIntakeItem.name,
        category: lastIntakeItem.category,
        suggestion: zoneMatch
          ? `Slot ini cocok untuk "${lastIntakeItem.name}" (${lastIntakeItem.category}). ${suggestedZone} sesuai klasifikasi zona.`
          : `Rekomendasi: Pindahkan "${lastIntakeItem.name}" ke ${suggestedZone}. Slot ini berada di Zona ${selectedSlot.zone}.`,
        canApply: zoneMatch,
        targetSlot: selectedSlotId,
        item: lastIntakeItem
      };
    }

    if (!isOccupied) {
      const zoneNames = { A: 'Bahan Kering', B: 'Bahan Cair', C: 'Bahan Umum', D: 'Cold Storage', E: 'Bahan Berbahaya' };
      return {
        itemName: null,
        category: null,
        suggestion: `Slot ini tersedia untuk item kategori ${zoneNames[selectedSlot.zone] || 'Umum'} berdasarkan klasifikasi zona.`,
        canApply: false,
        targetSlot: selectedSlotId,
        item: null
      };
    }

    return null;
  }, [selectedSlot, selectedSlotId, lastIntakeItem]);

  function handleAddItem() {
    setShowAddForm(true);
    const cat = addData.category || 'Essence';
    setAddData(prev => ({ ...prev, category: cat }));
    const suggestion = getPlacementSuggestion(cat);
    setAiSuggestion(`Saran Penempatan: ${suggestion}`);
  }

  function handleCategoryChange(cat) {
    setAddData({ ...addData, category: cat });
    const suggestion = getPlacementSuggestion(cat);
    setAiSuggestion(`Saran Penempatan: ${suggestion}`);
  }
  // Handle direct database write from Digital Twin Panel
  const handleSaveNewItem = async (e) => {
    e.preventDefault();
    if (!addData.selectedLotId) {
      alert('Silakan pilih material terlebih dahulu!');
      return;
    }

    const invItem = inventoryItems.find(i => i.id === addData.selectedLotId);
    if (!invItem) return;

    try {
      const newItem = {
        id: invItem.id,
        name: invItem.name,
        category: invItem.category,
        qty: invItem.qty,
        unit: invItem.unit,
        maxCapacity: invItem.maxCapacity || 500,
        hasTempSensor: addData.hasTempSensor,
        tempApiUrl: addData.tempApiUrl,
        hasHumidSensor: addData.hasHumidSensor,
        humidApiUrl: addData.humidApiUrl
      };

      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedSlotId, item: newItem })
      });
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots);
        setShowAddForm(false);
        setToast(`Material ${invItem.name} berhasil ditambahkan!`);
        setSelectedSlotPopup(true);
        setShowAddForm(false);
        setAddData({ selectedLotId: '', hasTempSensor: false, tempApiUrl: '', hasHumidSensor: false, humidApiUrl: '' });
        setSearchLotQuery('');
        setAiSuggestion(null);
        fetchSlots();
        fetchLastIntake();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi database.');
    }
  };

  // Handle applying the AI placement suggestion dynamically
  const handleApplyAISuggestion = async () => {
    if (!canEdit() || !aiRecommendation || !aiRecommendation.canApply || !aiRecommendation.item) return;
    setIsApplyingAI(true);
    
    try {
      const item = aiRecommendation.item;
      const targetSlotId = aiRecommendation.targetSlot;

      // Check if slot is already occupied
      const resSlots = await fetch('/api/slots');
      const dataSlots = await resSlots.json();
      const targetSlot = dataSlots.success ? dataSlots.slots.find(s => s.id === targetSlotId) : null;

      if (targetSlot && targetSlot.occupied) {
        setToast(`Gagal: Slot ${targetSlotId} sudah terisi!`);
        setIsApplyingAI(false);
        return;
      }

      const room = ROOMS.find(r => r.id === targetSlotId);
      const payload = {
        id: `INV-AI-${Date.now().toString().slice(-3)}`,
        name: item.name,
        category: item.category,
        qty: item.qty || 100,
        unit: item.unit || 'kg',
        location: targetSlotId,
        zone: room?.zone || 'C',
        dateIn: new Date().toISOString().split('T')[0],
        expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Aman',
        user: { name: user.name, role: user.role }
      };

      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || ''), 'x-user-role': user?.role || 'Operator' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setToast(`AI Suggestion Applied: "${item.name}" ditempatkan di ${room?.name || targetSlotId}!`);
        fetchSlots();
        fetchLastIntake();
      } else {
        alert('Gagal menerapkan rekomendasi AI: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsApplyingAI(false);
    }
  };

  // Handle direct database delete from Digital Twin Panel
  const handleDeleteDefaultZone = (zoneId) => {
    const updated = [...deletedDefaultZones, zoneId];
    setDeletedDefaultZones(updated);
    localStorage.setItem('aromasys_deleted_default_zones', JSON.stringify(updated));
    setSelectedSlotPopup(false);
    setToast('Zona berhasil dihapus!');
  };

  const getFilteredRooms = () => {
    return ROOMS.filter(r => !deletedDefaultZones.includes(r.id));
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!canDelete()) return;
    if (confirm(`Apakah Anda yakin ingin menghapus "${itemName}" dari database?`)) {
      try {
        const res = await fetch(`/api/inventory?id=${itemId}&userName=${encodeURIComponent(user.name)}&userRole=${encodeURIComponent(user.role)}`, {
          method: 'DELETE',
          headers: { 'x-user-id': String(user?.id || ''), 'x-user-role': user?.role || '' }
        });
        const data = await res.json();
        if (data.success) {
          setToast(`Bahan baku ${itemName} berhasil dihapus!`);
          fetchSlots();
          fetchLastIntake();
        } else {
          alert('Gagal menghapus: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi database.');
      }
    }
  };

  // Inline upload handlers
  const handleUploadImageDrop = (e) => {
    e.preventDefault();
    setUploadDragActiveImage(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(png|jpe?g|webp)$/i.test(file.name)) {
      setUploadImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setUploadImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPdfDrop = (e) => {
    e.preventDefault();
    setUploadDragActivePdf(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.pdf$/i.test(file.name)) {
      setUploadPdfFile(file);
    }
  };

  const handleUploadImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setUploadImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPdfChange = (e) => {
    const file = e.target.files[0];
    if (file) setUploadPdfFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadImageFile) return;
    setIsUploading(true);
    try {
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(uploadImageFile);
      });

      let zones = [];

      if (uploadPdfFile) {
        const formData = new FormData();
        formData.append('image', uploadImageFile);
        formData.append('pdf', uploadPdfFile);
        try {
          const res = await fetch('/api/floor-plan-upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success && data.zones) zones = data.zones;
        } catch (err) {
          console.error('PDF processing error:', err);
        }
      }

      const data = {
        imageDataUrl,
        fileName: uploadImageFile.name,
        uploadedAt: new Date().toISOString(),
        zones
      };
      localStorage.setItem('aromasys_floor_plan', JSON.stringify(data));
      setCustomFloorPlan(data);
      setShowUploadPanel(false);
      setUploadImageFile(null);
      setUploadImagePreview(null);
      setUploadPdfFile(null);
      setIsUploading(false);
      setToast('Floor plan uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      setIsUploading(false);
    }
  };

  // Render proper icon inside rooms based on mockups
  function renderRoomIcon(iconType) {
    switch (iconType) {
      case 'snowflake':
        return <Snowflake className="room-bg-icon room-icon-snowflake" size={20} />;
      case 'flame':
        return <Flame className="room-bg-icon room-icon-flame" size={32} />;
      case 'door':
        return <Lock className="room-bg-icon room-icon-door" size={16} />;
      case 'wash':
        return <Droplet className="room-bg-icon room-icon-wash" size={16} />;
      case 'machinery':
        return <ArrowRightLeft className="room-bg-icon room-icon-machinery" size={16} />;
      default:
        return null;
    }
  }

  // Calculate stats for current selected room
  const selectedRoomStats = useMemo(() => {
    if (!selectedSlot) return { qty: 0, capacityPct: 0, occupied: false, materials: [] };
    const materials = selectedSlot.materials || (selectedSlot.item ? [selectedSlot.item] : []);
    
    let totalQty = 0;
    materials.forEach(m => totalQty += (parseFloat(m.qty) || 0));
    
    const capacityPct = Math.min(100, Math.round((totalQty / 500) * 100));
    const hasCritical = materials.some(m => m.status === 'Kritis' || m.status === 'Expired');
    
    return {
      qty: totalQty ? `${totalQty}` : '0',
      capacityPct,
      occupied: materials.length > 0,
      itemName: materials.length > 0 ? materials.map(m => m.name).join(', ') : 'Kosong',
      status: hasCritical ? 'Kritis' : (materials.length > 0 ? 'Aman' : 'N/A'),
      materials
    };
  }, [selectedSlot]);

  // AI Recommendations: check all occupied slots for zone mismatches and critical statuses
  const allRecommendations = useMemo(() => {
    const recommendations = [];
    for (const slot of slots) {
      if (!slot.occupied || !slot.item) continue;
      const item = slot.item;
      const currentZone = slot.zone;
      const suggestedZone = getPlacementSuggestion(item.category);
      // Extract zone letter from suggestion string like "Zona B (Bahan Cair)"
      const suggestedZoneLetter = suggestedZone.match(/Zona ([A-E])/)?.[1];

      // Check zone mismatch
      if (suggestedZoneLetter && suggestedZoneLetter !== currentZone) {
        recommendations.push({
          itemName: item.name,
          suggestion: `Pindahkan "${item.name}" dari Zona ${currentZone} ke ${suggestedZone}`,
          priority: 'high'
        });
      }

      // Check expired/critical status
      if (item.status === 'Expired' || item.status === 'Kritis') {
        recommendations.push({
          itemName: item.name,
          suggestion: `"${item.name}" berstatus ${item.status}. Segera lakukan pengecekan atau pemindahan.`,
          priority: item.status === 'Expired' ? 'critical' : 'medium'
        });
      }
    }
    return recommendations;
  }, [slots]);

  return (
    <div className="floor-plan animate-fade">
      <div className="floor-plan-header">
        <h1 className="page-title" style={{ fontSize: '32px', fontWeight: '700', color: '#202224', fontFamily: "'Poppins', sans-serif", margin: '0' }}>Interactive Floor Plan</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canEdit() && (
            <button className="btn btn-primary btn-sm" onClick={handleAddZoneClick}>
              <Plus size={14} /> Add Zone
            </button>
          )}
          <button className="btn btn-secondary btn-sm upload-floor-plan-btn" onClick={() => setShowUploadPanel(!showUploadPanel)}>
            <Upload size={14} /> Upload Floor Plan
          </button>
        </div>
      </div>

      {showZoneModal && (
        <ZoneDetailsModal 
          zone={editingZoneData} 
          existingMaterials={zoneMaterials}
          onSave={handleSaveZone} 
          onClose={() => setShowZoneModal(false)}
          onAddMaterial={handleAddMaterialToZone}
          onRemoveMaterial={handleRemoveMaterialFromZone}
        />
      )}

      {/* Upload Floor Plan Modal */}
      {showUploadPanel && (
        <div className="fp-modal-backdrop" onClick={() => { setShowUploadPanel(false); setUploadImageFile(null); setUploadImagePreview(null); setUploadPdfFile(null); }}>
          <div className="fp-modal-card animate-scale" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Upload Floor Plan</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowUploadPanel(false); setUploadImageFile(null); setUploadImagePreview(null); setUploadPdfFile(null); }}>
                <X size={16} />
              </button>
            </div>

            <div className="fp-modal-body">
              {/* Left: Image Upload */}
              <div className="fp-modal-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ImageIcon size={18} style={{ color: 'var(--color-brand-primary)' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Floor Plan Image</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>PNG, JPG, or WEBP</p>
                  </div>
                </div>
                {uploadImageFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
                    {uploadImagePreview && <img src={uploadImagePreview} alt="Preview" style={{ width: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />}
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{uploadImageFile.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setUploadImageFile(null); setUploadImagePreview(null); }}>
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className={`upload-drop-zone ${uploadDragActiveImage ? 'drop-zone-active' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setUploadDragActiveImage(true); }}
                    onDragLeave={() => setUploadDragActiveImage(false)}
                    onDrop={handleUploadImageDrop}
                    onClick={() => imageInputRef.current?.click()}
                    style={{ minHeight: '160px' }}
                  >
                    <FileUp size={28} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>Drop image or click to browse</p>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)' }}>PNG, JPG, WEBP (max 10MB)</span>
                    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={handleUploadImageChange} />
                  </div>
                )}
              </div>

              {/* Right: PDF Upload */}
              <div className="fp-modal-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <FileUp size={18} style={{ color: 'var(--color-status-critical)' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Zone Metadata (PDF)</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>Room/zone descriptions</p>
                  </div>
                </div>
                {uploadPdfFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--color-status-critical-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-status-critical)' }}>
                      <FileUp size={24} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{uploadPdfFile.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setUploadPdfFile(null)}>
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className={`upload-drop-zone ${uploadDragActivePdf ? 'drop-zone-active' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setUploadDragActivePdf(true); }}
                    onDragLeave={() => setUploadDragActivePdf(false)}
                    onDrop={handleUploadPdfDrop}
                    onClick={() => pdfInputRef.current?.click()}
                    style={{ minHeight: '160px' }}
                  >
                    <FileUp size={28} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>Drop PDF or click to browse</p>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)' }}>PDF (max 10MB)</span>
                    <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUploadPdfChange} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowUploadPanel(false); setUploadImageFile(null); setUploadImagePreview(null); setUploadPdfFile(null); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!uploadImageFile || isUploading}
                onClick={handleUploadSubmit}
              >
                {isUploading ? 'Uploading...' : 'Upload Floor Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floor Plan Grid — Full Width (no sidebar) */}
      <div className="floor-plan-main card" style={{ background: '#F8FAF9', padding: '24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', gap: '16px', background: '#FFFFFF', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' }}>
            <div className="spinner spinner-lg"></div>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', fontWeight: 500, letterSpacing: '0.02em', animation: 'pulse 2s infinite' }}>Memuat denah gudang live...</p>
          </div>
        ) : customFloorPlan ? (
          <div className="custom-floor-plan-view">
            <div className="custom-floor-plan-image-container" ref={canvasRef} style={{ position: 'relative' }}>
              <img
                src={customFloorPlan.imageDataUrl}
                alt="Custom warehouse floor plan"
                className="custom-floor-plan-image"
              />
              {interactiveZones.map(zone => {
                const isSelected = selectedSlotId === zone.id;
                const isSetup = zone.isSetup;
                const style = isSetup ? {
                    left: `${zone.position.x}%`,
                    top: `${zone.position.y}%`,
                    width: `${zone.position.width}%`,
                    height: `${zone.position.height}%`,
                    position: 'absolute',
                    zIndex: isSelected ? 5 : 2
                } : {
                    left: `${zone.position.x}%`,
                    top: `${zone.position.y}%`,
                    width: `${zone.position.width}%`,
                    height: `${zone.position.height}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                    cursor: canEdit() ? 'move' : 'pointer',
                    border: dragState?.zoneId === zone.id ? '2px dashed #4ade80' : '2px solid rgba(74, 222, 128, 0.4)',
                    position: 'absolute',
                    zIndex: 20
                };

                return isSetup ? (
                  <button
                    key={zone.id}
                    className={`floor-room room-theme-neutral ${zone.materials?.length ? 'room-occupied' : 'room-empty'} ${isSelected ? 'room-selected' : ''}`}
                    onClick={() => handleSlotClick({ id: zone.id, zone: zone.id.split('-')[0] || zone.id, occupied: !!zone.materials?.length, materials: zone.materials })}
                    style={style}
                    title={zone.name}
                  >
                    <div className="room-header-row">
                      <span className="room-name" style={{ fontSize: '10px' }}>{zone.name}</span>
                    </div>
                    {zone.materials?.length > 0 ? (
                      <div className="room-item-details" style={{ marginTop: '2px' }}>
                        <span className="room-item-title" style={{ fontSize: '10px' }}>{zone.materials[0].name} {zone.materials.length > 1 ? `(+${zone.materials.length - 1})` : ''}</span>
                      </div>
                    ) : (
                      <span className="room-empty-label" style={{ fontSize: '9px' }}>Kosong</span>
                    )}
                  </button>
                ) : (
                  <div
                    key={zone.id}
                    className={`floor-plan-hotspot ${isSelected ? 'hotspot-selected' : ''}`}
                    onMouseDown={(e) => handlePointerDown(e, zone, 'move')}
                    style={style}
                    onClick={() => handleSlotClick({ id: zone.id, zone: zone.id.split('-')[0] || zone.id, occupied: false })}
                    title={zone.name}
                  >
                    <span className="hotspot-label" style={{ pointerEvents: 'none' }}>{zone.name}</span>
                    {canEdit() && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }} onMouseDown={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ padding: '2px 8px', fontSize: '10px' }}
                          onClick={(e) => { e.stopPropagation(); handleEditZoneClick(zone); }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ padding: '2px 4px', fontSize: '10px', color: 'var(--color-status-critical)' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    
                    {/* Resize handles */}
                    {canEdit() && (
                      <>
                        <div className="resize-handle top" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-top')} />
                        <div className="resize-handle right" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-right')} />
                        <div className="resize-handle bottom" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-bottom')} />
                        <div className="resize-handle left" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-left')} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="custom-floor-plan-info">
              <ImageIcon size={14} />
              <span>Custom floor plan uploaded {customFloorPlan.uploadedAt ? new Date(customFloorPlan.uploadedAt).toLocaleDateString() : ''}</span>
            </div>
          </div>
        ) : (
          <div className="card fp-map-container" ref={canvasRef} style={{ position: 'relative' }}>
            <div className="floor-layout">
            {getFilteredRooms().map(room => {
              const slot = slots.find(s => s.id === room.id) || { id: room.id, occupied: false, zone: room.zone };
              const item = slot.item;
              const isSelected = selectedSlotId === room.id;
              const capacityPct = item ? Math.min(100, Math.round((item.qty / 500) * 100)) : 0;
              const isDock = room.name === 'LOADING DOCK';

              return (
                <button
                  key={room.id}
                  className={`floor-room room-theme-${room.theme} ${item ? 'room-occupied' : 'room-empty'} ${isSelected ? 'room-selected' : ''}`}
                  onClick={() => handleSlotClick(slot)}
                  style={room.gridStyle}
                >
                  <div className="room-header-row">
                    <span className="room-name">
                      {room.isHazard && <AlertTriangle size={14} style={{ display: 'inline', color: 'var(--color-status-critical)', strokeWidth: 2.5 }} />}
                      {room.name}
                    </span>
                    {room.hasStatusDot && !item && (
                      <span className="room-status-dot">
                        <span className="status-dot-active"></span> Active
                      </span>
                    )}
                  </div>

                  {item ? (
                    <div className="room-item-details">
                      <span className="room-item-title">{item.name}</span>
                    </div>
                  ) : (
                    !isDock && <span className="room-empty-label">Kosong</span>
                  )}

                  {room.hasCapacityBar && item && (
                    <div className="room-capacity-container">
                      <span className="room-capacity-text">Capacity: {capacityPct}%</span>
                      <div className="room-capacity-bar">
                        <div style={{ width: `${capacityPct}%`, background: 'var(--color-brand-primary)' }}></div>
                      </div>
                    </div>
                  )}

                  {renderRoomIcon(room.iconType)}
                </button>
              );
            })}
          </div>

          {/* Interactive Zones Overlay for Default Grid */}
          {interactiveZones.map(zone => {
            const isSelected = selectedSlotId === zone.id;
            const isSetup = zone.isSetup;
            const style = isSetup ? {
                left: `${zone.position.x}%`,
                top: `${zone.position.y}%`,
                width: `${zone.position.width}%`,
                height: `${zone.position.height}%`,
                position: 'absolute',
                zIndex: isSelected ? 5 : 2
            } : {
                left: `${zone.position.x}%`,
                top: `${zone.position.y}%`,
                width: `${zone.position.width}%`,
                height: `${zone.position.height}%`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                cursor: canEdit() ? 'move' : 'pointer',
                border: dragState?.zoneId === zone.id ? '2px dashed #4ade80' : '2px solid rgba(74, 222, 128, 0.4)',
                position: 'absolute',
                zIndex: 20
            };

            return isSetup ? (
              <button
                key={zone.id}
                className={`floor-room room-theme-neutral ${zone.materials?.length ? 'room-occupied' : 'room-empty'} ${isSelected ? 'room-selected' : ''}`}
                onClick={() => handleSlotClick({ id: zone.id, zone: zone.id.split('-')[0] || zone.id, occupied: !!zone.materials?.length, materials: zone.materials })}
                style={style}
                title={zone.name}
              >
                <div className="room-header-row">
                  <span className="room-name" style={{ fontSize: '10px' }}>{zone.name}</span>
                </div>
                {zone.materials?.length > 0 ? (
                  <div className="room-item-details" style={{ marginTop: '2px' }}>
                    <span className="room-item-title" style={{ fontSize: '10px' }}>{zone.materials[0].name} {zone.materials.length > 1 ? `(+${zone.materials.length - 1})` : ''}</span>
                  </div>
                ) : (
                  <span className="room-empty-label" style={{ fontSize: '9px' }}>Kosong</span>
                )}
              </button>
            ) : (
              <div
                key={zone.id}
                className={`floor-plan-hotspot ${isSelected ? 'hotspot-selected' : ''}`}
                onMouseDown={(e) => handlePointerDown(e, zone, 'move')}
                style={style}
                onClick={() => handleSlotClick({ id: zone.id, zone: zone.id.split('-')[0] || zone.id, occupied: false })}
                title={zone.name}
              >
                <span className="hotspot-label" style={{ pointerEvents: 'none' }}>{zone.name}</span>
                {canEdit() && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }} onMouseDown={(e) => e.stopPropagation()}>
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                      onClick={(e) => { e.stopPropagation(); handleEditZoneClick(zone); }}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: '2px 4px', fontSize: '10px', color: 'var(--color-status-critical)' }}
                      onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                
                {/* Resize handles */}
                {canEdit() && (
                  <>
                    <div className="resize-handle top" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-top')} />
                    <div className="resize-handle right" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-right')} />
                    <div className="resize-handle bottom" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-bottom')} />
                    <div className="resize-handle left" onMouseDown={(e) => handlePointerDown(e, zone, 'resize-left')} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* AI Recommendations Section */}
      {allRecommendations.length > 0 && (
        <div className="card fp-recommendations-section">
          <div className="fp-recommendations-header">
            <Bot size={20} />
            <h3>AI Placement Recommendations</h3>
            <span className="fp-recommendations-count">{allRecommendations.length} suggestions</span>
          </div>
          <div className="fp-recommendations-list">
            {allRecommendations.map((rec, i) => (
              <div key={i} className="fp-recommendation-item">
                <div className="fp-rec-icon">
                  <Lightbulb size={16} />
                </div>
                <div className="fp-rec-content">
                  <span className="fp-rec-item-name">{rec.itemName}</span>
                  <span className="fp-rec-text">{rec.suggestion}</span>
                </div>
                <span className={`fp-rec-priority fp-rec-priority-${rec.priority}`}>{rec.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popup Card Overlay — shown on room click */}
      {selectedSlotPopup && selectedSlot && (
        <div className="floor-plan-popup-backdrop" onClick={closePopup}>
          <div className="floor-plan-popup-card" onClick={(e) => e.stopPropagation()}>
            {/* Popup Header */}
            <div className="popup-header">
              <div className="popup-header-left">
                {selectedSlot.id === 'D-1' ? (
                  <Snowflake size={20} className="popup-header-icon" />
                ) : selectedSlot.id === 'E-1' ? (
                  <AlertTriangle size={20} className="popup-header-icon text-danger" />
                ) : (
                  <Package size={20} className="popup-header-icon" />
                )}
                <div>
                  <h3 className="popup-title">
                    {selectedSlot.isCustom ? selectedSlot.name : (ROOMS.find(r => r.id === selectedSlot.id)?.name || selectedSlot.id)}
                  </h3>
                  <span className="popup-subtitle">
                    Zone {selectedSlot.isCustom ? 'Custom' : selectedSlot.zone} • {selectedSlot.id === 'D-1' ? '4°C Maintained' : 'Ambient Temp'}
                  </span>
                </div>
              </div>
              <button className="popup-close-btn" onClick={closePopup}>
                <X size={18} />
              </button>
            </div>

            {canEdit() && (
              <div style={{ padding: '0 20px', marginBottom: '10px', display: 'flex', gap: '8px' }}>
                {selectedSlot.isCustom && (
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      handleEditZoneClick(selectedSlot);
                      closePopup();
                    }}
                  >
                    Edit Details
                  </button>
                )}
                {canDelete() && (
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ color: 'var(--color-status-critical)', flex: 1, border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => {
                      if (selectedSlot.isCustom) {
                        handleDeleteZone(selectedSlot.id);
                        closePopup();
                      } else {
                        handleDeleteDefaultZone(selectedSlot.id);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Delete Zone
                  </button>
                )}
              </div>
            )}

            <div className="popup-divider"></div>

            {/* Capacity Utilization */}
            <div className="popup-capacity-section">
              <div className="popup-capacity-labels">
                <span>Capacity Utilization</span>
                <strong>{selectedRoomStats.capacityPct}% full</strong>
              </div>
              <div className="popup-progress-bar">
                <div style={{ width: `${selectedRoomStats.capacityPct}%`, background: selectedSlot.id === 'E-1' ? 'var(--color-status-critical)' : 'var(--color-brand-primary)' }}></div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="popup-stats-row">
              <div className="popup-stat-box">
                <span className="popup-stat-label">Active Drums</span>
                <span className="popup-stat-value">{selectedRoomStats.qty}</span>
              </div>
              <div className="popup-stat-box">
                <span className="popup-stat-label">Alerts</span>
                <span className="popup-stat-value" style={{ color: selectedRoomStats.status === 'Expired' || selectedRoomStats.status === 'Kritis' ? 'var(--color-status-critical)' : 'inherit' }}>
                  {selectedRoomStats.status === 'Expired' || selectedRoomStats.status === 'Kritis' ? '1' : '0'}
                </span>
              </div>
            </div>

            <div className="popup-divider"></div>

            {/* CRUD Section */}
            <div className="popup-crud-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="popup-info-label" style={{ margin: 0 }}>Item Terdaftar ({selectedRoomStats.materials.length})</span>
                {!showAddForm && canEdit() && (
                  <button className="btn btn-secondary btn-sm" onClick={handleAddItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px' }}>
                    <Plus size={14} /> Add Material
                  </button>
                )}
              </div>
              
              {!showAddForm ? (
                selectedRoomStats.materials.length > 0 ? (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {selectedRoomStats.materials.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--color-border-default)' }}>
                        <div>
                          <strong style={{ fontSize: '13px', display: 'block' }}>{m.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Lot ID: {m.id} | {m.qty} {m.unit}</span>
                        </div>
                        {canEdit() && canDelete() && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-status-critical)', padding: '4px' }} onClick={() => handleDeleteItem(m.id, m.name)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="popup-empty-section">
                    <span className="popup-info-label" style={{ textAlign: 'center', display: 'block' }}>Kosong</span>
                  </div>
                )
              ) : (
                  <form onSubmit={handleSaveNewItem} className="popup-inline-form animate-fade">
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="field-label" htmlFor="popup-name">Nama Material / Lot ID</label>
                      <input
                        id="popup-name"
                        type="text"
                        className="input"
                        placeholder="Cari material atau Lot ID..."
                        value={searchLotQuery}
                        onChange={e => {
                          setSearchLotQuery(e.target.value);
                          setAddData({ ...addData, selectedLotId: '' }); // reset selection if typing
                        }}
                      />
                      {searchLotQuery && !addData.selectedLotId && (
                        <div style={{ marginTop: '8px', maxHeight: '120px', overflowY: 'auto', background: '#fff', border: '1px solid var(--color-border-default)', borderRadius: '4px' }}>
                          {getAvailableInventory()
                            .filter(m => m.name.toLowerCase().includes(searchLotQuery.toLowerCase()) || m.id.toLowerCase().includes(searchLotQuery.toLowerCase()))
                            .map(m => (
                              <div 
                                key={m.id} 
                                style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                                onClick={() => {
                                  setSearchLotQuery(`${m.name} (${m.id})`);
                                  setAddData({ ...addData, selectedLotId: m.id });
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{m.name}</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>Lot ID: {m.id} | Qty: {m.qty} {m.unit}</div>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={addData.hasTempSensor} onChange={e => setAddData({...addData, hasTempSensor: e.target.checked})} />
                        Terdapat Sensor Suhu?
                      </label>
                      {addData.hasTempSensor && (
                        <input type="url" className="input" value={addData.tempApiUrl} onChange={e => setAddData({...addData, tempApiUrl: e.target.value})} placeholder="https://api.sensor.com/temp" style={{ fontSize: '12px' }} />
                      )}
                    </div>

                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input type="checkbox" checked={addData.hasHumidSensor} onChange={e => setAddData({...addData, hasHumidSensor: e.target.checked})} />
                        Terdapat Sensor Humidity?
                      </label>
                      {addData.hasHumidSensor && (
                        <input type="url" className="input" value={addData.humidApiUrl} onChange={e => setAddData({...addData, humidApiUrl: e.target.value})} placeholder="https://api.sensor.com/humidity" style={{ fontSize: '12px' }} />
                      )}
                    </div>

                    <div className="popup-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Simpan</button>
                      <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>Batal</button>
                    </div>
                  </form>
                )}
              </div>

          </div>
        </div>
      )}

      {/* Toast Notification System */}
      {toast && (
        <div className="toast-notification toast-success animate-slide-right">
          <div className="toast-content">
            <Check size={20} className="toast-icon" />
            <span className="toast-message">{toast}</span>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
