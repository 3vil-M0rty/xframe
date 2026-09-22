import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

export const getMyEmployeeProfile = async () => {
  const response = await api.get("/me/employee");
  return response.data.data;
};

export const getMyLeaveBalance = async () => {
  const response = await api.get("/me/leave-balance");
  return response.data.data;
};

export const getMyPayslips = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get(`/me/payslips?page=${page}&limit=${limit}`);
  return {
    payslips: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const getMyPayslipById = async (id) => {
  const response = await api.get(`/me/payslips/${id}`);
  return response.data.data;
};

export const downloadMyPayslipPdf = async (id, filename = "bulletin.pdf") => {
  try {
    const response = await api.get(`/me/payslips/${id}/pdf`, {
      responseType: "blob",
    });
    downloadBlob(response.data, filename, true);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

export const getMyAbsences = async ({ page = 1, limit = 20, from, to } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const response = await api.get(`/me/absences?${params.toString()}`);
  return {
    absences: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const requestMyAbsence = async (data) => {
  const response = await api.post("/me/absences", data);
  return response.data.data;
};

export const cancelMyAbsence = async (id) => {
  const response = await api.delete(`/me/absences/${id}`);
  return response.data;
};

export const getMyAdvances = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get(`/me/advances?page=${page}&limit=${limit}`);
  return {
    advances: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const requestMyAdvance = async (data) => {
  const response = await api.post("/me/advances", data);
  return response.data.data;
};

export const getMyAttendance = async ({ month, year, from, to } = {}) => {
  const params = new URLSearchParams();
  if (month) params.append("month", month);
  if (year) params.append("year", year);
  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const response = await api.get(`/me/attendance?${params.toString()}`);
  return response.data.data || [];
};

export const getMyTeamRequests = async () => {
  const response = await api.get("/me/team-requests");
  return response.data.data; // { absences, advances }
};
