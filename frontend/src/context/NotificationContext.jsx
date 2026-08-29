import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load existing notifications on login.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    api.getMyNotifications().then((data) => {
      if (cancelled) return;
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Connect Socket.io for real-time notifications.
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      // Show a toast for the new notification.
      toast(notif.title, {
        description: notif.body,
        action: notif.link ? {
          label: 'View',
          onClick: () => { window.location.href = notif.link; }
        } : undefined
      });
    };

    const handleOrderUpdate = (payload) => {
      // Order updates are surfaced via toast. The Orders page refetches
      // when it sees this event (see Orders.jsx).
      const messages = {
        accepted: 'Your order was accepted',
        rejected: 'Your order was declined',
        cancelled: 'An order was cancelled',
        completed: 'An order is complete — you can review the seller now'
      };
      toast(messages[payload.action] || 'Order update', {
        action: { label: 'View', onClick: () => { window.location.href = '/orders'; } }
      });
    };

    const handleConversationUpdate = () => {
      // The Messages page listens for this and refetches its list.
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('order:update', handleOrderUpdate);
    socket.on('conversation:updated', handleConversationUpdate);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('order:update', handleOrderUpdate);
      socket.off('conversation:updated', handleConversationUpdate);
    };
  }, [user]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.markNotificationRead(id);
    } catch {
      // Non-fatal — the unread badge will sync on next load.
    }
  }, []);

  const remove = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.deleteNotification(id);
    } catch {
      // Non-fatal.
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, remove }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside a NotificationProvider');
  return ctx;
}
