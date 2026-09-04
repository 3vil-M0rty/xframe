import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

// Auth
export const authAPI = {
  register: (data) => axios.post(`${API_URL}/auth/register`, data),
  login: (email, password) => axios.post(`${API_URL}/auth/login`, { email, password }),
  getCurrentUser: (token) => axios.get(`${API_URL}/auth/me`, { headers: getHeaders(token) }),
  changePassword: (currentPassword, newPassword, token) =>
    axios.post(`${API_URL}/auth/change-password`, { currentPassword, newPassword }, { headers: getHeaders(token) })
};

// Users
export const userAPI = {
  getAll: (token) => axios.get(`${API_URL}/users`, { headers: getHeaders(token) }),
  getById: (id, token) => axios.get(`${API_URL}/users/${id}`, { headers: getHeaders(token) }),
  create: (data, token) => axios.post(`${API_URL}/users`, data, { headers: getHeaders(token) }),
  update: (id, data, token) => axios.put(`${API_URL}/users/${id}`, data, { headers: getHeaders(token) }),
  delete: (id, token) => axios.delete(`${API_URL}/users/${id}`, { headers: getHeaders(token) }),
  updatePermissions: (id, permissions, token) =>
    axios.post(`${API_URL}/users/${id}/permissions`, { permissions }, { headers: getHeaders(token) })
};

// Companies
export const companyAPI = {
  get: (token) => axios.get(`${API_URL}/companies`, { headers: getHeaders(token) }),
  getStats: (token) => axios.get(`${API_URL}/companies/stats`, { headers: getHeaders(token) }),
  update: (data, token) => axios.put(`${API_URL}/companies`, data, { headers: getHeaders(token) }),
  updateSettings: (data, token) => axios.put(`${API_URL}/companies/settings`, data, { headers: getHeaders(token) })
};

// Permissions
export const permissionAPI = {
  getAll: (token) => axios.get(`${API_URL}/permissions`, { headers: getHeaders(token) }),
  getUserPermissions: (userId, token) => axios.get(`${API_URL}/permissions/user/${userId}`, { headers: getHeaders(token) }),
  getAvailable: (token) => axios.get(`${API_URL}/permissions/available`, { headers: getHeaders(token) }),
  set: (data, token) => axios.post(`${API_URL}/permissions`, data, { headers: getHeaders(token) }),
  bulk: (permissions, token) => axios.post(`${API_URL}/permissions/bulk`, { permissions }, { headers: getHeaders(token) }),
  delete: (permissionId, token) => axios.delete(`${API_URL}/permissions/${permissionId}`, { headers: getHeaders(token) })
};

// Inventory
export const inventoryAPI = {
  // Categories
  getCategories: (token) => axios.get(`${API_URL}/inventory/categories`, { headers: getHeaders(token) }),
  createCategory: (data, token) => axios.post(`${API_URL}/inventory/categories`, data, { headers: getHeaders(token) }),
  updateCategory: (id, data, token) => axios.put(`${API_URL}/inventory/categories/${id}`, data, { headers: getHeaders(token) }),
  deleteCategory: (id, token) => axios.delete(`${API_URL}/inventory/categories/${id}`, { headers: getHeaders(token) }),

  // SubCategories
  getSubCategories: (token, categoryId) => {
    const query = categoryId ? `?categoryId=${categoryId}` : '';
    return axios.get(`${API_URL}/inventory/subcategories${query}`, { headers: getHeaders(token) });
  },
  createSubCategory: (data, token) => axios.post(`${API_URL}/inventory/subcategories`, data, { headers: getHeaders(token) }),
  updateSubCategory: (id, data, token) => axios.put(`${API_URL}/inventory/subcategories/${id}`, data, { headers: getHeaders(token) }),

  // Articles
  getArticles: (token, subCategoryId, status) => {
    let query = '';
    if (subCategoryId) query += `?subCategoryId=${subCategoryId}`;
    if (status) query += query ? `&status=${status}` : `?status=${status}`;
    return axios.get(`${API_URL}/inventory/articles${query}`, { headers: getHeaders(token) });
  },
  createArticle: (data, token) => axios.post(`${API_URL}/inventory/articles`, data, { headers: getHeaders(token) }),
  updateArticle: (id, data, token) => axios.put(`${API_URL}/inventory/articles/${id}`, data, { headers: getHeaders(token) }),
  addImage: (id, data, token) => axios.post(`${API_URL}/inventory/articles/${id}/images`, data, { headers: getHeaders(token) }),
  deleteArticle: (id, token) => axios.delete(`${API_URL}/inventory/articles/${id}`, { headers: getHeaders(token) }),
  getLowStock: (token) => axios.get(`${API_URL}/inventory/articles/low-stock`, { headers: getHeaders(token) })
};

// Projects
export const projectAPI = {
  getAll: (token, status) => {
    const query = status ? `?status=${status}` : '';
    return axios.get(`${API_URL}/projects${query}`, { headers: getHeaders(token) });
  },
  getById: (id, token) => axios.get(`${API_URL}/projects/${id}`, { headers: getHeaders(token) }),
  create: (data, token) => axios.post(`${API_URL}/projects`, data, { headers: getHeaders(token) }),
  update: (id, data, token) => axios.put(`${API_URL}/projects/${id}`, data, { headers: getHeaders(token) }),
  addConsumption: (id, data, token) => axios.post(`${API_URL}/projects/${id}/consumption`, data, { headers: getHeaders(token) }),
  removeConsumption: (id, consumptionId, token) =>
    axios.delete(`${API_URL}/projects/${id}/consumption`, { 
      headers: getHeaders(token),
      data: { consumptionId }
    }),
  getSummary: (id, token) => axios.get(`${API_URL}/projects/${id}/summary`, { headers: getHeaders(token) }),
  delete: (id, token) => axios.delete(`${API_URL}/projects/${id}`, { headers: getHeaders(token) })
};

// Payroll
export const payrollAPI = {
  getAll: (token, month, status, staffId) => {
    let query = '';
    if (month) query += `?month=${month}`;
    if (status) query += query ? `&status=${status}` : `?status=${status}`;
    if (staffId) query += query ? `&staffId=${staffId}` : `?staffId=${staffId}`;
    return axios.get(`${API_URL}/payroll${query}`, { headers: getHeaders(token) });
  },
  getById: (id, token) => axios.get(`${API_URL}/payroll/${id}`, { headers: getHeaders(token) }),
  create: (data, token) => axios.post(`${API_URL}/payroll`, data, { headers: getHeaders(token) }),
  update: (id, data, token) => axios.put(`${API_URL}/payroll/${id}`, data, { headers: getHeaders(token) }),
  addBonus: (id, data, token) => axios.post(`${API_URL}/payroll/${id}/bonus`, data, { headers: getHeaders(token) }),
  addDeduction: (id, data, token) => axios.post(`${API_URL}/payroll/${id}/deduction`, data, { headers: getHeaders(token) }),
  approve: (id, token) => axios.post(`${API_URL}/payroll/${id}/approve`, {}, { headers: getHeaders(token) }),
  markAsPaid: (id, paymentDate, token) =>
    axios.post(`${API_URL}/payroll/${id}/mark-paid`, { paymentDate }, { headers: getHeaders(token) }),
  getMonthlySummary: (token, month) => axios.get(`${API_URL}/payroll/summary/monthly?month=${month}`, { headers: getHeaders(token) })
};

export default {
  authAPI,
  userAPI,
  companyAPI,
  permissionAPI,
  inventoryAPI,
  projectAPI,
  payrollAPI
};
