import api from "./api";

// GET /users/me — current logged-in user's profile
export const getCurrentUser = async () => {
  const response = await api.get("/users/me");
  return response.data.data;
};

// GET /users — all users
export const getUsers = async () => {
  const response = await api.get("/users");
  return response.data.data;
};

// GET /users/:id — a specific user's profile
export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data.data;
};

// POST /users — create a new user
export const createUser = async (data) => {
  const response = await api.post("/users", data);
  return response.data.data;
};

// PUT /users/:id — update firstName, lastName, email
export const updateUser = async (
  id,
  { firstName, lastName, email }
) => {
  const response = await api.put(`/users/${id}`, {
    firstName,
    lastName,
    email,
  });

  return response.data.data;
};

// PUT /users/:id/password — change password
export const changePassword = async (
  id,
  { currentPassword, newPassword }
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

// DELETE /users/:id — admin only
export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};