import api from "./api";

const data = (r) => r.data?.data;

export const getPermissionCatalog = async () => data(await api.get("/permissions/catalog"));
export const getTeamPermissions = async (companyId) => data(await api.get(`/permissions/team?companyId=${companyId}`));
export const getUserPermissions = async (userId) => data(await api.get(`/permissions/users/${userId}`));
export const saveUserPermissions = async (userId, permissions) => data(await api.put(`/permissions/users/${userId}`, { permissions }));
export const resetUserPermissions = async (userId) => data(await api.post(`/permissions/users/${userId}/reset`));
