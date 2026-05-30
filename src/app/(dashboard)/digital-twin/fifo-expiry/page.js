'use client';
import { useState, useEffect, useMemo } from 'react';
import { getDynamicZones, CATEGORIES } from '@/lib/mockData';
import {
  Download,
  Search,
  AlertCircle,
  SlidersHorizontal,
  PackageSearch
} from 'lucide-react';
import './fifo-expiry.css';

const PAGE_SIZE = 10;

export default function FifoExpiryPage() {
  const [items, setItems] = useState([]);
  const [dynamicZones, setDynamicZones] = useState([]);
  useEffect(() => { setDynamicZones(getDynamicZones()); }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [zoneFilter, setZoneFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch FIFO items from database
  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      } else {
        setError('Failed to load inventory data.');
      }
    } catch (err) {
      console.error('Error fetching FIFO inventory:', err);
      setError('Could not retrieve inventory data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchInventory);
  }, []);

  // Reset currentPage to 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, zoneFilter, categoryFilter]);

  // Filter & Expiry Sorting
  const filtered = useMemo(() => {
    let result = [...items];
    if (zoneFilter) result = result.filter(i => i.zone === zoneFilter);
    if (categoryFilter) result = result.filter(i => i.category === categoryFilter);
    if (searchTerm) result = result.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Sort nearest expiry first (FIFO)
    result.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    return result;
  }, [items, zoneFilter, categoryFilter, searchTerm]);

  // Pagination computations
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const paginatedItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filtered, currentPage]);

  function getDaysUntilExpiry(expiry) {
    const diff = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getRowClass(days) {
    if (days < 7) return 'fifo-row-critical';
    if (days < 30) return 'fifo-row-warning';
    return 'fifo-row-safe';
  }

  function getStatusInfo(days) {
    if (days < 7) {
      return { label: 'CRITICAL', badgeClass: 'fifo-badge-critical' };
    }
    if (days < 30) {
      return { label: 'WARNING', badgeClass: 'fifo-badge-warning' };
    }
    return { label: 'SAFE', badgeClass: 'fifo-badge-safe' };
  }

  function getTimelineInfo(days) {
    if (days < 7) {
      return { daysClass: 'fifo-timeline-days-critical', barClass: 'fifo-progress-critical', actionLabel: 'Action Required' };
    }
    if (days < 30) {
      return { daysClass: 'fifo-timeline-days-warning', barClass: 'fifo-progress-warning', actionLabel: 'Scheduled Use' };
    }
    return { daysClass: 'fifo-timeline-days-safe', barClass: 'fifo-progress-safe', actionLabel: 'Stable' };
  }

  // Real CSV spreadsheet exporter and trigger download
  function handleExport() {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ID,Nama Bahan,Kategori,Jumlah Satuan,Lokasi,Tgl Masuk,Expired,Sisa Hari,Status\n";
    filtered.forEach(item => {
      const days = getDaysUntilExpiry(item.expiry);
      const daysLabel = days <= 0 ? `${Math.abs(days)} hari lalu` : `${days} hari`;
      csvContent += `"${item.id}","${item.name}","${item.category}","${item.qty} ${item.unit}","${item.location}","${item.dateIn}","${item.expiry}","${daysLabel}","${item.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FIFO_Expiry_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="fifo-page animate-fade">
      <h1 className="page-title">FIFO &amp; Expiry</h1>

      {/* Content Area Card */}
      <div className="fifo-content-card">
        {/* Table Controls / Filters */}
        <div className="fifo-controls">
          <div className="fifo-controls-left">
            {/* Search */}
            <div className="fifo-search-wrapper">
              <Search size={15} className="fifo-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="fifo-search-input"
                placeholder="Search lots, materials..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label="Search lots and materials"
              />
            </div>

            {/* Filter Button */}
            <button className="fifo-filter-btn" aria-label="Toggle filters">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Filter</span>
            </button>

            {/* Zone Filter */}
            <select
              className="fifo-select"
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value)}
              aria-label="Filter by zone"
            >
              <option value="">All Zones</option>
              {dynamicZones.map(z => <option key={z.id} value={z.id}>Zone {z.id}</option>)}
            </select>

            {/* Category Filter */}
            <select
              className="fifo-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="fifo-controls-right">
            {/* Export Button */}
            <button
              className="btn btn-primary fifo-export-btn"
              onClick={handleExport}
              disabled={filtered.length === 0}
              aria-label="Export Excel"
            >
              <Download size={16} aria-hidden="true" />
              Export Excel
            </button>

            {/* Sort */}
            <span className="fifo-sort-label">Sort by:</span>
            <select className="fifo-sort-select" aria-label="Sort order">
              <option value="urgency">Urgency (High-Low)</option>
              <option value="expiry-asc">Expiry (Nearest First)</option>
              <option value="expiry-desc">Expiry (Furthest First)</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="fifo-table-area">
          {isLoading ? (
            <div className="fifo-loading">
              <div className="spinner spinner-lg"></div>
              <div className="fifo-loading-content">
                <p className="fifo-loading-title">Memuat antrean FIFO...</p>
                <p className="fifo-loading-text">Menganalisis prioritas lot dan sisa kedaluwarsa...</p>
              </div>
            </div>
          ) : error ? (
            <div className="fifo-error">
              <AlertCircle size={48} className="fifo-error-icon" aria-hidden="true" />
              <p className="fifo-error-title">Data Tidak Tersedia</p>
              <p className="fifo-error-text">{error}</p>
              <button className="btn btn-primary" onClick={fetchInventory}>
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              <div className="fifo-table-wrapper">
                <table className="data-table fifo-table">
                  <thead>
                    <tr>
                      <th scope="col">MATERIAL &amp; LOT</th>
                      <th scope="col">INTAKE DATE</th>
                      <th scope="col">LOCATION SLOT</th>
                      <th scope="col">STATUS</th>
                      <th scope="col">EXPIRY TIMELINE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map(item => {
                        const days = getDaysUntilExpiry(item.expiry);

                        // Calculate remaining shelf life percentage
                        const dateIn = new Date(item.dateIn);
                        const expiry = new Date(item.expiry);
                        const today = new Date();
                        const totalDuration = expiry - dateIn;
                        const remainingDuration = expiry - today;
                        let pct = totalDuration > 0 ? Math.round((remainingDuration / totalDuration) * 100) : 0;
                        pct = Math.max(0, Math.min(100, pct));

                        const rowClass = getRowClass(days);
                        const statusInfo = getStatusInfo(days);
                        const timelineInfo = getTimelineInfo(days);

                        const daysLabel = days <= 0 ? '0 Days Left' : `${days} Days Left`;

                        return (
                          <tr key={item.id} className={rowClass}>
                            <td>
                              <div className="fifo-material-cell">
                                <div className={`fifo-material-icon ${days < 7 ? 'fifo-material-icon-critical' : days < 30 ? 'fifo-material-icon-warning' : 'fifo-material-icon-safe'}`}>
                                  <PackageSearch size={16} aria-hidden="true" />
                                </div>
                                <div className="fifo-material-info">
                                  <span className="fifo-material-name">{item.name}</span>
                                  <span className="fifo-material-id mono">{item.id}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="fifo-date">
                                {new Date(item.dateIn).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                              </span>
                            </td>
                            <td>
                              <span className="fifo-location mono">
                                {item.location}
                              </span>
                            </td>
                            <td>
                              <span className={`fifo-badge ${statusInfo.badgeClass}`}>
                                <span className="fifo-badge-dot"></span>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td>
                              <div className="fifo-timeline">
                                <div className="fifo-timeline-header">
                                  <span className={timelineInfo.daysClass}>{daysLabel}</span>
                                  <span className="fifo-timeline-label">{timelineInfo.actionLabel}</span>
                                </div>
                                <div className="fifo-progress-track">
                                  <div
                                    className={`fifo-progress-bar ${timelineInfo.barClass}`}
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <div className="fifo-empty">
                            <PackageSearch size={48} className="fifo-empty-icon" aria-hidden="true" />
                            <p className="fifo-empty-title">Tidak ada data ditemukan</p>
                            <p className="fifo-empty-text">Coba ubah filter atau kata kunci pencarian Anda.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="fifo-pagination">
                  <span className="fifo-pagination-info">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div className="fifo-pagination-controls">
                    <button
                      className="fifo-page-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      aria-label="Previous page"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`fifo-page-btn ${page === currentPage ? 'fifo-page-btn-active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                        aria-label={`Page ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      className="fifo-page-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      aria-label="Next page"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
