'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User as UserIcon, X,
  Paperclip, AlertTriangle,
  Calendar, Package, Thermometer, FileText,
  Lightbulb, Clock
} from 'lucide-react';
import { getDynamicZones, CATEGORIES } from '@/lib/mockData';
import './ChatbotOverlay.css';

const getNextMsgId = () => {
  return Date.now() + Math.random();
};

/**
 * renderMarkdown — Converts common Markdown patterns from Gemini responses to HTML.
 * Handles: headers, bold, italic, code blocks, bullet/numbered lists, tables, line breaks.
 */
function renderMarkdown(text) {
  if (!text) return '';

  // Escape HTML entities to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split into lines for block-level processing
  const lines = html.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- Tables: detect lines starting with | ---
    if (/^\s*\|/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // Filter out separator rows (e.g., |---|---|)
      const dataRows = tableLines.filter(l => !/^\s*\|[\s\-:|]+\|\s*$/.test(l));
      if (dataRows.length > 0) {
        let tableHtml = '<table class="chatbot-md-table">';
        dataRows.forEach((row, rowIdx) => {
          const cells = row.split('|').filter((c, ci, arr) => ci > 0 && ci < arr.length - 1);
          const tag = rowIdx === 0 ? 'th' : 'td';
          const rowTag = rowIdx === 0 ? 'thead' : (rowIdx === 1 ? 'tbody' : '');
          if (rowIdx === 0) tableHtml += '<thead>';
          if (rowIdx === 1) tableHtml += '<tbody>';
          tableHtml += '<tr>';
          cells.forEach(cell => {
            tableHtml += `<${tag}>${applyInlineFormatting(cell.trim())}</${tag}>`;
          });
          tableHtml += '</tr>';
          if (rowIdx === 0) tableHtml += '</thead>';
        });
        if (dataRows.length > 1) tableHtml += '</tbody>';
        tableHtml += '</table>';
        result.push(tableHtml);
      }
      continue;
    }

    // --- Unordered list: lines starting with -, *, or • ---
    if (/^\s*[-*•]\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i++;
      }
      result.push('<ul>' + listItems.map(item => `<li>${applyInlineFormatting(item)}</li>`).join('') + '</ul>');
      continue;
    }

    // --- Ordered list: lines starting with number. ---
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      result.push('<ol>' + listItems.map(item => `<li>${applyInlineFormatting(item)}</li>`).join('') + '</ol>');
      continue;
    }

    // --- Headers: ### Header ---
    if (/^\s*#{1,4}\s+/.test(line)) {
      const match = line.match(/^\s*(#{1,4})\s+(.*)/);
      if (match) {
        const level = Math.min(match[1].length + 1, 6); // ### → h4, ## → h3, etc. (shift down one)
        result.push(`<h${level}>${applyInlineFormatting(match[2])}</h${level}>`);
        i++;
        continue;
      }
    }

    // --- Empty line → paragraph break ---
    if (line.trim() === '') {
      result.push('<br/>');
      i++;
      continue;
    }

    // --- Regular text line ---
    result.push(`<p>${applyInlineFormatting(line)}</p>`);
    i++;
  }

  return result.join('');
}

/**
 * applyInlineFormatting — Handles inline markdown: bold, italic, code, links.
 */
function applyInlineFormatting(text) {
  if (!text) return '';

  return text
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* (but not inside bold which is already replaced)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** Quick Insight cards data */
const QUICK_INSIGHTS = [
  {
    id: 'low-stock',
    title: 'Check Low Stock Items',
    description: 'Identify raw botanical materials dropping below minimum thresholds.',
    borderColor: 'green',
    icon: Package,
    iconColor: '#2E7D32',
    iconBg: '#E8F5E9',
    prompt: 'Which raw materials are currently below minimum stock levels?',
  },
  {
    id: 'expiring-lots',
    title: 'Show Expiring Lots This Month',
    description: 'Review all inventory lots nearing expiration to prioritize usage.',
    borderColor: 'red',
    icon: AlertTriangle,
    iconColor: '#C62828',
    iconBg: '#FDECEA',
    prompt: 'Show me all lots expiring within the next 30 days.',
  },
  {
    id: 'ppic-schedule',
    title: 'Generate Optimal PPIC Schedule',
    description: 'Draft a production schedule based on current inventory and demand.',
    borderColor: 'lime',
    icon: Calendar,
    iconColor: '#E65100',
    iconBg: '#FFF3E0',
    prompt: 'Generate an optimal PPIC production schedule based on current inventory.',
  },
  {
    id: 'cold-storage',
    title: 'Find Empty Cold Storage Slots',
    description: 'Locate available pallet positions in climate-controlled zones.',
    borderColor: 'mint',
    icon: Thermometer,
    iconColor: '#1565C0',
    iconBg: '#E3F2FD',
    prompt: 'Which cold storage slots are currently empty and available?',
  },
];

/**
 * ChatbotOverlay — Modal overlay chat component (Figma-matched)
 * Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 14.6
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - messages: array of message objects
 * - setMessages: state setter for messages
 */
export default function ChatbotOverlay({ isOpen, onClose, messages, setMessages }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFileData, setAttachedFileData] = useState(null);
  const messagesEndRef = useRef(null);
  const overlayRef = useRef(null);
  const inputRef = useRef(null);
  const previousFocusRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus management: trap focus inside overlay when open, return focus on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Close on Escape key + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && overlayRef.current) {
        const focusableElements = overlayRef.current.querySelectorAll(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl?.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Helper to fetch live database context for Gemini LLM
  const fetchDatabaseContext = async () => {
    try {
      const [invRes, slotsRes, tempRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/slots'),
        fetch('/api/cold-chain')
      ]);

      const invData = await invRes.json();
      const slotsData = await slotsRes.json();
      const tempData = await tempRes.json();

      return {
        inventory: invData.success ? invData.items : [],
        slots: slotsData.success ? slotsData.slots : [],
        temperatures: tempData.success ? tempData.temperatures : {}
      };
    } catch (error) {
      console.error('Error fetching database context for AI:', error);
      return null;
    }
  };

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isTyping) return;

    const userMsg = {
      id: getNextMsgId(),
      sender: 'user',
      text: attachedFile ? `${msg}\n📎 ${attachedFile.name}` : msg,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentFileData = attachedFileData;
    const currentFile = attachedFile;
    setAttachedFile(null);
    setAttachedFileData(null);
    setIsTyping(true);

    try {
      // 1. Fetch live database context
      const dbContext = await fetchDatabaseContext();

      // Optimize context: only send relevant fields to reduce token count
      let contextText = 'Failed to retrieve database content.';
      if (dbContext) {
        const compactInventory = dbContext.inventory.map(i => ({
          name: i.name, qty: i.qty, unit: i.unit, category: i.category,
          location: i.location, expiry: i.expiry, minStock: i.minStock
        }));
        const compactSlots = dbContext.slots.map(s => ({
          id: s.id, zone: s.zone, occupied: s.occupied, itemName: s.item?.name
        }));
        contextText = `
- Categories: ${JSON.stringify(CATEGORIES)}
- Zones: ${JSON.stringify(getDynamicZones().map(z => ({ id: z.id, name: z.name, type: z.type, tempMin: z.tempMin, tempMax: z.tempMax })))}
- Inventory: ${JSON.stringify(compactInventory)}
- Slots: ${JSON.stringify(compactSlots)}
- Cold-Chain Temps: ${JSON.stringify(dbContext.temperatures)}
`;
      }

      // 2. Construct the Gemini System Instruction (separate from user message)
      const systemPrompt = `You are Aro, the AromaSys AI Copilot — a smart warehouse assistant for a botanical manufacturing facility.

LIVE DATABASE (JSON):
${contextText}

Today: ${new Date().toISOString().split('T')[0]}.

INSTRUCTIONS:
- Answer based on the data above. Analyze JSON carefully.
- For stock levels: check qty values. For expiring items: calculate days from today vs expiry field.
- For PPIC schedule: use expiry dates, stock levels, production priorities.
- For empty slots: filter where occupied is false. For cold-chain: analyze temps, flag anomalies.
- NEVER say "I don't have data". Always provide the best answer with available data.
- Be concise, professional. Use Markdown (bold, bullets, tables).

CRITICAL LANGUAGE RULE:
You MUST ALWAYS respond in the SAME language as the user's message. Detect the language of the user's question and reply in that exact language. If the question is in English, your entire response must be in English. If in Indonesian, respond in Indonesian. If in French, respond in French. Never mix languages.`;

      // 3. Build user message parts
      const userParts = [{ text: msg }];

      // If file is attached, include as inline data
      if (currentFileData && currentFile) {
        const mimeType = currentFile.type || 'application/octet-stream';
        const base64Data = currentFileData.split(',')[1];
        if (base64Data) {
          userParts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        }
      }

      // 4. Request Gemini API with model fallback chain
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const modelFallbackChain = [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
      ];

      let lastError = null;
      let replyText = null;

      for (const model of modelFallbackChain) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: userParts }]
            })
          });

          if (res.ok) {
            const data = await res.json();
            replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (replyText) break; // Success!
          } else if (res.status === 429) {
            // Rate limited — try next model
            console.warn(`Model ${model} rate limited, trying next...`);
            lastError = `Rate limited on ${model}`;
            continue;
          } else {
            const errText = await res.text();
            console.error(`Model ${model} failed:`, errText);
            lastError = errText;
            continue;
          }
        } catch (fetchErr) {
          console.error(`Model ${model} fetch error:`, fetchErr);
          lastError = fetchErr.message;
          continue;
        }
      }

      if (!replyText) {
        throw new Error(lastError || 'All models exhausted');
      }

      const aiMsg = {
        id: getNextMsgId(),
        sender: 'ai',
        text: replyText,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error generating Gemini response:', error);
      const errorMsg = {
        id: getNextMsgId(),
        sender: 'error',
        text: 'Sorry, a connection error occurred while contacting the AI. Please try again.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, setMessages, attachedFile, attachedFileData]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle insight card click — sends the prompt as a user message
  const handleInsightClick = (prompt) => {
    setInput(prompt);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Handle attachment button — open file picker
  const handleAttachment = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection from picker
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachedFileData(ev.target.result);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Remove attached file
  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setAttachedFileData(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="chatbot-overlay-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Production Copilot"
      ref={overlayRef}
    >
      <div className="chatbot-overlay-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chatbot-overlay-header">
          <h2 className="chatbot-overlay-title">
            <Bot size={20} />
            Production Copilot
          </h2>
          <button
            className="chatbot-overlay-close"
            onClick={onClose}
            aria-label="Close chat overlay"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: 2-column layout */}
        <div className="chatbot-overlay-body">
          {/* Left Panel — Chat Interface (70%) */}
          <div className="chatbot-panel-left">
            {/* Messages Area */}
            <div className="chatbot-overlay-messages">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`chatbot-msg-wrapper ${msg.sender === 'user' ? 'chatbot-msg-wrapper-user' : 'chatbot-msg-wrapper-ai'}`}
                >
                  {msg.sender !== 'user' && (
                    <div className="chatbot-msg-avatar chatbot-msg-avatar-ai">
                      <Bot size={18} />
                    </div>
                  )}
                  <div className={`chatbot-msg-bubble ${
                    msg.sender === 'user'
                      ? 'chatbot-msg-bubble-user'
                      : msg.sender === 'error'
                        ? 'chatbot-msg-bubble-error'
                        : 'chatbot-msg-bubble-ai'
                  }`}>
                    {/* Render message content with markdown support */}
                    <div
                      className="chatbot-md-content"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.text)
                      }}
                    />
                    {/* Render action buttons if present */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="chatbot-action-buttons">
                        {msg.actions.map((action, idx) => (
                          <button
                            key={idx}
                            className={`chatbot-action-btn ${idx === 0 ? 'chatbot-action-btn-primary' : 'chatbot-action-btn-secondary'}`}
                            onClick={() => handleInsightClick(action.prompt || action.label)}
                          >
                            {action.icon && <action.icon size={14} />}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Render data table if present */}
                    {msg.table && (
                      <div className="chatbot-data-table-wrapper">
                        <div className="chatbot-data-table-header">
                          <FileText size={14} />
                          <span className="chatbot-data-table-title">{msg.table.title || 'Data Report'}</span>
                        </div>
                        <table className="chatbot-data-table">
                          <thead>
                            <tr>
                              {msg.table.headers.map((h, i) => (
                                <th key={i}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.table.rows.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className={cell.className || ''}>{cell.value || cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <span className="chatbot-msg-time">{msg.time}</span>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="chatbot-msg-avatar chatbot-msg-avatar-user">
                      {(() => {
                        try {
                          const saved = localStorage.getItem('aromasys_user');
                          if (saved) {
                            const parsed = JSON.parse(saved);
                            if (parsed.avatar) {
                              return <img src={parsed.avatar} alt="You" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />;
                            }
                          }
                        } catch {}
                        return <UserIcon size={14} />;
                      })()}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="chatbot-msg-wrapper chatbot-msg-wrapper-ai">
                  <div className="chatbot-msg-avatar chatbot-msg-avatar-ai">
                    <Bot size={18} />
                  </div>
                  <div className="chatbot-msg-bubble chatbot-msg-bubble-ai">
                    <div className="chatbot-typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chatbot-overlay-input-area">
              <div className="chatbot-input-container">
                {/* Attachment Button */}
                <button
                  className="chatbot-input-btn"
                  onClick={handleAttachment}
                  aria-label="Attach file"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />

                {/* Text Input */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {attachedFile && (
                    <div className="chatbot-attachment-chip">
                      <Paperclip size={12} />
                      <span className="chatbot-attachment-chip-name">{attachedFile.name}</span>
                      <button
                        className="chatbot-attachment-chip-remove"
                        onClick={handleRemoveAttachment}
                        aria-label="Remove attachment"
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    className="chatbot-overlay-input"
                    placeholder="Ask about stock, expiry, or operations..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isTyping}
                  />
                </div>

                {/* Send button only (mic removed) */}
                <div className="chatbot-input-actions">
                  <button
                    className="chatbot-overlay-send"
                    onClick={handleSend}
                    disabled={isTyping || !input.trim()}
                    aria-label="Send message"
                    type="button"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
              <p className="chatbot-overlay-disclaimer">
                AromaSys AI can make mistakes. Verify critical production data.
              </p>
            </div>
          </div>

          {/* Right Panel — Quick Insights (30%) */}
          <div className="chatbot-panel-right">
            <div>
              {/* Heading */}
              <div className="chatbot-insights-heading">
                <Lightbulb size={20} />
                <h3>Quick Insights</h3>
              </div>

              {/* Insight Cards */}
              <div className="chatbot-insights-list">
                {QUICK_INSIGHTS.map(insight => {
                  const IconComponent = insight.icon;
                  return (
                    <button
                      key={insight.id}
                      className="chatbot-insight-card"
                      onClick={() => handleInsightClick(insight.prompt)}
                      type="button"
                      aria-label={insight.title}
                    >
                      <div className={`chatbot-insight-card-border chatbot-insight-card-border-${insight.borderColor}`} />
                      <div className="chatbot-insight-card-content">
                        <div className="chatbot-insight-card-icon" style={{ background: insight.iconBg, color: insight.iconColor, borderRadius: '10px' }}>
                          <IconComponent size={20} />
                        </div>
                        <div className="chatbot-insight-card-text">
                          <span className="chatbot-insight-card-title">{insight.title}</span>
                          <span className="chatbot-insight-card-desc">{insight.description}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Status */}
            <div className="chatbot-system-status">
              <div className="chatbot-system-status-header">
                <Clock size={15} />
                <span className="chatbot-system-status-title">System Status</span>
              </div>
              <p className="chatbot-system-status-text">
                Connected to ERP Database. Last sync: <strong>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
