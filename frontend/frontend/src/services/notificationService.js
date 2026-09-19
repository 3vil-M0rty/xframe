import api from "./api";

export const getNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (unreadOnly) params.append("unreadOnly", "true");

  const response = await api.get(`/notifications?${params.toString()}`);
  return {
    notifications: response.data.data || [],
    unreadCount: response.data.unreadCount || 0,
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};

export const deleteNotification = async (id) => {
  const response = await api.delete(`/notifications/${id}`);
  return response.data;
};
