import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

// Public holidays (jours fériés) — see backend routes/holidays.js.

export const getHolidays = async (companyId, year) => {
  const response = await api.get(`/holidays?companyId=${companyId}&year=${year}`);
  return response.data.data || [];
};

// Excel template for `year`, with the fixed-date holidays pre-filled.
export const downloadHolidayTemplate = async (year) => {
  try {
    const response = await api.get(`/holidays/template?year=${year}`, { responseType: "blob" });
    downloadBlob(response.data, `jours-feries-${year}.xlsx`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// Step 1: upload the file, get validated rows back (nothing saved).
export const previewHolidayImport = async (companyId, file) => {
  const form = new FormData();
  form.append("companyId", companyId);
  form.append("file", file);
  const response = await api.post("/holidays/import/preview", form);
  return response.data.data;
};

// Step 2: save the previewed rows.
export const commitHolidayImport = async (companyId, rows) => {
  const response = await api.post("/holidays/import/commit", { companyId, rows });
  return response.data.data; // { created, updated }
};

export const createHoliday = async (data) => {
  const response = await api.post("/holidays", data);
  return response.data.data;
};

export const updateHoliday = async (id, data) => {
  const response = await api.put(`/holidays/${id}`, data);
  return response.data.data;
};

export const deleteHoliday = async (id) => {
  const response = await api.delete(`/holidays/${id}`);
  return response.data;
};
