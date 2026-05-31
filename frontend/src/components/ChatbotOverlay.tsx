'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User as UserIcon, X, Loader2, MessageSquare,
  Paperclip, Lightbulb, Package, AlertTriangle, Calendar, Snowflake, Clock,
  FileDown, BarChart2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { callGemini } from '@/lib/gemini';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import type { ChatMessage } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = html.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const dataRows = rows.filter(l => !/^\s*\|[\s\-:|]+\|\s*$/.test(l));
      if (dataRows.length) {
        let t = '<table style="border-collapse:collapse;width:100%;font-size:11px;margin:8px 0;box-shadow:0 1px 3px rgba(0,0,0,0.05);border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">';
        dataRows.forEach((row, ri) => {
          const cells = row.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1);
          t += `<tr style="${ri % 2 === 0 && ri > 0 ? 'background-color:#f9fafb' : ''}">`;
          cells.forEach(c => { 
            const tag = ri === 0 ? 'th' : 'td'; 
            t += `<${tag} style="border:1px solid #e5e7eb;padding:6px 10px;text-align:left;${ri === 0 ? 'background:#2C742F;color:white;font-weight:700' : 'color:#374151'}">${inline(c.trim())}</${tag}>`; 
          });
          t += '</tr>';
        });
        out.push(t + '</table>');
      }
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++; }
      out.push('<ul style="margin:4px 0;padding-left:18px">' + items.map(it => `<li style="margin:2px 0">${inline(it)}</li>`).join('') + '</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push('<ol style="margin:4px 0;padding-left:18px">' + items.map(it => `<li style="margin:2px 0">${inline(it)}</li>`).join('') + '</ol>');
      continue;
    }
    if (/^\s*#{1,4}\s+/.test(line)) {
      const m = line.match(/^\s*(#{1,4})\s+(.*)/);
      if (m) { out.push(`<p style="font-weight:700;margin:6px 0 2px">${inline(m[2])}</p>`); i++; continue; }
    }
    if (line.trim() === '') { out.push('<br/>'); i++; continue; }
    out.push(`<p style="margin:2px 0;line-height:1.5">${inline(line)}</p>`);
    i++;
  }
  return out.join('');
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;border-radius:3px;padding:1px 4px;font-family:monospace;font-size:11px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function downloadPdfReport(text: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const htmlContent = renderMarkdown(text);
  
  printWindow.document.write(`
    <html>
      <head>
        <title>AromaSys - Laporan AI Copilot</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            color: #1f2937;
            padding: 40px;
            line-height: 1.5;
          }
          .header {
            border-bottom: 2px solid #2c742f;
            padding-bottom: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #2c742f;
          }
          .subtitle {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #6b7280;
            font-weight: 750;
            margin-top: 2px;
          }
          .date {
            font-size: 11px;
            color: #6b7280;
            font-weight: 600;
          }
          h1, h2, h3, p {
            margin-top: 15px;
            margin-bottom: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12px;
          }
          th {
            background-color: #2c742f;
            color: white;
            font-weight: 700;
            text-align: left;
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
          }
          td {
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 60px;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            font-size: 10px;
            color: #9ca3af;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">AromaSys</div>
            <div class="subtitle">Sistem Manajemen Aroma - Laporan AI</div>
          </div>
          <div class="date">Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
        </div>
        
        <div class="content">
          ${htmlContent}
        </div>
        
        <div class="footer">
          Laporan ini dihasilkan otomatis oleh Aro - AI Copilot AromaSys. Kritis & Rahasia.
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export default function ChatbotOverlay({ isOpen, onClose, messages, setMessages }: Props) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbContext, setDbContext] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64: string; type: string } | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [fileToast, setFileToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userAvatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=2C742F&color=fff&size=200`;

  const handleClearHistory = () => {
    setShowConfirmClear(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileToast(lang === 'en' ? 'Only image files are supported for AI analysis.' : 'Hanya file gambar yang didukung untuk analisis AI.');
      setTimeout(() => setFileToast(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setAttachedFile({
        name: file.name,
        base64: base64Data,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const INSIGHTS = [
    {
      title: t('insightLowStock'),
      description: t('insightLowStockDesc'),
      query: lang === 'en'
        ? 'Check all raw materials with stock level below the minimum threshold (low stock). Present as a table.'
        : 'Tolong cek bahan baku yang tingkat stoknya di bawah batas minimum (hampir habis). Sajikan dalam tabel.',
      color: 'emerald',
      icon: Package
    },
    {
      title: t('insightExpiring'),
      description: t('insightExpiringDesc'),
      query: lang === 'en'
        ? 'Show all inventory items expiring this month. Present as a table with name, qty, zone, and expiry date.'
        : 'Tampilkan bahan baku yang kedaluwarsa bulan ini. Sajikan dalam tabel dengan nama, qty, zona, dan tanggal kedaluwarsa.',
      color: 'red',
      icon: AlertTriangle
    },
    {
      title: t('insightPPIC'),
      description: t('insightPPICDesc'),
      query: lang === 'en'
        ? 'Draft an optimal PPIC production schedule based on current inventory levels and demand. Use a table format.'
        : 'Buat draf jadwal produksi (PPIC) optimal berdasarkan data inventaris dan permintaan saat ini. Gunakan format tabel.',
      color: 'amber',
      icon: Calendar
    },
    {
      title: t('insightColdStorage'),
      description: t('insightColdStorageDesc'),
      query: lang === 'en'
        ? 'Find all empty slots in Cold Storage (Zone D). Show as a table with slot ID and zone.'
        : 'Cari slot kosong di Cold Storage (Zona D). Tampilkan dalam tabel dengan ID slot dan zona.',
      color: 'blue',
      icon: Snowflake
    },
    {
      title: t('insightGenerateReport'),
      description: t('insightGenerateReportDesc'),
      query: lang === 'en'
        ? 'Generate a complete inventory report as a markdown table with columns: Name, Category, Qty, Unit, Zone/Location, Status, Expiry Date. Include all items and make it downloadable as PDF.'
        : 'Buat laporan inventori lengkap dalam format tabel markdown dengan kolom: Nama, Kategori, Qty, Unit, Zona/Lokasi, Status, Tanggal Kedaluwarsa. Sertakan semua item dan buatkan laporan PDF.',
      color: 'green',
      icon: BarChart2
    },
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  // Set the sync time dynamically on open
  useEffect(() => {
    if (isOpen) {
      setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
  }, [isOpen]);

  // Load inventory, layout, slots, and temperature context when panel opens
  useEffect(() => {
    async function loadCtx() {
      try {
        const [invData, slotsData, tempData] = await Promise.all([
          api.get<{ success: boolean; items: any[] }>('/inventory'),
          api.get<{ success: boolean; slots: any[] }>('/slots'),
          api.get<{ success: boolean; temperatures: any }>('/cold-chain').catch(() => ({ success: false, temperatures: {} }))
        ]);

        const savedFloors = localStorage.getItem('aromasys_floors');
        let floorsCtx = [];
        if (savedFloors) {
          try { floorsCtx = JSON.parse(savedFloors); } catch {}
        }

        const contextObj = {
          inventory: invData.success ? invData.items.map(i => ({ id: i.id, name: i.name, category: i.category, qty: i.qty, unit: i.unit, status: i.status })) : [],
          dbSlots: slotsData.success ? slotsData.slots.map(s => ({ id: s.id, zone: s.zone, occupied: s.occupied, itemId: s.itemId })) : [],
          temperatures: tempData.success ? tempData.temperatures : {},
          customLayouts: floorsCtx.map((f: any) => ({
            layoutName: f.name,
            zones: f.interactiveZones.map((z: any) => ({
              zoneId: z.id,
              zoneName: z.name,
              materials: z.materials?.map((m: any) => ({ id: m.id, name: m.name, qty: m.qty, unit: m.unit })) || []
            }))
          }))
        };

        setDbContext(JSON.stringify(contextObj));
      } catch (err) {
        console.error("Failed loading chatbot context:", err);
      }
    }
    if (isOpen) Promise.resolve().then(loadCtx);
  }, [isOpen]);

  async function sendMessage(text: string) {
    if (!text.trim() && !attachedFile) return;
    if (isLoading) return;

    const fileToUpload = attachedFile;
    setAttachedFile(null);

    const userMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: text.trim() || (lang === 'en' ? 'Uploaded an image for analysis' : 'Mengunggah gambar untuk dianalisis'),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      image: fileToUpload ? `data:${fileToUpload.type};base64,${fileToUpload.base64}` : undefined
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const langInstruction = lang === 'en'
      ? 'Always respond in English.'
      : 'Selalu jawab dalam Bahasa Indonesia.';
    const systemPrompt = `You are Aro, the AromaSys AI Copilot — an expert warehouse AI assistant for SIMA AROME (Sistem Manajemen Aroma). ${langInstruction}

WAREHOUSE DATA CONTEXT:
${dbContext || 'Warehouse management system for aromatic materials'}

FORMATTING RULES & RESPONSE GUIDELINES (MANDATORY):
1. For structured data with more than 2 rows (like inventory lists, stock levels, temperature sensors, expiry dates, or zones), you MUST present it as a clean markdown table.
2. Always include a header separator row (|---|---|) after the header row.
3. IMPORTANT: Along with every table, you MUST provide a detailed, informative analysis and explanation of the data. Summarize the key findings, highlight any potential anomalies or alerts (such as low stock, expiring batches, or temperature excursions), and give professional, actionable warehouse management advice. Do NOT just output a bare table.
4. If an image is provided, analyze the image carefully (it could be a purchase order, invoice, report, or screenshot), extract relevant data, compare it to the current WMS context if necessary, and write a detailed analysis.`;
    const prompt = `${systemPrompt}\n\nUser: ${userMsg.text}`;

    let responseText = '';
    try {
      if (fileToUpload) {
        responseText = await callGemini(prompt, fileToUpload.base64, fileToUpload.type);
      } else {
        responseText = await callGemini(prompt);
      }
    } catch (err) {
      console.error("Gemini call error:", err);
      responseText = lang === 'en'
        ? 'Sorry, the AI service is temporarily unavailable. Core operations (inventory, FIFO, cold chain) are running normally. Please try again later.'
        : 'Maaf, layanan AI sedang tidak tersedia untuk sementara. Operasi gudang inti (inventaris, FIFO, cold chain) tetap berjalan normal. Silakan coba lagi nanti.';
    }

    const aiMsg: ChatMessage = {
      id: Date.now() + 1,
      sender: 'ai',
      text: responseText,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Centered Modal Card */}
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] max-h-[750px] flex flex-col border border-stone-200 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-white px-5 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 bg-emerald-50 border border-[#2C742F]/10 rounded-xl flex items-center justify-center text-[#2C742F] shrink-0 shadow-sm">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-800 text-base leading-tight">{t('chatbotTitle')}</h3>
                    <p className="text-[10px] font-extrabold text-[#79747E] uppercase tracking-wider mt-0.5">
                      {t('chatbotSub')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-250 text-stone-500 hover:text-red-600 hover:border-red-200 transition-all text-xs font-bold focus:outline-none shadow-sm mr-2"
                  >
                    <Trash2 size={13} />
                    <span>{lang === 'en' ? 'Clear Chat' : 'Hapus Riwayat'}</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-stone-100 bg-white border border-stone-250 text-stone-400 hover:text-stone-750 transition-all focus:outline-none shadow-sm"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body split into 2 columns */}
              <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white divide-y md:divide-y-0 md:divide-x divide-stone-100">
                
                {/* Left Column: Chat Thread */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-left">
                    {messages.map((msg, index) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 w-full mb-2 ${
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* AI Avatar */}
                        {msg.sender === 'ai' && (
                          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-[#2C742F]/10 flex items-center justify-center text-[#2C742F] shrink-0 shadow-sm">
                            <Bot size={15} />
                          </div>
                        )}

                        {/* Bubble */}
                        <div className={`max-w-[75%] flex flex-col ${
                          msg.sender === 'user' ? 'items-end' : 'items-start'
                        }`}>
                          <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                            msg.sender === 'user'
                              ? 'bg-[#2C742F] text-white rounded-tr-sm font-semibold'
                              : 'bg-[#F2F7ED] border border-[#AAE970]/10 text-stone-850 rounded-tl-sm font-medium'
                          }`}>
                            {msg.sender === 'ai'
                              ? (
                                  <div className="space-y-2">
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                                    {msg.text.includes('|') && (
                                      <button
                                        onClick={() => downloadPdfReport(msg.text)}
                                        className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-[#2C742F] text-white text-[10px] font-bold hover:bg-[#366306] transition-all shadow-sm active:scale-95 border border-[#AAE970]/10"
                                      >
                                        <FileDown className="w-3.5 h-3.5" /> {t('downloadReport')}
                                      </button>
                                    )}
                                  </div>
                                )
                              : <p className="margin-0">{msg.text}</p>}
                          </div>
                          {msg.image && (
                            <div className="mt-2 max-w-xs rounded-lg overflow-hidden border border-stone-200 shadow-sm bg-white">
                              <img src={msg.image} alt="Uploaded file" className="w-full max-h-48 object-contain" />
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-[#79747E] mt-1 block px-1">
                            {msg.time}
                          </span>
                        </div>

                        {/* User Avatar */}
                        {msg.sender === 'user' && (
                          <div className="w-8 h-8 rounded-full border border-emerald-700/20 overflow-hidden shrink-0 shadow-sm bg-white">
                            <img
                              src={userAvatarUrl}
                              alt={user?.name || "User"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="flex items-start gap-3 justify-start w-full">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 border border-[#2C742F]/10 flex items-center justify-center text-[#2C742F] shrink-0 shadow-sm animate-pulse">
                          <Bot size={15} />
                        </div>
                        <div className="bg-[#F2F7ED] border border-[#AAE970]/10 rounded-2xl rounded-tl-sm p-3.5 flex gap-1 items-center shadow-sm">
                          {[0, 150, 300].map(d => (
                            <div
                              key={d}
                              className="w-2.5 h-2.5 rounded-full bg-[#2C742F] animate-bounce"
                              style={{ animationDelay: `${d}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input and Disclaimer Footer */}
                  <div className="p-5 border-t border-stone-100 flex flex-col gap-2 shrink-0 bg-white">
                    {/* Attachment preview banner */}
                    {attachedFile && (
                      <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl mb-1 text-xs text-emerald-800 font-semibold animate-fadeIn">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase">Image</span>
                          <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                        </div>
                        <button 
                          onClick={() => setAttachedFile(null)}
                          className="p-0.5 rounded-full hover:bg-emerald-100 text-emerald-700 focus:outline-none"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 px-4 py-2 border border-stone-200 rounded-full focus-within:ring-2 focus-within:ring-[#2C742F]/20 focus-within:border-[#2C742F] transition-all bg-stone-50/50 shadow-inner">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <Paperclip 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-5 h-5 text-stone-400 hover:text-stone-600 cursor-pointer shrink-0" 
                      />
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendMessage(input); }}
                        placeholder={lang === 'en' ? 'Ask about stock, expiry, or operations...' : 'Tanya tentang stok, kedaluwarsa, atau operasi...'}
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-xs text-stone-850 placeholder:text-stone-400 focus:outline-none py-1.5"
                      />
                      <button
                        onClick={() => sendMessage(input)}
                        disabled={isLoading || (!input.trim() && !attachedFile)}
                        className="w-8 h-8 rounded-full bg-[#2C742F] hover:bg-[#366306] text-white flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95 shadow-md shadow-[#2C742F]/15"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                    <p className="text-[9px] text-stone-400 text-center font-semibold mt-1">
                      {lang === 'en' ? 'AromaSys AI can make mistakes. Verify critical production data.' : 'AI AromaSys dapat membuat kesalahan. Verifikasi data produksi penting.'}
                    </p>
                  </div>
                </div>

                {/* Right Column: Quick Insights */}
                <div className="w-80 shrink-0 hidden md:flex flex-col bg-[#F5FBF3]/45 p-5 min-h-0 text-left justify-between border-l border-stone-100">
                  <div className="flex-1 overflow-y-auto max-h-[85%] pr-1 space-y-4">
                    <div className="flex items-center gap-2 text-stone-700 font-extrabold text-sm mb-4 border-b border-[#2C742F]/10 pb-2">
                      <Lightbulb className="w-4 h-4 text-[#2C742F] animate-pulse" />
                      <span>{lang === 'en' ? 'Quick Insights' : 'Wawasan Cepat'}</span>
                    </div>

                    {INSIGHTS.map((insight) => {
                      const Icon = insight.icon;
                      let colorClass = '';
                      let bgClass = '';
                      let borderClass = '';

                      if (insight.color === 'emerald') {
                        colorClass = 'text-emerald-600';
                        bgClass = 'bg-emerald-50';
                        borderClass = 'border-emerald-200/50 hover:bg-emerald-50/10';
                      } else if (insight.color === 'red') {
                        colorClass = 'text-red-500';
                        bgClass = 'bg-red-50';
                        borderClass = 'border-red-200/50 hover:bg-red-50/10';
                      } else if (insight.color === 'amber') {
                        colorClass = 'text-amber-600';
                        bgClass = 'bg-amber-50';
                        borderClass = 'border-amber-200/50 hover:bg-amber-50/10';
                      } else if (insight.color === 'green') {
                        colorClass = 'text-[#2C742F]';
                        bgClass = 'bg-emerald-50';
                        borderClass = 'border-emerald-300/50 hover:bg-emerald-50/10';
                      } else {
                        colorClass = 'text-blue-500';
                        bgClass = 'bg-blue-50';
                        borderClass = 'border-blue-200/50 hover:bg-blue-50/10';
                      }

                      return (
                        <button
                          key={insight.title}
                          onClick={() => sendMessage(insight.query)}
                          disabled={isLoading}
                          className={`w-full text-left p-3.5 bg-white border ${borderClass} rounded-2xl transition-all shadow-sm hover:scale-[1.01] active:scale-98 cursor-pointer flex gap-3 items-start disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className={`w-8 h-8 rounded-xl ${bgClass} flex items-center justify-center ${colorClass} shrink-0`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-stone-850 leading-snug">{insight.title}</h4>
                            <p className="text-[10px] font-semibold text-stone-400 mt-1 leading-normal">{insight.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-[#2C742F]/10 space-y-2 mt-4 shrink-0 bg-transparent text-left">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2C742F] tracking-wider uppercase">
                      <Clock size={12} className="text-[#2C742F]" />
                      <span>{lang === 'en' ? 'System Status' : 'Status Sistem'}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-[#79747E] leading-normal">
                      {lang === 'en' ? `Connected to ERP Database. Last sync: ${lastSyncTime || '07:59 PM'}.` : `Terhubung ke Database ERP. Sinkronisasi terakhir: ${lastSyncTime || '07:59 PM'}.`}
                    </p>
                  </div>
                </div>

              </div>

              {/* File Toast Notification */}
              <AnimatePresence>
                {fileToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-white border border-red-200 rounded-xl shadow-lg max-w-sm"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shrink-0">
                      <AlertTriangle size={14} />
                    </div>
                    <p className="text-[11px] font-semibold text-stone-700 leading-snug">{fileToast}</p>
                    <button onClick={() => setFileToast(null)} className="ml-auto p-0.5 rounded-full hover:bg-stone-100 text-stone-400 shrink-0 focus:outline-none">
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom Confirm Clear History Dialog */}
              <AnimatePresence>
                {showConfirmClear && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                  >
                    <motion.div
                      initial={{ scale: 0.95, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.95, y: 15 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      className="bg-white rounded-3xl p-6 max-w-sm w-full border border-stone-200/80 shadow-2xl flex flex-col items-center text-center space-y-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shadow-sm shrink-0">
                        <Trash2 size={22} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-stone-850 text-base leading-tight">
                          {lang === 'en' ? 'Clear Chat History?' : 'Hapus Riwayat Obrolan?'}
                        </h3>
                        <p className="text-[11px] font-semibold text-stone-400 leading-normal">
                          {lang === 'en' 
                            ? 'This action cannot be undone. All your conversations with Aro will be cleared.'
                            : 'Tindakan ini tidak dapat dibatalkan. Semua riwayat percakapan Anda dengan Aro akan dihapus.'}
                        </p>
                      </div>
                      <div className="flex gap-3 w-full pt-1.5">
                        <button
                          onClick={() => setShowConfirmClear(false)}
                          className="flex-1 py-2.5 rounded-xl border border-stone-250 hover:bg-stone-50 text-stone-600 hover:text-stone-800 transition-all font-bold text-xs focus:outline-none"
                        >
                          {lang === 'en' ? 'Cancel' : 'Batal'}
                        </button>
                        <button
                          onClick={() => {
                            setMessages([
                              { id: 1, sender: 'ai', text: t('chatbotGreeting'), time: '08:00' }
                            ]);
                            setShowConfirmClear(false);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all font-bold text-xs focus:outline-none shadow-md shadow-red-500/10"
                        >
                          {lang === 'en' ? 'Clear' : 'Hapus'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
