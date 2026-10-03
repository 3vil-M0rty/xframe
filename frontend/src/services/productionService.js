import api from "./api";
import { downloadBlob, normalizeBlobError } from "../utils/download";

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
// Series = profile library (codes DOR, OUV… on the articles) + formula variables
export const getSeriesDetail = async (id) => data(await api.get(`/production/series/${id}`));
export const getSeriesCandidates = async (id, search = "") => data(await api.get(`/production/series/${id}/candidates?${qs({ search })}`)) || [];
export const addSeriesProfiles = async (id, items) => data(await api.post(`/production/series/${id}/profiles`, { items }));
export const updateSeriesProfile = async (id, productId, body) => data(await api.patch(`/production/series/${id}/profiles/${productId}`, body));
export const removeSeriesProfile = async (id, productId) => (await api.delete(`/production/series/${id}/profiles/${productId}`)).data;
// CAD (Technique › Conception): drawing + débit without saving
export const previewDesign = async (body) => data(await api.post("/production/designs/preview", body));
// ---------- profile sections (DXF) ----------
const sectionForm = (file, opts = {}) => {
  const f = new FormData();
  if (file) f.append("file", file);
  if (opts.transform) f.append("transform", JSON.stringify(opts.transform));
  if (opts.hiddenLayers) f.append("hiddenLayers", JSON.stringify(opts.hiddenLayers));
  if (opts.scale) f.append("scale", String(opts.scale));
  if (opts.applyToProduct !== undefined) f.append("applyToProduct", String(!!opts.applyToProduct));
  return f;
};
export const previewSection = async (file, opts) => data(await api.post("/production/profiles/section/preview", sectionForm(file, opts)));
export const uploadSection = async (productId, file, opts) => data(await api.post(`/production/profiles/${productId}/section`, sectionForm(file, opts)));
export const getSection = async (productId) => data(await api.get(`/production/profiles/${productId}/section`));
export const updateSection = async (productId, body) => data(await api.patch(`/production/profiles/${productId}/section`, body));
export const deleteSection = async (productId) => (await api.delete(`/production/profiles/${productId}/section`)).data;
export const downloadSectionSource = async (productId, fileName) => {
  try {
    const res = await api.get(`/production/profiles/${productId}/section/source`, { responseType: "blob" });
    downloadBlob(res.data, fileName || "profil.dxf");
  } catch (err) { throw await normalizeBlobError(err); }
};
export const getProfile = async (productId) => data(await api.get(`/production/profiles/${productId}`));
export const saveProfileRules = async (productId, body) => data(await api.put(`/production/profiles/${productId}/fab-rules`, body));
export const getSeriesSections = async (seriesId) => data(await api.get(`/production/series/${seriesId}/sections`));
// ---------- nodes ----------
export const getSeriesNodes = async (seriesId) => data(await api.get(`/production/series/${seriesId}/nodes`));
export const getNode = async (id) => data(await api.get(`/production/nodes/${id}`));
export const createNode = async (seriesId, body) => data(await api.post(`/production/series/${seriesId}/nodes`, body));
export const updateNode = async (id, body) => data(await api.put(`/production/nodes/${id}`, body));
export const deleteNode = async (id) => (await api.delete(`/production/nodes/${id}`)).data;

/** Dossier de fabrication (PDF) of a CAD design at L × H × quantity. */
export const downloadFabricationPdf = async (body, fileName) => {
  try {
    const res = await api.post("/production/designs/dossier", body, { responseType: "blob" });
    downloadBlob(res.data, `${String(fileName || "dossier-fabrication").replace(/[/\\:*?"<>|]/g, "").trim()}.pdf`);
  } catch (err) {
    throw await normalizeBlobError(err);
  }
};

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
export const planProjectProduction = async (projectId, body = {}) => data(await api.post(`/projects/${projectId}/production/plan`, body));

// ---- glass compositions (vitrages: "44.2 / 10 / 6" and the plateaux each layer may be cut from) ----
export const getGlassTypes = async (companyId, params = {}) => data(await api.get(`/production/glass-types?${qs({ companyId, ...params })}`)) || [];
export const createGlassType = async (body) => data(await api.post("/production/glass-types", body));
export const updateGlassType = async (id, body) => data(await api.put(`/production/glass-types/${id}`, body));
export const deleteGlassType = async (id) => (await api.delete(`/production/glass-types/${id}`)).data;

// ---- débit (bar cutting plans, glass plateau layouts, accessories, powder) ----
// `overrides` = { kerf, trim, endTrim, spacing, edgeTrim, gap, allowRotation } — recompute without saving the settings.
export const getProjectCutting = async (projectId, overrides = {}) => data(await api.get(`/projects/${projectId}/production/cutting?${qs(overrides)}`));
export const getWorkOrderCutting = async (id, overrides = {}) => data(await api.get(`/production-orders/${id}/cutting?${qs(overrides)}`));

async function openPdf(url) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(blobUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
/** One paper per material: section = bars | accessories | powder | glass */
export const openProjectSectionPdf = (projectId, section, overrides = {}) => openPdf(`/projects/${projectId}/production/pdf?${qs({ section, ...overrides })}`);
export const openWorkOrderSectionPdf = (id, section, overrides = {}) => openPdf(`/production-orders/${id}/pdf?${qs({ section, ...overrides })}`);
