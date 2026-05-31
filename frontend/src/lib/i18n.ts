import { useState, useEffect } from 'react';
import { api } from './api';

export type Language = 'id' | 'en';

export const translations = {
  id: {
    // Navigation - Sidebar Groups
    mainGroup: 'UTAMA',
    warehouseGroup: 'GUDANG',
    productionGroup: 'PRODUKSI',
    settingsGroup: 'PENGATURAN',

    // Navigation - Menu Items
    overview: 'Ringkasan',
    floorPlan: 'Denah Interaktif',
    inventoryMaster: 'Master Inventori',
    fifoExpiry: 'FIFO & Kedaluwarsa',
    coldChain: 'Monitor Rantai Dingin',
    dataIngestion: 'Perekaman Data',
    autoReport: 'Laporan Otomatis',
    auditLogs: 'Log Audit',
    qualityControl: 'Kontrol Kualitas',
    userManagement: 'Manajemen Pengguna',

    // Settings
    settings: 'Pengaturan',
    language: 'Bahasa',
    notifications: 'Notifikasi',
    profile: 'Profil',
    logout: 'Keluar',

    // Search
    searchPlaceholder: 'Cari halaman, item, log...',
    searchPages: 'Halaman',
    searchInventory: 'Inventori',
    searchActivityLogs: 'Log Aktivitas',
    searchNoResults: 'Tidak ditemukan',
    searching: 'Mencari...',

    // Header profile dropdown
    manageAccount: 'Kelola Akun',
    changePassword: 'Ubah Password',
    activityLog: 'Log Aktivitas',
    logOut: 'Keluar',

    // Notifications popup
    notificationsTitle: 'Notifikasi',
    markAllRead: 'Tandai semua dibaca',
    noNewNotifications: 'Tidak ada notifikasi baru',
    viewDetail: 'Lihat Detail',
    markRead: 'Tandai dibaca',
    viewAllNotifications: 'Lihat semua notifikasi',

    // Notification settings page
    notifUnreadCount: 'Anda memiliki {count} notifikasi belum dibaca',
    notifAllRead: 'Semua notifikasi telah dibaca. Bersih!',
    notifMarkAllRead: 'Tandai semua dibaca',
    notifFilterAll: 'Semua',
    notifFilterUnread: 'Belum Dibaca',
    notifFilterAlerts: 'Peringatan',
    notifFilterInventory: 'Stok & Inventori',
    notifFilterColdChain: 'Rantai Dingin',
    notifFilterSystem: 'Sistem',
    notifNone: 'Tidak ada notifikasi',
    notifNoneDesc: 'Tidak ada log notifikasi yang cocok untuk filter saat ini.',
    notifJustNow: 'Baru saja',
    notifMinAgo: '{n}m lalu',
    notifHourAgo: '{n}j lalu',
    notifDayAgo: '{n}h lalu',

    // Roles
    roleAdmin: 'Admin',
    roleQC: 'Kontrol Kualitas',
    rolePPIC: 'Perencana PPIC',
    roleOperator: 'Operator',

    // Floor plan page
    interactiveFloorPlan: 'Denah Interaktif',
    floorPlanSub: 'Desain, letakkan, dan pantau zona penyimpanan gudang digital twin live.',
    uploadPlan: 'Unggah Denah',
    resetDefault: 'Reset Default',
    undo: 'Batal',
    addZone: 'Tambah Zona',
    tambahLayout: 'Tambah Layout',

    // Buttons
    save: 'Simpan',
    cancel: 'Batal',
    delete: 'Hapus',
    edit: 'Ubah',

    // Profile page
    profileSettings: 'Pengaturan Profil',
    tabAccount: 'Akun',
    tabPassword: 'Password',
    fullName: 'Nama Lengkap',
    emailLabel: 'Email',
    roleLabel: 'Jabatan',
    saveChanges: 'Simpan Perubahan',
    currentPassword: 'Password Saat Ini',
    newPasswordLabel: 'Password Baru',
    confirmPassword: 'Konfirmasi Password',
    changePasswordTitle: 'Ubah Password',
    passwordMinLength: 'Password minimal 8 karakter.',
    passwordNoMatch: 'Password tidak cocok.',
    updateProfileSuccess: 'Profil berhasil diperbarui!',
    updateProfileFail: 'Gagal memperbarui profil.',
    changePasswordSuccess: 'Password berhasil diubah!',
    backToDefault: 'Kembali ke Default',
    languageSettingsTitle: 'Pengaturan Bahasa',
    languageSettingsSub: 'Pilih bahasa tampilan untuk aplikasi AromaSys.',
    langSuccessId: 'Bahasa berhasil diubah ke Bahasa Indonesia',
    langSuccessEn: 'Bahasa berhasil diubah ke Bahasa Inggris',

    // Chatbot
    chatbotTitle: 'Kopilot Produksi',
    chatbotSub: 'Aro — AI AromaSys',
    insightLowStock: 'Cek Stok Hampir Habis',
    insightLowStockDesc: 'Identifikasi bahan baku yang hampir mencapai batas minimum.',
    insightExpiring: 'Bahan Kedaluwarsa Bulan Ini',
    insightExpiringDesc: 'Tinjau semua lot inventori yang mendekati tanggal kedaluwarsa.',
    insightPPIC: 'Buat Jadwal PPIC Optimal',
    insightPPICDesc: 'Buat jadwal produksi berdasarkan inventari dan permintaan saat ini.',
    insightColdStorage: 'Cari Slot Cold Storage Kosong',
    insightColdStorageDesc: 'Temukan posisi palet yang tersedia di zona pendingin.',
    insightGenerateReport: 'Generate Laporan Inventori Lengkap',
    insightGenerateReportDesc: 'Buat laporan tabel lengkap semua item, status, zona, dan kedaluwarsa.',
    downloadReport: 'Unduh Laporan PDF',

    // Chatbot common
    botName: 'Aro - AI Copilot',
    botSub: 'Asisten AI Pergudangan AromaSys',
    chatbotGreeting: 'Halo! Saya Aro, asisten AI AromaSys. Ada yang bisa saya bantu terkait inventori atau data sensor hari ini?',

    // Overview page
    overviewTitle: 'Ringkasan Dashboard',
    overviewSub: 'Pantau kondisi gudang secara real-time.',
    totalActiveStock: 'Total Stok Aktif',
    nearingExpiry: 'Mendekati Kedaluwarsa',
    warehouseCapacity: 'Kapasitas Gudang',
    coldChainAlerts: 'Peringatan Rantai Dingin',
    weeklyStockTrend: 'Tren Stok Mingguan',
    recentActivity: 'Aktivitas Terkini',
    quickStats: 'Statistik Cepat',
    loadingDashboard: 'Memuat Dashboard',
    fetchingData: 'Mengambil data gudang...',

    // Inventory Master page
    inventoryMasterTitle: 'Master Inventori',
    inventoryMasterSub: 'Kelola seluruh data bahan baku gudang.',
    searchInventory2: 'Cari bahan baku...',
    addNewRecord: 'Tambah Data Baru',
    updateStock: 'Update Stok',
    loadingInventory: 'Memuat Data Inventori...',
    noInventoryFound: 'Tidak ada data ditemukan.',
    allCategories: 'Semua Kategori',
    allZones: 'Semua Zona',
    allStatus: 'Semua Status',
    colName: 'Nama Bahan',
    colCategory: 'Kategori',
    colQty: 'Qty',
    colLocation: 'Lokasi',
    colExpiry: 'Kedaluwarsa',
    colStatus: 'Status',
    colActions: 'Aksi',

    // FIFO & Expiry page
    fifoExpiryTitle: 'FIFO & Kedaluwarsa',
    fifoExpirySub: 'Monitor rotasi stok dan bahan mendekati kedaluwarsa.',
    sortByExpiry: 'Urutkan: Paling Dekat Kedaluwarsa',
    sortByName: 'Urutkan: Nama',
    sortByQty: 'Urutkan: Qty',
    loadingFifo: 'Memuat Data FIFO & Kedaluwarsa...',
    daysLeft: 'Hari Tersisa',
    expired: 'Kedaluwarsa',
    exportCsv: 'Ekspor CSV',
    colMaterial: 'Material & Lot',
    colIntakeDate: 'Tanggal Masuk',
    colSlot: 'Slot Lokasi',
    colTimeline: 'Timeline Kedaluwarsa',

    // Cold Chain Monitor page
    coldChainTitle: 'Monitor Rantai Dingin',
    coldChainSub: 'Pantau suhu dan kelembapan zona penyimpanan secara real-time.',
    createTicket: 'Buat Tiket Maintenance',
    allZonesFilter: 'Semua Zona',
    loadingTelemetry: 'Memuat Data Telemetri...',
    targetRange: 'Rentang Target',
    humidity: 'Kelembapan',
    stable: 'Stabil',
    warning: 'Peringatan',
    critical: 'Kritis',
    takeAction: 'Ambil Tindakan',

    // Data Ingestion page
    dataIngestionTitle: 'Perekaman Data',
    dataIngestionSub: 'Upload dan rekam data inventori dari berbagai sumber.',
    uploadFiles: 'Upload & Lampirkan File',
    noFilesYet: 'Belum ada file yang diupload.',
    dropFilesHere: 'Taruh file di sini atau klik untuk pilih.',
    loadingIngestion: 'Memuat data...',

    // Auto Report page
    autoReportTitle: 'Laporan Otomatis',
    autoReportSub: 'Generate laporan inventori otomatis secara terjadwal.',
    generateReport: 'Generate Laporan',
    reportConfig: 'Konfigurasi Laporan',
    reportFormat: 'Format Laporan',
    loadingReport: 'Memuat Data...',

    // Audit Trail page
    auditTrailTitle: 'Log Audit',
    auditTrailSub: 'Riwayat seluruh aktivitas dan perubahan sistem.',
    searchAuditLogs: 'Cari log berdasarkan Aktor, Aksi, atau Detail...',
    allRoles: 'Semua Role',
    allModules: 'Semua Modul',
    loadingLogs: 'Memuat Log Aktivitas...',
    noLogsFound: 'Tidak ada log aktivitas yang cocok ditemukan.',
    colTimestamp: 'Waktu',
    colActor: 'Aktor',
    colModule: 'Modul',
    colAction: 'Aksi & Detail',

    // User Management page
    userManagementTitle: 'Manajemen Pengguna',
    userManagementSub: 'Kelola akun dan peran pengguna sistem.',
    addEmployee: 'Tambah Karyawan',
    searchUsers: 'Cari pengguna...',

    // Landing page
    landingTitle1: 'AromaSys',
    landingTitle2: 'Sistem Gudang',
    landingSub: 'Teknologi pemantauan sensorik modern dan pelacakan batch aktif untuk Sima Arome. Kelola kemurnian minyak esensial dan rantai dingin dalam satu konsol cerdas.',
    signUpBtn: 'Daftar',
    signInBtn: 'Masuk',
    copyright: '© 2026 Logistik AromaSys. Hak Cipta Dilindungi.',

    // Sign In page
    signInTitle: 'Masuk',
    signInSubtitle: 'Masuk ke akun AromaSys Anda',
    emailPlaceholder: 'john.doe@gmail.com',
    passwordPlaceholder: '••••••••••',
    rememberMe: 'Ingat saya',
    forgotPassword: 'Lupa Password?',
    dontHaveAccount: 'Belum punya akun?',
    signUpNow: 'Daftar Sekarang',
    signInSubmit: 'Masuk',
    signInQuotePart1: 'Menjaga Kualitas,',
    signInQuotePart2: 'Mengalirkan Aroma.',
    signInQuoteDesc: 'Pemantauan presisi sensor suhu dan kelembapan real-time untuk menjamin kesegaran esensial konsentrat parfum terbaik.',

    // Sign Up page
    signUpTitle: 'Daftar',
    signUpSubtitle: 'Daftar akun perusahaan baru',
    fullNameLabel: 'Nama Lengkap',
    fullNamePlaceholder: 'Nama lengkap Anda',
    roleLabelSelect: 'Pilih peran...',
    roleWarehouseStaff: 'Staf Gudang (Aroma Stock)',
    roleQCSelect: 'Kontrol Kualitas (Penilai Lab)',
    rolePPICSelect: 'Perencana Produksi (PPIC)',
    roleAdminSelect: 'Manajer Operasional (Admin)',
    confirmPasswordLabel: 'Konfirmasi Password',
    signUpSubmit: 'Daftar',
    alreadyHaveAccount: 'Sudah memiliki akun?',
    signInNow: 'Masuk Sekarang',
    signUpQuotePart1: 'Presisi',
    signUpQuotePart2: 'di Setiap Tetes.',
    signUpQuoteDesc: 'Integrasi digital twin dan analisis AI untuk manajemen inventori bahan baku parfum yang optimal dan FIFO yang akurat.',
    backBtn: 'Kembali',
    emailRequired: 'Email wajib diisi',
    emailInvalid: 'Format email tidak valid',
    passwordRequired: 'Password wajib diisi',
    passwordMinLengthErr: 'Password minimal 6 karakter',
    connFailed: 'Koneksi ke server otentikasi gagal.',
    invalidCreds: 'Kredensial tidak valid',
    nameRequired: 'Nama lengkap wajib diisi',
    roleRequired: 'Peran wajib diisi',
    passwordsNoMatch: 'Password tidak cocok',
    registerFailed: 'Gagal melakukan pendaftaran',
    registerConnFailed: 'Koneksi ke server pendaftaran gagal.',
  },
  en: {
    // Navigation - Sidebar Groups
    mainGroup: 'MAIN',
    warehouseGroup: 'WAREHOUSE',
    productionGroup: 'PRODUCTION',
    settingsGroup: 'SETTINGS',

    // Navigation - Menu Items
    overview: 'Overview',
    floorPlan: 'Interactive Floor Plan',
    inventoryMaster: 'Inventory Master',
    fifoExpiry: 'FIFO & Expiry',
    coldChain: 'Cold-Chain Monitor',
    dataIngestion: 'Data Ingestion',
    autoReport: 'Auto-Report',
    auditLogs: 'Audit Logs',
    qualityControl: 'Quality Control',
    userManagement: 'User Management',

    // Settings
    settings: 'Settings',
    language: 'Language',
    notifications: 'Notifications',
    profile: 'Profile',
    logout: 'Logout',

    // Search
    searchPlaceholder: 'Search pages, items, logs...',
    searchPages: 'Pages',
    searchInventory: 'Inventory',
    searchActivityLogs: 'Activity Logs',
    searchNoResults: 'No results found',
    searching: 'Searching...',

    // Header profile dropdown
    manageAccount: 'Manage Account',
    changePassword: 'Change Password',
    activityLog: 'Activity Log',
    logOut: 'Log out',

    // Notifications popup
    notificationsTitle: 'Notifications',
    markAllRead: 'Mark all as read',
    noNewNotifications: 'No new notifications',
    viewDetail: 'View Detail',
    markRead: 'Mark as read',
    viewAllNotifications: 'View all notifications',

    // Notification settings page
    notifUnreadCount: 'You have {count} unread notifications',
    notifAllRead: 'All notifications have been read. Clean!',
    notifMarkAllRead: 'Mark all as read',
    notifFilterAll: 'All',
    notifFilterUnread: 'Unread',
    notifFilterAlerts: 'Alerts',
    notifFilterInventory: 'Stock & Inventory',
    notifFilterColdChain: 'Cold Chain',
    notifFilterSystem: 'System',
    notifNone: 'No notifications',
    notifNoneDesc: 'No notification logs match the current filter.',
    notifJustNow: 'Just now',
    notifMinAgo: '{n}m ago',
    notifHourAgo: '{n}h ago',
    notifDayAgo: '{n}d ago',

    // Roles
    roleAdmin: 'Admin',
    roleQC: 'Quality Control',
    rolePPIC: 'PPIC Planner',
    roleOperator: 'Operator',

    // Floor plan page
    interactiveFloorPlan: 'Interactive Floor Plan',
    floorPlanSub: 'Design, place, and monitor warehouse storage zones in a live digital twin.',
    uploadPlan: 'Upload Plan',
    resetDefault: 'Reset Default',
    undo: 'Undo',
    addZone: 'Add Zone',
    tambahLayout: 'Add Layout',

    // Buttons
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',

    // Profile page
    profileSettings: 'Profile Settings',
    tabAccount: 'Account',
    tabPassword: 'Password',
    fullName: 'Full Name',
    emailLabel: 'Email',
    roleLabel: 'Role',
    saveChanges: 'Save Changes',
    currentPassword: 'Current Password',
    newPasswordLabel: 'New Password',
    confirmPassword: 'Confirm New Password',
    changePasswordTitle: 'Change Password',
    passwordMinLength: 'Password must be at least 8 characters.',
    passwordNoMatch: 'Passwords do not match.',
    updateProfileSuccess: 'Profile updated successfully!',
    updateProfileFail: 'Failed to update profile.',
    changePasswordSuccess: 'Password changed successfully!',
    backToDefault: 'Back to Default',
    languageSettingsTitle: 'Language Settings',
    languageSettingsSub: 'Choose the display language for AromaSys.',
    langSuccessId: 'Language successfully changed to Bahasa Indonesia',
    langSuccessEn: 'Language successfully changed to English',

    // Chatbot
    chatbotTitle: 'Production Copilot',
    chatbotSub: 'Aro — AromaSys AI',
    insightLowStock: 'Check Low Stock Items',
    insightLowStockDesc: 'Identify raw materials dropping below minimum thresholds.',
    insightExpiring: 'Show Expiring Lots This Month',
    insightExpiringDesc: 'Review all inventory lots nearing expiration to prioritize usage.',
    insightPPIC: 'Generate Optimal PPIC Schedule',
    insightPPICDesc: 'Draft a production schedule based on current inventory and demand.',
    insightColdStorage: 'Find Empty Cold Storage Slots',
    insightColdStorageDesc: 'Locate available pallet positions in climate-controlled zones.',
    insightGenerateReport: 'Generate Full Inventory Report',
    insightGenerateReportDesc: 'Create a complete table report of all items, status, zones, and expiry.',
    downloadReport: 'Download PDF Report',

    // Chatbot common
    botName: 'Aro - AI Copilot',
    botSub: 'AromaSys Warehouse AI Assistant',
    chatbotGreeting: 'Hello! I\'m Aro, the AromaSys AI assistant. How can I help you with inventory or sensor data today?',

    // Overview page
    overviewTitle: 'Dashboard Overview',
    overviewSub: 'Monitor warehouse conditions in real-time.',
    totalActiveStock: 'Total Active Stock',
    nearingExpiry: 'Nearing Expiry',
    warehouseCapacity: 'Warehouse Capacity',
    coldChainAlerts: 'Cold-Chain Alerts',
    weeklyStockTrend: 'Weekly Stock Trend',
    recentActivity: 'Recent Activity',
    quickStats: 'Quick Stats',
    loadingDashboard: 'Loading Dashboard',
    fetchingData: 'Fetching live warehouse data...',

    // Inventory Master page
    inventoryMasterTitle: 'Inventory Master',
    inventoryMasterSub: 'Manage all raw material data.',
    searchInventory2: 'Search inventory...',
    addNewRecord: 'Add New Record',
    updateStock: 'Update Stock',
    loadingInventory: 'Loading Inventory...',
    noInventoryFound: 'No data found.',
    allCategories: 'All Categories',
    allZones: 'All Zones',
    allStatus: 'All Status',
    colName: 'Material Name',
    colCategory: 'Category',
    colQty: 'Qty',
    colLocation: 'Location',
    colExpiry: 'Expiry',
    colStatus: 'Status',
    colActions: 'Actions',

    // FIFO & Expiry page
    fifoExpiryTitle: 'FIFO & Expiry',
    fifoExpirySub: 'Monitor stock rotation and items nearing expiry.',
    sortByExpiry: 'Sort: Nearest Expiry',
    sortByName: 'Sort: Name',
    sortByQty: 'Sort: Qty',
    loadingFifo: 'Loading FIFO & Expiry...',
    daysLeft: 'Days Left',
    expired: 'Expired',
    exportCsv: 'Export CSV',
    colMaterial: 'Material & Lot',
    colIntakeDate: 'Intake Date',
    colSlot: 'Location Slot',
    colTimeline: 'Expiry Timeline',

    // Cold Chain Monitor page
    coldChainTitle: 'Cold-Chain Monitor',
    coldChainSub: 'Monitor zone temperatures and humidity in real-time.',
    createTicket: 'Create Maintenance Ticket',
    allZonesFilter: 'All Zones',
    loadingTelemetry: 'Loading Telemetry...',
    targetRange: 'Target Range',
    humidity: 'Humidity',
    stable: 'Stable',
    warning: 'Warning',
    critical: 'Critical',
    takeAction: 'Take Action',

    // Data Ingestion page
    dataIngestionTitle: 'Data Ingestion',
    dataIngestionSub: 'Upload and record inventory data from various sources.',
    uploadFiles: 'Upload & Attach Files',
    noFilesYet: 'No files uploaded yet.',
    dropFilesHere: 'Drop files here or click to select.',
    loadingIngestion: 'Loading data...',

    // Auto Report page
    autoReportTitle: 'Auto-Report',
    autoReportSub: 'Automatically generate scheduled inventory reports.',
    generateReport: 'Generate Report',
    reportConfig: 'Report Configuration',
    reportFormat: 'Report Format',
    loadingReport: 'Loading Data...',

    // Audit Trail page
    auditTrailTitle: 'Audit Trail',
    auditTrailSub: 'History of all system activities and changes.',
    searchAuditLogs: 'Search logs by Actor, Action, or Detail...',
    allRoles: 'All Roles',
    allModules: 'All Modules',
    loadingLogs: 'Loading Activity Logs...',
    noLogsFound: 'No matching activity logs found.',
    colTimestamp: 'Timestamp',
    colActor: 'Actor',
    colModule: 'Module',
    colAction: 'Action & Detail',

    // User Management page
    userManagementTitle: 'User Management',
    userManagementSub: 'Manage user accounts and system roles.',
    addEmployee: 'Add Employee',
    searchUsers: 'Search users...',

    // Landing page
    landingTitle1: 'AromaSys',
    landingTitle2: 'Warehouse System',
    landingSub: 'Next-generation sensory telemetry and active batch tracking for Sima Arome. Monitor essential oil purity and cold-chain metrics in one intelligent console.',
    signUpBtn: 'Sign Up',
    signInBtn: 'Sign In',
    copyright: '© 2026 AromaSys Logistics. All rights reserved.',

    // Sign In page
    signInTitle: 'Sign In',
    signInSubtitle: 'Sign In to your AromaSys account',
    emailPlaceholder: 'john.doe@gmail.com',
    passwordPlaceholder: '••••••••••',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot Password?',
    dontHaveAccount: "Don't have an account?",
    signUpNow: 'Sign Up Now',
    signInSubmit: 'Sign In',
    signInQuotePart1: 'Preserving Quality,',
    signInQuotePart2: 'Releasing Aroma.',
    signInQuoteDesc: 'Precision real-time monitoring of temperature and humidity sensors to guarantee the freshness of premium essential oils.',

    // Sign Up page
    signUpTitle: 'Sign Up',
    signUpSubtitle: 'Sign up for a new enterprise account',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'Your Full Name',
    roleLabelSelect: 'Select a role...',
    roleWarehouseStaff: 'Warehouse Staff (Aroma Stock)',
    roleQCSelect: 'Quality Control (Lab Assessor)',
    rolePPICSelect: 'Production Planner (PPIC)',
    roleAdminSelect: 'Operations Manager (Admin)',
    confirmPasswordLabel: 'Confirm Password',
    signUpSubmit: 'Sign Up',
    alreadyHaveAccount: 'Already have an account?',
    signInNow: 'Sign In Now',
    signUpQuotePart1: 'Precision',
    signUpQuotePart2: 'in Every Drop.',
    signUpQuoteDesc: 'Digital twin integration and AI analysis for optimal perfume raw material inventory management and accurate FIFO tracking.',
    backBtn: 'Back',
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    passwordRequired: 'Password is required',
    passwordMinLengthErr: 'Password must be at least 6 characters',
    connFailed: 'Connection to authentication server failed.',
    invalidCreds: 'Invalid credentials',
    nameRequired: 'Full name is required',
    roleRequired: 'Role is required',
    passwordsNoMatch: 'Passwords do not match',
    registerFailed: 'Failed to register',
    registerConnFailed: 'Connection to registration server failed.',
  }
};

export function useLanguage() {
  const [lang, setLangState] = useState<Language>('id');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aromasys_language') as Language;
      if (saved === 'en' || saved === 'id') {
        setLangState(saved);
      }
    }
  }, []);

  const setLanguage = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aromasys_language', newLang);
      // Dispatch a custom event to notify other components/pages
      window.dispatchEvent(new Event('languageChange'));

      // If logged in, persist to database
      const token = localStorage.getItem('aromasys_token');
      if (token) {
        api.put('/profile/settings/language', { settings: { language: newLang } })
          .catch(e => console.error('Failed to sync language to DB:', e));
      }
    }
  };

  useEffect(() => {
    const handleLanguageChange = () => {
      const saved = localStorage.getItem('aromasys_language') as Language;
      if (saved === 'en' || saved === 'id') {
        setLangState(saved);
      }
    };
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);

  const t = (key: keyof typeof translations['id']) => {
    return translations[lang][key] || translations['id'][key] || key;
  };

  return { lang, setLanguage, t };
}
