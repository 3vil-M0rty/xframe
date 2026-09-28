import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

// Payroll declarations — see backend routes/declarations.js.

// ---------- Damancom (CNSS) ----------
const damancomForm = (file, situations) => {
  const form = new FormData();
  form.append("preetabli", file);
  form.append("situations", JSON.stringify(situations || {}));
  return form;
};

export const previewDamancom = async (runId, file, situations) => {
  const res = await api.post(`/declarations/runs/${runId}/damancom/preview`, damancomForm(file, situations));
  return { plan: res.data.data, situationOptions: res.data.situations || [] };
};

export const downloadDamancomFile = async (runId, file, situations, filename) => {
  try {
    const res = await api.post(`/declarations/runs/${runId}/damancom/file`, damancomForm(file, situations), { responseType: "blob" });
    downloadBlob(res.data, filename || "declaration-cnss.txt");
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- bank transfer ----------
export const getBankTransfer = async (runId) => (await api.get(`/declarations/runs/${runId}/bank-transfer`)).data.data;

export const downloadBankTransfer = async (runId, { format = "xlsx", executionDate } = {}, filename) => {
  try {
    const params = new URLSearchParams({ format });
    if (executionDate) params.append("executionDate", executionDate);
    const res = await api.get(`/declarations/runs/${runId}/bank-transfer/file?${params.toString()}`, { responseType: "blob" });
    downloadBlob(res.data, filename || `virements.${format}`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- Simpl-IR ----------
export const getMonthlyIr = async (runId) => (await api.get(`/declarations/runs/${runId}/ir`)).data.data;

export const getAnnualIr = async (companyId, year) =>
  (await api.get(`/declarations/ir-annual?companyId=${companyId}&year=${year}`)).data.data;

export const downloadAnnualIr = async (companyId, year, format) => {
  try {
    const res = await api.get(`/declarations/ir-annual/file?companyId=${companyId}&year=${year}&format=${format}`, { responseType: "blob" });
    downloadBlob(res.data, format === "xlsx" ? `etat-9421-${year}.xlsx` : `traitements-salaires-${year}.xml`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- leave balances ----------
export const getLeaveBalances = async (companyId) => {
  const res = await api.get(`/leave/balances?companyId=${companyId}`);
  return { rows: res.data.data || [], rules: res.data.rules || {} };
};

export const setLeaveOpeningBalance = async (employeeId, data) =>
  (await api.patch(`/leave/opening-balance/${employeeId}`, data)).data.data;

export const downloadLeaveBalances = async (companyId) => {
  try {
    const res = await api.get(`/leave/balances/export?companyId=${companyId}`, { responseType: "blob" });
    downloadBlob(res.data, `soldes-conges-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};
