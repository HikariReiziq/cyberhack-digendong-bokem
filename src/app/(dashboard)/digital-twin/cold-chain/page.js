'use client';
import { useState, useEffect } from 'react';
import { getDynamicZones, TEMPERATURE_DATA } from '@/lib/mockData';
import {
  Thermometer,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  X
} from 'lucide-react';
import './cold-chain.css';

export default function ColdChainPage() {
  const [dynamicZones, setDynamicZones] = useState([]);
  useEffect(() => { setDynamicZones(getDynamicZones()); }, []);

  const [selectedZone, setSelectedZone] = useState('D');
  const [showTakeActionModal, setShowTakeActionModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ desc: '', priority: 'high' });
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Dynamic temperature readings fetched from Neon PostgreSQL database
  const [temperatures, setTemperatures] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTemperatures = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/cold-chain');
      const data = await res.json();
      if (data.success) {
        setTemperatures(data.temperatures);
      } else {
        setError('Gagal memuat data sensor.');
      }
    } catch (err) {
      console.error('Error fetching cold-chain readings:', err);
      setError('Tidak dapat terhubung ke server sensor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchTemperatures);
  }, []);

  const zone = dynamicZones.length ? (dynamicZones.find(z => z.id === selectedZone) || dynamicZones[0]) : { id: 'D', name: 'Loading', tempMin: -5, tempMax: 5 };
  const readings = temperatures[selectedZone] || [];
  const maxTemp = readings.length > 0 ? Math.max(...readings.map(r => r.temperature)) : 0;
  const minTemp = readings.length > 0 ? Math.min(...readings.map(r => r.temperature)) : 0;
  const avgTemp = readings.length > 0
    ? (readings.reduce((sum, r) => sum + r.temperature, 0) / readings.length).toFixed(1)
    : '0.0';
  const anomalies = readings.filter(r => r.temperature > zone.tempMax || r.temperature < zone.tempMin);
  const status = anomalies.length > 0 ? 'danger' : maxTemp > zone.tempMax - 2 ? 'warning' : 'safe';

  // Chart rendering parameters
  const chartHeight = 200;
  const tempRange = readings.length > 0
    ? Math.max(zone.tempMax + 5, maxTemp + 2) - Math.min(zone.tempMin - 5, minTemp - 2)
    : 30;
  const tempMin2 = readings.length > 0
    ? Math.min(zone.tempMin - 5, minTemp - 2)
    : 0;

  function tempToY(temp) {
    return chartHeight - ((temp - tempMin2) / tempRange) * chartHeight;
  }

  const points = readings.length > 0
    ? readings.map((r, i) => {
        const x = (i / (readings.length - 1)) * 100;
        const y = tempToY(r.temperature);
        return `${x},${y}`;
      }).join(' ')
    : '';

  const areaPoints = readings.length > 0 ? `0,${chartHeight} ${points} 100,${chartHeight}` : '';

  // Generate dynamic sparkline points
  const getSparklinePoints = (zoneId, defaultType) => {
    const list = temperatures[zoneId] || [];
    if (list.length === 0) {
      if (defaultType === 'rising') {
        return "0,35 20,32 40,24 60,18 80,10 100,4";
      }
      if (defaultType === 'wavy') {
        return "0,25 20,28 40,15 60,28 80,18 100,20";
      }
      return "0,20 20,18 40,22 60,18 80,24 100,20";
    }
    const minVal = Math.min(...list.map(r => r.temperature));
    const maxVal = Math.max(...list.map(r => r.temperature));
    const range = maxVal - minVal || 1;
    return list.map((r, i) => {
      const x = (i / (list.length - 1)) * 100;
      const y = 35 - ((r.temperature - minVal) / range) * 30;
      return `${x},${y}`;
    }).join(' ');
  };

  // Determine zone status for each card
  const getZoneStatus = (zoneId) => {
    const zoneData = dynamicZones.find(z => z.id === zoneId);
    const zoneReadings = temperatures[zoneId] || [];
    if (zoneReadings.length === 0) return 'safe';
    const zoneAnomalies = zoneReadings.filter(r => r.temperature > zoneData.tempMax || r.temperature < zoneData.tempMin);
    if (zoneAnomalies.length > 0) return 'danger';
    const zoneMax = Math.max(...zoneReadings.map(r => r.temperature));
    if (zoneMax > zoneData.tempMax - 2) return 'warning';
    return 'safe';
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone: selectedZone,
          description: ticketForm.desc,
          priority: ticketForm.priority,
          createdBy: 'System User'
        })
      });
      const data = await res.json();
      if (data.success) {
        setTicketSuccess(true);
        setTimeout(() => {
          setTicketSuccess(false);
          setShowTakeActionModal(false);
          setTicketForm({ desc: '', priority: 'high' });
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting maintenance ticket:', err);
    }
  };

  // Zone card configuration
  const zoneCards = [
    { id: 'A', label: 'Zone A', desc: 'RAW MATERIAL STORAGE', defaultType: 'stable', targetRange: `20°C to 30°C` },
    { id: 'B', label: 'Zone B', desc: 'DISTILLATION PER-STAGE', defaultType: 'rising', targetRange: `15°C to 25°C` },
    { id: 'C', label: 'Zone C', desc: 'FINAL PRODUCT VAULT', defaultType: 'wavy', targetRange: `18°C to 28°C` },
  ];

  const statusLabels = { safe: 'Stable', danger: 'Critical', warning: 'Warning' };
  const sparklineColors = { safe: '#84D187', danger: '#BA1A1A', warning: '#D9B829' };

  return (
    <div className="cold-chain animate-fade">
      <h1 className="page-title">Cold-Chain Monitor</h1>

      {/* 3-Column Zone Card Grid */}
      <div className="cc-zone-grid">
        {zoneCards.map((card) => {
          const cardStatus = getZoneStatus(card.id);
          const lastReading = temperatures[card.id]?.slice(-1)[0]?.temperature;
          const displayTemp = lastReading != null ? lastReading.toFixed(1) : '--.-';

          return (
            <div key={card.id} className={`cc-zone-card cc-zone-card--${cardStatus}`}>
              <div className="cc-zone-header">
                <span className="cc-zone-name">{card.label}</span>
                <span className={`cc-zone-badge cc-zone-badge--${cardStatus}`}>
                  {statusLabels[cardStatus]}
                </span>
              </div>

              <p className="cc-zone-desc">{card.desc}</p>

              <div className="cc-zone-temp-row">
                <span className={`cc-zone-temp-value cc-zone-temp-value--${cardStatus}`}>
                  {displayTemp}°C
                </span>
                <div className="cc-zone-target">
                  <span className="cc-zone-target-label">Target Range</span>
                  <span className="cc-zone-target-range">{card.targetRange}</span>
                </div>
              </div>

              {/* Mini Chart Sparkline */}
              <div className="cc-sparkline">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                  <polyline
                    points={getSparklinePoints(card.id, card.defaultType)}
                    fill="none"
                    stroke={sparklineColors[cardStatus]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="cc-zone-footer">
                {cardStatus === 'danger' ? (
                  <span className="cc-zone-footer-alert">
                    <AlertTriangle size={14} /> Temp Rising
                  </span>
                ) : (
                  <span className="cc-zone-footer-text">Humidity: {card.id === 'C' ? '38' : '42'}%</span>
                )}

                {cardStatus === 'danger' ? (
                  <button
                    className="cc-zone-btn-action"
                    onClick={() => { setSelectedZone(card.id); setShowTakeActionModal(true); }}
                    aria-label={`Take action on ${card.label}`}
                  >
                    Take Action
                  </button>
                ) : (
                  <button
                    className="cc-zone-btn-details"
                    onClick={() => setSelectedZone(card.id)}
                    aria-label={`View details for ${card.label}`}
                  >
                    Details
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Details Area */}
      {isLoading ? (
        <div className="cc-loading">
          <div className="cc-loading-spinner"></div>
          <div className="cc-loading-text">
            <p className="cc-loading-title">Memuat sensor suhu...</p>
            <p className="cc-loading-subtitle">Menghubungkan ke node IoT Cold-Chain...</p>
          </div>
        </div>
      ) : error ? (
        <div className="cc-error">
          <AlertCircle size={48} className="cc-error-icon" aria-hidden="true" />
          <h3 className="cc-error-title">Gagal Memuat Data Sensor</h3>
          <p className="cc-error-text">{error}</p>
          <button className="btn btn-primary" onClick={fetchTemperatures}>
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* Chart Card */}
          <div className="cc-chart-card">
            <div className="cc-chart-header">
              <div>
                <h3 className="cc-chart-title">
                  Sensor Details: Zone {selectedZone} — {zone.name.split('—')[1]?.trim() || zone.name}
                </h3>
                <p className="cc-chart-subtitle">
                  Batas ideal: {zone.tempMax}°C — {zone.tempMin}°C
                </p>
              </div>
              <div className="cc-chart-stats">
                <div className="cc-stat">
                  <span className="cc-stat-label">Min</span>
                  <span className="cc-stat-value">{minTemp.toFixed(1)}°C</span>
                </div>
                <div className="cc-stat">
                  <span className="cc-stat-label">Rata-rata</span>
                  <span className="cc-stat-value">{avgTemp}°C</span>
                </div>
                <div className="cc-stat">
                  <span className="cc-stat-label">Max</span>
                  <span className={`cc-stat-value ${maxTemp > zone.tempMax ? 'cc-stat-value--critical' : ''}`}>
                    {maxTemp.toFixed(1)}°C
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="cc-chart-area">
              {readings.length > 0 ? (
                <svg viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" className="cc-chart-svg">
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map(pct => (
                    <line key={pct} x1="0" x2="100" y1={chartHeight * pct} y2={chartHeight * pct}
                      stroke="#E5E8EB" strokeWidth="0.25" strokeDasharray="1,1" />
                  ))}

                  {/* Threshold lines (dashed) */}
                  <line x1="0" x2="100" y1={tempToY(zone.tempMax)} y2={tempToY(zone.tempMax)}
                    stroke="var(--color-status-critical)" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" x2="100" y1={tempToY(zone.tempMin)} y2={tempToY(zone.tempMin)}
                    stroke="var(--color-status-info)" strokeWidth="0.5" strokeDasharray="2,2" />

                  {/* Area fill */}
                  <polygon points={areaPoints} fill="url(#tempGrad)" opacity="0.1" />

                  {/* Line */}
                  <polyline points={points} fill="none"
                    stroke={status === 'danger' ? 'var(--color-status-critical)' : 'var(--color-brand-primary)'}
                    strokeWidth="0.75" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Anomaly dots */}
                  {readings.map((r, i) => {
                    const isAnomaly = r.temperature > zone.tempMax || r.temperature < zone.tempMin;
                    if (!isAnomaly) return null;
                    const x = (i / (readings.length - 1)) * 100;
                    const y = tempToY(r.temperature);
                    return (
                      <circle key={i} cx={x} cy={y} r="1.5" fill="var(--color-status-critical)" stroke="white" strokeWidth="0.4">
                        <animate attributeName="r" values="1.2;2;1.2" dur="2s" repeatCount="indefinite" />
                      </circle>
                    );
                  })}

                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={status === 'danger' ? 'var(--color-status-critical)' : 'var(--color-brand-primary)'} />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              ) : (
                <div className="cc-chart-empty">
                  Tidak ada data sensor.
                </div>
              )}

              {/* Time labels */}
              <div className="cc-chart-labels">
                {['00:00', '06:00', '12:00', '18:00', '23:00'].map(t => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>

            {/* Threshold legend */}
            <div className="cc-threshold-legend">
              <div className="cc-threshold-item">
                <div className="cc-threshold-line cc-threshold-line--upper"></div>
                <span className="cc-threshold-text--upper">Batas Atas: {zone.tempMax}°C</span>
              </div>
              <div className="cc-threshold-item">
                <div className="cc-threshold-line cc-threshold-line--lower"></div>
                <span className="cc-threshold-text--lower">Batas Bawah: {zone.tempMin}°C</span>
              </div>
            </div>
          </div>

          {/* Anomaly Alerts List */}
          {anomalies.length > 0 && (
            <div className="cc-alert-banner">
              <div className="cc-alert-header">
                <AlertTriangle size={24} className="cc-alert-icon" aria-hidden="true" />
                <div>
                  <h3 className="cc-alert-title">Suhu Melebihi Batas - Zona {selectedZone}</h3>
                  <p className="cc-alert-desc">
                    Terdeteksi {anomalies.length} anomali suhu dalam 24 jam terakhir.
                  </p>
                </div>
              </div>

              <div className="cc-alert-list">
                {anomalies.slice(0, 3).map((a, i) => (
                  <div key={i} className="cc-alert-item">
                    <span className="cc-alert-item-time">
                      <Clock size={14} /> {a.hour}
                    </span>
                    <span className="cc-alert-item-temp mono">{a.temperature.toFixed(1)}°C</span>
                    <span className="cc-alert-item-badge">
                      +{(a.temperature - zone.tempMax).toFixed(1)}°C EXCEEDED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Take Action Modal */}
      {showTakeActionModal && (
        <div className="cc-modal-backdrop" onClick={() => setShowTakeActionModal(false)}>
          <div className="cc-modal-card" onClick={e => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h3 className="cc-modal-title">Create Maintenance Ticket - Zone {selectedZone}</h3>
              <button
                className="cc-modal-close"
                onClick={() => setShowTakeActionModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {ticketSuccess ? (
              <div className="cc-modal-success">
                <CheckCircle2 size={48} className="cc-modal-success-icon" />
                <h4 className="cc-modal-success-title">Tiket Berhasil Dikirim!</h4>
                <p className="cc-modal-success-text">Petugas maintenance sedang dikirim ke Zona {selectedZone}.</p>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="cc-modal-form">
                <div className="cc-modal-form-group">
                  <label htmlFor="popup-ticket-desc">Deskripsi Masalah</label>
                  <textarea
                    id="popup-ticket-desc"
                    rows="3"
                    required
                    value={ticketForm.desc}
                    onChange={e => setTicketForm({ ...ticketForm, desc: e.target.value })}
                    placeholder="Contoh: Terjadi lonjakan suhu hingga -2°C di ruangan penyulingan per-stage B. Perlu pengecekan katup kompresor dingin segera."
                  />
                </div>

                <div className="cc-modal-form-group">
                  <label htmlFor="popup-ticket-priority">Prioritas Perbaikan</label>
                  <select
                    id="popup-ticket-priority"
                    value={ticketForm.priority}
                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  >
                    <option value="high">Tinggi (Urgent - Segera Kirim Teknisi)</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah (Pemantauan rutin)</option>
                  </select>
                </div>

                <div className="cc-modal-actions">
                  <button type="button" className="cc-modal-btn-cancel" onClick={() => setShowTakeActionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="cc-modal-btn-submit">
                    Dispatch Technician
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
