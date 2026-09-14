import api from "./api";

export const getAuditLogs = async ({ companyId, resourceType, page = 1, limit = 30 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (resourceType) params.append("resourceType", resourceType);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/audit-logs?${params.toString()}`);
  return {
    entries: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};
