'use client';
import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { Notification, NotificationType } from '@/types';
import { api } from './api';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Partial<Notification> & Pick<Notification, 'type' | 'title' | 'description'>) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function createDefaultNotifications(): Notification[] {
  const now = Date.now();
  return [
    { id: 1, type: 'alert', title: 'Expiry Alert', description: 'Pewarna Makanan Merah akan kedaluwarsa dalam 5 hari', time: new Date(now - 1000 * 60 * 30).toISOString(), isRead: false, href: '/fifo-expiry' },
    { id: 2, type: 'coldchain', title: 'Cold-Chain Warning', description: 'Suhu Zone C melebihi batas: 8.2°C', time: new Date(now - 1000 * 60 * 60 * 2).toISOString(), isRead: false, href: '/cold-chain' },
    { id: 3, type: 'inventory', title: 'Stock Low', description: 'Essence Vanilla tersisa 2 kg', time: new Date(now - 1000 * 60 * 60 * 5).toISOString(), isRead: false, href: '/inventory-master' },
    { id: 4, type: 'system', title: 'System Update', description: 'Database backup berhasil dilakukan', time: new Date(now - 1000 * 60 * 60 * 24).toISOString(), isRead: true, href: '/audit-trail' },
  ];
}

async function fetchReadState(): Promise<string[]> {
  try {
    const data = await api.get<{ success: boolean; readIds: string[] }>('/notifications/read-state');
    return data.readIds ?? [];
  } catch {
    return [];
  }
}

async function postMarkRead(notificationIds: string[]): Promise<void> {
  try {
    await api.post('/notifications/mark-read', { notificationIds });
  } catch {
    // Silently fail — optimistic update already applied
  }
}

async function postMarkAllRead(notificationIds: string[]): Promise<void> {
  try {
    await api.post('/notifications/mark-all-read', { notificationIds });
  } catch {
    // Silently fail — optimistic update already applied
  }
}


export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(createDefaultNotifications);

  // On mount: fetch read state from the API and apply to default notifications
  useEffect(() => {
    let cancelled = false;
    fetchReadState().then((readIds) => {
      if (cancelled) return;
      if (readIds.length > 0) {
        const readSet = new Set(readIds);
        setNotifications((prev) =>
          prev.map((n) => (readSet.has(n.id.toString()) ? { ...n, isRead: true } : n))
        );
      }
    });
    return () => { cancelled = true; };
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markAsRead = useCallback((id: number) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    // Persist to backend
    postMarkRead([id.toString()]);
  }, []);

  const markAllAsRead = useCallback(() => {
    // Optimistic UI update
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      // Persist to backend with all notification IDs
      postMarkAllRead(updated.map(n => n.id.toString()));
      return updated;
    });
  }, []);

  const addNotification = useCallback((notif: Partial<Notification> & Pick<Notification, 'type' | 'title' | 'description'>) => {
    setNotifications(prev => [
      { ...notif, id: notif.id ?? Date.now(), time: notif.time ?? new Date().toISOString(), isRead: notif.isRead ?? false } as Notification,
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }),
    [notifications, unreadCount, markAsRead, markAllAsRead, addNotification]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
