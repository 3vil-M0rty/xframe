import create from 'zustand';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  company: null,
  token: localStorage.getItem('token') || null,
  loading: false,
  error: null,

  // Login
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      set({
        user: res.data.user,
        company: res.data.company,
        token: res.data.token,
        loading: false
      });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Login failed', loading: false });
      return false;
    }
  },

  // Register
  register: async (companyName, companySlug, email, password, firstName, lastName) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/register`, {
        companyName,
        companySlug,
        email,
        password,
        firstName,
        lastName
      });
      localStorage.setItem('token', res.data.token);
      set({
        user: res.data.user,
        company: res.data.company,
        token: res.data.token,
        loading: false
      });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Registration failed', loading: false });
      return false;
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, company: null, token: null });
  },

  // Get auth header
  getHeaders: () => {
    const token = get().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  // Clear error
  clearError: () => set({ error: null })
}));
