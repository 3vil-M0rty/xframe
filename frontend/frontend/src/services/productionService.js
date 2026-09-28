import api from "./api";

// Aluminium production: workshops, colours, series, chassis catalogue,
// work orders — see backend routes/productionConfig.js and productionOrders.js.

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};
const data = (r) => r.data.data;

// ---- configuration ----
export const getProductionSettings = async (companyId) => data(await api.get(`/production/settings?${qs({ companyId })}`));
export const saveProductionSettings = async (companyId, body) => data(await api.put(`/production/settings?${qs({ companyId })}`, body));

export const getWorkshops = async (companyId) => data(await api.get(`/production/workshops?${qs({ companyId })}`)) || [];
export const createWorkshop = async (body) => data(await api.post("/production/workshops", body));
export const updateWorkshop = async (id, body) => data(await api.put(`/production/workshops/${id}`, body));
export const deleteWorkshop = async (id) => (await api.delete(`/production/workshops/${id}`)).data;

export const getFinishes = async (companyId) => data(await api.get(`/production/finishes?${qs({ companyId })}`)) || [];
export const createFinish = async (body) => data(await api.post("/production/finishes", body));
export const updateFinish = async (id, body) => data(await api.put(`/production/finishes/${id}`, body));
export const deleteFinish = async (id) => (await api.delete(`/production/finishes/${id}`)).data;

export const getSeries = async (companyId) => data(await api.get(`/production/series?${qs({ companyId })}`)) || [];
export const createSeries = async (body) => data(await api.post("/production/series", body));
export const updateSeries = async (id, body) => data(await api.put(`/production/series/${id}`, body));
export const deleteSeries = async (id) => (await api.delete(`/production/series/${id}`)).data;

export const getCatalog = async () => data(await api.get("/production/catalog"));
export const getTemplate = async (key) => data(await api.get(`/production/catalog/${key}`));

export const getChassisModels = async (params) => data(await api.get(`/production/models?${qs(params)}`)) || [];
export const getChassisModel = async (id) => data(await api.get(`/production/models/${id}`));
export const createChassisModel = async (body) => data(await api.post("/production/models", body));
export const importTemplate = async (body) => data(await api.post("/production/models/import", body));
export const updateChassisModel = async (id, body) => data(await api.put(`/production/models/${id}`, body));
export const duplicateChassisModel = async (id, body = {}) => data(await api.post(`/production/models/${id}/duplicate`, body));
export const deleteChassisModel = async (id) => (await api.delete(`/production/models/${id}`)).data;
export const testChassisModel = async (id, body) => data(await api.post(`/production/models/${id}/test`, body));
export const uploadChassisModelImage = async (id, file) => {
  const form = new FormData();
  form.append("image", file);
  return data(await api.post(`/production/models/${id}/image`, form));
};
export const deleteChassisModelImage = async (id) => data(await api.delete(`/production/models/${id}/image`));
export const priceChassis = async (id, body) => data(await api.post(`/production/models/${id}/price`, body));
export const checkFormula = async (formula, known) => data(await api.post("/production/formulas/check", { formula, known }));
export const getCatalogArticles = async (companyId, params = {}) => data(await api.get(`/production/articles?${qs({ companyId, ...params })}`)) || [];

// ---- work orders ----
export const getWorkshopBoard = async (companyId) => data(await api.get(`/production-orders/board?${qs({ companyId })}`)) || [];
export const getWorkOrders = async (params) => data(await api.get(`/production-orders?${qs(params)}`)) || [];
export const getWorkOrder = async (id) => data(await api.get(`/production-orders/${id}`));
export const createWorkOrder = async (body) => data(await api.post("/production-orders", body));
export const updateWorkOrder = async (id, body) => data(await api.patch(`/production-orders/${id}`, body));
export const startWorkOrder = async (id, force = false) => data(await api.post(`/production-orders/${id}/start`, { force }));
export const consumeWorkOrder = async (id, body) => data(await api.post(`/production-orders/${id}/consume`, body));
export const completeWorkOrder = async (id, body) => data(await api.post(`/production-orders/${id}/complete`, body));
export const cancelWorkOrder = async (id, reason) => data(await api.post(`/production-orders/${id}/cancel`, { reason }));
export async function openWorkOrderPdf(id) {
  const res = await api.get(`/production-orders/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- project ouvrages & production ----
export const addProjectItem = async (projectId, body) => data(await api.post(`/projects/${projectId}/items`, body));
export const updateProjectItem = async (projectId, itemId, body) => data(await api.put(`/projects/${projectId}/items/${itemId}`, body));
export const deleteProjectItem = async (projectId, itemId) => (await api.delete(`/projects/${projectId}/items/${itemId}`)).data;
export const getProjectProduction = async (projectId) => data(await api.get(`/projects/${projectId}/production`));
export const planProjectProduction = async (projectId) => data(await api.post(`/projects/${projectId}/production/plan`));
