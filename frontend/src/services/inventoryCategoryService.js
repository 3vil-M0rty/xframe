import api from "./api";

export const getInventoryCategories = async (companyId) => {
  const response = await api.get(`/inventory-categories?companyId=${companyId}`);
  return response.data.data || [];
};

export const createInventoryCategory = async (data) => {
  const response = await api.post("/inventory-categories", data);
  return response.data.data;
};

export const updateInventoryCategory = async (id, data) => {
  const response = await api.put(`/inventory-categories/${id}`, data);
  return response.data.data;
};

export const deleteInventoryCategory = async (id) => {
  const response = await api.delete(`/inventory-categories/${id}`);
  return response.data;
};
