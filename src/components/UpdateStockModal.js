import React, { useState } from 'react';
import { X, Search, Check } from 'lucide-react';

export default function UpdateStockModal({ isOpen, onClose, items, onSave }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    addQty: '',
    location: '',
    dateIn: new Date().toISOString().split('T')[0],
    expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  if (!isOpen) return null;

  const searchResults = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelect = (item) => {
    setSelectedItem(item);
    setFormData({ ...formData, location: item.location });
    setSearchQuery('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    onSave(selectedItem, formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel animate-scale" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Update Stock</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px' }}>
          {!selectedItem ? (
            <div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#888' }} />
                <input 
                  type="text" 
                  className="input" 
                  style={{ paddingLeft: '36px' }} 
                  placeholder="Search material by name..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {searchResults.slice(0, 5).map(item => (
                  <div 
                    key={item.id} 
                    style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                    onClick={() => handleSelect(item)}
                  >
                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>ID: {item.id} | Qty: {item.qty} {item.unit} | Loc: {item.location}</div>
                  </div>
                ))}
                {searchQuery && searchResults.length === 0 && <div style={{ padding: '12px', color: '#888' }}>No materials found.</div>}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Name</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedItem.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Current Qty</span>
                  <span>{selectedItem.qty} {selectedItem.unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Current Location</span>
                  <span>{selectedItem.location}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '8px', width: '100%' }} onClick={() => setSelectedItem(null)}>
                  Change Material
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="field-label">Add Quantity</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="1" className="input" value={formData.addQty} onChange={e => setFormData({...formData, addQty: e.target.value})} required />
                  <span style={{ alignSelf: 'center', fontWeight: 'bold', color: '#666' }}>{selectedItem.unit}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="field-label">New Location Slot (Optional)</label>
                <input type="text" className="input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required />
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="field-label">Intake Date</label>
                  <input type="date" className="input" value={formData.dateIn} onChange={e => setFormData({...formData, dateIn: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="field-label">Expiry Date</label>
                  <input type="date" className="input" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Check size={16} /> Save Update</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
