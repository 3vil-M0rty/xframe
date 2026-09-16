import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './context/i18nContext'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import Profile from './pages/Profile'
import Company from './pages/owner/Company'
import WorkSchedule from './pages/owner/WorkSchedule'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Users from './pages/owner/Users'
import Employees from './pages/hr/Employees'
import Salaries from './pages/hr/Salaries'
import Absences from './pages/hr/Absences'
import Advances from './pages/hr/Advances'
import Payroll from './pages/hr/Payroll'
import Contracts from './pages/hr/Contracts'
import Documents from './pages/hr/Documents'
import Attendance from './pages/hr/Attendance'
import Reports from './pages/hr/Reports'
import AuditLog from './pages/hr/AuditLog'
import OrgChart from './pages/hr/OrgChart'
import MySpace from './pages/me/MySpace'
import { canAccessHR, canSelfService, canManageCompanySettings } from './utils/permissions'
import './styles/global.css';

// Every HR page needs the same two things: logged in (outer
// ProtectedRoute wrapping <Layout />) AND canAccessHR (admin/owner/
// hr-department). Wrapping each one here keeps that rule in exactly
// one place — see components/ProtectedRoute.jsx.
function hrRoute(element) {
  return <ProtectedRoute permission={canAccessHR}>{element}</ProtectedRoute>
}

// My Space (self-service) pages need `canSelfService` instead —
// anyone whose account is linked to an employee record, regardless
// of role/department.
function selfServiceRoute(element) {
  return <ProtectedRoute permission={canSelfService}>{element}</ProtectedRoute>
}

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
              <Route
                path="/organization/work-schedule"
                element={
                  <ProtectedRoute permission={canManageCompanySettings}>
                    <WorkSchedule />
                  </ProtectedRoute>
                }
              />

              {/* HR module */}
              <Route path="/hr/employees" element={hrRoute(<Employees />)} />
              <Route path="/hr/salaries" element={hrRoute(<Salaries />)} />
              <Route path="/hr/absences" element={hrRoute(<Absences />)} />
              <Route path="/hr/advances" element={hrRoute(<Advances />)} />
              <Route path="/hr/payroll" element={hrRoute(<Payroll />)} />
              <Route path="/hr/contracts" element={hrRoute(<Contracts />)} />
              <Route path="/hr/documents" element={hrRoute(<Documents />)} />
              <Route path="/hr/attendance" element={hrRoute(<Attendance />)} />
              <Route path="/hr/reports" element={hrRoute(<Reports />)} />
              <Route path="/hr/audit-log" element={hrRoute(<AuditLog />)} />
              <Route path="/hr/org-chart" element={hrRoute(<OrgChart />)} />

              {/* My Space (self-service) — one tabbed page, several
                  paths so each tab is directly linkable/bookmarkable
                  and the sidebar can highlight the active one. */}
              <Route path="/me" element={selfServiceRoute(<MySpace />)} />
              <Route path="/me/payslips" element={selfServiceRoute(<MySpace />)} />
              <Route path="/me/absences" element={selfServiceRoute(<MySpace />)} />
              <Route path="/me/advances" element={selfServiceRoute(<MySpace />)} />
              <Route path="/me/attendance" element={selfServiceRoute(<MySpace />)} />

              {/* Unmatched routes (including the organization sidebar's
                  not-yet-built placeholder links — Departments, Job
                  Positions, etc.) land here instead of a blank page. */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}

function NotFound() {
  return (
    <div className="pageShell">
      <div className="emptyStateBlock">
        <h2>Page not found</h2>
        <p>This section hasn't been built yet.</p>
      </div>
    </div>
  )
}
