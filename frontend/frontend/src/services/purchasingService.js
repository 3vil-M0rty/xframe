import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

// Purchasing module (service achats) — see backend routes/suppliers.js,
// routes/purchaseOrders.js, routes/priceRequests.js, routes/purchaseRequests.js.

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};

// ---------- suppliers ----------
export const getSuppliers = async (companyId, { search, active } = {}) =>
  (await api.get(`/suppliers?${qs({ companyId, search, active })}`)).data.data || [];
export const createSupplier = async (data) => (await api.post("/suppliers", data)).data.data;
export const updateSupplier = async (id, data) => (await api.put(`/suppliers/${id}`, data)).data.data;
export const deleteSupplier = async (id) => (await api.delete(`/suppliers/${id}`)).data;

// ---------- purchase requests (demandes d'achat) ----------
export const getOpenRequestCount = async (companyId) =>
  (await api.get(`/purchase-requests/open-count?${qs({ companyId })}`)).data.data?.count || 0;
export const getRequests = async ({ companyId, status, product, page = 1, limit = 20 }) => {
  const res = await api.get(`/purchase-requests?${qs({ companyId, status, product, page, limit })}`);
  return { requests: res.data.data || [], pagination: res.data.pagination };
};
// action: "ordered" | "declined" | "delayed" | "note"
export const processRequest = async (id, { action, note, purchaseOrderId }) =>
  (await api.patch(`/purchase-requests/${id}/process`, { action, note, purchaseOrderId })).data.data;

// ---------- purchase orders (bons de commande) ----------
export const getOrders = async (params) => {
  const res = await api.get(`/purchase-orders?${qs(params)}`);
  return { orders: res.data.data || [], pagination: res.data.pagination };
};
export const getOrderSummary = async (companyId) => (await api.get(`/purchase-orders/summary?${qs({ companyId })}`)).data.data;
export const getOrder = async (id) => (await api.get(`/purchase-orders/${id}`)).data.data;
export const createOrder = async (data) => (await api.post("/purchase-orders", data)).data.data;
export const updateOrder = async (id, data) => (await api.put(`/purchase-orders/${id}`, data)).data.data;
export const setOrderStatus = async (id, status, reason) => (await api.patch(`/purchase-orders/${id}/status`, { status, reason })).data.data;
export const deleteOrder = async (id) => (await api.delete(`/purchase-orders/${id}`)).data;
export const getArticleOrders = async (productId) => (await api.get(`/purchase-orders/by-product/${productId}`)).data.data || [];

// multipart: reception/return with optional BL scan
export const addReception = async (id, { type, reference, date, notes, lines, file }) => {
  const form = new FormData();
  form.append("type", type);
  form.append("reference", reference);
  if (date) form.append("date", date);
  if (notes) form.append("notes", notes);
  form.append("lines", JSON.stringify(lines));
  if (file) form.append("file", file);
  return (await api.post(`/purchase-orders/${id}/receptions`, form)).data.data;
};
export const addInvoice = async (id, { type = "invoice", number, date, dueDate, amountTTC, vatBreakdown, notes, file }) => {
  const form = new FormData();
  form.append("type", type);
  // exact VAT per rate, as printed on the supplier's invoice
  if (Array.isArray(vatBreakdown) && vatBreakdown.length) form.append("vatBreakdown", JSON.stringify(vatBreakdown));
  form.append("number", number);
  form.append("date", date);
  if (dueDate) form.append("dueDate", dueDate);
  form.append("amountTTC", amountTTC);
  if (notes) form.append("notes", notes);
  if (file) form.append("file", file);
  return (await api.post(`/purchase-orders/${id}/invoices`, form)).data.data;
};
export const deleteInvoice = async (id, invoiceId) => (await api.delete(`/purchase-orders/${id}/invoices/${invoiceId}`)).data.data;
export const addPayment = async (id, data) => (await api.post(`/purchase-orders/${id}/payments`, data)).data.data;
export const deletePayment = async (id, paymentId) => (await api.delete(`/purchase-orders/${id}/payments/${paymentId}`)).data.data;

// ---------- price requests (demandes de prix) ----------
export const getPriceRequests = async (companyId, status) => (await api.get(`/price-requests?${qs({ companyId, status })}`)).data.data || [];
export const createPriceRequest = async (data) => (await api.post("/price-requests", data)).data.data;
export const updatePriceRequest = async (id, data) => (await api.put(`/price-requests/${id}`, data)).data.data;
export const uploadQuoteFile = async (id, file) => {
  const form = new FormData();
  form.append("file", file);
  return (await api.post(`/price-requests/${id}/quote-file`, form)).data.data;
};
export const convertPriceRequest = async (id) => (await api.post(`/price-requests/${id}/convert`)).data.data;
export const deletePriceRequest = async (id) => (await api.delete(`/price-requests/${id}`)).data;

// Turn a typed-in order line into an inventory article (linked to the line).
export const addLineToInventory = async (orderId, lineId, { category, internalReference, unit, threshold }) =>
  (await api.post(`/purchase-orders/${orderId}/lines/${lineId}/create-article`, { category, internalReference, unit, threshold })).data.data;

// ---------- PDFs to send to the supplier ----------
const safeFileName = (s) => String(s).replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

export const downloadOrderPdf = async (order) => {
  try {
    const res = await api.get(`/purchase-orders/${order._id}/pdf`, { responseType: "blob" });
    downloadBlob(res.data, `${safeFileName(`${order.number} - ${order.supplier?.name || ""}`)}.pdf`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

export const downloadPriceRequestPdf = async (priceRequest) => {
  try {
    const res = await api.get(`/price-requests/${priceRequest._id}/pdf`, { responseType: "blob" });
    downloadBlob(res.data, `${safeFileName(`${priceRequest.number} - ${priceRequest.supplier?.name || ""}`)}.pdf`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

// ---------- closing a line short ("solder la ligne") ----------
export const closeOrderLine = async (orderId, lineId, reason) =>
  (await api.patch(`/purchase-orders/${orderId}/lines/${lineId}/close`, { reason })).data.data;
export const reopenOrderLine = async (orderId, lineId) =>
  (await api.patch(`/purchase-orders/${orderId}/lines/${lineId}/reopen`)).data.data;

// ---------- supplier invoices (échéancier) ----------
export const getSupplierInvoices = async ({ companyId, filter = "unpaid", supplier } = {}) => {
  const res = await api.get(`/purchase-orders/invoices?${qs({ companyId, filter, supplier })}`);
  return { rows: res.data.data || [], totals: res.data.totals || {} };
};

// ---------- approval of large purchase orders ----------
export const approveOrder = async (id) => (await api.patch(`/purchase-orders/${id}/approve`)).data.data;
export const refuseOrderApproval = async (id, reason) => (await api.patch(`/purchase-orders/${id}/reject-approval`, { reason })).data.data;
// status change that may come back as "approval_requested"
export const setOrderStatusWithMessage = async (id, status, reason) => {
  const res = await api.patch(`/purchase-orders/${id}/status`, { status, reason });
  return { order: res.data.data, message: res.data.message };
};

// ---------- email (placeholder mode until SMTP is configured) ----------
export const emailOrder = async (id, { to, cc, message }) => {
  const res = await api.post(`/purchase-orders/${id}/email`, { to, cc, message });
  return { order: res.data.data, simulated: !!res.data.simulated };
};
export const emailPriceRequest = async (id, { to, cc, message }) => {
  const res = await api.post(`/price-requests/${id}/email`, { to, cc, message });
  return { priceRequest: res.data.data, simulated: !!res.data.simulated };
};

// ---------- quote comparison ----------
export const createPriceRequests = async (data) => {
  const res = await api.post("/price-requests", data);
  return { docs: Array.isArray(res.data.data) ? res.data.data : [res.data.data], comparisonGroup: res.data.comparisonGroup };
};
export const comparePriceRequests = async (group) => (await api.get(`/price-requests/compare/${group}`)).data.data;

// ---------- reports & files ----------
const downloadXlsx = async (url, filename) => {
  try {
    const res = await api.get(url, { responseType: "blob" });
    downloadBlob(res.data, filename);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};
// rows: the TVA listing; withoutInvoice: payments it can't include (no invoice yet)
export const getVatDeductions = async (params) => {
  const res = await api.get(`/purchase-orders/reports/vat-deductions?${qs(params)}`);
  return { rows: res.data.data || [], withoutInvoice: res.data.withoutInvoice || [] };
};
export const downloadVatDeductions = (params) => downloadXlsx(`/purchase-orders/reports/vat-deductions?${qs({ ...params, format: "xlsx" })}`, `releve-deductions-tva${params.from ? `-${params.from}` : ""}.xlsx`);
export const downloadAccountingExport = (params) => downloadXlsx(`/purchase-orders/reports/accounting?${qs(params)}`, `journal-achats${params.from ? `-${params.from}` : ""}.xlsx`);
export const getAgedBalance = async (companyId) => (await api.get(`/purchase-orders/reports/aged-balance?${qs({ companyId })}`)).data.data || [];
export const downloadAgedBalance = (companyId) => downloadXlsx(`/purchase-orders/reports/aged-balance?${qs({ companyId, format: "xlsx" })}`, "balance-agee-fournisseurs.xlsx");
export const getRestockSuggestions = async (companyId) => (await api.get(`/purchase-orders/reports/restock?${qs({ companyId })}`)).data.data || [];

// ---------- supplier statement & documents ----------
export const getSupplierStatement = async (id, params = {}) => (await api.get(`/suppliers/${id}/statement?${qs(params)}`)).data.data;
export const downloadSupplierStatement = (id, name, params = {}) => downloadXlsx(`/suppliers/${id}/statement?${qs({ ...params, format: "xlsx" })}`, `releve-${String(name || "fournisseur").replace(/[^\w-]+/g, "_")}.xlsx`);
export const addSupplierDocument = async (id, { type, label, number, issueDate, expiryDate, file }) => {
  const form = new FormData();
  form.append("type", type);
  if (label) form.append("label", label);
  if (number) form.append("number", number);
  if (issueDate) form.append("issueDate", issueDate);
  if (expiryDate) form.append("expiryDate", expiryDate);
  if (file) form.append("file", file);
  return (await api.post(`/suppliers/${id}/documents`, form)).data.data;
};
export const deleteSupplierDocument = async (id, docId) => (await api.delete(`/suppliers/${id}/documents/${docId}`)).data.data;

// One transfer / cheque settling several invoices (possibly on several orders)
// allocations: [{ orderId, invoiceId, amount }]
export const createSupplierPayment = async (data) => (await api.post("/purchase-orders/supplier-payments", data)).data.data;
