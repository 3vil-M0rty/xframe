import api from "./api";

// ======================================================
// GET ALL EMPLOYEES
// ======================================================

export const getEmployees = async ({
  companyId,
  status,
  department,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (companyId) params.append("companyId", companyId);
  if (status) params.append("status", status);
  if (department) params.append("department", department);
  if (search) params.append("search", search);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/employees?${params.toString()}`);

  // Backend responds { success, data: [...employees], pagination }.
  // Previously this unwrapped straight to `response.data.data`, which
  // silently threw away `pagination` — meaning callers had no way to
  // know how many pages/employees existed and always had to fetch
  // everything (limit: 100) and render it all in one grid. Returning
  // both lets the UI paginate instead.
  return {
    employees: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ======================================================
// GET SINGLE EMPLOYEE
// ======================================================

export const getEmployeeById = async (id) => {
  const response = await api.get(`/employees/${id}`);

  // Backend responds { success, data: employee }.
  return response.data.data;
};

// ======================================================
// CREATE EMPLOYEE
// ======================================================

export const createEmployee = async (employeeData) => {
  const response = await api.post(
    "/employees",
    employeeData
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// UPDATE EMPLOYEE
// ======================================================

export const updateEmployee = async (id, employeeData) => {
  const response = await api.put(
    `/employees/${id}`,
    employeeData
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// DELETE EMPLOYEE
// ======================================================

export const deleteEmployee = async (id) => {
  const response = await api.delete(
    `/employees/${id}`
  );

  // Backend responds { success, message, employeeId } — no `data` to unwrap.
  return response.data;
};

// ======================================================
// UPLOAD EMPLOYEE PHOTO
// ======================================================

export const uploadEmployeePhoto = async (id, file) => {
  const formData = new FormData();

  formData.append("photo", file);

  const response = await api.post(
    `/employees/${id}/photo`,
    formData
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// DELETE EMPLOYEE PHOTO
// ======================================================

export const deleteEmployeePhoto = async (id) => {
  const response = await api.delete(
    `/employees/${id}/photo`
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};