"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu, X, Bell, Search, LayoutDashboard, Warehouse, Calendar,
  Thermometer, Database, FileSpreadsheet, Layers, ShieldCheck,
  LogOut, ChevronDown, User, Bot, Settings, AlertTriangle,
  Snowflake, Package, UploadCloud, Info, Key, Activity, Users, Map,
  ArrowUpRight, Microscope, Globe
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import ChatbotOverlay from "@/components/ChatbotOverlay";
import type { ChatMessage } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationProvider, useNotifications } from "@/lib/notifications";

function getNotificationIcon(type: string) {
  switch (type) {
    case 'alert': return <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />;
    case 'coldchain': return <Snowflake className="w-4 h-4 text-blue-500" />;
    case 'inventory': return <Package className="w-4 h-4 text-[#2C742F]" />;
    case 'upload': return <UploadCloud className="w-4 h-4 text-[#2C742F]" />;
    case 'audit': return <ShieldCheck className="w-4 h-4 text-stone-600" />;
    default: return <Info className="w-4 h-4 text-blue-500" />;
  }
}

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.3,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </NotificationProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, logout, loading } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'ai', text: 'Halo! Saya Aro, asisten AI AromaSys. Ada yang bisa saya bantu terkait inventori atau data sensor hari ini?', time: '08:00' }
  ]);

  // Set mounted flag after first render to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update chatbot greeting when language changes (only if no conversation has started)
  useEffect(() => {
    setChatMessages(prev => {
      if (prev.length === 1 && prev[0].id === 1 && prev[0].sender === 'ai') {
        return [{ id: 1, sender: 'ai', text: t('chatbotGreeting'), time: '08:00' }];
      }
      return prev;
    });
  }, [lang]);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // RBAC route protection
  useEffect(() => {
    if (!loading && user && pathname) {
      const role = user.role || 'Operator';
      const roleAccess: Record<string, string[]> = {
        Admin: [
          '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
          '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
          '/qc', '/settings/profile', '/settings/language', '/user-management',
          '/settings/notifications'
        ],
        QC: [
          '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
          '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
          '/qc', '/settings/profile', '/settings/language',
          '/settings/notifications'
        ],
        PPIC: [
          '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
          '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
          '/settings/profile', '/settings/language', '/settings/notifications'
        ],
        Operator: [
          '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
          '/cold-chain', '/data-ingestion', '/settings/profile',
          '/settings/language', '/settings/notifications'
        ],
      };
      const rk = Object.keys(roleAccess).find(k => k.toLowerCase() === role.toLowerCase()) || 'Operator';
      const allowed = roleAccess[rk];
      if (!allowed.includes(pathname)) {
        router.push('/overview');
      }
    }
  }, [loading, user, pathname, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // ─── Live Search ───
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [inventoryResults, setInventoryResults] = useState<Array<{ id: string; name: string; category: string; location: string }>>([]);
  const [auditResults, setAuditResults] = useState<Array<{ id?: string; user?: string; username?: string; action?: string; timestamp?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SEARCH_PAGES = [
    { label: t('overview'), href: '/overview', icon: LayoutDashboard },
    { label: t('floorPlan'), href: '/floor-plan', icon: Map },
    { label: t('inventoryMaster'), href: '/inventory-master', icon: Layers },
    { label: t('fifoExpiry'), href: '/fifo-expiry', icon: Calendar },
    { label: t('coldChain'), href: '/cold-chain', icon: Thermometer },
    { label: t('dataIngestion'), href: '/data-ingestion', icon: Database },
    { label: t('autoReport'), href: '/auto-report', icon: FileSpreadsheet },
    { label: t('auditLogs'), href: '/audit-trail', icon: ShieldCheck },
    { label: t('userManagement'), href: '/user-management', icon: Users },
  ];

  const filteredPages = searchQuery.trim()
    ? SEARCH_PAGES.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setInventoryResults([]);
      setAuditResults([]);
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [invData, auditData] = await Promise.all([
          api.get<{ success: boolean; items: Array<{ id: string; name: string; category: string; location: string }> }>(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`),
          api.get<{ success: boolean; logs: Array<{ id?: string; user?: string; username?: string; action?: string; timestamp?: string }> }>('/audit'),
        ]);
        if (invData.success) setInventoryResults((invData.items ?? []).slice(0, 5));
        else setInventoryResults([]);
        if (auditData.success) {
          const q = searchQuery.toLowerCase();
          const filtered = (auditData.logs ?? []).filter(log =>
            log.user?.toLowerCase().includes(q) ||
            log.username?.toLowerCase().includes(q) ||
            log.action?.toLowerCase().includes(q)
          );
          setAuditResults(filtered.slice(0, 3));
        } else setAuditResults([]);
      } catch {
        setInventoryResults([]);
        setAuditResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [searchQuery]);

  // RBAC: define which routes each role can access
  const ROLE_ACCESS: Record<string, string[]> = {
    Admin: [
      '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
      '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
      '/qc', '/settings/profile', '/settings/language', '/user-management',
      '/settings/notifications'
    ],
    QC: [
      '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
      '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
      '/qc', '/settings/profile', '/settings/language',
      '/settings/notifications'
    ],
    PPIC: [
      '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
      '/cold-chain', '/data-ingestion', '/auto-report', '/audit-trail',
      '/settings/profile', '/settings/language', '/settings/notifications'
    ],
    Operator: [
      '/overview', '/floor-plan', '/inventory-master', '/fifo-expiry',
      '/cold-chain', '/data-ingestion', '/settings/profile',
      '/settings/language', '/settings/notifications'
    ],
  };

  const userRole = user?.role || 'Operator';
  const roleKey = Object.keys(ROLE_ACCESS).find(k => k.toLowerCase() === userRole.toLowerCase()) || 'Operator';
  const allowedRoutes = ROLE_ACCESS[roleKey];

  const filterItems = (items: { name: string; href: string; icon: any }[]) =>
    items.filter(item => allowedRoutes.includes(item.href));

  // Hikari sidebar menu groups
  const menuGroups = [
    {
      title: t('mainGroup'),
      items: filterItems([
        { name: t('overview'), href: "/overview", icon: LayoutDashboard },
        { name: t('floorPlan'), href: "/floor-plan", icon: Map },
      ])
    },
    {
      title: t('warehouseGroup'),
      items: filterItems([
        { name: t('inventoryMaster'), href: "/inventory-master", icon: Layers },
        { name: t('fifoExpiry'), href: "/fifo-expiry", icon: Calendar },
        { name: t('coldChain'), href: "/cold-chain", icon: Thermometer },
        { name: t('dataIngestion'), href: "/data-ingestion", icon: Database },
      ])
    },
    {
      title: t('productionGroup'),
      items: filterItems([
        { name: t('autoReport'), href: "/auto-report", icon: FileSpreadsheet },
        { name: t('auditLogs'), href: "/audit-trail", icon: ShieldCheck },
        { name: t('qualityControl'), href: "/qc", icon: Microscope },
      ])
    },
    {
      title: t('settingsGroup'),
      items: filterItems([
        { name: t('profile'), href: "/settings/profile", icon: User },
        { name: t('language'), href: "/settings/language", icon: Globe },
        { name: t('userManagement'), href: "/user-management", icon: Users },
      ])
    }
  ].filter(group => group.items.length > 0);

  const getDisplayRole = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin') return t('roleAdmin');
    if (r === 'qc' || r === 'quality_control') return t('roleQC');
    if (r === 'ppic') return t('rolePPIC');
    return t('roleOperator');
  };

  return (
    <div className="h-screen w-full flex bg-[#D7E5D8] select-none font-sans overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#2C742F] border-r border-[#2C742F]/10 h-full shrink-0 text-left">
        {/* Brand Logo */}
        <div className="h-16 border-b border-white/10 flex flex-col items-center justify-center shrink-0">
          <div className="flex items-center gap-2 justify-center">
            <img src="/logo-cerah.png" alt="AromaSys" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-2xl text-emerald-50 leading-none">AromaSys</span>
          </div>
          <div className="text-[#AAE970] text-[10px] font-bold uppercase tracking-widest mt-1 text-center">
            SIMA AROME
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 py-6 space-y-5 overflow-y-auto" suppressHydrationWarning>
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-4 py-1">
                <span className="text-green-200 text-xs font-bold uppercase tracking-wider block opacity-70">
                  {group.title}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-all text-sm font-semibold group relative ${isActive
                        ? "text-[#CBEAD2] bg-white/10 rounded-l-xl rounded-r-none border-r-4 border-[#BCF389]"
                        : "text-green-200/80 hover:text-white hover:bg-white/5 rounded-xl"
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-[#CBEAD2]" : "text-green-200/70 group-hover:text-green-100"}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-white/10" suppressHydrationWarning>
          <button
            onClick={handleLogout}
            suppressHydrationWarning
            className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3.5 text-sm font-semibold text-green-200/80 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4.5 h-4.5 text-green-200/70" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/75 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-64 bg-[#2C742F] p-5 z-50 lg:hidden flex flex-col text-left"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 justify-center flex-1">
                  <img src="/logo-cerah.png" alt="AromaSys" className="w-6 h-6 object-contain" />
                  <span className="font-semibold text-2xl text-emerald-50 leading-none">AromaSys</span>
                </div>
                <button onClick={() => setIsMobileOpen(false)} className="p-1 rounded-lg hover:bg-white/5 text-green-200 hover:text-white shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-[#AAE970] text-[10px] font-bold uppercase tracking-widest mt-1.5 text-center">
                SIMA AROME
              </div>

              <nav className="flex-1 py-6 space-y-5 overflow-y-auto">
                {menuGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="px-4 py-1">
                      <span className="text-green-200 text-xs font-bold uppercase tracking-wider block opacity-70">
                        {group.title}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-all text-sm font-semibold group relative ${isActive
                              ? "text-[#CBEAD2] bg-white/10 rounded-l-xl rounded-r-none border-r-4 border-[#BCF389]"
                              : "text-green-200/80 hover:text-white hover:bg-white/5 rounded-xl"
                            }`}
                          >
                            <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-[#CBEAD2]" : "text-green-200/70 group-hover:text-green-100"}`} />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="border-t border-white/10 pt-4">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3.5 text-sm font-semibold text-green-200/80 hover:text-white hover:bg-white/5 transition-all"
                >
                  <LogOut className="w-4.5 h-4.5 text-green-200/70" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top Header Bar */}
        <header className="h-16 sticky top-0 z-30 bg-[#D7E5D8]/95 border-b border-[#2C742F]/10 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 rounded-lg border border-[#2C742F]/20 bg-white/10 hover:bg-white/20 lg:hidden text-[#2C742F]"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search Pill */}
            <div ref={searchWrapperRef} className="relative hidden md:block w-72" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
                suppressHydrationWarning
                className="w-full bg-[#f3f6f3] rounded-full border border-stone-300 py-1.5 pl-10 pr-4 text-xs font-semibold text-[#1C1B1F] placeholder:text-[#79747E]/60 focus:outline-none focus:ring-1 focus:ring-[#2C742F]/20"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#79747E]" />

              {/* Search Dropdown */}
              <AnimatePresence>
                {showSearchDropdown && searchQuery.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-full bg-[#F2F7ED]/98 backdrop-blur-lg border border-stone-200/60 rounded-2xl shadow-xl z-50 overflow-hidden text-left max-h-[360px] overflow-y-auto"
                  >
                    {filteredPages.length > 0 && (
                      <div className="p-2">
                        <p className="px-3 py-1 text-[9px] font-bold text-[#79747E] uppercase tracking-wider">{t('searchPages')}</p>
                        {filteredPages.map(page => {
                          const Icon = page.icon;
                          return (
                            <button
                              key={page.href}
                              onClick={() => { router.push(page.href); setShowSearchDropdown(false); setSearchQuery(''); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/60 transition-all text-left"
                            >
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-[#2C742F]/10 flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5 text-[#2C742F]" />
                              </div>
                              <span className="text-xs font-semibold text-[#1C1B1F]">{page.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {inventoryResults.length > 0 && (
                      <div className="p-2 border-t border-stone-200/40">
                        <p className="px-3 py-1 text-[9px] font-bold text-[#79747E] uppercase tracking-wider">{t('searchInventory')}</p>
                        {inventoryResults.map(item => (
                          <button
                            key={item.id}
                            onClick={() => { router.push('/inventory-master'); setShowSearchDropdown(false); setSearchQuery(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/60 transition-all text-left"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-[#2C742F]/10 flex items-center justify-center shrink-0">
                              <Package className="w-3.5 h-3.5 text-[#2C742F]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#1C1B1F] truncate">{item.name}</p>
                              <p className="text-[9px] text-[#79747E] truncate">{item.category} · {item.location}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {auditResults.length > 0 && (
                      <div className="p-2 border-t border-stone-200/40">
                        <p className="px-3 py-1 text-[9px] font-bold text-[#79747E] uppercase tracking-wider">{t('searchActivityLogs')}</p>
                        {auditResults.map((log, i) => (
                          <button
                            key={`audit-${i}`}
                            onClick={() => { router.push('/audit-trail'); setShowSearchDropdown(false); setSearchQuery(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/60 transition-all text-left"
                          >
                            <div className="w-7 h-7 rounded-lg bg-stone-100 border border-stone-200/40 flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-3.5 h-3.5 text-stone-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#1C1B1F] truncate">{log.username || log.user || 'Unknown'}</p>
                              <p className="text-[9px] text-[#79747E] truncate">{log.action}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchLoading && filteredPages.length === 0 && inventoryResults.length === 0 && auditResults.length === 0 && (
                      <div className="p-6 flex items-center justify-center gap-2 text-xs text-[#79747E] font-semibold">
                        <div className="w-4 h-4 border-2 border-[#2C742F] border-t-transparent rounded-full animate-spin" />
                        {t('searching')}
                      </div>
                    )}

                    {!searchLoading && filteredPages.length === 0 && inventoryResults.length === 0 && auditResults.length === 0 && (
                      <div className="p-6 flex flex-col items-center justify-center gap-1 text-center">
                        <Search className="w-5 h-5 text-[#79747E]/60" />
                        <p className="text-xs text-[#79747E] font-semibold">{t('searchNoResults')}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(!showNotifications);
                  setIsProfileOpen(false);
                }}
                className="relative p-2 rounded-full border border-[#2C742F]/10 bg-white/40 hover:bg-white/70 text-[#1C1B1F] transition-colors focus:outline-none"
                title={t('notifications')}
                suppressHydrationWarning
              >
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EA4B48] text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                <Bell className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-6 w-80 bg-[#F2F7ED]/95 backdrop-blur-md border border-stone-200/50 rounded-2xl shadow-xl z-50 overflow-hidden text-left"
                    >
                      <div className="p-4 border-b border-stone-200/60 flex items-center justify-between">
                        <span className="text-sm font-bold text-green-950">{t('notificationsTitle')}</span>
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} className="text-[10px] font-bold text-[#2C742F] hover:underline">
                            {t('markAllRead')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-stone-200/60 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-stone-400 font-semibold">
                            {t('noNewNotifications')}
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3 flex gap-3 transition-colors ${!notif.isRead ? 'bg-emerald-50/10' : ''}`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-white border border-[#AAE970]/10 flex items-center justify-center shrink-0">
                                {getNotificationIcon(notif.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs ${!notif.isRead ? 'font-bold text-green-950' : 'text-stone-700'}`}>{notif.title}</p>
                                <p className="text-[10px] text-stone-500 mt-0.5 truncate">{notif.description}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {notif.href && (
                                    <button
                                      onClick={() => { markAsRead(notif.id); router.push(notif.href!); setShowNotifications(false); }}
                                      className="flex items-center gap-1 text-[9px] font-bold text-[#2C742F] hover:underline"
                                    >
                                      <ArrowUpRight size={10} className="shrink-0" /> {t('viewDetail')}
                                    </button>
                                  )}
                                  {!notif.isRead && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                      className="text-[9px] font-bold text-[#79747E] hover:text-[#1C1B1F] hover:underline"
                                    >
                                      {t('markRead')}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!notif.isRead && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#EA4B48] self-center shrink-0" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-2.5 border-t border-stone-200/60 text-center bg-white/40">
                        <button
                          onClick={() => { router.push('/settings/notifications'); setShowNotifications(false); }}
                          className="text-[10px] font-bold text-stone-500 hover:text-stone-800"
                        >
                          {t('viewAllNotifications')}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* AI Production Copilot */}
            <button
              onClick={() => setChatOpen(true)}
              className="relative p-2 rounded-full border border-[#2C742F]/10 bg-white/40 hover:bg-white/70 text-[#1C1B1F] transition-colors focus:outline-none"
              title="Production Copilot"
              suppressHydrationWarning
            >
              <Bot className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={() => router.push('/settings/profile')}
              className="relative p-2 rounded-full border border-[#2C742F]/10 bg-white/40 hover:bg-white/70 text-[#1C1B1F] transition-colors focus:outline-none hidden sm:flex"
              title="Settings"
              suppressHydrationWarning
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 sm:gap-3 p-1 pr-2 sm:pr-3 rounded-full hover:bg-white/40 transition-all focus:outline-none"
                >
                  <img
                    src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=2C742F&color=fff&size=200`}
                    alt={user.name}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#2C742F]/20"
                  />
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-sm font-bold text-[#1C1B1F] leading-tight">{user.name}</span>
                    <span className="text-[10px] text-[#79747E] font-semibold leading-none">{getDisplayRole(user.role)}</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border border-stone-300 bg-white/40 hidden sm:flex items-center justify-center">
                    <ChevronDown className="w-3.5 h-3.5 text-[#79747E]" />
                  </div>
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-4 w-52 bg-[#F2F7ED]/95 backdrop-blur-md border border-stone-200/50 rounded-2xl shadow-xl z-50 overflow-hidden text-left"
                      >
                        <div className="p-1 space-y-0.5">
                          <button
                            onClick={() => { setIsProfileOpen(false); router.push('/settings/profile'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-stone-700 hover:text-stone-900 hover:bg-white/60 rounded-xl transition-all font-semibold text-sm text-left"
                          >
                            <User className="w-4.5 h-4.5 text-[#5A94E2] shrink-0" />
                            <span>{t('manageAccount')}</span>
                          </button>
                          <button
                            onClick={() => { setIsProfileOpen(false); router.push('/settings/profile?tab=password'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-stone-700 hover:text-stone-900 hover:bg-white/60 rounded-xl transition-all font-semibold text-sm text-left"
                          >
                            <Key className="w-4.5 h-4.5 text-[#2C742F] shrink-0" />
                            <span>{t('changePassword')}</span>
                          </button>
                          <button
                            onClick={() => { setIsProfileOpen(false); router.push('/audit-trail'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-stone-700 hover:text-stone-900 hover:bg-white/60 rounded-xl transition-all font-semibold text-sm text-left"
                          >
                            <Activity className="w-4.5 h-4.5 text-[#79747E] shrink-0" />
                            <span>{t('activityLog')}</span>
                          </button>
                          <div className="h-[1px] bg-stone-200/60 my-1 mx-2" />
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-stone-700 hover:text-stone-900 hover:bg-white/60 rounded-xl transition-all font-semibold text-sm text-left"
                          >
                            <LogOut className="w-4.5 h-4.5 text-[#EA4B48] shrink-0" />
                            <span>{t('logOut')}</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
              {children}
          </div>
        </main>
      </div>

      {/* Copilot Chat Overlay */}
      <ChatbotOverlay
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        setMessages={setChatMessages}
      />
    </div>
  );
}
