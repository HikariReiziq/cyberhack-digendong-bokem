'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NotificationProvider, useNotifications } from '@/lib/notifications';
import { getDynamicZones } from '@/lib/mockData';
import Sidebar from '@/components/Sidebar';
import ChatbotOverlay from '@/components/ChatbotOverlay';
import { Bell, Settings as SettingsIcon, ChevronDown, User, Key, Activity, LogOut, Search, AlertTriangle, Calendar, Bot, LayoutDashboard, Map, Thermometer, CalendarClock, Upload, FileBarChart, Database, ShieldCheck, Package, MapPin, Info, Snowflake, UploadCloud, ClipboardList, Monitor } from 'lucide-react';

const SEARCH_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Interactive Floor Plan', href: '/digital-twin/floor-plan', icon: Map },
  { label: 'FIFO & Expiry', href: '/digital-twin/fifo-expiry', icon: CalendarClock },
  { label: 'Cold-Chain Monitor', href: '/digital-twin/cold-chain', icon: Thermometer },
  { label: 'Data Ingestion', href: '/copilot/upload', icon: Upload },
  { label: 'Auto-Report', href: '/copilot/report', icon: FileBarChart },
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Inventory Master', href: '/settings/inventory', icon: Database },
  { label: 'Audit Trail', href: '/settings/audit', icon: ShieldCheck },
];

// Helper to get notification icon by type
function getNotificationIcon(type) {
  switch (type) {
    case 'alert': return <AlertTriangle size={16} />;
    case 'coldchain': return <Snowflake size={16} />;
    case 'inventory': return <Package size={16} />;
    case 'upload': return <UploadCloud size={16} />;
    case 'audit': return <ClipboardList size={16} />;
    case 'system': return <Monitor size={16} />;
    default: return <Info size={16} />;
  }
}

// Helper to get notification icon class by type
function getNotificationIconClass(type) {
  switch (type) {
    case 'alert': return 'notification-item-icon-error';
    default: return 'notification-item-icon-default';
  }
}

// Format badge display: hide at 0, show count 1-99, show "99+" above 99
function formatBadge(count) {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

export default function DashboardLayout({ children }) {
  return (
    <NotificationProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </NotificationProvider>
  );
}

function DashboardLayoutInner({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [inventoryResults, setInventoryResults] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [auditResults, setAuditResults] = useState([]);
  const [zoneResults, setZoneResults] = useState([]);
  const searchWrapperRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [userAvatar, setUserAvatar] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: Date.now(),
      sender: 'ai',
      text: `Hey there! I'm Aro, your AromaSys AI Copilot, connected live to the warehouse database. I can help you check stock levels, find empty slots, track expiry dates, monitor cold-chain temps, or even draft a PPIC schedule. Just ask me anything about your warehouse operations and I'll dig into the data for you.`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load avatar from localStorage and listen for updates
  useEffect(() => {
    const loadAvatar = () => {
      try {
        const saved = localStorage.getItem('aromasys_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUserAvatar(parsed.avatar || null);
        }
      } catch {}
    };
    loadAvatar();

    // Listen for storage events (from other tabs) and custom event (same tab)
    const handleStorage = (e) => {
      if (!e.key || e.key === 'aromasys_user') loadAvatar();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('aromasys_avatar_updated', loadAvatar);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aromasys_avatar_updated', loadAvatar);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      setShowProfileMenu(false);
      setShowNotifications(false);
      // Close search dropdown if clicking outside the search wrapper
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Debounced inventory + audit search, and zone matching
  useEffect(() => {
    if (!searchQuery.trim()) {
      setInventoryResults([]);
      setAuditResults([]);
      setZoneResults([]);
      return;
    }

    // Immediate zone matching from ZONES constant
    const query = searchQuery.toLowerCase();
    const dynamicZones = getDynamicZones();
    const matchedZones = dynamicZones.filter(z =>
      z.name.toLowerCase().includes(query) ||
      z.id.toLowerCase().includes(query) ||
      z.type.toLowerCase().includes(query)
    );
    setZoneResults(matchedZones.slice(0, 5));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setInventoryLoading(true);
      try {
        // Fetch inventory results
        const invRes = await fetch(`/api/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
        const invData = await invRes.json();
        if (invData.success) {
          setInventoryResults(invData.items.slice(0, 5));
        } else {
          setInventoryResults([]);
        }

        // Fetch audit log results (search by username or action)
        const auditRes = await fetch(`/api/audit?user=${encodeURIComponent(searchQuery.trim())}`);
        const auditData = await auditRes.json();
        if (auditData.success && auditData.logs.length > 0) {
          setAuditResults(auditData.logs.slice(0, 3));
        } else {
          // Also try searching by action keyword in all logs
          const auditRes2 = await fetch('/api/audit');
          const auditData2 = await auditRes2.json();
          if (auditData2.success) {
            const filtered = auditData2.logs.filter(log =>
              log.user?.toLowerCase().includes(query) ||
              log.action?.toLowerCase().includes(query)
            );
            setAuditResults(filtered.slice(0, 3));
          } else {
            setAuditResults([]);
          }
        }
      } catch (err) {
        console.error('Search error:', err);
        setInventoryResults([]);
        setAuditResults([]);
      } finally {
        setInventoryLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Filter search items based on query
  const filteredSearchItems = searchQuery.trim()
    ? SEARCH_ITEMS.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchDropdown(value.trim().length > 0);
  };

  const handleSearchResultClick = (href) => {
    router.push(href);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setInventoryResults([]);
    setAuditResults([]);
    setZoneResults([]);
  };

  // Helper to resolve title based on current pathname
  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard Overview';
      case '/digital-twin/floor-plan':
        return 'Denah Gudang (Interactive Floor Plan)';
      case '/digital-twin/cold-chain':
        return 'Cold-Chain Monitor';
      case '/digital-twin/fifo-expiry':
        return 'FIFO & Expiry Tracker';
      case '/copilot/chat':
        return 'Production Copilot Chat';
      case '/copilot/upload':
        return 'Data Ingestion (Upload Nota)';
      case '/copilot/report':
        return 'Auto-Report Generator';
      case '/settings/inventory':
        return 'Database Inventori (Master Data)';
      case '/settings/audit':
        return 'Audit Trail Logs';
      default:
        return 'AromaSys WMS';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-card">
          <div className="dashboard-loading-spinner-wrapper">
            <div className="dashboard-loading-spinner"></div>
          </div>
          <h2 className="dashboard-loading-title">AromaSys</h2>
          <p className="dashboard-loading-text">Memuat data sistem...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        {/* Topbar */}
        <header className="topbar">
          {/* Left: Search Bar */}
          <div className="topbar-left">
            <div className="topbar-search-wrapper" ref={searchWrapperRef} onClick={(e) => e.stopPropagation()}>
              <Search size={16} className="topbar-search-icon" />
              <input
                type="text"
                placeholder="Search pages..."
                className="topbar-search-input"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
              />

              {/* Search Results Dropdown */}
              {showSearchDropdown && (
                <div className="search-dropdown animate-scale">
                  {filteredSearchItems.length > 0 || inventoryResults.length > 0 || auditResults.length > 0 || zoneResults.length > 0 ? (
                    <div className="search-dropdown-list">
                      {/* Pages Section */}
                      {filteredSearchItems.length > 0 && (
                        <>
                          <div className="search-dropdown-section-title">Pages</div>
                          {filteredSearchItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div
                                key={item.href}
                                className="search-dropdown-item"
                                onClick={() => handleSearchResultClick(item.href)}
                              >
                                <div className="search-dropdown-item-icon">
                                  <Icon size={16} />
                                </div>
                                <span className="search-dropdown-item-label">{item.label}</span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Inventory Section */}
                      {inventoryResults.length > 0 && (
                        <>
                          <div className="search-dropdown-section-title">Inventory Items</div>
                          {inventoryResults.map((item) => (
                            <div
                              key={item.id}
                              className="search-dropdown-item"
                              onClick={() => handleSearchResultClick('/settings/inventory')}
                            >
                              <div className="search-dropdown-item-icon">
                                <Package size={16} />
                              </div>
                              <div className="search-dropdown-item-info">
                                <span className="search-dropdown-item-label">{item.name}</span>
                                <div className="search-dropdown-item-meta">
                                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 5px' }}>{item.category}</span>
                                  <span className="search-dropdown-item-location"><MapPin size={10} /> {item.location}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Zones Section */}
                      {zoneResults.length > 0 && (
                        <>
                          <div className="search-dropdown-section-title">Zones</div>
                          {zoneResults.map((zone) => (
                            <div
                              key={zone.id}
                              className="search-dropdown-item"
                              onClick={() => handleSearchResultClick('/digital-twin/floor-plan')}
                            >
                              <div className="search-dropdown-item-icon" style={{ color: zone.color }}>
                                <MapPin size={16} />
                              </div>
                              <div className="search-dropdown-item-info">
                                <span className="search-dropdown-item-label">{zone.name}</span>
                                <div className="search-dropdown-item-meta">
                                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 5px' }}>{zone.type}</span>
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{zone.tempMin}°C – {zone.tempMax}°C</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Audit Logs Section */}
                      {auditResults.length > 0 && (
                        <>
                          <div className="search-dropdown-section-title">Audit Logs</div>
                          {auditResults.map((log) => (
                            <div
                              key={log.id}
                              className="search-dropdown-item"
                              onClick={() => handleSearchResultClick('/settings/audit')}
                            >
                              <div className="search-dropdown-item-icon">
                                <Activity size={16} />
                              </div>
                              <div className="search-dropdown-item-info">
                                <span className="search-dropdown-item-label">{log.user || log.username} — {log.action}</span>
                                <div className="search-dropdown-item-meta">
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{log.detail?.substring(0, 50)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Loading indicator for inventory */}
                      {inventoryLoading && filteredSearchItems.length === 0 && inventoryResults.length === 0 && zoneResults.length === 0 && auditResults.length === 0 && (
                        <div className="search-dropdown-empty">
                          <div className="spinner" />
                          <span>Searching...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="search-dropdown-empty">
                      {inventoryLoading ? (
                        <>
                          <div className="spinner" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <Search size={20} />
                          <span>No results found</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Notifications, Settings & Profile */}
          <div className="topbar-right">
            <div className="topbar-notification-wrapper">
              <button
                className="topbar-btn"
                aria-label="Notifications"
                title="Notifications"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                style={{ position: 'relative' }}
              >
                <Bell size={18} />
                {formatBadge(unreadCount) && (
                  <span className="topbar-notification-badge">{formatBadge(unreadCount)}</span>
                )}
              </button>

              {/* Notifications Dropdown Card */}
              {showNotifications && (
                <div
                  className="notification-dropdown animate-scale"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="notification-dropdown-header">
                    <h4 className="notification-dropdown-title">Notification</h4>
                    {unreadCount > 0 && (
                      <button
                        className="notification-mark-all-btn"
                        onClick={() => markAllAsRead()}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="notification-dropdown-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          className={`notification-item ${!notif.isRead ? 'notification-item-unread' : ''}`}
                          onClick={() => markAsRead(notif.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={`notification-item-icon ${getNotificationIconClass(notif.type)}`}>
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="notification-item-content">
                            <span className="notification-item-name">{notif.title}</span>
                            <span className="notification-item-desc">{notif.description}</span>
                          </div>
                          {!notif.isRead && <span className="notification-unread-dot"></span>}
                        </div>
                      ))
                    )}
                  </div>

                  <div
                    className="notification-dropdown-footer"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      router.push('/settings/notifications');
                      setShowNotifications(false);
                    }}
                  >
                    <span>See all notification</span>
                  </div>
                </div>
              )}
            </div>

            <button
              className="topbar-btn"
              aria-label="Production Copilot"
              title="Production Copilot"
              onClick={(e) => {
                e.stopPropagation();
                setIsChatOpen(true);
              }}
            >
              <Bot size={18} />
            </button>
            <button
              className="topbar-btn"
              aria-label="Settings"
              title="Settings"
              onClick={() => router.push('/settings/profile')}
            >
              <SettingsIcon size={18} />
            </button>
            <div className="topbar-divider"></div>

            {/* Clickable Profile wrapper */}
            <div
              className="topbar-profile"
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
            >
              <div className="topbar-avatar">
                {userAvatar ? (
                  <img src={userAvatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-username">{user.name}</span>
                <span className="topbar-role">{user.role}</span>
              </div>
              <ChevronDown size={14} className={`topbar-chevron ${showProfileMenu ? 'topbar-chevron-open' : ''}`} />

              {/* Admin Card Dropdown Menu */}
              {showProfileMenu && (
                <div
                  className="profile-dropdown animate-scale"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="profile-dropdown-item"
                    onClick={() => {
                      router.push('/settings/profile');
                      setShowProfileMenu(false);
                    }}
                  >
                    <User size={14} />
                    <span>Manage Account</span>
                  </div>
                  <div
                    className="profile-dropdown-item"
                    onClick={() => {
                      router.push('/settings/profile?tab=password');
                      setShowProfileMenu(false);
                    }}
                  >
                    <Key size={14} />
                    <span>Change Password</span>
                  </div>
                  <div
                    className="profile-dropdown-item"
                    onClick={() => {
                      router.push('/settings/audit');
                      setShowProfileMenu(false);
                    }}
                  >
                    <Activity size={14} />
                    <span>Activity Log</span>
                  </div>
                  <div
                    className="profile-dropdown-item profile-dropdown-item-logout"
                    onClick={logout}
                  >
                    <LogOut size={14} />
                    <span>Log out</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="content-area">
          {children}
        </main>

        {/* Floating Chatbot Button — Removed to move to navbar */}

        {/* Chatbot Overlay (Req 13.4, 13.8, 13.9) */}
        <ChatbotOverlay
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          setMessages={setChatMessages}
        />
      </div>
    </div>
  );
}
