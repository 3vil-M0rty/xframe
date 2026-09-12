import api from "./api";

// ======================================================
// GET ALL SALARY RECORDS
// ======================================================

export const getSalaries = async ({
  companyId,
  employeeId,
  current,
  page = 1,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (current) params.append("current", current);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/salaries?${params.toString()}`);

  return {
    salaries: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ======================================================
// GET SINGLE SALARY RECORD
// ======================================================

export const getSalaryById = async (id) => {
  const response = await api.get(`/salaries/${id}`);
  return response.data.data;
};

// ======================================================
// CREATE SALARY RECORD (a raise — closes the previous current
// record automatically on the backend)
// ======================================================

export const createSalary = async (salaryData) => {
  const response = await api.post("/salaries", salaryData);
  return response.data.data;
};

// ======================================================
// UPDATE SALARY RECORD
// ======================================================

export const updateSalary = async (id, salaryData) => {
  const response = await api.put(`/salaries/${id}`, salaryData);
  return response.data.data;
};

// ======================================================
// DELETE SALARY RECORD
// ======================================================

export const deleteSalary = async (id) => {
  const response = await api.delete(`/salaries/${id}`);
  return response.data;
};
