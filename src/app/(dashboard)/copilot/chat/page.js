'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getDynamicZones, CATEGORIES } from '@/lib/mockData';
import { Send, Bot, User as UserIcon, ShieldCheck } from 'lucide-react';
import './chat.css';

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

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: Date.now(),
      sender: 'ai',
      text: `Hello ${user?.name || 'User'}! I am Aro, your AromaSys AI Copilot, connected to the live database.\n\nI can assist you with:\n• Checking stock levels and tracking statuses\n• Finding empty warehouse slots\n• Reviewing material expiration timelines\n• Analyzing cold-chain temperatures\n\nWhat can I help you with today?`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  async function handleSend(text) {
    const msg = text || input.trim();
    if (!msg) return;

    // Add user message
    const userMsg = {
      id: getNextMsgId(),
      sender: 'user',
      text: msg,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
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

      // 2. Construct the Gemini System Prompt
      const fullPrompt = `
You are Aro, the AromaSys AI Copilot — a smart warehouse assistant for a botanical manufacturing facility.

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

LANGUAGE RULE (MANDATORY — DO NOT IGNORE):
You MUST respond in the EXACT SAME language the user wrote their question in.
- If the user writes in English, you MUST reply ENTIRELY in English. No Indonesian words.
- If the user writes in Indonesian, reply in Indonesian.
- If the user writes in French, reply in French. German → German. Etc.
- Match the user's language precisely. This is non-negotiable.

Question: "${msg}"
`;

      // 3. Request Gemini API with model fallback chain
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
              contents: [{ parts: [{ text: fullPrompt }] }]
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
        sender: 'ai',
        text: 'Sorry, a connection error occurred while contacting the Gemini API. Please try again later.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-page animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title" style={{ fontSize: 'var(--text-display)', fontWeight: '700', color: 'var(--color-text-primary)', fontFamily: "'IBM Plex Sans', sans-serif", margin: '0 0 8px 0' }}>Production Copilot</h1>
        <p className="page-subtitle" style={{ marginTop: 0, fontSize: 'var(--text-body-lg)', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
          Query your connected ERP/WMS database using natural language, powered by live Gemini AI.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', flex: 1, minHeight: 0 }}>
        {/* Left Panel (70%) */}
        <div style={{ flex: 7, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-surface)', borderRadius: '12px', border: '1px solid var(--color-border-default)', overflow: 'hidden' }}>
          {/* Chat Messages */}
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {messages.map(msg => (
              <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'chat-user' : 'chat-ai'}`}>
                {msg.sender === 'ai' && (
                  <div className="chat-avatar chat-avatar-ai" style={{ background: 'var(--color-brand-primary)', color: 'var(--color-bg-surface)' }}>
                    <Bot size={16} />
                  </div>
                )}
                <div className={`chat-bubble ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`} style={{
                  background: msg.sender === 'user' ? 'var(--color-brand-primary)' : 'var(--color-brand-light)',
                  color: msg.sender === 'user' ? 'var(--color-bg-surface)' : 'var(--color-text-primary)',
                  borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  padding: '12px 16px',
                  maxWidth: '75%'
                }}>
                  <div className="chat-text chatbot-md-content" style={{ fontSize: 'var(--text-body-md)', lineHeight: '1.5' }} dangerouslySetInnerHTML={{
                    __html: renderMarkdown(msg.text)
                  }} />
                  <span className="chat-time" style={{ fontSize: 'var(--text-body-sm)', display: 'block', textAlign: 'right', marginTop: '6px', opacity: 0.7 }}>{msg.time}</span>
                </div>
                {msg.sender === 'user' && (
                  <div className="chat-avatar chat-avatar-user" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
                    <UserIcon size={14} />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="chat-bubble-wrapper chat-ai">
                <div className="chat-avatar chat-avatar-ai" style={{ background: 'var(--color-brand-primary)', color: 'var(--color-bg-surface)' }}>
                  <Bot size={16} />
                </div>
                <div className="chat-bubble chat-bubble-ai chat-typing" style={{ background: 'var(--color-brand-light)', padding: '12px 16px', borderRadius: '12px 12px 12px 0' }}>
                  <div className="typing-dots">
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
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border-default)' }}>
            <div className="chat-input-area" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                className="input chat-input"
                placeholder="Ask about stock, expiry, or operations..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--color-border-strong)' }}
              />
              <button
                className="btn btn-primary chat-send-btn btn-icon"
                onClick={() => handleSend()}
                disabled={isTyping || !input.trim()}
                style={{ width: '48px', height: '48px', background: 'var(--color-brand-primary)', border: 'none', borderRadius: '8px', color: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              AromaSys AI can make mistakes. Verify critical production data.
            </p>
          </div>
        </div>

        {/* Right Panel (30%) */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Quick Insights Preset Buttons */}
          <div className="card" style={{ padding: 'var(--space-6)', background: 'var(--color-bg-surface)', borderRadius: '12px', border: '1px solid var(--color-border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-heading-sm)', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '16px', fontFamily: "'IBM Plex Sans', sans-serif" }}>Quick Insights</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Check Low Stock Items', prompt: 'Check for items with low stock or quantity under 30' },
                { label: 'Show Expiring Lots This Month', prompt: 'Show me any lots expiring this month' },
                { label: 'Generate Optimal PPIC Schedule', prompt: 'Analyze raw materials and formulate optimal PPIC schedule' },
                { label: 'Find Empty Cold Storage Slots', prompt: 'Find vacant cold storage locations and shelves' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  style={{
                    padding: '12px 14px',
                    textAlign: 'left',
                    background: 'var(--color-brand-light)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '8px',
                    color: 'var(--color-brand-dark)',
                    fontSize: 'var(--text-body-md)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'var(--color-brand-light)'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Status Info Box */}
          <div className="card" style={{ padding: 'var(--space-5)', background: 'var(--color-bg-surface)', borderRadius: '12px', border: '1px solid var(--color-border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-body-sm)', fontWeight: '700', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>System Status</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ width: '10px', height: '10px', background: 'var(--color-brand-secondary)', borderRadius: '50%', boxShadow: '0 0 8px var(--color-brand-secondary)' }}></span>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-primary)' }}>
                <strong>Connected to ERP Database</strong>
                <span style={{ display: 'block', fontSize: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Last sync: 2 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
