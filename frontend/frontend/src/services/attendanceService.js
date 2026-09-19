import api from "./api";

// ---------- Self-service ----------

export const clockIn = async () => {
  const response = await api.post("/attendance/clock-in");
  return response.data.data;
};

export const clockOut = async () => {
  const response = await api.post("/attendance/clock-out");
  return response.data.data;
};

export const getTodayAttendance = async () => {
  const response = await api.get("/attendance/today");
  return response.data.data;
};

// ---------- HR view ----------

export const getAttendance = async ({ companyId, employeeId, from, to, page = 1, limit = 31 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/attendance?${params.toString()}`);
  return {
    records: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const updateAttendance = async (id, data) => {
  const response = await api.put(`/attendance/${id}`, data);
  return response.data.data;
};

export const getAttendanceSummary = async ({ companyId, employeeId, month, year }) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  params.append("month", month);
  params.append("year", year);

  const response = await api.get(`/attendance/summary?${params.toString()}`);
  return response.data.data;
};
