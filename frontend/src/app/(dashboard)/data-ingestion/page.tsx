'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { callAI } from '@/lib/gemini';
import { OcrItem, UploadRecord, InventoryItem, createUploadRecord, isDuplicate } from '@/lib/ocr';
import { api } from '@/lib/api';
import Portal from '@/components/Portal';
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  Pencil,
  Trash2,
  Loader2,
  RotateCcw,
  History,
  Clock
} from 'lucide-react';
import './upload.css';

const OCR_PROMPT = `Extract inventory/material data from this document image. Return a JSON array where each item has: name (string), category (string - one of: Kimia, Pengawet, Susu, Cokelat, Tepung, Gula, Minyak, Pewarna, Essence, Rempah), qty (number), unit (string - kg, L, pcs, etc.), lotNumber (string), location (string - slot ID if visible), expiry (string - YYYY-MM-DD format), confidence (number 0-1). Return ONLY the JSON array.`;

interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  errorMsg: string;
}

export default function DataIngestionPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Main state
  const [ocrResult, setOcrResult] = useState<OcrItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);

  // Modal & queue state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const fileQueueRef = useRef<FileQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Sync ref with fileQueue state to avoid stale closures
  useEffect(() => {
    fileQueueRef.current = fileQueue;
  }, [fileQueue]);
  const [processedFileNames, setProcessedFileNames] = useState<string[]>([]);

  // Row editing
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<OcrItem>>({});

  // Ingestion history state
  const [ingestionHistory, setIngestionHistory] = useState<UploadRecord[]>([]);

  // Duplicate detection state
  const [existingInventory, setExistingInventory] = useState<InventoryItem[]>([]);

  // Load ingestion history from DB on mount
  useEffect(() => {
    api.get<{ success: boolean; records: any[] }>('/ingestion-history')
      .then(data => {
        if (data.success) {
          setIngestionHistory(data.records.map(r => ({
            id: r.id,
            fileName: r.fileName,
            fileSize: r.fileSize || '',
            category: r.category || 'OCR Scan',
            recordCount: r.recordCount || 0,
            uploadedBy: r.uploadedBy || '',
            uploadedAt: r.uploadedAt,
            status: r.status as UploadRecord['status'],
            notes: r.notes || '',
          })));
        }
      })
      .catch(() => {
        // Fallback ke localStorage jika API gagal
        try {
          const stored = localStorage.getItem('aromasys_ingestion_history');
          if (stored) setIngestionHistory(JSON.parse(stored));
        } catch {}
      });
  }, []);

  // Fetch existing inventory once when first OCR results arrive (not on every edit)
  const inventoryFetchedRef = useRef(false);
  useEffect(() => {
    if (ocrResult.length === 0) { inventoryFetchedRef.current = false; return; }
    if (inventoryFetchedRef.current) return; // already fetched for this batch
    inventoryFetchedRef.current = true;

    api.get<{ success: boolean; items: Array<{ name: string; id?: string; lotNumber?: string }> }>('/inventory')
      .then(data => {
        if (data.success && Array.isArray(data.items)) {
          setExistingInventory(data.items.map(item => ({
            name: item.name,
            lotNumber: item.id || item.lotNumber || '',
          })));
        }
      })
      .catch(() => {}); // non-critical
  }, [ocrResult.length]);

  // Processing state
  const processingRef = useRef(false);

  // --- Structured Data CSV Processing ---
  const parseCsvDirectly = (csvText: string): OcrItem[] => {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Remove BOM if present
    const header = lines[0].replace(/^\uFEFF/, '').toLowerCase();
    const results: OcrItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      let cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cells.length < 3) {
        cells = lines[i].split(';').map(c => c.replace(/^"|"$/g, '').trim());
      }
      if (cells.length < 3) continue;

      // Try to extract meaningful data from CSV columns
      const name = cells[1] || cells[0] || '';
      const category = cells[2] || 'Kimia';
      const qtyStr = cells[3] || '0';
      const qty = parseFloat(qtyStr.replace(/[^\d.]/g, '')) || 0;
      const unit = (cells[3] || '').replace(/[\d.]/g, '').trim() || 'kg';
      const expiry = cells[6] || cells[5] || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const lotNumber = cells[0] || `LOT-${i}`;

      if (name && name !== 'Nama Bahan' && name !== 'name' && name !== 'Nama') {
        results.push({
          name,
          category: ['Tepung', 'Gula', 'Minyak', 'Pewarna', 'Essence', 'Pengawet', 'Susu', 'Cokelat', 'Rempah', 'Kimia'].includes(category) ? category : 'Kimia',
          qty: qty || 1,
          unit: ['kg', 'L', 'liter', 'pcs', 'box', 'karung', 'drum'].includes(unit) ? unit : 'kg',
          expiry,
          confidence: 0.90, // high confidence for structured data
          lotNumber
        });
      }
    }
    return results;
  };

  // --- OCR Processing - Single File (Fallback) ---
  const processOneFile = async (file: File): Promise<OcrItem[]> => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

    if (!isImage && !isPdf && !isCsv) {
      throw new Error('Unsupported file format. Please upload JPG, PNG, PDF, or CSV files.');
    }

    if (isCsv) {
      const textContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
      return parseCsvDirectly(textContent);
    }

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
    const responseText = await callAI(OCR_PROMPT, 'ocr', base64Data, mimeType);

    // Parse JSON from response, stripping markdown code blocks if present
    let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    if (!Array.isArray(parsed)) {
      throw new Error('AI returned invalid format. Expected a JSON array.');
    }

    // Normalize confidence to 0-1 range if returned as 0-100
    return parsed.map((item: Record<string, unknown>) => ({
      name: String(item.name || ''),
      category: String(item.category || 'Kimia'),
      qty: Number(item.qty) || 0,
      unit: String(item.unit || 'kg'),
      lotNumber: String(item.lotNumber || ''),
      location: String(item.location || ''),
      expiry: String(item.expiry || ''),
      confidence: Number(item.confidence) > 1 ? Number(item.confidence) / 100 : Number(item.confidence) || 0.5,
    }));
  };

  // --- OCR Processing (BATCH MODE) ---
  const processFileBatch = async (files: FileQueueItem[]): Promise<Map<string, OcrItem[]>> => {
    const results = new Map<string, OcrItem[]>();
    
    if (files.length === 0) return results;

    // Filter out CSV files to process them locally
    const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv') || f.file.type === 'text/csv');
    const nonCsvFiles = files.filter(f => !f.name.toLowerCase().endsWith('.csv') && f.file.type !== 'text/csv');

    // Process CSV files locally
    for (const queueItem of csvFiles) {
      try {
        const textContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(queueItem.file);
        });
        const items = parseCsvDirectly(textContent);
        results.set(queueItem.id, items);
      } catch (err) {
        results.set(queueItem.id, []);
      }
    }

    if (nonCsvFiles.length === 0) {
      return results;
    }

    if (nonCsvFiles.length === 1) {
      // Single non-CSV file - use processOneFile
      try {
        const items = await processOneFile(nonCsvFiles[0].file);
        results.set(nonCsvFiles[0].id, items);
      } catch (err) {
        results.set(nonCsvFiles[0].id, []);
      }
      return results;
    }

    // Batch processing: convert all files to base64 and send in single API call
    const fileDataList: Array<{ id: string; name: string; base64: string; mimeType: string }> = [];
    
    try {
      for (const queueItem of nonCsvFiles) {
        const isImage = queueItem.file.type.startsWith('image/');
        const isPdf = queueItem.file.type === 'application/pdf';

        if (!isImage && !isPdf) {
          throw new Error(`Unsupported format: ${queueItem.name}`);
        }

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(queueItem.file);
        });

        fileDataList.push({
          id: queueItem.id,
          name: queueItem.name,
          base64: base64Data,
          mimeType: queueItem.file.type || (isPdf ? 'application/pdf' : 'image/jpeg')
        });
      }

      // Build batch prompt - more context-aware
      const inventoryContext = existingInventory.length > 0 
        ? `\n\nEksisting inventory untuk duplicate detection:\n${existingInventory.slice(0, 10).map(i => `- ${i.name} (LOT: ${i.lotNumber})`).join('\n')}`
        : '';

      const batchPrompt = `Batch OCR Processing - Extract inventory/material data from ${nonCsvFiles.length} documents.

For EACH document, return a JSON array of extracted items.
Return a JSON object with keys being the filename (without path), values being arrays of items.

Each item must have: name, category (one of: Kimia, Pengawet, Susu, Cokelat, Tepung, Gula, Minyak, Pewarna, Essence, Rempah), qty, unit, lotNumber, location, expiry (YYYY-MM-DD), confidence (0-1).

Important:
- Extract ALL items from EVERY document
- Use confidence score to indicate extraction certainty
- Standardize unit names (kg, L, pcs, dll)
- If expiry date cannot be read clearly, estimate based on standard shelf life
- Cross-reference with existing items: if name+lot matches, mark confidence higher
${inventoryContext}

Return ONLY valid JSON object in this format:
{
  "document1.pdf": [{"name": "...", "category": "...", ...}],
  "document2.jpg": [{"name": "...", "category": "...", ...}]
}`;

      // Prepare Gemini request with multiple images
      const parts: any[] = [{ text: batchPrompt }];
      
      for (const fileData of fileDataList) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.base64
          }
        });
      }

      // Call Gemini with batch processing
      const response = await callAI(batchPrompt, 'ocr', undefined, 'image/jpeg');
      
      // Parse batch response
      let cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const batchResults = JSON.parse(cleanResponse);

      // Distribute results to each file
      for (const fileData of fileDataList) {
        const fileKey = fileData.name;
        const items = batchResults[fileKey] || [];
        
        // Normalize each item
        const normalizedItems = (Array.isArray(items) ? items : []).map((item: Record<string, unknown>) => ({
          name: String(item.name || ''),
          category: String(item.category || 'Kimia'),
          qty: Number(item.qty) || 0,
          unit: String(item.unit || 'kg'),
          lotNumber: String(item.lotNumber || ''),
          location: String(item.location || ''),
          expiry: String(item.expiry || ''),
          confidence: Number(item.confidence) > 1 ? Number(item.confidence) / 100 : Number(item.confidence) || 0.5,
        }));

        results.set(fileData.id, normalizedItems);
      }
    } catch (err: unknown) {
      // If batch fails, fallback to individual processing
      for (const queueItem of nonCsvFiles) {
        try {
          const items = await processOneFile(queueItem.file);
          results.set(queueItem.id, items);
        } catch {
          results.set(queueItem.id, []);
        }
      }
    }

    return results;
  };

  // --- File Queue Helpers ---
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileTypeBadge(name: string): { label: string; className: string } {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { label: 'PDF', className: 'upload-queue-badge-pdf' };
    if (ext === 'jpg' || ext === 'jpeg') return { label: 'JPG', className: 'upload-queue-badge-jpg' };
    if (ext === 'png') return { label: 'PNG', className: 'upload-queue-badge-jpg' };
    return { label: ext.toUpperCase(), className: 'upload-queue-badge-csv' };
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Add files to queue with size validation
  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    setFileQueue(prev => {
      const newItems: FileQueueItem[] = [];
      const oversized: string[] = [];

      Array.from(files).forEach(f => {
        if (f.size > MAX_FILE_SIZE) {
          oversized.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
          return;
        }

        newItems.push({
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          name: f.name,
          size: f.size,
          status: 'pending' as const,
          progress: 0,
          errorMsg: ''
        });
      });

      if (oversized.length > 0) {
        setError(`File berikut melebihi batas 10MB: ${oversized.join(', ')}`);
      }

      return [...prev, ...newItems];
    });
  }, []);

  // Remove file from queue
  const removeFromQueue = useCallback((id: string) => {
    setFileQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  // Retry a failed file in queue
  const retryQueueFile = useCallback((id: string) => {
    setFileQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'pending' as const, progress: 0, errorMsg: '' } : item
    ));
  }, []);

  // Process all pending files in queue using BATCH MODE for efficiency
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Loop continuously as long as there are pending files in the latest queue to prevent hanging/stuck files
    while (true) {
      const pending = fileQueueRef.current.filter(item => item.status === 'pending');
      if (pending.length === 0) {
        break;
      }

      // Split into batches of max 3 files per batch for optimal API response
      const BATCH_SIZE = 3;
      const batch = pending.slice(0, BATCH_SIZE);

      // Mark all files in batch as uploading
      batch.forEach(queueItem => {
        setFileQueue(prev => prev.map(item =>
          item.id === queueItem.id ? { ...item, status: 'uploading' as const, progress: 0 } : item
        ));
      });

      // Simulate progress for all files in batch simultaneously
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 12 + 3, 90);
        batch.forEach(queueItem => {
          setFileQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, progress: Math.round(progress) } : item
          ));
        });
      }, 500);

      try {
        // Process entire batch in single Gemini call
        const batchResults = await processFileBatch(batch);
        clearInterval(progressInterval);

        // Process each file's results
        for (const queueItem of batch) {
          const resData = batchResults.get(queueItem.id) || [];

          if (Array.isArray(resData) && resData.length > 0) {
            setOcrResult(prev => {
              const combined = [...prev, ...resData];
              // Deduplicate staging items by name and lotNumber
              const unique = combined.filter((item, index, self) =>
                self.findIndex(t => 
                  t.name.toLowerCase().trim() === item.name.toLowerCase().trim() && 
                  t.lotNumber.toLowerCase().trim() === item.lotNumber.toLowerCase().trim()
                ) === index
              );
              return unique;
            });
            setProcessedFileNames(prev => {
              const combined = [...prev, queueItem.name];
              return Array.from(new Set(combined)); // unique file names
            });
            setFileQueue(prev => prev.map(item =>
              item.id === queueItem.id ? { ...item, status: 'done' as const, progress: 100 } : item
            ));
            setError(null);
          } else {
            setFileQueue(prev => prev.map(item =>
              item.id === queueItem.id ? { ...item, status: 'error' as const, progress: 0, errorMsg: 'No data extracted from file' } : item
            ));
          }
        }
      } catch (err: unknown) {
        clearInterval(progressInterval);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        const isAIUnavailable = errorMsg.includes("All Gemini models failed") || errorMsg.includes("NEXT_PUBLIC_GEMINI_API_KEY");
        const displayError = isAIUnavailable
          ? `Layanan AI/OCR sedang tidak tersedia. Anda dapat memasukkan data secara manual melalui halaman Inventory, atau coba lagi nanti.`
          : `Failed to extract data from batch: ${errorMsg}. Silakan coba lagi atau masukkan data secara manual.`;
        setError(displayError);
        
        batch.forEach(queueItem => {
          setFileQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, status: 'error' as const, progress: 0, errorMsg } : item
          ));
          setRetryFile(queueItem.file);
        });
      }
    }

    setSaved(false);
    processingRef.current = false;
  }, [processFileBatch]);

  // Auto-start processing when there are pending files
  useEffect(() => {
    const hasPending = fileQueue.some(item => item.status === 'pending');
    const hasUploading = fileQueue.some(item => item.status === 'uploading');

    if (hasPending && !hasUploading && !processingRef.current) {
      processQueue();
    }
  }, [fileQueue, processQueue]);

  // --- Event Handlers ---
  const handleCloseModal = () => setShowUploadModal(false);

  function handleModalDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) addFilesToQueue(files);
  }

  function handleModalFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) addFilesToQueue(files);
    e.target.value = '';
  }

  function handleInlineDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      addFilesToQueue(files);
      setShowUploadModal(true);
    }
  }

  // Retry failed extraction
  const handleRetry = () => {
    if (retryFile) {
      setError(null);
      addFilesToQueue([retryFile]);
      setRetryFile(null);
    }
  };

  // --- Row Editing ---
  const handleStartEditRow = (index: number, item: OcrItem) => {
    setEditIndex(index);
    setEditFormData({ ...item });
  };

  const handleSaveEditRow = (index: number) => {
    if (!editFormData.name?.trim() || !editFormData.qty || Number(editFormData.qty) <= 0 ||
        !editFormData.category?.trim() || !editFormData.unit?.trim() || !editFormData.expiry) return;
    const updated = [...ocrResult];
    updated[index] = { ...editFormData, qty: Number(editFormData.qty) } as OcrItem;
    setOcrResult(updated);
    setEditIndex(null);
  };

  function handleDeleteRow(index: number) {
    setOcrResult(prev => prev.filter((_, i) => i !== index));
  }

  function handleReset() {
    setOcrResult([]);
    setSaved(false);
    setEditIndex(null);
    setError(null);
    setRetryFile(null);
    setFileQueue([]);
    setProcessedFileNames([]);
  }

  // Zone assignment by category — single source of truth
  function getZoneForCategory(cat: string): string {
    if (['Kimia', 'Pengawet'].includes(cat)) return 'E';
    if (['Susu', 'Cokelat'].includes(cat)) return 'D';
    if (['Tepung', 'Gula'].includes(cat)) return 'A';
    if (['Minyak', 'Pewarna', 'Essence'].includes(cat)) return 'B';
    return 'C';
  }

  // --- Save to DB ---
  const handleSave = async () => {
    // Validate all items before starting save
    const invalidItems = ocrResult.filter(item =>
      !item.name?.trim() || !item.category?.trim() || !item.unit?.trim() ||
      !item.qty || Number(item.qty) <= 0 || !item.expiry
    );
    if (invalidItems.length > 0) {
      setError(`${invalidItems.length} item belum lengkap (nama, kategori, qty, unit, dan expiry wajib diisi).`);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const slotsData = await api.get<{ success: boolean; slots: Array<{ id: string; zone: string; occupied: boolean }> }>('/slots');
      const availableSlots = slotsData.success ? slotsData.slots.filter(s => !s.occupied) : [];

      let savedCount = 0;
      const failedItems: string[] = [];

      for (const item of ocrResult) {
        // Skip duplicate items to prevent double entry in DB!
        if (isDuplicate(item, existingInventory)) {
          continue;
        }

        const zone = getZoneForCategory(item.category);
        const slot = availableSlots.find(s => s.zone === zone && !s.occupied)
          || availableSlots.find(s => !s.occupied);
        const slotId = slot ? slot.id : null;
        if (slot) slot.occupied = true;

        // Use crypto.randomUUID for guaranteed unique ID
        const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
        const nextId = `INV-${uuid}`;

        const defaultExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const payload = {
          id: nextId,
          name: item.name.trim(),
          category: item.category.trim(),
          qty: Number(item.qty),
          unit: item.unit.trim(),
          location: slotId || 'UNASSIGNED',
          zone: slot ? slot.zone : zone,
          dateIn: new Date().toISOString().split('T')[0],
          expiry: item.expiry || defaultExpiry,
          user: { name: user?.name || 'OCR Assistant', role: user?.role || 'Operator' }
        };

        try {
          const res = await api.post<{ success: boolean }>('/inventory', payload);
          if (res.success) savedCount++;
          else failedItems.push(item.name);
        } catch {
          failedItems.push(item.name);
        }
      }

      if (failedItems.length > 0 && savedCount === 0) {
        throw new Error(`Semua item gagal disimpan: ${failedItems.join(', ')}`);
      }
      if (failedItems.length > 0) {
        setError(`${savedCount} item berhasil, ${failedItems.length} gagal: ${failedItems.join(', ')}`);
      }

      // Log ingestion history ke DB
      const record = createUploadRecord(
        processedFileNames.join(', ') || 'document',
        `${ocrResult.length} items`,
        savedCount,
        'OCR Scan',
        user?.name || 'System'
      );
      await api.post('/ingestion-history', {
        id: record.id,
        fileName: record.fileName,
        fileSize: record.fileSize,
        category: record.category,
        recordCount: record.recordCount,
        uploadedBy: record.uploadedBy,
        uploadedAt: record.uploadedAt,
        status: record.status,
        notes: record.notes,
      }).catch(() => {});
      setIngestionHistory(prev => [record, ...prev]);

      setSaved(true);
      setFileQueue([]);
      setProcessedFileNames([]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to save data to database: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a record from ingestion history
  const handleDeleteHistory = (recordId: string) => {
    setIngestionHistory(prev => prev.filter(r => r.id !== recordId));
    api.delete(`/ingestion-history/${recordId}`).catch(() => {});
  };

  // Check if any file is currently processing
  const isProcessing = fileQueue.some(item => item.status === 'uploading');

  // --- RENDER ---
  return (
    <div className="upload-page animate-fade">
      {/* Page Header */}
      <div className="upload-page-header">
        <div className="upload-page-header-left">
          <h1 className="page-title">{t('dataIngestionTitle')}</h1>
          <p className="page-subtitle">
            {t('dataIngestionSub')}
          </p>
        </div>
        <button
          className="upload-add-files-btn"
          onClick={() => setShowUploadModal(true)}
        >
          + Add Files
        </button>
      </div>

      {/* Main Content Area */}
      <div className="upload-content-area">
        {/* Error banner with retry */}
        {error && (
          <div className="upload-preview-card" style={{ marginBottom: '0' }}>
            <div className="upload-preview-accent" style={{ background: 'linear-gradient(90deg, #DC2626, #F87171)' }} />
            <div className="upload-error-state" style={{ padding: '1rem 1.5rem', flexDirection: 'row', gap: '0.75rem', alignItems: 'center' }}>
              <AlertCircle size={20} className="upload-error-icon" style={{ marginBottom: 0 }} />
              <span className="upload-error-text" style={{ margin: 0, textAlign: 'left', flex: 1 }}>{error}</span>
              {retryFile && (
                <button className="btn btn-primary btn-sm" onClick={handleRetry} style={{ flexShrink: 0 }}>
                  <RotateCcw size={14} /> Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent" />
            <div className="upload-processing">
              <div className="w-8 h-8 border-4 border-[#2C742F]/20 border-t-[#2C742F] rounded-full animate-spin" />
              <div>
                <p className="upload-processing-text-title">Processing documents with OCR...</p>
                <p className="upload-processing-text-sub">Extracting structured data with Gemini AI</p>
              </div>
            </div>
          </div>
        )}

        {/* OCR Results Table */}
        {ocrResult.length > 0 && !saved && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent" />
            <div className="upload-preview-header">
              <div className="upload-preview-header-left">
                <h3 className="upload-preview-title">
                  <FileText size={20} className="upload-preview-title-icon" />
                  Latest OCR Extraction
                </h3>
                <p className="upload-preview-subtitle">
                  {processedFileNames.length > 0 ? processedFileNames.join(', ') : 'documents'} (Processed just now)
                </p>
              </div>
              <div className="upload-no-duplicates-badge">
                <CheckCircle2 size={12} />
                {ocrResult.length} items extracted
              </div>
            </div>

            {/* Duplicate Warning Banner */}
            {existingInventory.length > 0 && ocrResult.some(item => isDuplicate(item, existingInventory)) && (
              <div className="upload-duplicate-warning">
                <AlertTriangle size={16} className="upload-duplicate-warning-icon" />
                <div>
                  <p className="upload-duplicate-warning-title">
                    Duplicates Detected ({ocrResult.filter(item => isDuplicate(item, existingInventory)).length} items)
                  </p>
                  <p className="upload-duplicate-warning-text">
                    Some extracted items match existing inventory records (same name and lot number). Review highlighted rows before saving.
                  </p>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="upload-preview-table-area">
              <table className="upload-preview-table">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-white">ACTION</th>
                    <th scope="col">NAME</th>
                    <th scope="col">CATEGORY</th>
                    <th scope="col">QTY</th>
                    <th scope="col">UNIT</th>
                    <th scope="col">LOT NUMBER</th>
                    <th scope="col">LOCATION</th>
                    <th scope="col">EXPIRY</th>
                    <th scope="col">CONFIDENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrResult.map((item, i) => {
                    const itemIsDuplicate = isDuplicate(item, existingInventory);
                    const matchingItem = itemIsDuplicate
                      ? existingInventory.find(
                          (inv) => inv.name.toLowerCase() === item.name.toLowerCase() && inv.lotNumber === item.lotNumber
                        )
                      : null;
                    return (
                    <tr key={i} className={itemIsDuplicate ? 'upload-row-duplicate' : ''}>
                      {editIndex === i ? (
                        <>
                          <td className="sticky left-0 z-10 bg-white">
                            <div className="upload-edit-actions">
                              <button className="btn btn-primary btn-sm" onClick={() => handleSaveEditRow(i)}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditIndex(null)}>Cancel</button>
                            </div>
                          </td>
                          <td>
                            <input type="text" className="input" value={editFormData.name || ''}
                              onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} />
                          </td>
                          <td>
                            <select className="select" value={editFormData.category || ''}
                              onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}>
                              {['Kimia', 'Pengawet', 'Susu', 'Cokelat', 'Tepung', 'Gula', 'Minyak', 'Pewarna', 'Essence', 'Rempah'].map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="number" className="input" style={{ width: '4rem' }} value={editFormData.qty || 0}
                              onChange={e => setEditFormData({ ...editFormData, qty: Number(e.target.value) })} />
                          </td>
                          <td>
                            <select className="select" value={editFormData.unit || ''}
                              onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}>
                              {['kg', 'L', 'pcs', 'box', 'karung', 'drum', 'ml', 'g'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="text" className="input mono" value={editFormData.lotNumber || ''}
                              onChange={e => setEditFormData({ ...editFormData, lotNumber: e.target.value })} />
                          </td>
                          <td>
                            <input type="text" className="input" value={editFormData.location || ''}
                              onChange={e => setEditFormData({ ...editFormData, location: e.target.value })} />
                          </td>
                          <td>
                            <input type="date" className="input" value={editFormData.expiry || ''}
                              onChange={e => setEditFormData({ ...editFormData, expiry: e.target.value })} />
                          </td>
                          <td>
                            <span className="confidence-badge confidence-medium">
                              {Math.round((editFormData.confidence || 0) * 100)}%
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="sticky left-0 z-10 bg-white">
                            <div className="upload-edit-actions">
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleStartEditRow(i, item)} disabled={isSaving} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteRow(i)} disabled={isSaving} title="Delete"
                                style={{ color: '#DC2626' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="material-name">
                            {item.confidence < 0.7 && <AlertTriangle size={14} className="confidence-warning-icon" />}
                            {item.name}
                            {itemIsDuplicate && (
                              <span className="upload-duplicate-badge" title={matchingItem ? `Matches: ${matchingItem.name} (Lot: ${matchingItem.lotNumber})` : 'Duplicate detected'}>
                                Duplicate
                              </span>
                            )}
                          </td>
                          <td>{item.category}</td>
                          <td className="quantity">{item.qty}</td>
                          <td>{item.unit}</td>
                          <td className="lot-number">{item.lotNumber || '—'}</td>
                          <td>{item.location || '—'}</td>
                          <td>{item.expiry || '—'}</td>
                          <td>
                            <span className={`confidence-badge ${item.confidence >= 0.8 ? 'confidence-high' : item.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low'}`}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="upload-preview-footer">
              <span className="upload-preview-footer-info">
                {ocrResult.length} items extracted
              </span>
              <div className="upload-preview-footer-actions">
                <button className="upload-btn-edit" onClick={handleReset} disabled={isSaving}>
                  Cancel
                </button>
                <button className="upload-btn-save" onClick={handleSave} disabled={isSaving || editIndex !== null}>
                  {isSaving ? (
                    <><Loader2 size={14} className="upload-queue-spinner" /> Saving...</>
                  ) : (
                    'Commit to Master DB'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {saved && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent" />
            <div className="upload-success-state">
              <CheckCircle2 size={48} className="upload-success-icon" />
              <h3 className="upload-success-title">Data Saved Successfully!</h3>
              <p className="upload-success-text">
                {ocrResult.length} items have been committed to the Master Database.
              </p>
              <button className="btn btn-primary" onClick={handleReset}>
                <Plus size={16} /> Upload More Documents
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {ocrResult.length === 0 && !isProcessing && !saved && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent" />
            <div className="upload-preview-header">
              <div className="upload-preview-header-left">
                <h3 className="upload-preview-title">
                  <FileText size={20} className="upload-preview-title-icon" />
                  Latest OCR Extraction
                </h3>
                <p className="upload-preview-subtitle">No files uploaded yet</p>
              </div>
            </div>
            <div className="upload-empty-preview">
              <div className="upload-dropzone-inline"
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleInlineDrop}
                onClick={() => setShowUploadModal(true)}
              >
                <div className={`upload-dropzone-inner ${dragOver ? 'upload-dragover' : ''}`}>
                  <div className="upload-icon-circle">
                    <UploadIcon size={24} aria-label="Upload" />
                  </div>
                  <p className="upload-empty-title">
                    Drop your files here or <span className="upload-link">click to upload</span>
                  </p>
                  <p className="upload-empty-formats">JPG, PNG, PDF, CSV — max 10MB</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ingestion History Section */}
      {ingestionHistory.length > 0 && (
        <div className="upload-preview-card" style={{ marginTop: '1.5rem' }}>
          <div className="upload-preview-accent" style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
          <div className="upload-preview-header">
            <div className="upload-preview-header-left">
              <h3 className="upload-preview-title">
                <History size={20} className="upload-preview-title-icon" />
                Ingestion History
              </h3>
              <p className="upload-preview-subtitle">
                {ingestionHistory.length} past upload{ingestionHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="upload-preview-table-area">
            <table className="upload-preview-table">
              <thead>
                <tr>
                  <th scope="col">FILE NAME</th>
                  <th scope="col">FILE SIZE</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">RECORDS</th>
                  <th scope="col">UPLOADED BY</th>
                  <th scope="col">UPLOADED AT</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {ingestionHistory.map((record) => (
                  <tr key={record.id}>
                    <td className="material-name">
                      <FileText size={14} style={{ marginRight: '0.25rem', opacity: 0.6 }} />
                      {record.fileName}
                    </td>
                    <td>{record.fileSize}</td>
                    <td>{record.category}</td>
                    <td className="quantity">{record.recordCount}</td>
                    <td>{record.uploadedBy}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} style={{ opacity: 0.5 }} />
                        {new Date(record.uploadedAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className={`confidence-badge ${record.status === 'Validated' ? 'confidence-high' : record.status === 'Processing' ? 'confidence-medium' : 'confidence-low'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleDeleteHistory(record.id)}
                        title="Delete record"
                        style={{ color: '#DC2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <Portal>
        <div className="upload-modal-backdrop" onClick={handleCloseModal}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-accent" />
            <div className="upload-modal-header">
              <div>
                <h3 className="upload-modal-header-title">Upload and Attach Files</h3>
                <span className="upload-modal-header-subtitle">(.jpg / .png / .pdf / .csv)</span>
              </div>
              <button className="upload-modal-close-btn" onClick={handleCloseModal} aria-label="Close upload modal">
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="upload-modal-body">
              {/* Left: Drop Area */}
              <div className="upload-modal-drop-area">
                <div className="upload-modal-drop-zone"
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleModalDrop}
                >
                  <div className="upload-icon-circle">
                    <UploadIcon size={24} aria-label="Upload" />
                  </div>
                  <span className="upload-modal-drop-title">
                    Drop your files here or click to upload
                  </span>
                  <span className="upload-modal-drop-subtitle">
                    (.jpg / .png / .pdf / .csv)
                  </span>
                  <input
                    type="file"
                    className="upload-file-input"
                    accept=".pdf,.jpg,.jpeg,.png,.csv"
                    multiple={true}
                    onChange={handleModalFileInput}
                    ref={modalFileInputRef}
                  />
                </div>
              </div>

              {/* Right: File Queue */}
              <div className="upload-modal-files-area">
                {fileQueue.length === 0 ? (
                  <div className="upload-modal-empty-files">
                    <FileText size={32} className="upload-modal-empty-icon" />
                    <p className="upload-modal-empty-text">No files in queue</p>
                    <p className="upload-modal-empty-hint">Drop files on the left or click to browse</p>
                  </div>
                ) : (
                  fileQueue.map(item => {
                    const badge = getFileTypeBadge(item.name);
                    return (
                      <div key={item.id} className={`upload-queue-item ${item.status === 'error' ? 'upload-queue-item-error' : ''}`}>
                        <div className="upload-queue-item-header">
                          <div className="upload-queue-item-left">
                            <span className={`upload-queue-type-badge ${badge.className}`}>{badge.label}</span>
                            <div>
                              <p className="upload-queue-file-name">{item.name}</p>
                              <p className={`upload-queue-status ${item.status === 'done' ? 'upload-queue-status-success' : ''} ${item.status === 'error' ? 'upload-queue-status-error' : ''}`}>
                                {item.status === 'pending' && `${formatFileSize(item.size)} · Waiting...`}
                                {item.status === 'uploading' && `${formatFileSize(item.size)} · ${item.progress}% processing`}
                                {item.status === 'done' && `${formatFileSize(item.size)} · Complete`}
                                {item.status === 'error' && (item.errorMsg || 'Processing failed, please try again')}
                              </p>
                            </div>
                          </div>
                          <div className="upload-queue-item-actions">
                            {item.status === 'uploading' && (
                              <Loader2 size={18} className="upload-queue-spinner" />
                            )}
                            {item.status === 'done' && (
                              <CheckCircle2 size={18} className="upload-queue-done-icon" />
                            )}
                            {item.status === 'error' && (
                              <button className="upload-queue-retry-link" onClick={() => retryQueueFile(item.id)}>Try again</button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeFromQueue(item.id)} aria-label="Remove file">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
