import api from "./api";

// Projects (production) — see backend routes/projects.js.

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  return p.toString();
};

export const getProjects = async (params) => (await api.get(`/projects?${qs(params)}`)).data.data || [];
export const getProject = async (id) => (await api.get(`/projects/${id}`)).data.data;
export const createProject = async (data) => (await api.post("/projects", data)).data.data;
export const updateProject = async (id, data) => (await api.put(`/projects/${id}`, data)).data.data;
export const setProjectStatus = async (id, status) => (await api.patch(`/projects/${id}/status`, { status })).data.data;
export const deleteProject = async (id) => (await api.delete(`/projects/${id}`)).data;
export const getPlanning = async (companyId, from, to) => (await api.get(`/projects/planning?${qs({ companyId, from, to })}`)).data.data;

export const createTask = async (projectId, data) => (await api.post(`/projects/${projectId}/tasks`, data)).data.data;
export const updateTask = async (taskId, data) => (await api.put(`/projects/tasks/${taskId}`, data)).data.data;
export const deleteTask = async (taskId) => (await api.delete(`/projects/tasks/${taskId}`)).data;

export const addTimeEntry = async (projectId, data) => (await api.post(`/projects/${projectId}/time`, data)).data;
export const deleteTimeEntry = async (entryId) => (await api.delete(`/projects/time/${entryId}`)).data;
export const addMaterial = async (projectId, data) => (await api.post(`/projects/${projectId}/materials`, data)).data.data;
export const addExpense = async (projectId, data) => (await api.post(`/projects/${projectId}/expenses`, data)).data.data;
export const deleteExpense = async (projectId, expenseId) => (await api.delete(`/projects/${projectId}/expenses/${expenseId}`)).data;
/** Employees (names only) to assign to projects. */
export const getProjectPeople = async (companyId) => (await api.get(`/projects/people?${qs({ companyId })}`)).data.data || [];
