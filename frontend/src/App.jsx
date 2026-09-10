import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './context/i18nContext'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import Profile from './pages/Profile'
import Company from './pages/owner/Company'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Users from './pages/owner/Users'
import Employees from './pages/hr/Employees'
import './styles/global.css';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}>
          <Routes>
            <Route path="/" element={<LoginPage />} />

            {/* Everything under here is auth-gated AND shares the sidebar */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/profile" element={<Profile />} />
              <Route path="/organization/company" element={<Company />} />
              <Route path="/organization/users" element={<Users />} />
              <Route path="/hr/employees" element={<Employees />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}