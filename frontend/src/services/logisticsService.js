import api from "./api";

// Chassis tracking + logistics — see backend routes/tracking.js and routes/logistics.js.
const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};
const data = (r) => r.data.data;

export const getTrackingOverview = async (companyId, status) => data(await api.get(`/tracking/projects?${qs({ companyId, status })}`)) || [];
export const getProjectTracking = async (projectId) => data(await api.get(`/tracking/projects/${projectId}`));
export const syncProjectTracking = async (projectId) => data(await api.post(`/tracking/projects/${projectId}/sync`));
export const trackingAction = async (projectId, action, targets, note) => data(await api.post(`/tracking/projects/${projectId}/actions`, { action, targets, note }));
export const updateUnitParts = async (unitId, parts) => data(await api.put(`/tracking/units/${unitId}/parts`, { parts }));
export const cancelUnit = async (unitId, reason) => data(await api.post(`/tracking/units/${unitId}/cancel`, { reason }));

export const getToDeliver = async (companyId) => data(await api.get(`/logistics/to-deliver?${qs({ companyId })}`));
export const getDeliveryNotes = async (params) => data(await api.get(`/logistics/delivery-notes?${qs(params)}`)) || [];
export const getDeliveryNote = async (id) => data(await api.get(`/logistics/delivery-notes/${id}`));
export const createDeliveryNote = async (body) => data(await api.post("/logistics/delivery-notes", body));
export const updateDeliveryNote = async (id, body) => data(await api.put(`/logistics/delivery-notes/${id}`, body));
export const setDeliveryNoteStatus = async (id, body) => data(await api.post(`/logistics/delivery-notes/${id}/status`, body));
export const deleteDeliveryNote = async (id) => (await api.delete(`/logistics/delivery-notes/${id}`)).data;
export async function openDeliveryNotePdf(id) {
  const res = await api.get(`/logistics/delivery-notes/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
