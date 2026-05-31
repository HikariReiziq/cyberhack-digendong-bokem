'use client';
import { useState, useCallback } from 'react';
import { Bot, Lightbulb, RefreshCw, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { callAI } from '@/lib/gemini';
import { detectZoneMismatch, CATEGORY_ZONE_MAP, type InteractiveZone } from '@/lib/zones';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { InventoryItem, Slot } from '@/types';

export interface AIRecommendation {
  id: string;
  itemName: string;
  itemId: string;
  suggestion: string;
  targetZone: string;
  targetSlotId?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'placement' | 'mismatch' | 'rotation';
}

export interface CustomFloorPlan {
  imageDataUrl: string;
  fileName?: string;
  uploadedAt?: string;
  zones?: any[];
}

interface AIRecommendationPanelProps {
  slots: Slot[];
  inventoryItems: InventoryItem[];
  selectedSlotId: string | null;
  selectedSlotZone: string | null;
  interactiveZones: InteractiveZone[];
  customFloorPlan: CustomFloorPlan | null;
  activeFloorName: string;
  onApplyRecommendation: (rec: AIRecommendation) => void;
  onToast: (msg: string) => void;
  temperatureData?: Record<string, any>;
}

function getMismatchReasonText(
  itemName: string,
  category: string,
  currentZoneId: string,
  currentZoneName: string,
  recommendedZoneId: string,
  recommendedZoneName: string,
  qty: number,
  unit: string,
  expiry: string
): string {
  const getZoneTemp = (zoneId: string) => {
    const map: Record<string, string> = {
      A: '20°C – 30°C (Bahan Kering)',
      B: '15°C – 25°C (Bahan Cair)',
      C: '18°C – 28°C (Bahan Umum)',
      D: '-5°C – 5°C (Cold Storage)',
      E: '15°C – 25°C (Hazard / Kimia)',
    };
    return map[zoneId] || 'suhu tidak sesuai';
  };

  const currTemp = getZoneTemp(currentZoneId);
  const targetTemp = getZoneTemp(recommendedZoneId);

  let reason = '';
  switch (category) {
    case 'Susu':
      reason = `Susu bubuk/cream memiliki kandungan lemak susu dan protein yang sangat rentan mengalami denaturasi protein dan oksidasi lemak pada suhu hangat. Suhu hangat juga sangat memicu pertumbuhan cepat mikroba pembusuk dan patogen (seperti Salmonella dan Listeria).`;
      break;
    case 'Cokelat':
      reason = `Cokelat bubuk/padat sangat sensitif terhadap panas. Suhu hangat dapat menyebabkan mentega kakao (cocoa butter) mencair dan mengkristal kembali di permukaan saat suhu turun (fenomena fat bloom), merusak tekstur dan memudarkan cita rasanya.`;
      break;
    case 'Kimia':
    case 'Pengawet':
      reason = `Bahan kimia/pengawet memiliki tingkat reaktivitas dan potensi bahaya kontaminasi silang (cross-contamination) yang sangat tinggi bagi bahan pangan jika disimpan di area umum/pangan.`;
      break;
    case 'Tepung':
      reason = `Tepung bersifat sangat higroskopis (mudah menyerap uap air dari udara). Suhu dingin/lembap akan memicu tepung menggumpal (caking), meningkatkan kadar air yang merangsang kapang/jamur berkembang biak, serta mengundang kutu tepung.`;
      break;
    case 'Gula':
      reason = `Gula sangat mudah mencair sebagian (deliquescence) atau menggumpal keras (caking) akibat kelembapan udara yang tidak sesuai.`;
      break;
    case 'Minyak':
      reason = `Minyak goreng/kelapa rentan mengalami hidrolisis dan oksidasi lipid jika terpapar suhu hangat atau cahaya langsung, yang menyebabkan minyak cepat tengik (rancid) dan merusak senyawa asam lemaknya.`;
      break;
    case 'Pewarna':
      reason = `Pewarna makanan cair memerlukan suhu ruang sejuk yang stabil. Suhu ekstrim atau fluktuatif dapat merusak stabilitas emulsi warna, menyebabkan pigmen mengendap, atau membeku.`;
      break;
    case 'Essence':
      reason = `Essence/perisa mengandung senyawa organik volatil yang cepat menguap pada suhu hangat. Hal ini dapat menurunkan konsentrasi aroma secara drastis dalam waktu singkat.`;
      break;
    case 'Rempah':
      reason = `Rempah kering membutuhkan kelembapan rendah dan sirkulasi udara baik. Menyimpannya di suhu dingin/lembap berisiko menurunkan kadar minyak atsiri yang menjadi sumber rasa alami, atau memicu pembusukan jamur.`;
      break;
    default:
      reason = `Penyimpanan di luar zona standar tidak sesuai dengan standar penataan pergudangan GMP (Good Manufacturing Practices) untuk kategori ${category}.`;
  }

  return `Peringatan Ketidakcocokan: Bahan "${itemName}" (${qty} ${unit}, Kedaluwarsa: ${expiry}) saat ini berada di ${currentZoneName} (Suhu Standar: ${currTemp}) yang tidak cocok. Alasan: ${reason} Pindahkan segera ke ${recommendedZoneName} (Suhu Ideal: ${targetTemp}) demi keamanan bahan.`;
}

function getPlacementReasonText(itemName: string, category: string, recommendedZone: string): string {
  const getZoneName = (zoneId: string) => {
    const map: Record<string, string> = {
      A: 'Zona A (Bahan Kering, Suhu: 20°C s/d 30°C)',
      B: 'Zona B (Bahan Cair, Suhu: 15°C s/d 25°C)',
      C: 'Zona C (Bahan Umum, Suhu: 18°C s/d 28°C)',
      D: 'Zona D (Cold Storage, Suhu: -5°C s/d 5°C)',
      E: 'Zona E (Hazard Storage, Suhu: 15°C s/d 25°C)',
    };
    return map[zoneId] || `Zona ${zoneId}`;
  };

  const targetName = getZoneName(recommendedZone);

  let reason = '';
  switch (category) {
    case 'Susu':
      reason = `Disarankan ditempatkan di ${targetName} untuk menghambat denaturasi protein susu dan aktivitas bakteri patogen yang dapat berkembang biak dengan cepat pada suhu hangat di atas 8°C.`;
      break;
    case 'Cokelat':
      reason = `Disarankan ditaruh di ${targetName} guna menjaga lemak cokelat tetap beku dan stabil, mencegah pembentukan fat bloom (noda putih lemak di permukaan) serta mempertahankan tekstur padat cokelat.`;
      break;
    case 'Kimia':
    case 'Pengawet':
      reason = `Wajib ditempatkan di ${targetName} untuk mengisolasi bahan non-pangan dari area bahan pangan pokok guna menghindari kecelakaan kontaminasi silang dan mematuhi regulasi K3 pergudangan.`;
      break;
    case 'Tepung':
      reason = `Disarankan disimpan di ${targetName} yang memiliki tingkat kelembapan rendah. Ini mencegah tepung dari pembentukan gumpalan keras (caking), kontaminasi spora jamur, dan munculnya kutu tepung.`;
      break;
    case 'Gula':
      reason = `Disarankan diletakkan di ${targetName} yang kering guna mencegah pencairan kristal gula (deliquescence) akibat penyerapan uap air dari udara sekitar.`;
      break;
    case 'Minyak':
      reason = `Disarankan ditempatkan di ${targetName} yang sejuk untuk meminimalkan laju oksidasi lemak (lipid oxidation) yang memicu bau tengik dan degradasi nilai nutrisi minyak.`;
      break;
    case 'Pewarna':
      reason = `Disarankan ditaruh di ${targetName} untuk menjaga kestabilan suspensi zat warna aktif agar tidak pecah/mengendap akibat paparan fluktuasi suhu yang drastis.`;
      break;
    case 'Essence':
      reason = `Disarankan disimpan di ${targetName} yang sejuk untuk menekan laju volatilisasi (penguapan) minyak esensial aromatik sehingga aroma bahan tetap pekat dan tahan lama.`;
      break;
    case 'Rempah':
      reason = `Disarankan diletakkan di ${targetName} agar minyak atsiri pembawa aroma alami rempah tidak mudah menguap atau terdegradasi akibat suhu panas.`;
      break;
    default:
      reason = `Disarankan ditempatkan di ${targetName} untuk menyesuaikan klasifikasi standar GMP pergudangan serta memperpanjang masa simpan bahan tanpa merusak kualitas fisiknya.`;
  }

  return `Rekomendasi Penempatan: ${reason}`;
}

export default function AIRecommendationPanel({
  slots,
  inventoryItems,
  selectedSlotId,
  selectedSlotZone,
  interactiveZones,
  customFloorPlan,
  activeFloorName,
  onApplyRecommendation,
  onToast,
  temperatureData = {},
}: AIRecommendationPanelProps) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Generate AI recommendations based on current inventory and zone state
  const generateRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const recs: AIRecommendation[] = [];

      // Load previously applied recommendation IDs to avoid re-showing them
      const appliedIds = new Set<string>(
        JSON.parse(localStorage.getItem('aromasys_applied_recommendations') || '[]')
      );

      // ── Zone & room name maps ─────────────────────────────────────────────
      const ROOMS_MAPPING: Record<string, string> = {
        'A-1': 'LOADING DOCK', 'A-2': 'Equipment Set Up', 'B-1': 'Tray Setting 1',
        'B-2': 'Tray Setting 2', 'D-1': 'Cold Storage', 'C-1': 'Hot Extraction',
        'C-3': 'Non-Production Machinery', 'C-4': 'Locker Room', 'C-5': 'QC & Lab',
        'C-2': 'Packaging & Shipping', 'A-3': 'Receiving', 'E-1': 'Hazard Storage',
      };
      const ZONE_NAME_MAPPING: Record<string, string> = {
        'A': 'Zona A (Bahan Kering, 20–30°C)',
        'B': 'Zona B (Bahan Cair, 15–25°C)',
        'C': 'Zona C (Bahan Umum, 18–28°C)',
        'D': 'Zona D (Cold Storage, -5–5°C)',
        'E': 'Zona E (Hazard Storage, 15–25°C)',
      };
      const ZONE_IDEAL_TEMP: Record<string, string> = {
        A: '20–30°C', B: '15–25°C', C: '18–28°C', D: '-5–5°C', E: '15–25°C',
      };

      // Helper: get real-time temp from sensor data
      const getRealTemp = (zoneId: string): string => {
        const readings = temperatureData[zoneId];
        if (!readings) return 'N/A';
        const arr = Array.isArray(readings) ? readings : [];
        const latest = arr.length > 0 ? arr[arr.length - 1] : null;
        return latest?.temperature !== undefined ? `${latest.temperature}°C` : 'N/A';
      };

      // ── Step 1: Detect raw issues (rule-based, no AI yet) ─────────────────
      interface RawIssue {
        id: string; itemId: string; itemName: string; category: string;
        qty: number; unit: string; expiry: string; status: string;
        currentZoneId: string; currentZoneName: string; currentSlotId: string;
        issueType: 'mismatch' | 'rotation';
        recommendedZoneId: string; recommendedZoneName: string;
        targetSlotId?: string; isCustomZone: boolean;
      }
      const rawIssues: RawIssue[] = [];

      // DB slots
      for (const slot of slots) {
        if (!slot.occupied || !slot.itemId) continue;
        const item = inventoryItems.find(i => i.id === slot.itemId);
        if (!item) continue;

        if (detectZoneMismatch(item.category, slot.zone)) {
          const recZone = CATEGORY_ZONE_MAP[item.category];
          rawIssues.push({
            id: `mismatch-${slot.id}-${item.id}`,
            itemId: item.id, itemName: item.name, category: item.category,
            qty: item.qty, unit: item.unit,
            expiry: (item as any).expiry || '-', status: (item as any).status || '-',
            currentZoneId: slot.zone,
            currentZoneName: ROOMS_MAPPING[slot.id] || `Slot ${slot.id}`,
            currentSlotId: slot.id,
            issueType: 'mismatch',
            recommendedZoneId: recZone,
            recommendedZoneName: ZONE_NAME_MAPPING[recZone] || `Zona ${recZone}`,
            targetSlotId: slot.id, isCustomZone: false,
          });
        }
        if (item.status === 'Expired' || item.status === 'Kritis') {
          rawIssues.push({
            id: `rotation-${item.id}`,
            itemId: item.id, itemName: item.name, category: item.category,
            qty: item.qty, unit: item.unit,
            expiry: (item as any).expiry || '-', status: (item as any).status || '',
            currentZoneId: slot.zone,
            currentZoneName: ROOMS_MAPPING[slot.id] || `Slot ${slot.id}`,
            currentSlotId: slot.id,
            issueType: 'rotation',
            recommendedZoneId: slot.zone, recommendedZoneName: '',
            isCustomZone: false,
          });
        }
      }

      // Custom zones
      for (const z of interactiveZones) {
        if (!z.materials?.length) continue;
        for (const mat of z.materials) {
          const item = inventoryItems.find(i => i.id === mat.id);
          if (!item) continue;
          const zoneLetter = z.zone || z.id.charAt(0);
          if (detectZoneMismatch(item.category, zoneLetter)) {
            const recZone = CATEGORY_ZONE_MAP[item.category];
            rawIssues.push({
              id: `mismatch-${z.id}-${item.id}`,
              itemId: item.id, itemName: item.name, category: item.category,
              qty: item.qty, unit: item.unit,
              expiry: (item as any).expiry || '-', status: (item as any).status || '-',
              currentZoneId: zoneLetter,
              currentZoneName: z.name || `Zona Kustom ${z.id}`,
              currentSlotId: z.id,
              issueType: 'mismatch',
              recommendedZoneId: recZone,
              recommendedZoneName: ZONE_NAME_MAPPING[recZone] || `Zona ${recZone}`,
              targetSlotId: z.id, isCustomZone: true,
            });
          }
        }
      }

      // Deduplicate rawIssues in place — same item can show up in both the slots
      // loop and the custom zones loop when their IDs match, producing duplicate keys.
      const seenIds = new Set<string>();
      const dedupedIssues = rawIssues.filter(issue => {
        if (seenIds.has(issue.id)) return false;
        seenIds.add(issue.id);
        return true;
      });
      rawIssues.length = 0;
      rawIssues.push(...dedupedIssues);

      // ── Step 2: Enrich ALL issues with ONE Gemini call ────────────────────
      let aiSuggestions: Record<string, string> = {};
      if (rawIssues.length > 0) {
        // Build real-time temperature summary
        const tempSummary = Object.entries(temperatureData)
          .map(([zone, readings]: [string, any]) => {
            const arr = Array.isArray(readings) ? readings : [];
            const latest = arr.length > 0 ? arr[arr.length - 1] : null;
            return `Zona ${zone}: suhu terkini ${latest?.temperature ?? 'N/A'}°C (ideal: ${ZONE_IDEAL_TEMP[zone] || 'N/A'})`;
          }).join('\n') || 'Data suhu tidak tersedia.';

        // Build zone occupancy summary
        const zoneOccupancy = interactiveZones.map(z => {
          const mats = z.materials?.map(m => m.name).join(', ') || 'kosong';
          return `- "${z.name || z.id}": ${mats}`;
        }).join('\n') || 'Tidak ada zona kustom.';

        const issueList = rawIssues.map((issue, i) => {
          const realTemp = getRealTemp(issue.currentZoneId);
          const idealTemp = ZONE_IDEAL_TEMP[issue.recommendedZoneId] || ZONE_IDEAL_TEMP[issue.currentZoneId] || 'N/A';
          if (issue.issueType === 'mismatch') {
            return `${i + 1}. [MISMATCH] id="${issue.id}"
   Bahan: "${issue.itemName}" | Kategori: ${issue.category} | Qty: ${issue.qty} ${issue.unit} | Kedaluwarsa: ${issue.expiry} | Status: ${issue.status}
   Lokasi saat ini: ${issue.currentZoneName} (Zona ${issue.currentZoneId}) | Suhu real-time: ${realTemp}
   Zona yang direkomendasikan: ${issue.recommendedZoneName} | Suhu ideal: ${idealTemp}`;
          } else {
            return `${i + 1}. [ROTATION] id="${issue.id}"
   Bahan: "${issue.itemName}" | Kategori: ${issue.category} | Qty: ${issue.qty} ${issue.unit} | Kedaluwarsa: ${issue.expiry} | Status: ${issue.status}
   Lokasi saat ini: ${issue.currentZoneName} (Zona ${issue.currentZoneId}) | Suhu real-time: ${realTemp}`;
          }
        }).join('\n\n');

        const batchPrompt = `Kamu adalah AI WMS AromaSys. Analisis ${rawIssues.length} masalah inventori berikut berdasarkan data denah gudang dan sensor suhu real-time.

=== DATA SUHU REAL-TIME SENSOR ===
${tempSummary}

=== ZONA KUSTOM DENAH SAAT INI ===
${zoneOccupancy}

=== MASALAH YANG PERLU DIANALISIS ===
${issueList}

Untuk setiap masalah di atas, berikan analisis SANGAT INFORMATIF dalam Bahasa Indonesia. Untuk MISMATCH: jelaskan (1) mengapa suhu saat ini BERBAHAYA bagi bahan ini secara ilmiah, (2) risiko spesifik kerusakan bahan di kondisi sekarang (berikan angka/fakta ilmiah), (3) mengapa suhu zona target lebih cocok, (4) urgensi tindakan. Untuk ROTATION: jelaskan (1) kondisi aktual bahan berdasarkan tanggal kedaluwarsa dan suhu zona sekarang, (2) risiko jika dibiarkan (kontaminasi, kerugian finansial estimasi), (3) langkah tindakan konkret yang harus dilakukan segera.

Kembalikan HANYA JSON array seperti ini:
[{"id": "ID_PERSIS_DARI_ATAS", "analysis": "teks analisis panjang dan informatif"}]`;

        try {
          const response = await callAI(batchPrompt, 'floor-plan');
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: { id: string; analysis: string }) => {
                if (item.id && item.analysis) aiSuggestions[item.id] = item.analysis;
              });
            }
          }
        } catch {
          // fallback to rule-based messages (handled below)
        }
      }

      // ── Step 3: Build final recs using AI suggestions or fallback ─────────
      for (const issue of rawIssues) {
        const aiText = aiSuggestions[issue.id];
        if (issue.issueType === 'mismatch') {
          const fallbackText = getMismatchReasonText(
            issue.itemName, issue.category, issue.currentZoneId,
            issue.currentZoneName, issue.recommendedZoneId,
            issue.recommendedZoneName, issue.qty, issue.unit, issue.expiry
          );
          recs.push({
            id: issue.id, itemName: issue.itemName, itemId: issue.itemId,
            suggestion: aiText || fallbackText,
            targetZone: issue.recommendedZoneId,
            targetSlotId: issue.targetSlotId,
            priority: 'high', type: 'mismatch',
          });
        } else {
          const fallbackText = `"${issue.itemName}" berstatus ${issue.status} (kedaluwarsa: ${issue.expiry}). Segera lakukan rotasi stok atau pembuangan dari ${issue.currentZoneName}.`;
          recs.push({
            id: issue.id, itemName: issue.itemName, itemId: issue.itemId,
            suggestion: aiText || fallbackText,
            targetZone: issue.currentZoneId,
            priority: issue.status === 'Expired' ? 'critical' : 'medium',
            type: 'rotation',
          });
        }
      }

      // 2. Generate placement recommendations for unassigned inventory using Gemini
      const assignedIds = new Set<string>();
      slots.forEach(s => { if (s.itemId) assignedIds.add(s.itemId); });
      interactiveZones.forEach(z => {
        if (z.materials) z.materials.forEach(m => assignedIds.add(m.id));
      });
      // Also consider items that have a location set in DB as assigned
      inventoryItems.forEach(item => {
        if (item.location && item.location !== 'UNASSIGNED') assignedIds.add(item.id);
      });

      const unassignedItems = inventoryItems.filter(item => !assignedIds.has(item.id));

      if (unassignedItems.length > 0) {
        // Use Gemini to generate smart placement recommendations
        const latestItems = unassignedItems.slice(0, 8); // Analyze up to 8 items
        const zoneInfo = Object.entries(CATEGORY_ZONE_MAP)
          .reduce((acc, [cat, zone]) => {
            if (!acc[zone]) acc[zone] = [];
            acc[zone].push(cat);
            return acc;
          }, {} as Record<string, string[]>);

        const ZONE_TEMP_RANGES: Record<string, string> = {
          A: '20°C – 30°C (Bahan Kering)',
          B: '15°C – 25°C (Bahan Cair)',
          C: '18°C – 28°C (Bahan Umum)',
          D: '-5°C – 5°C (Cold Storage)',
          E: '15°C – 25°C (Hazard / Kimia)',
        };

        const zoneDescriptions = Object.entries(zoneInfo)
          .map(([zone, cats]) => `Zone ${zone} (${ZONE_TEMP_RANGES[zone] || 'N/A'}): diperuntukkan bagi ${cats.join(', ')}`)
          .join('\n');

        // Full inventory context including quantities, expiry, status
        const itemsList = latestItems
          .map(item => {
            const expiryInfo = (item as any).expiry ? `, expiry: ${(item as any).expiry}` : '';
            const statusInfo = (item as any).status ? `, status: ${(item as any).status}` : '';
            return `- ${item.name} (kategori: ${item.category}, qty: ${item.qty} ${item.unit}${expiryInfo}${statusInfo})`;
          })
          .join('\n');

        // Full current occupancy of all custom zones
        const zonesContextText = interactiveZones.map(z => {
          const materialsText = z.materials && z.materials.length > 0
            ? z.materials.map(m => `  - ${m.name} (Qty: ${m.qty} ${m.unit}, ID: ${m.id})`).join('\n')
            : '  - Kosong';
          return `- Zone "${z.name}" (ID: ${z.id}, Position x: ${Math.round(z.position.x)}%, y: ${Math.round(z.position.y)}%, w: ${Math.round(z.position.width)}%, h: ${Math.round(z.position.height)}%):\n${materialsText}`;
        }).join('\n');

        // Current assigned items summary for context
        const assignedSummary = inventoryItems
          .filter(item => assignedIds.has(item.id))
          .slice(0, 10)
          .map(item => `- ${item.name} (${item.category}) → ${item.location || item.zone || 'N/A'}`)
          .join('\n');

        // Build real-time temperature summary from temperatureData
        const tempSummaryLines = Object.entries(temperatureData).map(([zone, readings]: [string, any]) => {
          const arr = Array.isArray(readings) ? readings : [];
          const latest = arr.length > 0 ? arr[arr.length - 1] : null;
          const tempVal = latest?.temperature ?? 'N/A';
          return `Zona ${zone}: suhu terkini ${tempVal}°C`;
        });
        const tempSummary = tempSummaryLines.length > 0
          ? tempSummaryLines.join('\n')
          : 'Data suhu real-time tidak tersedia saat ini.';

        let prompt = `Kamu adalah AI penempatan gudang WMS AromaSys. Kamu menganalisis layout gudang bernama "${activeFloorName}".`;
        
        if (customFloorPlan?.imageDataUrl) {
          prompt += `\nDenah gambar blueprint telah dilampirkan. Perhatikan posisi zona-zona yang terlihat pada gambar.`;
        }

        prompt += `\n\n=== ZONA INTERAKTIF PADA DENAH DAN ISINYA ===\n${zonesContextText || 'Tidak ada zona khusus yang dikonfigurasi.'}`;
        
        prompt += `\n\n=== KLASIFIKASI ZONA STANDAR DAN SUHU ===\n${zoneDescriptions}`;

        prompt += `\n\n=== SUHU REAL-TIME ZONA SAAT INI (DARI SENSOR) ===\n${tempSummary}\n(Gunakan data suhu real-time ini untuk menentukan zona mana yang sedang beroperasi sesuai/tidak sesuai suhu ideal bahan.)`;

        if (assignedSummary) {
          prompt += `\n\n=== ITEM YANG SUDAH DITEMPATKAN ===\n${assignedSummary}`;
        }
        
        prompt += `\n\n=== ITEM BELUM DITEMPATKAN (PERLU REKOMENDASI) ===\n${itemsList}`;
        
        prompt += `\n\nBerdasarkan data inventaris aktual di atas, denah blueprint, zona interaktif, dan suhu masing-masing zona, berikan rekomendasi penempatan untuk setiap item yang belum ditempatkan. Respond dengan JSON array, setiap objek memiliki field:
- itemName (string, harus sama persis dengan nama item)
- targetZone (string, nama zona interaktif misalnya "Cold Storage" atau huruf A-E)
- reason (string, penjelasan SANGAT INFORMATIF dalam Bahasa Indonesia. Wajib menyebutkan: (1) suhu ideal penyimpanan untuk kategori bahan ini, (2) jumlah stok aktual dan tanggal kedaluwarsa item ini, (3) mengapa zona lain TIDAK cocok dengan penjelasan ilmiah/operasional risiko kerusakan spesifik seperti pertumbuhan bakteri, fat bloom, caking, oksidasi lemak, kontaminasi K3, dll, (4) rekomendasi zona yang paling aman dan alasannya).

Kembalikan HANYA JSON array.`;

        try {
          const response = await callAI(prompt, 'floor-plan', customFloorPlan?.imageDataUrl || undefined);
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              for (const rec of parsed) {
                const matchingItem = latestItems.find(
                  i => i.name.toLowerCase() === (rec.itemName || '').toLowerCase()
                );
                if (matchingItem) {
                  // Find if targetZone points to a custom zone name
                  const matchedCustomZone = interactiveZones.find(
                    z => z.name.toLowerCase() === (rec.targetZone || '').toLowerCase()
                  );

                  recs.push({
                    id: `placement-${matchingItem.id}`,
                    itemName: matchingItem.name,
                    itemId: matchingItem.id,
                    suggestion: rec.reason || `Tempatkan "${matchingItem.name}" di Zona ${rec.targetZone}`,
                    targetZone: matchedCustomZone ? matchedCustomZone.name : (rec.targetZone || CATEGORY_ZONE_MAP[matchingItem.category] || 'C'),
                    targetSlotId: matchedCustomZone ? matchedCustomZone.id : undefined,
                    priority: 'medium',
                    type: 'placement',
                  });
                }
              }
            }
          }
        } catch (err) {
          // Fallback: use CATEGORY_ZONE_MAP for recommendations when AI is unavailable
          for (const item of latestItems) {
            const targetZone = CATEGORY_ZONE_MAP[item.category] || 'C';
            recs.push({
              id: `placement-${item.id}`,
              itemName: item.name,
              itemId: item.id,
              suggestion: getPlacementReasonText(item.name, item.category, targetZone),
              targetZone,
              priority: 'medium',
              type: 'placement',
            });
          }
        }
      }

      // 3. If a specific empty slot is selected, generate targeted recommendation
      if (selectedSlotId && selectedSlotZone) {
        const slotData = slots.find(s => s.id === selectedSlotId);
        const isEmptySlot = slotData && !slotData.occupied;
        const isEmptyCustomZone = interactiveZones.find(
          z => z.id === selectedSlotId && (!z.materials || z.materials.length === 0)
        );

        if (isEmptySlot || isEmptyCustomZone) {
          // Find the best item for this zone
          const zoneCategories = Object.entries(CATEGORY_ZONE_MAP)
            .filter(([, zone]) => zone === selectedSlotZone)
            .map(([cat]) => cat);

          const bestItem = unassignedItems.find(item => zoneCategories.includes(item.category));
          if (bestItem) {
            // Remove any existing placement rec for this item to avoid duplicates
            const existingIdx = recs.findIndex(r => r.id === `placement-${bestItem.id}`);
            if (existingIdx >= 0) recs.splice(existingIdx, 1);

            recs.unshift({
              id: `slot-${selectedSlotId}-${bestItem.id}`,
              itemName: bestItem.name,
              itemId: bestItem.id,
              suggestion: getPlacementReasonText(bestItem.name, bestItem.category, selectedSlotZone),
              targetZone: selectedSlotZone,
              targetSlotId: selectedSlotId,
              priority: 'high',
              type: 'placement',
            });
          }
        }
      }

      // Filter applied and deduplicate by id before saving to state
      const filteredRecs = recs.filter(r => !appliedIds.has(r.id));
      const uniqueRecs = [...new Map(filteredRecs.map(r => [r.id, r])).values()];
      setRecommendations(uniqueRecs);
      setLastGeneratedAt(new Date().toLocaleTimeString('id-ID'));
      setHasGenerated(true);
    } catch (err) {
      console.error('Failed to generate AI recommendations:', err);
      onToast('Gagal menghasilkan rekomendasi AI. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [slots, inventoryItems, selectedSlotId, selectedSlotZone, interactiveZones, onToast, temperatureData]);

  // Recommendations are generated on-demand via button click (no auto-generation)

  // Apply a recommendation — write placement to backend AND persist to DB
  const handleApply = async (rec: AIRecommendation) => {
    setApplyingId(rec.id);
    try {
      // Check if target is a custom zone
      const customZone = interactiveZones.find(z => z.id === rec.targetSlotId || z.name.toLowerCase() === rec.targetZone.toLowerCase());

      const persistApplied = (recId: string) => {
        const prev = JSON.parse(localStorage.getItem('aromasys_applied_recommendations') || '[]');
        if (!prev.includes(recId)) {
          localStorage.setItem('aromasys_applied_recommendations', JSON.stringify([...prev, recId]));
        }
      };

      if (customZone) {
        // It's a custom zone — pass to parent AND persist location in DB
        try {
          const invItem = inventoryItems.find(i => i.id === rec.itemId);
          if (invItem) {
            await api.put('/inventory', {
              id: invItem.id,
              name: invItem.name,
              category: invItem.category,
              qty: invItem.qty,
              unit: invItem.unit,
              location: customZone.id,
              zone: rec.targetZone.length === 1 ? rec.targetZone : (invItem as any).zone || 'C',
              dateIn: (invItem as any).dateIn || new Date().toISOString().split('T')[0],
              expiry: (invItem as any).expiry || new Date().toISOString().split('T')[0],
              status: (invItem as any).status || 'Aman',
              user: { name: user?.name || 'Admin', role: user?.role || 'Admin' }
            });
          }
        } catch { /* DB update is best-effort; local update always proceeds */ }
        persistApplied(rec.id);
        onApplyRecommendation(rec);
        setRecommendations(prev => prev.filter(r => r.id !== rec.id));
        return;
      }

      if (rec.type === 'placement' && rec.targetSlotId) {
        // Write placement to backend API
        const res = await api.post<{ success: boolean; slots?: Slot[] }>('/slots', {
          id: rec.targetSlotId,
          item: { id: rec.itemId },
        });
        if (res.success) {
          persistApplied(rec.id);
          onToast(`✓ "${rec.itemName}" berhasil ditempatkan di slot ${rec.targetSlotId}`);
          onApplyRecommendation(rec);
          setRecommendations(prev => prev.filter(r => r.id !== rec.id));
        }
      } else if (rec.type === 'placement' && !rec.targetSlotId) {
        // Find an empty slot in the target zone
        const emptySlot = slots.find(s => s.zone === rec.targetZone && !s.occupied);
        if (emptySlot) {
          const res = await api.post<{ success: boolean; slots?: Slot[] }>('/slots', {
            id: emptySlot.id,
            item: { id: rec.itemId },
          });
          if (res.success) {
            persistApplied(rec.id);
            onToast(`✓ "${rec.itemName}" berhasil ditempatkan di Zona ${rec.targetZone} (Slot ${emptySlot.id})`);
            onApplyRecommendation(rec);
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
          }
        } else {
          onToast(`Tidak ada slot kosong di Zona ${rec.targetZone}`);
        }
      } else {
        // For mismatch/rotation, just notify
        persistApplied(rec.id);
        onApplyRecommendation(rec);
        setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      }
    } catch (err) {
      onToast('Gagal menerapkan rekomendasi. Silakan coba lagi.');
    } finally {
      setApplyingId(null);
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical': return { badge: 'bg-red-100 text-red-800', icon: 'bg-red-50 text-red-700' };
      case 'high': return { badge: 'bg-amber-100 text-amber-800', icon: 'bg-amber-50 text-amber-600' };
      case 'medium': return { badge: 'bg-blue-100 text-blue-800', icon: 'bg-blue-50 text-blue-600' };
      default: return { badge: 'bg-stone-100 text-stone-600', icon: 'bg-stone-50 text-stone-500' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mismatch': return <AlertTriangle className="w-4 h-4" />;
      case 'rotation': return <RefreshCw className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  if (!hasGenerated && !isLoading) {
    return (
      <div className="bg-[#F5FBF3] rounded-2xl border border-[#AAE970]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] p-5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2C742F]/15 rounded-lg flex justify-center items-center shrink-0 text-[#2C742F]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-green-950 text-sm">AI Placement Recommendations</h3>
              <p className="text-[10px] font-bold text-stone-500">Analisis penempatan optimal berdasarkan inventaris dan zona</p>
            </div>
          </div>
          <button
            onClick={generateRecommendations}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2C742F] text-white text-xs font-bold hover:bg-[#366306] transition-all shadow-sm active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate with AI
          </button>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0 && !isLoading) return null;

  return (
    <div className="bg-[#F5FBF3] rounded-2xl border border-[#AAE970]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] p-5 space-y-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2C742F]/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#2C742F]/15 rounded-lg flex justify-center items-center shrink-0 text-[#2C742F]">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-green-950 text-sm">AI Placement Recommendations</h3>
            <p className="text-[10px] font-bold text-stone-500">
              {isLoading ? 'Generating...' : `${recommendations.length} action points`}
              {lastGeneratedAt && !isLoading && ` • Updated ${lastGeneratedAt}`}
            </p>
          </div>
        </div>
        <button
          onClick={generateRecommendations}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-white text-[10px] font-bold text-[#2C742F] hover:bg-stone-50 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-6 gap-3">
          <Sparkles className="w-5 h-5 text-[#2C742F] animate-pulse" />
          <p className="text-xs font-semibold text-stone-500">AI sedang menganalisis penempatan optimal...</p>
        </div>
      )}

      {/* Zone Mismatch Warnings */}
      {!isLoading && recommendations.filter(r => r.type === 'mismatch').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Zone Mismatch Warnings</span>
          </div>
          <div className="space-y-1.5">
            {[...new Map(recommendations.filter(r => r.type === 'mismatch').map(r => [r.id, r])).values()].map(rec => (
              <div key={rec.id} className="flex items-center justify-between gap-2 text-[10px] font-semibold text-amber-700 bg-white/60 rounded-lg px-2.5 py-1.5">
                <span className="flex-1">{rec.suggestion}</span>
                <button
                  onClick={() => handleApply(rec)}
                  disabled={applyingId === rec.id}
                  className="shrink-0 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full text-[9px] font-bold transition-all disabled:opacity-50"
                >
                  {applyingId === rec.id ? '...' : 'Fix'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...new Map(recommendations.filter(r => r.type !== 'mismatch').map(r => [r.id, r])).values()].map(rec => {
            const styles = getPriorityStyles(rec.priority);
            return (
              <div key={rec.id} className="flex gap-3 p-3 bg-white rounded-xl border border-stone-100 hover:border-[#2C742F]/20 transition-all relative overflow-hidden group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.icon}`}>
                  {getTypeIcon(rec.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-800 truncate">{rec.itemName}</p>
                  <p className="text-[10px] font-semibold text-stone-500 mt-0.5 leading-normal line-clamp-2">{rec.suggestion}</p>
                  <button
                    onClick={() => handleApply(rec)}
                    disabled={applyingId === rec.id}
                    className="mt-2 flex items-center gap-1 px-2.5 py-1 bg-[#2C742F]/10 hover:bg-[#2C742F]/20 text-[#2C742F] rounded-full text-[9px] font-bold transition-all disabled:opacity-50 active:scale-95"
                  >
                    {applyingId === rec.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {applyingId === rec.id ? 'Applying...' : 'Apply'}
                  </button>
                </div>
                <span className={`absolute top-2 right-2 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${styles.badge}`}>
                  {rec.priority}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
