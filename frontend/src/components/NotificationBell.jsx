import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService";

import styles from "./NotificationBell.module.css";

const POLL_INTERVAL_MS = 60000;

function timeAgo(date, locale) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return locale.now;
  if (diffMin < 60) return `${diffMin}${locale.minutesShort}`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}${locale.hoursShort}`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}${locale.daysShort}`;
}

export default function NotificationBell() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef(null);

  const load = async () => {
    try {
      const { notifications: data, unreadCount: count } =
        await getNotifications({ limit: 10 });
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) load();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await markNotificationRead(notification._id);
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notification._id ? { ...n, read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      } catch (error) {
        console.error("Failed to mark notification read:", error);
      }
    }

    setIsOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async (event) => {
    event.stopPropagation();
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
    }
  };

  const locale = {
    now: t("notifications.now"),
    minutesShort: t("notifications.minutesShort"),
    hoursShort: t("notifications.hoursShort"),
    daysShort: t("notifications.daysShort"),
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={handleOpen}
        title={t("notifications.title")}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t("notifications.title")}</span>

            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllButton}
                onClick={handleMarkAllRead}
              >
                <Check size={13} />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>{t("notifications.empty")}</div>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification._id}
                  className={`${styles.item} ${
                    !notification.read ? styles.itemUnread : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {!notification.read && <span className={styles.dot} />}
                  <div className={styles.itemBody}>
                    <span className={styles.itemTitle}>
                      {notification.title}
                    </span>
                    {notification.message && (
                      <span className={styles.itemMessage}>
                        {notification.message}
                      </span>
                    )}
                    <span className={styles.itemTime}>
                      {timeAgo(notification.createdAt, locale)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
