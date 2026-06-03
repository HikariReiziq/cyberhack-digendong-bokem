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
  Sprout,
  Apple,
  Trash2,
  AlertTriangle,
  Video,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

type MaterialTab = "plant" | "fruit";

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

interface InterimResult {
  id: string;
  timestamp: string;
  accepted: number;
  rejected: number;
  total: number;
  avgConfidence: number;
  imageBase64: string;
  reason: string;
  status: string;
}

export default function QCPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<MaterialTab>("plant");
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [countObjects, setCountObjects] = useState(false);

  // Video counting state
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [videoCount, setVideoCount] = useState(0);
  const [acceptCount, setAcceptCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [isVideoInspecting, setIsVideoInspecting] = useState(false);
  const [interimResults, setInterimResults] = useState<InterimResult[]>([]);
  const recentCenters = useRef<{x: number, y: number, time: number}[]>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const materialType = activeTab === "plant" ? "plant" : "fruit";

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
      setHistoryError("Failed to load inspection history. Please check your connection and try again.");
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
      setIsVideoMode(false);
    } catch (err) {
      console.error("Camera access error:", err);
      setError(
        "Cannot access camera. Please allow camera permission in your browser, or use file upload instead."
      );
    }
  };

  const startVideo = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setIsVideoMode(true);
      setCountObjects(true); // Automatically start auto-inspecting
      setVideoCount(0);
      setAcceptCount(0);
      setRejectCount(0);
      setInterimResults([]);
      recentCenters.current = [];
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Cannot access camera.");
    }
  };

  const playAudioNotification = useCallback((status: "ACCEPTED" | "REJECTED") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (status === "ACCEPTED") {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.3);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  }, []);

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
    setIsVideoMode(false);
  };

  // Continuous video inference loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cameraActive && isVideoMode) {
      interval = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || isVideoInspecting) return;
        setIsVideoInspecting(true);
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const base64 = canvas.toDataURL("image/jpeg", 0.6); // Lower quality for faster inference
          
          try {
            const res = await api.post<{ success: boolean; data: any }>("/qc/analyze", {
              imageBase64: base64,
              materialId: `VID-${Date.now()}`,
              materialType,
              autoSave: false, // Don't spam database
            });
            
            if (res.success && res.data) {
              const preds = res.data.predictions || [];

              // Update visual boxes
              setQcResult(prev => ({
                ...prev,
                status: res.data.status,
                reason: res.data.reason,
                predictions: preds,
              }));

              let newCount = 0;
              let newObjectsConfSum = 0;
              const now = Date.now();
              const width = video.videoWidth;

              // Consider all detected objects on screen for auto-inspection
              const passingObjects = preds;

              let localAccept = 0;
              let localReject = 0;

              passingObjects.forEach((p: any) => {
                const isDuplicate = recentCenters.current.some(c => {
                  const dist = Math.sqrt(Math.pow(c.x - p.x, 2) + Math.pow(c.y - p.y, 2));
                  return dist < 150 && (now - c.time) < 4000;
                });
                
                if (!isDuplicate) {
                  newCount++;
                  newObjectsConfSum += (p.confidence || 0);
                  recentCenters.current.push({ x: p.x, y: p.y, time: now });
                  
                  const isDisease = [
                    "spot", "rot", "rotten", "blight", "scab", "disease", "mildew", "rust", "bad", "defect"
                  ].some((k) => p.class.toLowerCase().includes(k));
                  
                  if (isDisease) localReject++;
                  else localAccept++;
                }
              });

              recentCenters.current = recentCenters.current.filter(c => now - c.time < 4000);
              
              if (newCount > 0) {
                if (countObjects) {
                  setVideoCount(prev => prev + newCount);
                  if (localAccept > 0) setAcceptCount(prev => prev + localAccept);
                  if (localReject > 0) setRejectCount(prev => prev + localReject);
                }

                if (localAccept > 0) {
                  playAudioNotification("ACCEPTED");
                }
                if (localReject > 0) {
                  // Add a small delay if both are playing to avoid overlapping exactly
                  setTimeout(() => playAudioNotification("REJECTED"), localAccept > 0 ? 300 : 0);
                }
                
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
                const newBatchId = `BATCH-AUTO-${dateStr}-${randomStr}`;
                setMaterialId(newBatchId);
                
                const avgConf = Math.round((newObjectsConfSum / newCount) * 100) || 0;
                setInterimResults(prev => [{
                  id: newBatchId,
                  timestamp: new Date().toLocaleTimeString(),
                  accepted: localAccept,
                  rejected: localReject,
                  total: newCount,
                  avgConfidence: avgConf,
                  imageBase64: base64,
                  reason: res.data.reason,
                  status: res.data.status
                }, ...prev]);
              }
            }
          } catch (e) {
            console.error("Video inference error", e);
          } finally {
            setIsVideoInspecting(false);
          }
        }
      }, 1500); // Trigger inference every 1.5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cameraActive, isVideoMode, countObjects, materialType, isVideoInspecting]);

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
      setError("File size exceeds 2MB limit. Please upload a smaller image.");
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
    let currentImage = imageBase64;
    
    // Automatically capture if camera is active but no image captured yet
    if (!currentImage && cameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        currentImage = canvas.toDataURL("image/jpeg", 0.85);
        setImageBase64(currentImage);
        stopCamera();
      }
    }

    if (!currentImage) {
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
        imageBase64: currentImage,
        materialId: currentMaterialId,
        materialType,
        autoSave,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to process image");
      }

      setQcResult({
        status: response.data.status,
        reason: response.data.reason,
        roboflowClasses: response.data.roboflowClasses,
        predictions: response.data.predictions,
      });

      // Play Audio Notification
      if (response.data.status === "ACCEPTED" || response.data.status === "REJECTED") {
        playAudioNotification(response.data.status);
      }

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
    setVideoCount(0);
    setAcceptCount(0);
    setRejectCount(0);
    setInterimResults([]);
  };

  const saveInterimResults = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await Promise.all(interimResults.map(r => 
        api.post("/qc/inspect", {
          imageBase64: r.imageBase64,
          materialType,
          materialId: r.id,
          result: r.accepted >= r.rejected ? "pass" : "fail",
          confidence: r.avgConfidence,
          notes: `[Auto Video Inspection] ${r.reason} | Accepted: ${r.accepted}, Rejected: ${r.rejected}`
        })
      ));
      setSaveSuccess(true);
      fetchHistory();
      setInterimResults([]);
    } catch (e) {
      console.error(e);
      setError("Failed to save some interim results.");
    } finally {
      setIsSaving(false);
    }
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

  const deleteInspection = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/qc/history/${id}`);
      setHistory(prev => prev.filter(r => r.id !== id));
    } catch {
      setError("Failed to delete inspection record.");
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllHistory = async () => {
    setClearingAll(true);
    try {
      await api.delete("/qc/history");
      setHistory([]);
      setShowClearConfirm(false);
    } catch {
      setError("Failed to clear inspection history.");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 text-left relative">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-neutral-800 tracking-tight font-sans">
          {t("qualityControl")}
        </h2>
        <p className="text-sm text-stone-500 font-semibold mt-1">
          {t("qcSubtitle")}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveTab("plant");
            resetInspection();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            activeTab === "plant"
              ? "bg-[#2C742F] text-white"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Sprout className="w-4 h-4" />
          Plant
        </button>
        <button
          onClick={() => {
            setActiveTab("fruit");
            resetInspection();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            activeTab === "fruit"
              ? "bg-[#2C742F] text-white"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Apple className="w-4 h-4" />
          Fruit
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Panel: Camera & Capture */}
        <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2C742F]" />
            {t("qcCaptureImage")}
          </h3>

          {/* Camera / Image Preview */}
          <div className="relative w-full bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 mb-4 flex items-center justify-center min-h-[300px]">
            {cameraActive && !imageBase64 ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    setImageDimensions({
                      width: e.currentTarget.videoWidth,
                      height: e.currentTarget.videoHeight,
                    });
                  }}
                  className="w-full h-full object-cover aspect-video relative"
                />
                {isVideoMode && countObjects && (
                  <>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-2 rounded-xl font-mono text-xl z-20 border border-white/20 shadow-xl whitespace-nowrap">
                      Object Counted (In): {videoCount}
                    </div>
                    {/* Visual Line to simulate crossing */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 z-10" />
                  </>
                )}
                {/* Overlay Bounding Boxes for Video Mode */}
                {isVideoMode && qcResult?.predictions && imageDimensions && qcResult.predictions.map((box, idx) => {
                  const left = Math.max(0, ((box.x - box.width / 2) / imageDimensions.width) * 100);
                  const top = Math.max(0, ((box.y - box.height / 2) / imageDimensions.height) * 100);
                  const width = (box.width / imageDimensions.width) * 100;
                  const height = (box.height / imageDimensions.height) * 100;
                  
                  return (
                    <div
                      key={idx}
                      className="absolute border-[2px] border-[#F0E620] pointer-events-none transition-all duration-300"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                      }}
                    >
                      <div className="absolute -top-[22px] left-[-2px] bg-[#F0E620] text-black text-[11px] font-bold px-1.5 py-0.5 whitespace-nowrap z-10 tracking-tight pointer-events-none">
                        {box.class} {Math.round(box.confidence * 100)}%
                      </div>
                    </div>
                  );
                })}
              </>
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
                <span className="text-xs font-semibold">{t("qcNoImage")}</span>
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
                  {t("qcStartCamera")}
                </button>
                <button
                  onClick={startVideo}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <Video className="w-4 h-4" />
                  {t("qcStartVideo")}
                </button>
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-bold cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                  <Upload className="w-4 h-4" />
                  {t("qcUploadFile")}
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
                {!isVideoMode && (
                  <button
                    onClick={captureImage}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white text-xs font-bold transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    Capture
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all active:scale-95"
                >
                  {t("qcStopCamera")} / Video
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
                {t("qcRetake")}
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
              placeholder={t("qcBatchPlaceholder")}
              className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-semibold text-neutral-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2C742F]"
            />
          </div>

          {/* Inspect Button */}
          <button
            onClick={runInspection}
            disabled={isInspecting || (!imageBase64 && !cameraActive) || isVideoMode}
            className="mt-5 w-full py-3 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVideoMode ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Auto Inspect With AI...
              </>
            ) : isInspecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisis...
              </>
            ) : (
              <>
                <Microscope className="w-4 h-4" />
                {t("qcInspectAI")}
              </>
            )}
          </button>

          {/* Settings Checkboxes */}
          <div className="mt-4 flex flex-col gap-2">
            {isVideoMode && (
              <div className="flex items-start gap-2 px-1">
                <input
                  type="checkbox"
                  id="countObjects"
                  checked={countObjects}
                  onChange={(e) => setCountObjects(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#2C742F] bg-stone-100 border-stone-300 rounded focus:ring-[#2C742F] cursor-pointer"
                />
                <label htmlFor="countObjects" className="text-xs font-semibold text-stone-600 cursor-pointer">
                  {t("qcStartCounting")}
                </label>
              </div>
            )}

            <div className="flex items-start gap-2 px-1">
              <input
                type="checkbox"
                id="autoSave"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#2C742F] bg-stone-100 border-stone-300 rounded focus:ring-[#2C742F] cursor-pointer"
              />
              <label htmlFor="autoSave" className="text-xs font-semibold text-stone-600 cursor-pointer">
                {t("qcAutoSave")}
              </label>
            </div>
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
                Manual Inspection Form
              </h4>
              <p className="text-xs text-amber-700">
                AI is unavailable or encountered an error. Use this form to record inspection manually.
              </p>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  {t("qcInspectionResult")}
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
                  Inspection Notes
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Describe material condition, defects found, etc."
                  rows={3}
                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-sm text-neutral-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                />
              </div>
              <button
                onClick={submitManualInspection}
                className="w-full py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all active:scale-[0.98]"
              >
                {t("qcSubmitManual")}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <Microscope className="w-5 h-5 text-[#2C742F]" />
              {t("qcInspectionResult")}
            </h3>
            
            {/* Real-time Accept / Reject Counters in Video Mode */}
            {isVideoMode && countObjects && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept: {acceptCount}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                  <XCircle className="w-3.5 h-3.5" />
                  Reject: {rejectCount}
                </div>
              </div>
            )}
          </div>

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
                {(() => {
                  const isNotDetected = qcResult.status === "REJECTED" && 
                    (qcResult.reason?.toLowerCase().includes("no relevant objects") || qcResult.predictions?.length === 0);
                  
                  let bannerClass = qcResult.status === "ACCEPTED" || qcResult.result === "pass"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-red-50 border-red-300 text-red-800";
                  let Icon = qcResult.status === "ACCEPTED" || qcResult.result === "pass" ? CheckCircle2 : XCircle;
                  let title = qcResult.status || (qcResult.result === "pass" ? "PASS" : "FAIL");

                  if (isNotDetected) {
                    bannerClass = "bg-stone-50 border-stone-300 text-stone-600";
                    Icon = AlertTriangle;
                    title = "NOT DETECTED";
                  }

                  return (
                    <div className={`p-6 rounded-2xl border-2 flex flex-col gap-4 shadow-sm ${bannerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon className={`w-8 h-8 ${isNotDetected ? "text-stone-500" : (title === "ACCEPTED" || title === "PASS" ? "text-emerald-600" : "text-red-600")}`} />
                        <span className="text-2xl font-black uppercase">{title}</span>
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
                                title === "ACCEPTED" || title === "PASS"
                                  ? "bg-emerald-500"
                                  : isNotDetected ? "bg-stone-400" : "bg-red-500"
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
                          Inspection Notes / Reason
                        </span>
                        <p className="text-sm font-medium leading-relaxed bg-white/60 p-3 rounded-xl mb-3">
                          {qcResult.reason || qcResult.notes}
                        </p>
                      </div>

                      {countObjects && qcResult.predictions && (
                        <div className="border-t border-black/10 pt-4 mt-2">
                          <span className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-80">
                            Total Objects Detected
                          </span>
                          <span className="text-3xl font-black text-neutral-800 block">
                            {qcResult.predictions.length} <span className="text-lg text-neutral-500 font-bold ml-1">objects</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!isVideoMode && (
                  saveSuccess ? (
                    <div className="w-full py-3 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-sm text-center flex items-center justify-center gap-2 mt-4">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("qcSavedDb")}
                    </div>
                  ) : (
                    <button
                      onClick={saveToDatabase}
                      disabled={isSaving}
                      className="w-full py-3 rounded-full bg-white border-2 border-stone-200 text-stone-700 hover:border-[#2C742F] hover:text-[#2C742F] font-bold text-sm text-center flex items-center justify-center gap-2 mt-4 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Save to Database
                        </>
                      )}
                    </button>
                  )
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
                <p className="text-sm font-semibold">{t("qcNoResults")}</p>
                <p className="text-xs text-stone-400">
                  Capture material image and click "{t("qcInspectAI")}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Interim {t("qcInspectionResult")}s for Video Mode */}
      {(isVideoMode || interimResults.length > 0) && (
        <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)] mb-6 mt-6">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
               <History className="w-5 h-5 text-[#2C742F]" />
               Interim {t("qcInspectionResult")}s
               {interimResults.length > 0 && (
                 <span className="text-xs font-bold bg-[#2C742F]/10 text-[#2C742F] px-2 py-0.5 rounded-full ml-1 border border-[#2C742F]/20">
                   {t("qcTotalObjects")} {interimResults.reduce((sum, r) => sum + r.total, 0)}
                 </span>
               )}
             </h3>
             <div className="flex items-center gap-2">
               <button
                  onClick={() => {
                    setInterimResults([]);
                    setVideoCount(0);
                    setAcceptCount(0);
                    setRejectCount(0);
                  }}
                  className="px-4 py-2 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 font-bold text-xs transition-all active:scale-[0.98] flex items-center gap-2"
               >
                 Cancel
               </button>
               <button
                  onClick={saveInterimResults}
                  disabled={isSaving || interimResults.length === 0}
                  className="px-4 py-2 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {isSaving ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : <><Save className="w-4 h-4"/> Save to Database</>}
               </button>
             </div>
          </div>
          
          <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
             {interimResults.length === 0 ? (
                <div className="text-center text-stone-500 text-sm py-4">No results yet.</div>
             ) : (
               interimResults.map(res => (
                <div key={res.id} className="p-4 bg-white border border-stone-200 rounded-xl flex flex-col md:flex-row md:items-center gap-4">
                   <div className="flex-1">
                      <div className="font-bold text-sm text-neutral-800">{res.id}</div>
                      <div className="text-xs text-stone-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3"/> {res.timestamp}</div>
                   </div>
                   <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                      <span className={`px-2.5 py-1.5 rounded-lg ${res.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {t("qcResultText")} {res.status}
                      </span>
                      <span className="px-2.5 py-1.5 bg-stone-100 text-stone-700 rounded-lg">{t("qcObjectText")} {res.total}</span>
                      <span className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg">{t("qcConfidenceText")} {res.avgConfidence}%</span>
                      <button
                        onClick={() => {
                          setInterimResults(prev => prev.filter(item => item.id !== res.id));
                          setVideoCount(prev => prev - res.total);
                          setAcceptCount(prev => prev - res.accepted);
                          setRejectCount(prev => prev - res.rejected);
                        }}
                        className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all ml-1"
                        title="Remove item"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
               ))
             )}
          </div>
        </div>
      )}

      {/* {t("qcHistory")} */}
      <div className="bg-[#F5FBF3] rounded-3xl p-6 border border-[#2C742F]/10 shadow-[6px_6px_54px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
            <History className="w-5 h-5 text-[#2C742F]" />
            {t("qcHistory")}
            {history.length > 0 && (
              <>
                <span className="text-xs font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                  {history.length} batches
                </span>
                <span className="text-xs font-bold bg-[#2C742F]/10 text-[#2C742F] px-2 py-0.5 rounded-full border border-[#2C742F]/20">
                  {t("qcTotalObjects")} {history.reduce((sum, record) => {
                    if (record.notes?.includes("[Auto Video Inspection]")) {
                      const match = record.notes.match(/Accepted: (\d+), Rejected: (\d+)/);
                      if (match) return sum + parseInt(match[1]) + parseInt(match[2]);
                      return sum;
                    }
                    if (record.notes?.toLowerCase().includes("no relevant objects")) {
                      return sum;
                    }
                    const staticMatch = record.notes?.match(/\(([^)]+)\)/);
                    if (staticMatch) {
                      return sum + staticMatch[1].split(',').length;
                    }
                    return sum + 1;
                  }, 0)}
                </span>
              </>
            )}
          </h3>
          {history.length > 0 && !historyLoading && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {/* Clear All Confirmation */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2 text-sm text-red-700 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Delete all {history.length} inspection records? This cannot be undone.
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-full border border-stone-200 bg-white text-stone-600 text-xs font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={clearAllHistory}
                  disabled={clearingAll}
                  className="px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {clearingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  {clearingAll ? "Deleting..." : "Delete All"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {historyLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#2C742F]" />
            <span className="text-sm text-stone-500 font-semibold">{t("qcLoadingHistory")}</span>
          </div>
        ) : historyError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm font-semibold text-red-600">{historyError}</p>
            <button
              onClick={fetchHistory}
              className="px-4 py-2 rounded-full bg-[#2C742F] hover:bg-[#2C742F]/90 text-white text-xs font-bold transition-all active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-stone-400">
            <History className="w-10 h-10 opacity-20 mx-auto mb-2" />
            <p className="text-sm font-semibold">{t("qcNoHistory")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Material ID</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Type</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Result</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Objects</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Confidence</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Notes</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-3 text-xs font-bold text-stone-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-white/50 transition-colors group">
                    <td className="py-3 px-3 font-semibold text-neutral-800">{record.materialId}</td>
                    <td className="py-3 px-3 text-stone-600 capitalize">{record.materialType}</td>
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
                    <td className="py-3 px-3 text-stone-600 font-semibold">
                      {(() => {
                        if (record.notes?.includes("[Auto Video Inspection]")) {
                          const match = record.notes.match(/Accepted: (\d+), Rejected: (\d+)/);
                          if (match) return parseInt(match[1]) + parseInt(match[2]);
                          return 0;
                        }
                        if (record.notes?.toLowerCase().includes("no relevant objects")) {
                          return 0;
                        }
                        const staticMatch = record.notes?.match(/\(([^)]+)\)/);
                        if (staticMatch) {
                          return staticMatch[1].split(',').length;
                        }
                        return 1;
                      })()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-800">
                      {Math.round(record.confidence)}%
                    </td>
                    <td className="py-3 px-3 text-stone-600 max-w-[200px] truncate">
                      {record.notes || "-"}
                    </td>
                    <td className="py-3 px-3 text-stone-500 text-xs whitespace-nowrap">
                      {new Date(record.inspectedAt).toLocaleString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => deleteInspection(record.id)}
                        disabled={deletingId === record.id}
                        className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        title="Delete record"
                      >
                        {deletingId === record.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
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
