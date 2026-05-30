'use client';
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
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
  Loader2
} from 'lucide-react';
import './upload.css';

export default function UploadPage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const modalFileInputRef = useRef(null);

  // Main state
  const [ocrResult, setOcrResult] = useState([]);
  const [duplicateCheck, setDuplicateCheck] = useState(false);
  const [duplicateMessages, setDuplicateMessages] = useState([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Modal & queue state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileQueue, setFileQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState([]);

  // Row editing
  const [editIndex, setEditIndex] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // ─── Gemini OCR Functions ───────────────────────────────────────────
  const queryGeminiOCR = async (base64Data, mimeType) => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyCk7MLn1egt_KdMnsaCOnh4bw1kS-B-K3I';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `
You are an expert OCR and data extraction system for the AromaSys warehouse.
Extract all inventory items from this document (image or PDF).
Return ONLY a valid JSON array, with no markdown formatting blocks.
Each object must have: name (string), category (string, one of: 'Tepung','Gula','Minyak','Pewarna','Essence','Pengawet','Susu','Cokelat','Rempah','Kimia'), qty (number), unit (string, one of: 'kg','liter','pcs','box','karung','drum'), expiry (string YYYY-MM-DD), confidence (number 0-100), lotNumber (string).
If you cannot find any items, return an empty array [].`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }]
      })
    });
    if (!res.ok) throw new Error(`Gemini OCR API error: ${res.statusText}`);
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  };

  const queryGeminiOCRWithText = async (textContent, fileName) => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyCk7MLn1egt_KdMnsaCOnh4bw1kS-B-K3I';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `
You are an expert OCR and data extraction system for the AromaSys warehouse.
Extract all inventory items from this file named "${fileName}" containing:
---
${textContent}
---
Return ONLY a valid JSON array, with no markdown formatting blocks.
Each object must have: name (string), category (string, one of: 'Tepung','Gula','Minyak','Pewarna','Essence','Pengawet','Susu','Cokelat','Rempah','Kimia'), qty (number), unit (string, one of: 'kg','liter','pcs','box','karung','drum'), expiry (string YYYY-MM-DD), confidence (number 0-100), lotNumber (string).
If you cannot find any items, return an empty array [].`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
    });
    if (!res.ok) throw new Error(`Gemini OCR API error: ${res.statusText}`);
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  };

  // ─── Duplicate Check ────────────────────────────────────────────────
  const checkDuplicates = async (extractedItems) => {
    try {
      // Fetch FRESH data from database (includes previously committed items)
      const res = await fetch('/api/inventory?_t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        const dbItems = data.items;
        const duplicates = [];
        for (const extItem of extractedItems) {
          const extLot = (extItem.lotNumber || '').toLowerCase().trim();
          const extName = extItem.name.toLowerCase().trim();
          
          const matched = dbItems.find(dbItem => {
            const dbId = dbItem.id.toLowerCase().trim();
            const dbName = dbItem.name.toLowerCase().trim();
            
            // Check by lot number / ID match (primary check)
            if (extLot && dbId === extLot) return true;
            
            // Check by exact name match (secondary check)
            if (dbName === extName) return true;
            
            return false;
          });
          if (matched) {
            duplicates.push(`"${extItem.name}" (Lot: ${extItem.lotNumber || 'N/A'}) sudah ada di database sebagai "${matched.name}" (ID: ${matched.id}).`);
          }
        }
        return duplicates;
      }
    } catch (err) {
      console.error('Error checking duplicates:', err);
    }
    return [];
  };

  // ─── File Queue Helpers ─────────────────────────────────────────────
  function getFileExtension(name) {
    return name.split('.').pop().toLowerCase();
  }

  function getFileTypeBadge(name) {
    const ext = getFileExtension(name);
    if (ext === 'pdf') return { label: 'PDF', className: 'upload-queue-badge-pdf' };
    if (ext === 'xlsx' || ext === 'xls') return { label: 'XLSX', className: 'upload-queue-badge-xlsx' };
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return { label: 'JPG', className: 'upload-queue-badge-jpg' };
    if (ext === 'csv') return { label: 'CSV', className: 'upload-queue-badge-csv' };
    return { label: ext.toUpperCase(), className: 'upload-queue-badge-csv' };
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Add files to queue
  const addFilesToQueue = useCallback((files) => {
    const newItems = Array.from(files).map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending', // pending | uploading | done | error
      progress: 0,
      errorMsg: ''
    }));
    setFileQueue(prev => [...prev, ...newItems]);
  }, []);

  // Remove file from queue
  const removeFromQueue = useCallback((id) => {
    setFileQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  // Retry a failed file
  const retryFile = useCallback((id) => {
    setFileQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'pending', progress: 0, errorMsg: '' } : item
    ));
  }, []);

  // Process a single file through OCR
  const processOneFile = async (queueItem) => {
    const f = queueItem.file;
    const fileType = f.type;
    const isImage = fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf';
    const isCsv = f.name.toLowerCase().endsWith('.csv');

    let resData;
    if (isImage || isPdf) {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      resData = await queryGeminiOCR(base64Data, fileType || 'image/jpeg');
    } else if (isCsv) {
      // Parse CSV directly without AI — much faster and more reliable
      const textContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(f);
      });
      resData = parseCsvDirectly(textContent);
    } else {
      const textContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(f);
      });
      resData = await queryGeminiOCRWithText(textContent, f.name);
    }
    return resData;
  };

  // Direct CSV parser — no AI needed for structured data
  function parseCsvDirectly(csvText) {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Remove BOM if present
    const header = lines[0].replace(/^\uFEFF/, '').toLowerCase();
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cells.length < 3) continue;

      // Try to extract meaningful data from CSV columns
      const name = cells[1] || cells[0] || '';
      const category = cells[2] || 'Kimia';
      const qtyStr = cells[3] || '0';
      const qty = parseFloat(qtyStr.replace(/[^\d.]/g, '')) || 0;
      const unit = (cells[3] || '').replace(/[\d.]/g, '').trim() || 'kg';
      const expiry = cells[6] || cells[5] || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const lotNumber = cells[0] || `LOT-${i}`;

      if (name && name !== 'Nama Bahan' && name !== 'name') {
        results.push({
          name,
          category: ['Tepung', 'Gula', 'Minyak', 'Pewarna', 'Essence', 'Pengawet', 'Susu', 'Cokelat', 'Rempah', 'Kimia'].includes(category) ? category : 'Kimia',
          qty: qty || 1,
          unit: ['kg', 'liter', 'pcs', 'box', 'karung', 'drum'].includes(unit) ? unit : 'kg',
          expiry,
          confidence: 90,
          lotNumber
        });
      }
    }
    return results;
  }

  // Process all pending files in queue one by one
  const processQueue = useCallback(async () => {
    const pending = fileQueue.filter(item => item.status === 'pending');
    if (pending.length === 0) return;

    for (const queueItem of pending) {
      // Set uploading state with simulated progress
      setFileQueue(prev => prev.map(item =>
        item.id === queueItem.id ? { ...item, status: 'uploading', progress: 0 } : item
      ));

      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15 + 5, 90);
        setFileQueue(prev => prev.map(item =>
          item.id === queueItem.id ? { ...item, progress: Math.round(progress) } : item
        ));
      }, 400);

      try {
        const resData = await processOneFile(queueItem);
        clearInterval(progressInterval);

        if (Array.isArray(resData) && resData.length > 0) {
          // Accumulate results
          setOcrResult(prev => [...prev, ...resData]);
          setProcessedFileNames(prev => [...prev, queueItem.name]);

          // Check duplicates — just check the new items against DB
          const dups = await checkDuplicates(resData);
          setDuplicateMessages(prev => [...prev, ...dups.filter(d => !prev.includes(d))]);
          setDuplicateCheck(prev => prev || dups.length > 0);

          setFileQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, status: 'done', progress: 100 } : item
          ));
        } else {
          clearInterval(progressInterval);
          setFileQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, status: 'error', progress: 0, errorMsg: 'No data extracted' } : item
          ));
        }
      } catch (err) {
        clearInterval(progressInterval);
        console.error('OCR error for', queueItem.name, err);
        setFileQueue(prev => prev.map(item =>
          item.id === queueItem.id ? { ...item, status: 'error', progress: 0, errorMsg: err.message } : item
        ));
      }
    }
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileQueue, ocrResult]);

  // Auto-process pending files when queue changes
  const processingRef = useRef(false);
  const processQueueAuto = useCallback(async () => {
    if (processingRef.current) return;
    const pending = fileQueue.filter(item => item.status === 'pending');
    if (pending.length === 0) return;
    processingRef.current = true;
    await processQueue();
    processingRef.current = false;
  }, [processQueue, fileQueue]);

  // Trigger auto-processing when fileQueue has pending items
  useState(() => {
    // This runs on mount only
  });

  // Use effect to auto-start processing
  const hasPending = fileQueue.some(item => item.status === 'pending');
  const hasUploading = fileQueue.some(item => item.status === 'uploading');
  
  // Auto-start processing when there are pending files and nothing is currently uploading
  if (hasPending && !hasUploading && !processingRef.current) {
    processingRef.current = true;
    setTimeout(() => {
      processQueue().finally(() => { processingRef.current = false; });
    }, 100);
  }

  // Close modal
  const handleCloseModal = () => {
    setShowUploadModal(false);
  };

  // Handle drop in modal
  function handleModalDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) addFilesToQueue(files);
  }

  // Handle file input in modal
  function handleModalFileInput(e) {
    const files = e.target.files;
    if (files && files.length > 0) addFilesToQueue(files);
    e.target.value = '';
  }

  // Handle drop on inline dropzone (empty state)
  function handleInlineDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      addFilesToQueue(files);
      setShowUploadModal(true);
    }
  }

  function handleInlineFileInput(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToQueue(files);
      setShowUploadModal(true);
    }
    e.target.value = '';
  }

  // ─── Save to DB ─────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const slotsRes = await fetch('/api/slots');
      const slotsData = await slotsRes.json();
      if (!slotsData.success) throw new Error(slotsData.error || 'Failed to fetch slots');

      const availableSlots = slotsData.slots.filter(s => !s.occupied);

      function getZoneForCategory(cat) {
        if (['Kimia', 'Pengawet'].includes(cat)) return 'E';
        if (['Susu', 'Cokelat'].includes(cat)) return 'D';
        if (['Tepung', 'Gula'].includes(cat)) return 'A';
        if (['Minyak', 'Pewarna', 'Essence'].includes(cat)) return 'B';
        return 'C';
      }

      let savedCount = 0;
      let skippedCount = 0;
      for (const item of ocrResult) {
        if (isDuplicate(item.name)) {
          console.warn(`Skipping duplicate item: ${item.name}`);
          skippedCount++;
          continue;
        }

        const zone = getZoneForCategory(item.category);
        let slot = availableSlots.find(s => s.zone === zone && !s.occupied);
        
        // If no slot in preferred zone, try any available slot
        if (!slot) {
          slot = availableSlots.find(s => !s.occupied);
        }

        const slotId = slot ? slot.id : null;
        const assignedZone = slot ? slot.zone : zone;
        if (slot) slot.occupied = true;

        const nextId = `INV-${String(Date.now()).slice(-6)}${String(savedCount).padStart(2, '0')}`;
        const payload = {
          id: nextId, name: item.name, category: item.category,
          qty: parseFloat(item.qty), unit: item.unit,
          location: slotId || 'UNASSIGNED', zone: assignedZone,
          dateIn: new Date().toISOString().split('T')[0],
          expiry: item.expiry || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'Aman',
          user: { name: user?.name || 'OCR Assistant', role: user?.role || 'Operator' }
        };

        const res = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || ''), 'x-user-role': user?.role || 'Operator' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          savedCount++;
        } else {
          console.error('Failed to save item:', item.name, data.error);
          skippedCount++;
        }
      }
      // Log the data ingestion commit
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.name || 'Unknown',
          role: user?.role || 'Operator',
          action: 'Data Ingestion',
          detail: `Committed ${savedCount} items from OCR extraction to Master Database`,
          module: 'Copilot'
        })
      });

      setSaved(true);
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan menyimpan data ke database: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Row Editing ────────────────────────────────────────────────────
  const handleStartEditRow = (index, item) => {
    setEditIndex(index);
    setEditFormData({ ...item });
  };

  const handleSaveEditRow = (index) => {
    if (!editFormData.name || !editFormData.qty) return;
    const updated = [...ocrResult];
    updated[index] = { ...editFormData, qty: parseFloat(editFormData.qty) };
    setOcrResult(updated);
    setEditIndex(null);
  };

  function handleDeleteRow(index) {
    const updated = ocrResult.filter((_, i) => i !== index);
    setOcrResult(updated);
  }

  function handleReset() {
    setOcrResult([]);
    setDuplicateCheck(false);
    setDuplicateMessages([]);
    setSaved(false);
    setEditIndex(null);
    setError(null);
    setFileQueue([]);
    setProcessedFileNames([]);
  }

  // Duplicate helpers
  function isDuplicate(itemName) {
    return duplicateMessages.some(msg => msg.toLowerCase().includes(itemName.toLowerCase()));
  }
  const duplicateCount = ocrResult.filter(item => isDuplicate(item.name)).length;

  function handleDeleteAllDuplicates() {
    const updated = ocrResult.filter(item => !isDuplicate(item.name));
    setOcrResult(updated);
  }

  // Check if any file is currently processing
  const isProcessing = fileQueue.some(item => item.status === 'uploading');

  // ─── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="upload-page animate-fade">
      {/* Page Header */}
      <div className="upload-page-header">
        <div className="upload-page-header-left">
          <h1 className="page-title">Data Ingestion</h1>
          <p className="page-subtitle">
            Upload raw materials data for intelligent parsing. Drag and drop corporate invoices, handwritten intake notes, or spreadsheets (.xlsx/.csv/.pdf/.jpg)
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
        {/* Error banner */}
        {error && (
          <div className="upload-preview-card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="upload-preview-accent" style={{ background: 'var(--color-status-critical)' }}></div>
            <div className="upload-error-state" style={{ padding: 'var(--space-4) var(--space-6)', flexDirection: 'row', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} className="upload-error-icon" style={{ marginBottom: 0 }} />
              <span className="upload-error-text" style={{ margin: 0, textAlign: 'left' }}>{error}</span>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent"></div>
            <div className="upload-processing">
              <div className="spinner spinner-lg"></div>
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
            <div className="upload-preview-accent"></div>
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
              {!duplicateCheck && (
                <div className="upload-no-duplicates-badge">
                  <CheckCircle2 size={12} />
                  No Duplicates Detected
                </div>
              )}
            </div>

            {/* Duplicate Warning */}
            {duplicateCheck && (
              <div className="upload-duplicate-warning">
                <AlertCircle size={18} className="upload-duplicate-warning-icon" />
                <div>
                  <strong className="upload-duplicate-warning-title">Duplicate Check Warning</strong>
                  <div className="upload-duplicate-warning-text">
                    {duplicateMessages.map((msg, idx) => (
                      <p key={idx} style={{ margin: 0 }}>• {msg}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="upload-preview-table-area">
              <table className="upload-preview-table">
                <thead>
                  <tr>
                    <th scope="col">MATERIAL NAME</th>
                    <th scope="col">PARSED QUANTITY</th>
                    <th scope="col">EXTRACTED LOT NUMBER</th>
                    <th scope="col">CONFIDENCE</th>
                    <th scope="col">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrResult.map((item, i) => (
                    <tr key={i} className={isDuplicate(item.name) ? 'upload-row-duplicate' : ''}>
                      {editIndex === i ? (
                        <>
                          <td>
                            <input type="text" className="input" value={editFormData.name}
                              onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} />
                          </td>
                          <td>
                            <div className="upload-edit-qty-row">
                              <input type="number" className="input upload-edit-qty-input" value={editFormData.qty}
                                onChange={e => setEditFormData({ ...editFormData, qty: e.target.value })} />
                              <select className="select upload-edit-unit-select" value={editFormData.unit}
                                onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}>
                                {['kg', 'liter', 'pcs', 'box', 'karung', 'drum'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <input type="text" className="input mono" value={editFormData.lotNumber || ''}
                              onChange={e => setEditFormData({ ...editFormData, lotNumber: e.target.value })} />
                          </td>
                          <td>
                            <span className={`confidence-badge ${(editFormData.confidence || 95) >= 90 ? 'confidence-high' : (editFormData.confidence || 95) >= 70 ? 'confidence-medium' : 'confidence-low'}`}>
                              {editFormData.confidence || 95}%
                            </span>
                          </td>
                          <td>
                            <div className="upload-edit-actions">
                              <button className="btn btn-primary btn-sm" onClick={() => handleSaveEditRow(i)}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditIndex(null)}>Cancel</button>
                            </div>
                          </td>
                        </>

                      ) : (
                        <>
                          <td className="material-name">
                            {(item.confidence || 95) < 80 && <AlertTriangle size={14} className="confidence-warning-icon" />}
                            {item.name}
                            {isDuplicate(item.name) && <span className="upload-duplicate-badge">Duplikat</span>}
                          </td>
                          <td className="quantity">{item.qty} {item.unit}</td>
                          <td className="lot-number">
                            {item.lotNumber || `LOT-${item.name.slice(0, 2).toUpperCase()}-2305`}
                            {(item.confidence || 95) < 80 && <span className="confidence-uncertain-icon" title="Uncertain">?</span>}
                          </td>
                          <td>
                            <span className={`confidence-badge ${(item.confidence || 95) >= 90 ? 'confidence-high' : (item.confidence || 95) >= 70 ? 'confidence-medium' : 'confidence-low'}`}>
                              {item.confidence || 95}%
                            </span>
                          </td>
                          <td>
                            <div className="upload-edit-actions">
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleStartEditRow(i, item)} disabled={isSaving} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteRow(i)} disabled={isSaving} title="Delete"
                                style={{ color: 'var(--color-status-critical)' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="upload-preview-footer">
              <span className="upload-preview-footer-info">
                {ocrResult.length} items extracted • {duplicateCount} duplicates detected
              </span>
              <div className="upload-preview-footer-actions">
                {duplicateCount > 0 && (
                  <button className="upload-btn-edit" onClick={handleDeleteAllDuplicates} disabled={isSaving}
                    style={{ borderColor: 'var(--color-status-critical)', color: 'var(--color-status-critical)' }}>
                    <Trash2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    Remove All Duplicates
                  </button>
                )}
                <button className="upload-btn-edit" onClick={handleReset} disabled={isSaving}>
                  Cancel
                </button>
                <button className="upload-btn-save" onClick={handleSave} disabled={isSaving || editIndex !== null}>
                  {isSaving ? 'Saving...' : 'Commit to Master DB'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {saved && (
          <div className="upload-preview-card">
            <div className="upload-preview-accent"></div>
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
            <div className="upload-preview-accent"></div>
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
              >
                <div className={`upload-dropzone-inner ${dragOver ? 'upload-dragover' : ''}`}>
                  <div className="upload-icon-circle">
                    <UploadIcon size={24} aria-label="Upload" />
                  </div>
                  <p className="upload-empty-title">
                    Drop your files here or <span className="upload-link">click to upload</span>
                  </p>
                  <p className="upload-empty-formats">PDF, JPG, JPEG, PNG, XLSX, CSV — max 10MB</p>
                  <input
                    type="file"
                    className="upload-file-input"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                    multiple
                    onChange={handleInlineFileInput}
                    ref={fileInputRef}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Upload Modal ──────────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="upload-modal-backdrop" onClick={handleCloseModal}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-accent"></div>
            <div className="upload-modal-header">
              <div>
                <h3 className="upload-modal-header-title">Upload and Attach Files</h3>
                <span className="upload-modal-header-subtitle">(.xlsx/.csv/.pdf/.jpg)</span>
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
                    (.xlsx / .csv / .pdf / .jpg)
                  </span>
                  <input
                    type="file"
                    className="upload-file-input"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                    multiple
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
                                {item.status === 'pending' && `${formatFileSize(item.size)} • Waiting...`}
                                {item.status === 'uploading' && `${formatFileSize(item.size)} • ${item.progress}% uploaded`}
                                {item.status === 'done' && `${formatFileSize(item.size)} • Complete`}
                                {item.status === 'error' && 'Upload failed, please try again'}
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
                              <button className="upload-queue-retry-link" onClick={() => retryFile(item.id)}>Try again</button>
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
      )}
    </div>
  );
}
