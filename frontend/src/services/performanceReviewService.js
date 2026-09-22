import api from "./api";

export const getPerformanceReviews = async ({ companyId, employeeId, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/performance-reviews?${params.toString()}`);
  return { reviews: response.data.data, pagination: response.data.pagination };
};

export const getPerformanceReview = async (id) => {
  const response = await api.get(`/performance-reviews/${id}`);
  return response.data.data;
};

export const createPerformanceReview = async (data) => {
  const response = await api.post("/performance-reviews", data);
  return response.data.data;
};

export const updatePerformanceReview = async (id, data) => {
  const response = await api.put(`/performance-reviews/${id}`, data);
  return response.data.data;
};

export const submitPerformanceReview = async (id) => {
  const response = await api.patch(`/performance-reviews/${id}/submit`);
  return response.data.data;
};

export const acknowledgePerformanceReview = async (id, employeeComments) => {
  const response = await api.patch(`/performance-reviews/${id}/acknowledge`, { employeeComments });
  return response.data.data;
};

export const deletePerformanceReview = async (id) => {
  const response = await api.delete(`/performance-reviews/${id}`);
  return response.data;
};
