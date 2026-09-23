import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './context/i18nContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { canAccessHR, canSelfService, canManageCompanySettings, canAccessProduction, canOverseeDepartments } from './utils/permissions'
import './styles/global.css';

// LoginPage stays a normal (eager) import: it's the very first
// thing anyone sees, including on a cold cache, so there's nothing
// to gain from a lazy chunk that just adds a network round-trip
// before the page anyone is actually here for can render. Layout
// and ProtectedRoute are structural — needed by every single route
// once logged in — so they stay eager too. Every actual PAGE below
// is lazy: before this, a fresh visit to the bare login screen
// downloaded the JS for all ~24 pages (Employees, Reports,
// Inventory, every HR module, everything) in one bundle before the
// login form could even become interactive. Each page now only
// loads the moment its route is actually visited, and the browser
// caches it after that.
import LoginPage from './pages/LoginPage'
const Profile = lazy(() => import('./pages/Profile'))
const Company = lazy(() => import('./pages/owner/Company'))
const WorkSchedule = lazy(() => import('./pages/owner/WorkSchedule'))
const Departments = lazy(() => import('./pages/owner/Departments'))
const Users = lazy(() => import('./pages/owner/Users'))
const Employees = lazy(() => import('./pages/hr/Employees'))
const Salaries = lazy(() => import('./pages/hr/Salaries'))
const Absences = lazy(() => import('./pages/hr/Absences'))
const Advances = lazy(() => import('./pages/hr/Advances'))
const Payroll = lazy(() => import('./pages/hr/Payroll'))
const Contracts = lazy(() => import('./pages/hr/Contracts'))
const Documents = lazy(() => import('./pages/hr/Documents'))
const Attendance = lazy(() => import('./pages/hr/Attendance'))
const Reports = lazy(() => import('./pages/hr/Reports'))
const AuditLog = lazy(() => import('./pages/hr/AuditLog'))
const OrgChart = lazy(() => import('./pages/hr/OrgChart'))
const PerformanceReviews = lazy(() => import('./pages/hr/PerformanceReviews'))
const DisciplinaryActions = lazy(() => import('./pages/hr/DisciplinaryActions'))
const LeaveCalendar = lazy(() => import('./pages/hr/LeaveCalendar'))
const Holidays = lazy(() => import('./pages/hr/Holidays'))
const MySpace = lazy(() => import('./pages/me/MySpace'))
const Inventory = lazy(() => import('./pages/production/Inventory'))
const InventorySettings = lazy(() => import('./pages/production/InventorySettings'))
const PurchaseRequests = lazy(() => import('./pages/production/PurchaseRequests'))
const MyDepartment = lazy(() => import('./pages/me/MyDepartment'))

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

// Production module — admins and the "production" department only.
function productionRoute(element) {
  return <ProtectedRoute permission={canAccessProduction}>{element}</ProtectedRoute>
}

// Shown for the brief moment a lazy page's chunk is downloading —
// deliberately minimal (no spinner animation, no layout shift) since
// on a warm cache this never has time to actually become visible.
function RouteFallback() {
  return <div className="pageShell" aria-hidden="true" />
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
          <Suspense fallback={<RouteFallback />}>
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
                <Route
                  path="/organization/company"
                  element={
                    <ProtectedRoute permission={canManageCompanySettings}>
                      <Company />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organization/users"
                  element={
                    <ProtectedRoute permission={canManageCompanySettings}>
                      <Users />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organization/work-schedule"
                  element={
                    <ProtectedRoute permission={canManageCompanySettings}>
                      <WorkSchedule />
                    </ProtectedRoute>
                  }
                />
                {/* Same page as My Space > My department, for admins
                    (every department) and owners (their companies'). */}
                <Route
                  path="/organization/department-access"
                  element={
                    <ProtectedRoute permission={canManageCompanySettings}>
                      <MyDepartment />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organization/departments"
                  element={
                    <ProtectedRoute permission={canManageCompanySettings}>
                      <Departments />
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
                <Route path="/hr/performance-reviews" element={hrRoute(<PerformanceReviews />)} />
                <Route path="/hr/disciplinary-actions" element={hrRoute(<DisciplinaryActions />)} />
                <Route path="/hr/leave-calendar" element={hrRoute(<LeaveCalendar />)} />
                <Route path="/hr/holidays" element={hrRoute(<Holidays />)} />

                {/* My Space (self-service) — one tabbed page, several
                    paths so each tab is directly linkable/bookmarkable
                    and the sidebar can highlight the active one. */}
                <Route path="/me" element={selfServiceRoute(<MySpace />)} />
                <Route path="/me/payslips" element={selfServiceRoute(<MySpace />)} />
                <Route path="/me/absences" element={selfServiceRoute(<MySpace />)} />
                <Route path="/me/advances" element={selfServiceRoute(<MySpace />)} />
                <Route path="/me/attendance" element={selfServiceRoute(<MySpace />)} />
                <Route path="/me/records" element={selfServiceRoute(<MySpace />)} />
                <Route
                  path="/me/department"
                  element={
                    <ProtectedRoute permission={canOverseeDepartments}>
                      <MyDepartment />
                    </ProtectedRoute>
                  }
                />

                {/* Production module */}
                <Route path="/production/inventory" element={productionRoute(<Inventory />)} />
                <Route path="/production/purchase-requests" element={productionRoute(<PurchaseRequests />)} />
                <Route path="/production/settings" element={productionRoute(<InventorySettings />)} />

                {/* Unmatched routes (including the organization sidebar's
                    not-yet-built placeholder links — Departments, Job
                    Positions, etc.) land here instead of a blank page. */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
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
