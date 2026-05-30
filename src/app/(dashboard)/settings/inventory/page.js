'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getDynamicZones, CATEGORIES } from '@/lib/mockData';
import { 
  Database, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Upload,
  Wheat,
  CakeSlice,
  Droplets,
  Palette,
  Wind,
  ShieldCheck,
  Milk,
  Cookie,
  Leaf,
  FlaskConical
} from 'lucide-react';
import './inventory.css';
import UpdateStockModal from '@/components/UpdateStockModal';

const PAGE_SIZE = 10;
const UNITS = ['kg', 'liter', 'pcs', 'box', 'karung', 'drum'];

// Category-specific placeholder icons
const CATEGORY_ICONS = {
  'Tepung': Wheat,
  'Gula': CakeSlice,
  'Minyak': Droplets,
  'Pewarna': Palette,
  'Essence': Wind,
  'Pengawet': ShieldCheck,
  'Susu': Milk,
  'Cokelat': Cookie,
  'Rempah': Leaf,
  'Kimia': FlaskConical
};

export default function InventoryPage() {
  const { user, canEdit, canDelete } = useAuth();
  
  // Dynamic inventory data fetched from the PostgreSQL database API
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [isUpdateStockModalOpen, setIsUpdateStockModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    category: '',
    qty: '',
    unit: 'kg',
    location: '',
    dateIn: '',
    expiry: ''
  });
  
  // UI states
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Detail card modal state
  const [selectedItem, setSelectedItem] = useState(null);
  const clickedRowRef = useRef(null);
  const detailModalRef = useRef(null);
  
  // Image upload state for detail card
  const [imageUploadError, setImageUploadError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef(null);
  
  // Form validation state
  const [formErrors, setFormErrors] = useState({});
  
  // Database slots list for validation
  const [availableSlots, setAvailableSlots] = useState([]);

  // Fetch Inventory function
  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (zoneFilter) queryParams.append('zone', zoneFilter);
      if (categoryFilter) queryParams.append('category', categoryFilter);
      if (statusFilter) queryParams.append('status', statusFilter);

      const res = await fetch(`/api/inventory?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      } else {
        setError('Failed to load inventory data.');
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to connect to the database. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchInventory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, zoneFilter, categoryFilter, statusFilter]);

  // Fetch available slots from PostgreSQL when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const fetchSlots = async () => {
        try {
          const res = await fetch('/api/slots');
          const data = await res.json();
          if (data.success) {
            const filteredSlots = data.slots.filter(slot => {
              if (!slot.occupied) return true;
              if (modalMode === 'edit' && slot.itemId === formData.id) return true;
              return false;
            }).map(s => s.id).sort();
            setAvailableSlots(filteredSlots);
          }
        } catch (err) {
          console.error('Error fetching slots:', err);
        }
      };
      fetchSlots();
    }
  }, [isModalOpen, modalMode, formData.id]);

  // Toast Auto-Dismiss
  const [dynamicZones, setDynamicZones] = useState([]);
  
  useEffect(() => {
    fetchInventory();
    setDynamicZones(getDynamicZones());
  }, []);
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Form validation function
  const validateForm = () => {
    const errors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Name is required and must be at least 2 characters.';
    }

    if (!formData.qty || Number(formData.qty) <= 0) {
      errors.qty = 'Quantity is required and must be greater than 0.';
    }

    if (!formData.location) {
      errors.location = 'Location is required.';
    }

    if (!formData.category) {
      errors.category = 'Category is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if form currently has validation errors (for disabling submit)
  const hasFormErrors = Object.keys(formErrors).length > 0;

  // Pagination Logic
  const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  // Reset page when filter changes
  const handleFilterChange = (setter, value) => {
    setter(value);
    setPage(1);
  };

  // Helper to calculate status based on Expiry Date
  const calculateStatus = (expiryDateStr) => {
    if (!expiryDateStr) return 'Aman';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 7) return 'Kritis';
    if (diffDays <= 30) return 'Warning';
    return 'Aman';
  };

  // Open modal for Adding Item
  const handleOpenAdd = () => {
    if (!canEdit()) return;
    
    // Generate next ID locally based on current list (will verify on db)
    const maxNum = items.reduce((max, item) => {
      const num = parseInt(item.id.replace('INV-', ''));
      return num > max ? num : max;
    }, 0);
    const nextId = `INV-${String(maxNum + 1).padStart(3, '0')}`;

    setModalMode('add');
    setFormErrors({});
    setFormData({
      id: nextId,
      name: '',
      category: CATEGORIES[0] || '',
      qty: '',
      unit: 'kg',
      location: '',
      dateIn: new Date().toISOString().split('T')[0],
      expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxCapacity: '',
      threshold: 'Normal'
    });
    setIsModalOpen(true);
  };

  // Open modal for Editing Item
  const handleOpenEdit = (item) => {
    if (!canEdit()) return;
    setModalMode('edit');
    setFormErrors({});
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category,
      qty: item.qty,
      unit: item.unit,
      location: item.location,
      dateIn: item.dateIn,
      expiry: item.expiry,
      maxCapacity: item.maxCapacity || '',
      threshold: item.threshold || 'Normal'
    });
    setIsModalOpen(true);
  };

  // Handle Form Input Changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear validation error for this field when user types
    if (formErrors[field]) {
      setFormErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Save/Update Handler
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const calculatedStatus = calculateStatus(formData.expiry);
      const zone = formData.location.split('-')[0];

      const payload = {
        id: formData.id,
        name: formData.name,
        category: formData.category,
        qty: parseFloat(formData.qty),
        unit: formData.unit,
        location: formData.location,
        zone: zone,
        dateIn: formData.dateIn,
        expiry: formData.expiry,
        status: calculatedStatus,
        user: { name: user.name, role: user.role }
      };

      const url = '/api/inventory';
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id),
          'x-user-role': user.role
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setToast({ 
          type: 'success', 
          message: modalMode === 'add' 
            ? `Raw material ${formData.name} successfully saved to database!` 
            : `Raw material ${formData.name} successfully updated in database!`
        });
        setIsModalOpen(false);
        fetchInventory(); // Reload from database
      } else {
        setToast({ type: 'error', message: `Gagal menyimpan: ${data.error}` });
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handler
  const handleDelete = async (item) => {
    if (!canDelete()) return;
    if (confirm(`Are you sure you want to delete "${item.name}" from the database?`)) {
      try {
        const res = await fetch(`/api/inventory?id=${item.id}&userName=${encodeURIComponent(user.name)}&userRole=${encodeURIComponent(user.role)}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': String(user.id),
            'x-user-role': user.role
          }
        });
        const data = await res.json();

        if (data.success) {
          setToast({ type: 'success', message: `Raw material ${item.name} successfully deleted from database!` });
          fetchInventory(); // Reload from database
        } else {
          setToast({ type: 'error', message: `Failed to delete: ${data.error}` });
        }
      } catch (err) {
        console.error(err);
        setToast({ type: 'error', message: 'Terjadi kesalahan jaringan.' });
      }
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setZoneFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setPage(1);
  };

  // Detail card modal handlers
  const handleRowClick = (item, event) => {
    // Don't open detail modal if clicking action buttons
    if (event.target.closest('.inv-actions')) return;
    clickedRowRef.current = event.currentTarget;
    setSelectedItem(item);
  };

  const handleCloseDetail = useCallback(() => {
    setSelectedItem(null);
    setImageUploadError('');
    // Return focus to the clicked row
    if (clickedRowRef.current) {
      clickedRowRef.current.focus();
    }
  }, []);

  // Image upload handler for detail card
  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setImageUploadError('');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageUploadError('Invalid format. Only JPEG, PNG, and WebP files are supported.');
      // Reset file input
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setImageUploadError('File too large. Maximum size is 2 MB.');
      // Reset file input
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result;
      setIsUploadingImage(true);

      try {
        const res = await fetch('/api/inventory', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': String(user.id),
            'x-user-role': user.role
          },
          body: JSON.stringify({ id: selectedItem.id, image: base64String })
        });
        const data = await res.json();

        if (data.success) {
          // Update selectedItem with new image
          setSelectedItem(prev => ({ ...prev, image: base64String }));
          // Update items list
          setItems(prev => prev.map(item => 
            item.id === selectedItem.id ? { ...item, image: base64String } : item
          ));
          setImageUploadError('');
        } else {
          setImageUploadError(data.error || 'Failed to upload image.');
        }
      } catch (err) {
        console.error('Image upload error:', err);
        setImageUploadError('Network error. Please try again.');
      } finally {
        setIsUploadingImage(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImageUploadError('Failed to read file. Please try again.');
      if (imageInputRef.current) imageInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  }, [selectedItem]);

  // Focus trap and keyboard handling for detail modal
  useEffect(() => {
    if (!selectedItem) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseDetail();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && detailModalRef.current) {
        const focusableElements = detailModalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Focus the modal close button on open
    setTimeout(() => {
      if (detailModalRef.current) {
        const closeBtn = detailModalRef.current.querySelector('.detail-modal-close');
        if (closeBtn) closeBtn.focus();
      }
    }, 50);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, handleCloseDetail]);

  // Get category placeholder icon component
  const getCategoryIcon = (category) => {
    return CATEGORY_ICONS[category] || Database;
  };

  const getRowClass = (status) => {
    if (status === 'Expired') return 'row-expired';
    if (status === 'Kritis') return 'row-critical';
    if (status === 'Warning') return 'row-warning';
    return '';
  };

  const getBadgeClass = (status) => {
    if (status === 'Aman') return 'badge-safe';
    if (status === 'Warning') return 'badge-warning';
    if (status === 'Kritis') return 'badge-danger';
    if (status === 'Expired') return 'badge-danger';
    return 'badge-info';
  };

  const getBadgeLabel = (status) => {
    if (status === 'Aman') return 'STABLE';
    if (status === 'Warning') return 'WARNING';
    if (status === 'Kritis') return 'CRITICAL';
    if (status === 'Expired') return 'EXPIRED';
    return status.toUpperCase();
  };

  const showingStart = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingEnd = Math.min(page * PAGE_SIZE, items.length);
  const hasActiveFilters = search || zoneFilter || categoryFilter || statusFilter;

  return (
    <div className="inventory-page animate-fade">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-header-text">
          <h1 className="page-title">
            <Database size={24} aria-hidden="true" />
            Inventory Master
          </h1>
          <p className="page-subtitle">Master database inventory of raw materials for AromaSys (Live PostgreSQL)</p>
        </div>
        {canEdit() && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary inv-add-btn" onClick={() => setIsUpdateStockModalOpen(true)} aria-label="Update Stock">
              <RefreshCw size={16} /> Update Stock
            </button>
            <button className="btn btn-primary inv-add-btn" onClick={handleOpenAdd} aria-label="Add new inventory record">
              <Plus size={16} /> Add New Record
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="card inv-filters">
        <div className="inv-filter-row">
          <div className="inv-search-input">
            <Search size={16} className="inv-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="input"
              placeholder="Search by Name or ID..."
              value={search}
              onChange={e => handleFilterChange(setSearch, e.target.value)}
              aria-label="Search inventory by name or ID"
            />
          </div>
          
          <select 
            className="select inv-filter-select" 
            value={categoryFilter} 
            onChange={e => handleFilterChange(setCategoryFilter, e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="select inv-filter-select" 
            value={zoneFilter} 
            onChange={e => handleFilterChange(setZoneFilter, e.target.value)}
            aria-label="Filter by zone"
          >
            <option value="">All Zones</option>
            {dynamicZones.map(z => <option key={z.id} value={z.id}>Zone {z.id}</option>)}
          </select>
          
          <select 
            className="select inv-filter-select-sm" 
            value={statusFilter} 
            onChange={e => handleFilterChange(setStatusFilter, e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="Aman">Stable</option>
            <option value="Warning">Warning</option>
            <option value="Kritis">Critical</option>
            <option value="Expired">Expired</option>
          </select>

          {hasActiveFilters && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleResetFilters}
              aria-label="Reset all filters"
            >
              <X size={14} /> Reset Filters
            </button>
          )}
        </div>
        <span className="inv-count">
          Showing <strong>{showingStart}</strong> to <strong>{showingEnd}</strong> of <strong>{items.length}</strong> entries
        </span>
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <div className="card inv-error-state" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span className="inv-error-message">{error}</span>
          <button className="btn btn-primary btn-sm" onClick={fetchInventory} aria-label="Retry loading data">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="card inv-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Quantity</th>
              <th scope="col">Location</th>
              <th scope="col">Date Added</th>
              <th scope="col">Expiry Date</th>
              <th scope="col">Status</th>
              {canEdit() && <th scope="col" className="inv-th-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canEdit() ? 9 : 8} className="inv-loading-cell">
                  <div className="inv-loading-content">
                    <div className="spinner spinner-lg" aria-hidden="true"></div>
                    <div className="inv-loading-text">
                      <p className="inv-loading-title">Loading inventory data...</p>
                      <p className="inv-loading-subtitle">Fetching live master data from database</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : !error && paginated.length > 0 ? (
              paginated.map(item => (
                <tr 
                  key={item.id} 
                  className={`inv-row-clickable ${getRowClass(item.status)}`}
                  onClick={(e) => handleRowClick(item, e)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${item.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(item, e);
                    }
                  }}
                >
                  <td className="mono inv-id-cell">{item.id}</td>
                  <td className="inv-name-cell">{item.name}</td>
                  <td><span className="inv-category">{item.category}</span></td>
                  <td className="mono">{item.qty} {item.unit}</td>
                  <td className="mono">{item.location}</td>
                  <td>{item.dateIn}</td>
                  <td>{item.expiry}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(item.status)}`}>
                      {getBadgeLabel(item.status)}
                    </span>
                  </td>
                  {canEdit() && (
                    <td>
                      <div className="inv-actions">
                        <button 
                          className="btn btn-ghost btn-sm btn-icon" 
                          onClick={() => handleOpenEdit(item)}
                          title="Edit record"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        {canDelete() && (
                          <button 
                            className="btn btn-ghost btn-sm btn-icon inv-delete-btn" 
                            onClick={() => handleDelete(item)}
                            title="Delete record"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : !error && paginated.length === 0 ? (
              <tr>
                <td colSpan={canEdit() ? 9 : 8} className="inv-empty-cell">
                  <div className="empty-state">
                    <Database size={48} aria-hidden="true" />
                    <h4 className="empty-state-title">No records found</h4>
                    <p className="empty-state-text">
                      {hasActiveFilters 
                        ? 'No items match your current filters. Try resetting filters or changing the search keyword.'
                        : 'No inventory items available.'}
                    </p>
                    {hasActiveFilters && (
                      <button className="btn btn-secondary btn-sm inv-reset-btn" onClick={handleResetFilters}>
                        Reset Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="inv-pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div className="inv-page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`inv-page-btn ${page === p ? 'active' : ''}`}
                onClick={() => setPage(p)}
                aria-label={`Page ${p}`}
                aria-current={page === p ? 'page' : undefined}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)} role="dialog" aria-modal="true" aria-label={modalMode === 'add' ? 'Add new material record' : 'Edit material record'}>
          <div className="modal-panel animate-scale" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add New Material Record' : `Edit Material Record — ${formData.id}`}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group">
                <label className="field-label" htmlFor="inv-form-id">Material Lot ID</label>
                <input
                  id="inv-form-id"
                  type="text"
                  className="input mono"
                  value={formData.id}
                  disabled
                  readOnly
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="inv-form-name">Material Name <span className="required">*</span></label>
                <input
                  id="inv-form-name"
                  type="text"
                  className={`input ${formErrors.name ? 'input-error' : ''}`}
                  placeholder="e.g. Lavender Oil Pure"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  required
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-category">Category <span className="required">*</span></label>
                  <select
                    id="inv-form-category"
                    className={`select ${formErrors.category ? 'input-error' : ''}`}
                    value={formData.category}
                    onChange={e => handleInputChange('category', e.target.value)}
                    required
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {formErrors.category && <span className="field-error">{formErrors.category}</span>}
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-qty">Quantity <span className="required">*</span></label>
                  <div className="inv-qty-row">
                    <input
                      id="inv-form-qty"
                      type="number"
                      min="1"
                      className={`input inv-qty-input ${formErrors.qty ? 'input-error' : ''}`}
                      placeholder="100"
                      value={formData.qty}
                      onChange={e => handleInputChange('qty', e.target.value)}
                      required
                    />
                    <select
                      className="select inv-unit-select"
                      value={formData.unit}
                      onChange={e => handleInputChange('unit', e.target.value)}
                      aria-label="Unit"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {formErrors.qty && <span className="field-error">{formErrors.qty}</span>}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-maxcap">Max Capacity</label>
                  <input
                    id="inv-form-maxcap"
                    type="number"
                    min="1"
                    className="input"
                    placeholder="e.g. 500"
                    value={formData.maxCapacity}
                    onChange={e => handleInputChange('maxCapacity', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-threshold">Stock Status Threshold</label>
                  <select
                    id="inv-form-threshold"
                    className="select"
                    value={formData.threshold}
                    onChange={e => handleInputChange('threshold', e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="Optimal">Optimal</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="inv-form-location">Location Slot <span className="required">*</span></label>
                <select
                  id="inv-form-location"
                  className={`select ${formErrors.location ? 'input-error' : ''}`}
                  value={formData.location}
                  onChange={e => handleInputChange('location', e.target.value)}
                  required
                >
                  <option value="">-- Select Location Slot --</option>
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                {formErrors.location && <span className="field-error">{formErrors.location}</span>}
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-datein">Intake Date <span className="required">*</span></label>
                  <input
                    id="inv-form-datein"
                    type="date"
                    className="input"
                    value={formData.dateIn}
                    onChange={e => handleInputChange('dateIn', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="inv-form-expiry">Expiry Date <span className="required">*</span></label>
                  <input
                    id="inv-form-expiry"
                    type="date"
                    className="input"
                    value={formData.expiry}
                    onChange={e => handleInputChange('expiry', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary inv-save-btn"
                  disabled={isSaving || hasFormErrors}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner" aria-hidden="true"></div> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> {modalMode === 'add' ? 'Save Record' : 'Update Record'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Card Modal */}
      {selectedItem && (
        <div 
          className="detail-modal-overlay" 
          onClick={handleCloseDetail}
          role="dialog" 
          aria-modal="true" 
          aria-label={`Detail for ${selectedItem.name}`}
        >
          <div 
            className="detail-modal-panel animate-scale" 
            onClick={e => e.stopPropagation()}
            ref={detailModalRef}
          >
            <div className="detail-modal-header">
              <h3 className="detail-modal-title">Item Detail</h3>
              <button 
                className="detail-modal-close" 
                onClick={handleCloseDetail} 
                aria-label="Close detail modal"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="detail-modal-body">
              {/* Image / Placeholder */}
              <div className="detail-modal-image-area">
                {selectedItem.image ? (
                  <img 
                    src={selectedItem.image} 
                    alt={selectedItem.name} 
                    className="detail-modal-image"
                  />
                ) : (
                  <div className="detail-modal-placeholder">
                    {(() => {
                      const IconComponent = getCategoryIcon(selectedItem.category);
                      return <IconComponent size={64} aria-hidden="true" />;
                    })()}
                    <span className="detail-modal-placeholder-label">No image uploaded</span>
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div className="detail-modal-upload-section">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="detail-modal-file-input"
                  id="detail-image-upload"
                  aria-label="Upload item image"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm detail-modal-upload-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  aria-label="Upload image for this item"
                >
                  {isUploadingImage ? (
                    <>
                      <div className="spinner" aria-hidden="true"></div> Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={14} /> Upload Image
                    </>
                  )}
                </button>
                {imageUploadError && (
                  <p className="detail-modal-upload-error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {imageUploadError}
                  </p>
                )}
              </div>

              {/* Item Info */}
              <div className="detail-modal-info">
                <div className="detail-modal-field">
                  <span className="detail-modal-label">Name</span>
                  <span className="detail-modal-value detail-modal-name">{selectedItem.name}</span>
                </div>
                <div className="detail-modal-field">
                  <span className="detail-modal-label">Category</span>
                  <span className="detail-modal-value">
                    <span className="inv-category">{selectedItem.category}</span>
                  </span>
                </div>
                <div className="detail-modal-grid">
                  <div className="detail-modal-field">
                    <span className="detail-modal-label">Quantity</span>
                    <span className="detail-modal-value mono">{selectedItem.qty} {selectedItem.unit}</span>
                  </div>
                  <div className="detail-modal-field">
                    <span className="detail-modal-label">Location</span>
                    <span className="detail-modal-value mono">{selectedItem.location}</span>
                  </div>
                </div>
                <div className="detail-modal-grid">
                  <div className="detail-modal-field">
                    <span className="detail-modal-label">Date Added</span>
                    <span className="detail-modal-value">{selectedItem.dateIn}</span>
                  </div>
                  <div className="detail-modal-field">
                    <span className="detail-modal-label">Expiry Date</span>
                    <span className="detail-modal-value">{selectedItem.expiry}</span>
                  </div>
                </div>
                <div className="detail-modal-field">
                  <span className="detail-modal-label">Status</span>
                  <span className="detail-modal-value">
                    <span className={`badge ${getBadgeClass(selectedItem.status)}`}>
                      {getBadgeLabel(selectedItem.status)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification System */}
      {toast && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'} animate-slide-right`} role="alert">
          <div className="toast-content">
            {toast.type === 'error' ? (
              <AlertTriangle size={20} className="toast-icon" aria-hidden="true" />
            ) : (
              <Check size={20} className="toast-icon" aria-hidden="true" />
            )}
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {isUpdateStockModalOpen && (
        <UpdateStockModal 
          isOpen={isUpdateStockModalOpen}
          onClose={() => setIsUpdateStockModalOpen(false)}
          items={items}
          onSave={(item, data) => {
            setIsUpdateStockModalOpen(false);
            const lotId = `${item.id.split('-')[0]}-${item.id.split('-')[1]}-${Math.floor(Math.random()*1000)}`;
            setToast({ type: 'success', message: `Stock for ${item.name} updated! New Lot ID: ${lotId}`});
          }}
        />
      )}
    </div>
  );
}
