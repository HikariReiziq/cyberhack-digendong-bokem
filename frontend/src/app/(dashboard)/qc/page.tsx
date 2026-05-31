"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  History,
  Microscope,
  Leaf,
  FlaskConical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

type MaterialTab = "fruit-raw" | "extract-powder";

interface QCResult {
  status?: "ACCEPTED" | "REJECTED";
  reason?: string;
  result?: "pass" | "fail";
  confidence?: number;
  notes?: string;
  roboflowClasses?: string[];
  predictions?: any[];
}

interface InspectionRecord {
  id: number;
  materialId: string;
  materialType: string;
  result: "pass" | "fail";
  confidence: number;
  notes: string;
  inspectedAt: string;
}

export default function QCPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<MaterialTab>("fruit-raw");
  const [materialId, setMaterialId] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [qcResult, setQcResult] = useState<QCResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [history, setHistory] = useState<InspectionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualResult, setManualResult] = useState<"pass" | "fail">("pass");
  const [manualConfidence, setManualConfidence] = useState(80);
  const [manualNotes, setManualNotes] = useState("");
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const materialType = activeTab === "fruit-raw" ? "fruit" : "extract";

  // Fetch inspection history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await api.get<{ success: boolean; inspections: InspectionRecord[] }>("/qc/history");
      if (data.success) {
        setHistory(data.inspections);
      }
    } catch {
      setHistoryError("Gagal memuat riwayat inspeksi. Periksa koneksi dan coba lagi.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      // Set cameraActive FIRST so the <video> element mounts, then assign via useEffect
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setError(
        "Cannot access camera. Please allow camera permission in your browser, or use file upload instead."
      );
    }
  };

  // Assign stream to video element AFTER it mounts (conditional render means videoRef is null before)
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => console.error("Video play error:", err));
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    setCameraActive(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setImageBase64(base64);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran berkas melebihi batas 2MB. Silakan unggah gambar yang lebih kecil.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runInspection = async () => {
    if (!imageBase64) {
      setError("Silakan ambil gambar atau upload file terlebih dahulu.");
      return;
    }

    let currentMaterialId = materialId.trim();
    if (!currentMaterialId) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      currentMaterialId = `MAT-${dateStr}-${randomStr}`;
      setMaterialId(currentMaterialId);
    }

    setIsInspecting(true);
    setError(null);
    setQcResult(null);
    setSaveSuccess(false);

    try {
      const response = await api.post<{
        success: boolean;
        data: {
          status: "ACCEPTED" | "REJECTED";
          reason: string;
          inspectionId: number | null;
          roboflowClasses: string[];
          predictions: any[];
        };
        error?: string;
      }>("/qc/analyze", {
        imageBase64,
        materialId: currentMaterialId,
        materialType,
        autoSave,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Gagal memproses gambar");
      }

      setQcResult({
        status: response.data.status,
        reason: response.data.reason,
        roboflowClasses: response.data.roboflowClasses,
        predictions: response.data.predictions,
      });

      if (autoSave) {
        setSaveSuccess(true);
        fetchHistory();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(
        `Layanan AI sedang tidak tersedia (${errMsg}). Silakan lakukan inspeksi manual menggunakan form di bawah.`
      );
      setShowManualForm(true);
    } finally {
      setIsInspecting(false);
    }
  };

  const saveToDatabase = async () => {
    if (!qcResult || !materialId.trim()) return;
    setIsSaving(true);
    try {
      let resultVal: "pass" | "fail" = "pass";
      let confidenceVal = 80;
      let notesVal = "";

      if (qcResult.status !== undefined) {
        // AI Roboflow Path
        resultVal = qcResult.status === "ACCEPTED" ? "pass" : "fail";
        notesVal = qcResult.reason || "";
        if (qcResult.predictions && qcResult.predictions.length > 0) {
          confidenceVal =
            (qcResult.predictions.reduce((sum, p) => sum + p.confidence, 0) /
              qcResult.predictions.length) *
            100;
        }
      } else {
        // Manual/Old Path
        resultVal = qcResult.result || "pass";
        confidenceVal = qcResult.confidence !== undefined ? qcResult.confidence : 80;
        notesVal = qcResult.notes || "";
      }

      const res = await api.post<{ success: boolean }>("/qc/inspect", {
        imageBase64,
        materialType,
        materialId: materialId.trim(),
        result: resultVal,
        confidence: confidenceVal,
        notes: notesVal,
      });

      if (res.success) {
        setSaveSuccess(true);
        fetchHistory();
      } else {
        throw new Error("Gagal menyimpan data");
      }
    } catch {
      setError("Gagal menyimpan hasil inspeksi ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetInspection = () => {
    setImageBase64(null);
    setQcResult(null);
    setSaveSuccess(false);
    setError(null);
    setMaterialId("");
    setShowManualForm(false);
    setManualResult("pass");
    setManualConfidence(80);
    setManualNotes("");
    setImageDimensions(null);
  };

  const submitManualInspection = () => {
    if (!materialId.trim()) {
      setError("Silakan masukkan Material/Batch ID.");
      return;
    }
    if (!manualNotes.trim()) {
      setError("Silakan masukkan catatan inspeksi manual.");
      return;
    }
    setQcResult({
      result: manualResult,
      confidence: manualConfidence,
      notes: `[Inspeksi Manual] ${manualNotes}`,
    });
    setShowManualForm(false);
    setError(null);
  };

  return (
    <div className="space-y-8 pb-16 text-left relative">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-neutral-800 tracking-tight font-sans">
          {t("qualityControl")}
        </h2>
        <p className="text-sm text-stone-500 font-semibold mt-1">
          Inspeksi kualitas material menggunakan AI vision analysis
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveTab("fruit-raw");
            resetInspection();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            activeTab === "fruit-raw"
              ? "bg-[#2C742F] text-white"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Leaf className="w-4 h-4" />
          Fruit & Raw Material
        </button>
        <button
          onClick={() => {
            setActiveTab("extract-powder");
            resetInspection();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            activeTab === "extract-powder"
              ? "bg-[#2C742F] text-white"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Extract & Powder
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Camera & Capture */}
        <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2C742F]" />
            Capture Material Image
          </h3>

          {/* Camera / Image Preview */}
          <div className="relative w-full bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 mb-4 flex items-center justify-center min-h-[300px]">
            {cameraActive && !imageBase64 ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover aspect-video"
              />
            ) : imageBase64 ? (
              <div className="relative inline-block w-full">
                <img
                  src={imageBase64}
                  alt="Captured material"
                  className="w-full h-auto block"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                />
                {/* Bounding Boxes */}
                {qcResult?.predictions && imageDimensions && qcResult.predictions.map((box, idx) => {
                  const left = Math.max(0, ((box.x - box.width / 2) / imageDimensions.width) * 100);
                  const top = Math.max(0, ((box.y - box.height / 2) / imageDimensions.height) * 100);
                  const width = (box.width / imageDimensions.width) * 100;
                  const height = (box.height / imageDimensions.height) * 100;

                  // Detect disease keywords
                  const isDisease = [
                    "spot",
                    "rot",
                    "rotten",
                    "blight",
                    "scab",
                    "disease",
                    "mildew",
                    "rust",
                    "bad",
                    "defect",
                  ].some((k) => box.class.toLowerCase().includes(k));
                  const borderColor = isDisease ? "border-[#00FFFF]" : "border-[#F0E620]";
                  const labelBg = isDisease ? "bg-[#00FFFF]" : "bg-[#F0E620]";

                  return (
                    <div
                      key={idx}
                      className={`absolute border-[2px] ${borderColor}`}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                    >
                      <div
                        className={`absolute -top-[22px] left-[-2px] ${labelBg} text-black text-[11px] font-bold px-1.5 py-0.5 whitespace-nowrap z-10 tracking-tight`}
                      >
                        {box.class} {Math.round(box.confidence * 100)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2 p-16">
                <Microscope className="w-12 h-12 opacity-40" />
                <span className="text-xs font-semibold">Belum ada gambar</span>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls */}
          <div className="flex flex-wrap gap-3">
            {!cameraActive && !imageBase64 && (
              <>
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white text-xs font-bold transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera
                </button>
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-bold cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                  <Upload className="w-4 h-4" />
                  Upload File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </>
            )}
            {cameraActive && !imageBase64 && (
              <>
                <button
                  onClick={captureImage}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white text-xs font-bold transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Capture
                </button>
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all active:scale-95"
                >
                  Stop Camera
                </button>
              </>
            )}
            {imageBase64 && (
              <button
                onClick={() => {
                  setImageBase64(null);
                  setQcResult(null);
                  setSaveSuccess(false);
                  setImageDimensions(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all active:scale-95"
              >
                Retake / Upload Baru
              </button>
            )}
          </div>

          {/* Material ID Input */}
          <div className="mt-5">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
              Material / Batch ID
            </label>
            <input
              type="text"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              placeholder="Contoh: BATCH-2024-001 (Kosongkan untuk auto-generate)"
              className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-semibold text-neutral-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
            />
          </div>

          {/* Inspect Button */}
          <button
            onClick={runInspection}
            disabled={isInspecting || !imageBase64}
            className="mt-5 w-full py-3 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isInspecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisis...
              </>
            ) : (
              <>
                <Microscope className="w-4 h-4" />
                Inspect with AI
              </>
            )}
          </button>

          {/* Auto Save Checkbox */}
          <div className="mt-3 flex items-start gap-2 px-1">
            <input
              type="checkbox"
              id="autoSave"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-[#2C742F] bg-stone-100 border-stone-300 rounded focus:ring-[#2C742F] cursor-pointer"
            />
            <label htmlFor="autoSave" className="text-xs font-semibold text-stone-600 cursor-pointer">
              Simpan hasil inspeksi secara otomatis ke database (Inspection History)
            </label>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          {/* Manual Inspection Form Fallback */}
          {showManualForm && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <Microscope className="w-4 h-4" />
                Form Inspeksi Manual
              </h4>
              <p className="text-xs text-amber-700">
                AI tidak tersedia atau bermasalah. Gunakan form ini untuk mencatat hasil inspeksi secara manual.
              </p>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Hasil Inspeksi
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setManualResult("pass")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      manualResult === "pass"
                        ? "bg-emerald-500 text-white"
                        : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    PASS
                  </button>
                  <button
                    onClick={() => setManualResult("fail")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      manualResult === "fail"
                        ? "bg-red-500 text-white"
                        : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    FAIL
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Confidence (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={manualConfidence}
                  onChange={(e) => setManualConfidence(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Catatan Inspeksi
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Deskripsikan kondisi material, defek yang ditemukan, dll."
                  rows={3}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-sm text-neutral-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                />
              </div>
              <button
                onClick={submitManualInspection}
                className="w-full py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all active:scale-[0.98]"
              >
                Submit Inspeksi Manual
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <Microscope className="w-5 h-5 text-[#2C742F]" />
            Inspection Result
          </h3>

          <AnimatePresence mode="wait">
            {qcResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                {/* Dynamic Alert Banner */}
                <div
                  className={`p-6 rounded-2xl border-2 flex flex-col gap-4 shadow-sm ${
                    qcResult.status === "ACCEPTED" || qcResult.result === "pass"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-red-50 border-red-300 text-red-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {qcResult.status === "ACCEPTED" || qcResult.result === "pass" ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-600" />
                    )}
                    <span className="text-2xl font-black uppercase">
                      {qcResult.status || (qcResult.result === "pass" ? "PASS" : "FAIL")}
                    </span>
                  </div>

                  {/* Confidence display */}
                  {(qcResult.confidence !== undefined ||
                    (qcResult.predictions && qcResult.predictions.length > 0)) && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-80">
                        Confidence Level
                      </span>
                      <span className="text-3xl font-black text-neutral-800 block">
                        {qcResult.confidence !== undefined
                          ? qcResult.confidence
                          : Math.round(
                              (qcResult.predictions!.reduce((sum, p) => sum + p.confidence, 0) /
                                qcResult.predictions!.length) *
                                100
                            )}
                        %
                      </span>
                      <div className="w-full bg-stone-200 rounded-full h-2 mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            qcResult.status === "ACCEPTED" || qcResult.result === "pass"
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            width: `${
                              qcResult.confidence !== undefined
                                ? qcResult.confidence
                                : (qcResult.predictions!.reduce((sum, p) => sum + p.confidence, 0) /
                                    qcResult.predictions!.length) *
                                  100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-80">
                      Alasan / Catatan Inspeksi
                    </span>
                    <p className="text-sm font-medium leading-relaxed bg-white/60 p-3 rounded-xl mb-3">
                      {qcResult.reason || qcResult.notes}
                    </p>
                  </div>
                </div>

                {saveSuccess ? (
                  <div className="w-full py-3 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-sm text-center flex items-center justify-center gap-2 mt-4">
                    <CheckCircle2 className="w-4 h-4" />
                    Tersimpan di database
                  </div>
                ) : (
                  <button
                    onClick={saveToDatabase}
                    disabled={isSaving}
                    className="w-full py-3 rounded-full bg-white border-2 border-stone-200 text-stone-700 hover:border-[#2C742F] hover:text-[#2C742F] font-bold text-sm text-center flex items-center justify-center gap-2 mt-4 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Simpan ke Database
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-stone-400 gap-3"
              >
                <Microscope className="w-16 h-16 opacity-30" />
                <p className="text-sm font-semibold">Belum ada hasil inspeksi</p>
                <p className="text-xs text-stone-400">
                  Ambil gambar material dan klik "Inspect with AI"
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Inspection History */}
      <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
        <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[#2C742F]" />
          Inspection History
        </h3>

        {historyLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#2C742F]" />
            <span className="text-sm text-stone-500 font-semibold">Memuat riwayat...</span>
          </div>
        ) : historyError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm font-semibold text-red-600">{historyError}</p>
            <button
              onClick={fetchHistory}
              className="px-4 py-2 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white text-xs font-bold transition-all active:scale-95"
            >
              Coba Lagi
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-stone-400">
            <p className="text-sm font-semibold">Belum ada riwayat inspeksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Material ID
                  </th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-white/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-neutral-800">
                      {record.materialId}
                    </td>
                    <td className="py-3 px-3 text-stone-600 capitalize">
                      {record.materialType}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          record.result === "pass"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {record.result === "pass" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {record.result.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-800">
                      {record.confidence}%
                    </td>
                    <td className="py-3 px-3 text-stone-600 max-w-[200px] truncate">
                      {record.notes || "-"}
                    </td>
                    <td className="py-3 px-3 text-stone-500 text-xs">
                      {new Date(record.inspectedAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
