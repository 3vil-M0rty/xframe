import api from "./api";

export const getDocuments = async ({ companyId, employeeId, search, type, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (search) params.append("search", search);
  if (type) params.append("type", type);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/documents?${params.toString()}`);
  return {
    documents: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const getExpiringDocuments = async ({ companyId, withinDays = 30 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  params.append("withinDays", withinDays);

  const response = await api.get(`/documents/expiring?${params.toString()}`);
  return response.data.data || [];
};

export const uploadDocument = async ({ file, company, employee, type, label, issueDate, expiryDate, notes }) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("company", company);
  formData.append("employee", employee);
  formData.append("type", type);
  if (label) formData.append("label", label);
  if (issueDate) formData.append("issueDate", issueDate);
  if (expiryDate) formData.append("expiryDate", expiryDate);
  if (notes) formData.append("notes", notes);

  const response = await api.post("/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
};

export const updateDocument = async (id, { type, label, issueDate, expiryDate, notes, file }) => {
  const formData = new FormData();
  if (type !== undefined) formData.append("type", type);
  if (label !== undefined) formData.append("label", label);
  if (issueDate !== undefined) formData.append("issueDate", issueDate || "");
  if (expiryDate !== undefined) formData.append("expiryDate", expiryDate || "");
  if (notes !== undefined) formData.append("notes", notes || "");
  if (file) formData.append("file", file);

  const response = await api.put(`/documents/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};
