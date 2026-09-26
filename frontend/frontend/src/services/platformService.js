import api from "./api";

// Platform operator (client management) — see backend routes/platform.js.

export const getClients = async () => (await api.get("/platform/tenants")).data.data || [];
export const getClient = async (id) => (await api.get(`/platform/tenants/${id}`)).data.data;
// data: { name, notes, admin: { firstName, lastName, email, password } }
export const createClient = async (data) => (await api.post("/platform/tenants", data)).data.data;
// data: { name?, notes?, status?: "active" | "suspended" }
export const updateClient = async (id, data) => (await api.patch(`/platform/tenants/${id}`, data)).data.data;
export const addClientAdmin = async (id, data) => (await api.post(`/platform/tenants/${id}/admins`, data)).data.data;
export const getOrphans = async () => (await api.get("/platform/orphans")).data.data || { companies: [], users: [] };
export const assignOrphans = async (data) => (await api.post("/platform/orphans/assign", data)).data.data;
