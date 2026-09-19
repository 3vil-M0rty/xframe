import api from "./api";

export const getContracts = async ({ companyId, employeeId, search, status, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (search) params.append("search", search);
  if (status) params.append("status", status);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/contracts?${params.toString()}`);
  return {
    contracts: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const getExpiringContracts = async ({ companyId, withinDays = 30 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  params.append("withinDays", withinDays);

  const response = await api.get(`/contracts/expiring?${params.toString()}`);
  return response.data.data || [];
};

export const createContract = async (data) => {
  const response = await api.post("/contracts", data);
  return response.data.data;
};

export const updateContract = async (id, data) => {
  const response = await api.put(`/contracts/${id}`, data);
  return response.data.data;
};

export const renewContract = async (id, data) => {
  const response = await api.post(`/contracts/${id}/renew`, data);
  return response.data.data;
};

export const deleteContract = async (id) => {
  const response = await api.delete(`/contracts/${id}`);
  return response.data;
};
