import api from "./api";

const data = (r) => r.data.data;

// The company's default schedule (older screens).
export const getWorkSchedule = async (companyId) => data(await api.get(`/work-schedule?companyId=${companyId}`));
export const updateWorkSchedule = async (companyId, days, hoursManagement) => data(await api.put("/work-schedule", { companyId, ...days, hoursManagement }));

// Several named schedules per company, each assigned to departments.
export const getWorkSchedules = async (companyId) => data(await api.get(`/work-schedule/list?companyId=${companyId}`));
export const createWorkSchedule = async (companyId, name, copyFrom) => data(await api.post("/work-schedule", { companyId, name, copyFrom }));
export const saveWorkSchedule = async (id, body) => data(await api.put(`/work-schedule/${id}`, body));
export const setDefaultWorkSchedule = async (id) => data(await api.patch(`/work-schedule/${id}/default`));
export const assignWorkScheduleDepartments = async (id, departmentIds) => data(await api.put(`/work-schedule/${id}/departments`, { departmentIds }));
export const deleteWorkSchedule = async (id) => data(await api.delete(`/work-schedule/${id}`));
