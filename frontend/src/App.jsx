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
import Salaries from './pages/hr/Salaries'
import Absences from './pages/hr/Absences'
import Advances from './pages/hr/Advances'
import { canAccessHR } from './utils/permissions'
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

              {/* HR module: every route here needs both "logged in"
                  (handled by the ProtectedRoute above) AND
                  `canAccessHR` (admin/owner/hr-department). Adding a
                  future HR page is just one more line here reusing
                  the same guard — see components/ProtectedRoute.jsx
                  and utils/permissions.js. */}
              <Route
                path="/hr/employees"
                element={
                  <ProtectedRoute permission={canAccessHR}>
                    <Employees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/salaries"
                element={
                  <ProtectedRoute permission={canAccessHR}>
                    <Salaries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/absences"
                element={
                  <ProtectedRoute permission={canAccessHR}>
                    <Absences />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/advances"
                element={
                  <ProtectedRoute permission={canAccessHR}>
                    <Advances />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}