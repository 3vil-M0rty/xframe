import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n/index';
import { useStore } from './store';
import ToastContainer from './components/ToastContainer';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Permissions from './pages/Permissions';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Projects from './pages/Projects';
import Payroll from './pages/Payroll';
import Settings from './pages/Settings';

// Components
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { token } = useStore();
  
  if (!token) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { token } = useStore();
  
  if (token) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="permissions" element={<Permissions />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="projects" element={<Projects />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="settings" element={<Settings />} />
          <Route path="" element={<Navigate to="/dashboard" />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
      </BrowserRouter>
    </>
  );
}
