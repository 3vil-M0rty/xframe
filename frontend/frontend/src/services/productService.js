import api from "./api";

export const getProducts = async ({
  companyId,
  category,
  search,
  lowStockOnly,
  asOfDate,
  page = 1,
  limit = 24,
} = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (category) params.append("category", category);
  if (search) params.append("search", search);
  if (lowStockOnly) params.append("lowStockOnly", "true");
  if (asOfDate) params.append("asOfDate", asOfDate);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/products?${params.toString()}`);
  return {
    products: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const getProductSuggestions = async (companyId, q) => {
  const params = new URLSearchParams({ companyId, q });
  const response = await api.get(`/products/suggestions?${params.toString()}`);
  return response.data.data || [];
};

export const getProductById = async (id) => {
  const response = await api.get(`/products/${id}`);
  return response.data.data;
};

export const getProductMovements = async (id) => {
  const response = await api.get(`/products/${id}/movements`);
  return response.data.data || [];
};

export const createProduct = async (data) => {
  const response = await api.post("/products", data);
  return response.data.data;
};

export const updateProduct = async (id, data) => {
  const response = await api.put(`/products/${id}`, data);
  return response.data.data;
};

export const adjustProductQuantity = async (id, { type, quantity, reason }) => {
  const response = await api.post(`/products/${id}/adjust`, { type, quantity, reason });
  return response.data.data;
};

export const uploadProductPhoto = async (id, file) => {
  const formData = new FormData();
  formData.append("photo", file);
  const response = await api.post(`/products/${id}/photo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};
