import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

// Sales (ventes) — see backend routes/customers.js, quotes.js, salesInvoices.js.

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};
const safeFileName = (s) => String(s).replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

// ---------- customers ----------
export const getCustomers = async (companyId, { search, active } = {}) =>
  (await api.get(`/customers?${qs({ companyId, search, active })}`)).data.data || [];
export const getCustomer = async (id) => (await api.get(`/customers/${id}`)).data.data;
export const createCustomer = async (data) => (await api.post("/customers", data)).data.data;
export const updateCustomer = async (id, data) => (await api.put(`/customers/${id}`, data)).data.data;
export const deleteCustomer = async (id) => (await api.delete(`/customers/${id}`)).data;

// ---------- devis ----------
export const getQuotes = async (params) => {
  const res = await api.get(`/quotes?${qs(params)}`);
  return { quotes: res.data.data || [], pagination: res.data.pagination };
};
export const getQuote = async (id) => (await api.get(`/quotes/${id}`)).data.data;
export const createQuote = async (data) => (await api.post("/quotes", data)).data.data;
export const updateQuote = async (id, data) => (await api.put(`/quotes/${id}`, data)).data.data;
export const deleteQuote = async (id) => (await api.delete(`/quotes/${id}`)).data;
export const duplicateQuote = async (id) => (await api.post(`/quotes/${id}/duplicate`)).data.data;
export const setQuoteStatus = async (id, status, reason) => (await api.patch(`/quotes/${id}/status`, { status, reason })).data.data;
export const emailQuote = async (id, data) => (await api.post(`/quotes/${id}/email`, data)).data;
export const quoteToProject = async (id, data) => (await api.post(`/quotes/${id}/project`, data)).data.data;
export const quoteDeposit = async (id, data) => (await api.post(`/quotes/${id}/deposit`, data)).data.data;
export const quoteFinalInvoice = async (id) => (await api.post(`/quotes/${id}/invoice`)).data.data;
export const downloadQuotePdf = async (quote) => {
  try {
    const res = await api.get(`/quotes/${quote._id}/pdf`, { responseType: "blob" });
    downloadBlob(res.data, `${safeFileName(`${quote.number} - ${quote.customer?.name || ""}`)}.pdf`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- invoices ----------
export const getInvoices = async (params) => {
  const res = await api.get(`/sales-invoices?${qs(params)}`);
  return { invoices: res.data.data || [], pagination: res.data.pagination };
};
export const getInvoice = async (id) => (await api.get(`/sales-invoices/${id}`)).data.data;
export const createInvoice = async (data) => (await api.post("/sales-invoices", data)).data.data;
export const updateInvoice = async (id, data) => (await api.put(`/sales-invoices/${id}`, data)).data.data;
export const deleteInvoice = async (id) => (await api.delete(`/sales-invoices/${id}`)).data;
export const issueInvoice = async (id) => (await api.post(`/sales-invoices/${id}/issue`)).data.data;
export const addInvoicePayment = async (id, data) => (await api.post(`/sales-invoices/${id}/payments`, data)).data.data;
export const deleteInvoicePayment = async (id, paymentId) => (await api.delete(`/sales-invoices/${id}/payments/${paymentId}`)).data.data;
export const createCreditNote = async (id) => (await api.post(`/sales-invoices/${id}/credit-note`)).data.data;
export const applyCreditNote = async (id, data) => (await api.post(`/sales-invoices/${id}/apply-credit`, data)).data.data;
export const emailInvoice = async (id, data) => (await api.post(`/sales-invoices/${id}/email`, data)).data;
export const downloadInvoicePdf = async (invoice) => {
  try {
    const res = await api.get(`/sales-invoices/${invoice._id}/pdf`, { responseType: "blob" });
    downloadBlob(res.data, `${safeFileName(`${invoice.number || "brouillon"} - ${invoice.customer?.name || ""}`)}.pdf`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- reports ----------
export const getReceivables = async (companyId) => (await api.get(`/sales-invoices/reports/receivables?${qs({ companyId })}`)).data.data;
export const getVatCollected = async (companyId, from, to) => (await api.get(`/sales-invoices/reports/vat?${qs({ companyId, from, to })}`)).data.data;
export const downloadVatCollected = async (companyId, from, to) => {
  try {
    const res = await api.get(`/sales-invoices/reports/vat?${qs({ companyId, from, to, format: "xlsx" })}`, { responseType: "blob" });
    downloadBlob(res.data, `tva-collectee-${from}-${to}.xlsx`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};
