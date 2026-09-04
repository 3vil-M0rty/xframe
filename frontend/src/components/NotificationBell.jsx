import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useStore } from '../store';
import { useToast } from '../context/toastContext';
import { IconBell, IconCheck, IconAlertTriangle, IconCheckCircle } from './Icons';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getNotificationIcon = (type) => {
  switch(type) {
    case 'purchase_order_approved':
      return <IconCheckCircle size={16} className="text-green-600" />;
    case 'low_stock_alert':
      return <IconAlertTriangle size={16} className="text-yellow-600" />;
    case 'purchase_order_created':
      return <IconCheck size={16} className="text-blue-600" />;
    default:
      return <IconBell size={16} className="text-gray-600" />;
  }
};

export default function NotificationBell() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { getHeaders } = useStore();
  const { addToast } = useToast();

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
    getUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      getUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/notifications?limit=10`, {
        headers: getHeaders()
      });
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUnreadCount = async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications/unread/count`, {
        headers: getHeaders()
      });
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(
        `${API_URL}/notifications/${notificationId}/read`,
        {},
        { headers: getHeaders() }
      );
      await fetchNotifications();
      await getUnreadCount();
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(
        `${API_URL}/notifications/actions/mark-all-read`,
        {},
        { headers: getHeaders() }
      );
      await fetchNotifications();
      await getUnreadCount();
      addToast('All notifications marked as read', 'success');
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await axios.delete(
        `${API_URL}/notifications/${notificationId}`,
        { headers: getHeaders() }
      );
      await fetchNotifications();
      await getUnreadCount();
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition"
        title={t('common.notifications') || 'Notifications'}
      >
        <IconBell size={20} className="text-gray-700" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('common.notifications') || 'Notifications'}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-500">
                {t('common.loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <IconBell size={32} className="mx-auto mb-2 opacity-30" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`px-6 py-4 border-b hover:bg-gray-50 transition cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                          title="Mark as read"
                        >
                          <IconCheck size={16} className="text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notification._id)}
                        className="p-1 hover:bg-gray-200 rounded transition"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-6 py-3 border-t text-center">
              <a
                href="/notifications"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
