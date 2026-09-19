import api from "./api";

export const getPurchaseRequests = async ({ companyId, status, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (status) params.append("status", status);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/purchase-requests?${params.toString()}`);
  return {
    requests: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const createPurchaseRequest = async (data) => {
  const response = await api.post("/purchase-requests", data);
  return response.data.data;
};

export const reviewPurchaseRequest = async (id, status) => {
  const response = await api.patch(`/purchase-requests/${id}/review`, { status });
  return response.data.data;
};

export const deletePurchaseRequest = async (id) => {
  const response = await api.delete(`/purchase-requests/${id}`);
  return response.data;
};
