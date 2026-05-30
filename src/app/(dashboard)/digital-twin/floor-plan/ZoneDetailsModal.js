import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertTriangle, Plus } from 'lucide-react';
import { CATEGORIES } from '@/lib/mockData';

export default function ZoneDetailsModal({ zone, onSave, onClose, onAddMaterial, onRemoveMaterial, existingMaterials = [] }) {
  const [formData, setFormData] = useState({
    id: zone?.id || `Z-${Date.now().toString().slice(-4)}`,
    name: zone?.name || '',
    hasTempSensor: zone?.hasTempSensor || false,
    tempApiUrl: zone?.tempApiUrl || '',
    hasHumidSensor: zone?.hasHumidSensor || false,
    humidApiUrl: zone?.humidApiUrl || '',
  });

  const [isSearchingMaterial, setIsSearchingMaterial] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          setInventoryItems(data.items);
        }
      })
      .catch(err => console.error("Error fetching inventory:", err));
  }, []);

  // Calculate capacity utilization
  const totalMaxCapacity = existingMaterials.reduce((sum, item) => sum + (item.maxCapacity || 500), 0);
  const totalCurrentStock = existingMaterials.reduce((sum, item) => sum + (item.qty || 0), 0);
  const capacityPct = totalMaxCapacity > 0 ? Math.min(100, Math.round((totalCurrentStock / totalMaxCapacity) * 100)) : 0;

  const searchResults = inventoryItems.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...zone, ...formData, isSetup: true });
  };

  return (
    <div className="fp-modal-backdrop" onClick={onClose}>
      <div className="fp-modal-card animate-scale" onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>{zone?.name ? 'Edit Zone' : 'New Zone Details'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px', display: 'none' }}>
            <label className="field-label">Huruf & Nomor Zona (ID)</label>
            <input type="text" className="input" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} required placeholder="e.g. Z-1234" />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="field-label">Nama Zona</label>
            <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Cold Storage" />
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={formData.hasTempSensor} onChange={e => setFormData({...formData, hasTempSensor: e.target.checked})} />
              Terdapat Sensor Suhu?
            </label>
            {formData.hasTempSensor && (
              <input type="url" className="input" value={formData.tempApiUrl} onChange={e => setFormData({...formData, tempApiUrl: e.target.value})} placeholder="https://api.sensor.com/temp" />
            )}
          </div>

          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={formData.hasHumidSensor} onChange={e => setFormData({...formData, hasHumidSensor: e.target.checked})} />
              Terdapat Sensor Humidity?
            </label>
            {formData.hasHumidSensor && (
              <input type="url" className="input" value={formData.humidApiUrl} onChange={e => setFormData({...formData, humidApiUrl: e.target.value})} placeholder="https://api.sensor.com/humidity" />
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Materials in Zone</h4>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsSearchingMaterial(!isSearchingMaterial)}>
                <Plus size={14} /> Add Material
              </button>
            </div>

            {/* Capacity Utilization */}
            <div style={{ background: 'var(--color-bg-elevated)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span>Capacity Utilization</span>
                <strong>{capacityPct}% ({totalCurrentStock} / {totalMaxCapacity})</strong>
              </div>
              <div style={{ height: '6px', background: 'var(--color-border-default)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${capacityPct}%`, background: capacityPct > 90 ? 'var(--color-status-critical)' : 'var(--color-brand-primary)' }}></div>
              </div>
            </div>

            {isSearchingMaterial && (
              <div style={{ marginBottom: '16px', background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
                <div className="input-group" style={{ marginBottom: '8px' }}>
                  <Search size={14} />
                  <input type="text" className="input" placeholder="Search material..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                {searchResults.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#fff', borderRadius: '4px', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{m.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Lot ID: {m.id} | Max: {m.maxCapacity || 500} {m.unit}</div>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { onAddMaterial(m); setIsSearchingMaterial(false); setSearchQuery(''); }}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {existingMaterials.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', border: '1px solid var(--color-border-default)', borderRadius: '4px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Lot ID: {m.id}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '500' }}>{m.qty} / {m.maxCapacity || 500} {m.unit}</span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px', color: 'var(--color-status-critical)' }} onClick={() => onRemoveMaterial && onRemoveMaterial(m.id)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {existingMaterials.length === 0 && <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>No materials assigned to this zone.</p>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto', border: '1px solid var(--color-border-default)' }} onClick={() => onSave({ ...zone, ...formData, isSetup: false })}>
              Edit Layout
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Zone</button>
          </div>
        </form>
      </div>
    </div>
  );
}
