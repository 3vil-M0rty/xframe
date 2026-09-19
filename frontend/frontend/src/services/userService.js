import api from "./api";

// ============================================================
// GET CURRENT USER
// GET /users/me
// ============================================================

export const getCurrentUser = async () => {
  const response = await api.get("/users/me");

  return response.data.data;
};

// ============================================================
// GET ALL USERS
// GET /users
// Backend responds { success, data: [...users], pagination }.
// Supports the same params as getEmployees so the Users page can
// keep its card grid paginated instead of always fetching (and
// rendering) every user at once.
// ============================================================

export const getUsers = async ({
  search,
  role,
  status,
  department,
  page = 1,
  limit = 12,
} = {}) => {
  const params = new URLSearchParams();

  if (search) params.append("search", search);
  if (role) params.append("role", role);
  if (status) params.append("status", status);
  if (department) params.append("department", department);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/users?${params.toString()}`);

  return {
    users: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ============================================================
// GET USER BY ID
// GET /users/:id
// ============================================================

export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);

  return response.data.data;
};

// ============================================================
// CREATE USER
// POST /users
// ============================================================

export const createUser = async (data) => {
  const response = await api.post("/users", {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    password: data.password,
    role: data.role,
    status: data.status,
    department: data.department,
  });

  return response.data.data;
};

// ============================================================
// UPDATE USER
// PUT /users/:id
// ============================================================

export const updateUser = async (
  id,
  {
    firstName,
    lastName,
    email,
    role,
    status,
    department,
  }
) => {
  const response = await api.put(`/users/${id}`, {
    firstName,
    lastName,
    email,
    role,
    status,
    department,
  });

  return response.data.data;
};

// ============================================================
// CHANGE PASSWORD
// PUT /users/:id/password
// ============================================================

export const changePassword = async (
  id,
  {
    currentPassword,
    newPassword,
  }
) => {
  const response = await api.put(
    `/users/${id}/password`,
    {
      currentPassword,
      newPassword,
    }
  );

  return response.data;
};

// ============================================================
// DELETE USER
// DELETE /users/:id
// ============================================================

export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);

  return response.data;
};