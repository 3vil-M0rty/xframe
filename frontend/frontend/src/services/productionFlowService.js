import api from "./api";

// Workshop flow: issues (bars, accessories), receptions, offcuts, sub-contracting —
// see backend routes/productionFlow.js.
const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};
const data = (r) => r.data.data;

export const getProjectFlow = async (projectId) => data(await api.get(`/production-flow/projects/${projectId}`));
export const issueMaterial = async (projectId, body) => data(await api.post(`/production-flow/projects/${projectId}/issue`, body));
export const getTransfers = async (companyId, params = {}) => data(await api.get(`/production-flow/transfers?${qs({ companyId, ...params })}`)) || [];
export const receiveTransfer = async (id, body = {}) => data(await api.post(`/production-flow/transfers/${id}/receive`, body));
export const finishLaquage = async (orderId, body) => data(await api.post(`/production-flow/orders/${orderId}/finish-laquage`, body));
export const finishVitrage = async (orderId, body = {}) => data(await api.post(`/production-flow/orders/${orderId}/finish-vitrage`, body));
export const framesDone = async (orderId) => data(await api.post(`/production-flow/orders/${orderId}/frames-done`));
export const subcontractOrder = async (orderId, body) => data(await api.post(`/production-flow/orders/${orderId}/subcontract`, body));
export const cancelSubcontract = async (orderId) => data(await api.delete(`/production-flow/orders/${orderId}/subcontract`));
export const offcutsFromPlan = async (orderId) => data(await api.post(`/production-flow/orders/${orderId}/offcuts-from-plan`));
export const getOffcuts = async (companyId, params = {}) => data(await api.get(`/production-flow/offcuts?${qs({ companyId, ...params })}`)) || [];
export const createOffcut = async (body) => data(await api.post("/production-flow/offcuts", body));
export const deleteOffcut = async (id) => (await api.delete(`/production-flow/offcuts/${id}`)).data;
export const getToIssue = async (companyId) => data(await api.get(`/production-flow/to-issue?${qs({ companyId })}`)) || [];
