import api from "./api";

// ---------- Payroll runs ----------

export const getPayrollRuns = async ({ companyId, year, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (year) params.append("year", year);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/payroll/runs?${params.toString()}`);
  return {
    runs: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const getPayrollRunById = async (id) => {
  const response = await api.get(`/payroll/runs/${id}`);
  return response.data.data; // { run, payslips }
};

export const createPayrollRun = async ({ company, month, year }) => {
  const response = await api.post("/payroll/runs", { company, month, year });
  return response.data.data;
};

export const regeneratePayrollRun = async (id) => {
  const response = await api.post(`/payroll/runs/${id}/regenerate`);
  return response.data.data;
};

export const completePayrollRun = async (id) => {
  const response = await api.post(`/payroll/runs/${id}/complete`);
  return response.data.data;
};

export const deletePayrollRun = async (id) => {
  const response = await api.delete(`/payroll/runs/${id}`);
  return response.data;
};

// ---------- Payslips ----------

export const getPayslips = async ({ companyId, employeeId, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/payroll/payslips?${params.toString()}`);
  return {
    payslips: response.data.data || [],
    pagination: response.data.pagination || { total: 0, page: 1, limit, pages: 1 },
  };
};

export const markPayslipPaid = async (id) => {
  const response = await api.patch(`/payroll/payslips/${id}/mark-paid`);
  return response.data.data;
};
