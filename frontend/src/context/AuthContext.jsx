import { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import { getCurrentUser } from '../services/userService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  // True until we've resolved whether the stored token maps to a
  // real user. Prevents a flash of "logged out" UI (and hides
  // role-gated buttons like Edit/Delete) while that check is in flight.
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  // On first load (and on every refresh) we only have the raw token
  // in localStorage — `user` starts out null. Without this, every
  // role check in the UI (canManageUser, canDeleteUser, etc.) sees a
  // null actor and hides Edit/Delete buttons even for an owner/admin.
  // Fetch the real profile from /users/me to repopulate `user`.
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        // Token is invalid/expired - clear it out.
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
    // Only run this on mount / when the token itself changes (e.g. login/logout),
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};