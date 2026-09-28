import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './context/i18nContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { canAccessHR, canSelfService, canManageCompanySettings, canAccessProduction, canOverseeDepartments, canAccessPurchasing, isPlatformAdmin, canAccessSales, canViewProjects, canUseWorkshops, canAccessLogistics, can, canViewCatalog, canConfigureProduction, canManageInventory, canManageTeamPermissions } from './utils/permissions'
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
import { useI18n } from './hooks/useI18n'
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
const Declarations = lazy(() => import('./pages/hr/Declarations'))
const LeaveBalances = lazy(() => import('./pages/hr/LeaveBalances'))
const PurchaseRequestsQueue = lazy(() => import('./pages/purchasing/PurchaseRequestsQueue'))
const PurchaseOrders = lazy(() => import('./pages/purchasing/PurchaseOrders'))
const PurchaseOrderForm = lazy(() => import('./pages/purchasing/PurchaseOrderForm'))
const PurchaseOrderDetail = lazy(() => import('./pages/purchasing/PurchaseOrderDetail'))
const PriceRequests = lazy(() => import('./pages/purchasing/PriceRequests'))
const Suppliers = lazy(() => import('./pages/purchasing/Suppliers'))
const ArticleHistory = lazy(() => import('./pages/purchasing/ArticleHistory'))
const SupplierInvoices = lazy(() => import('./pages/purchasing/SupplierInvoices'))
const PurchasingReports = lazy(() => import('./pages/purchasing/PurchasingReports'))
const Restock = lazy(() => import('./pages/purchasing/Restock'))
const MySpace = lazy(() => import('./pages/me/MySpace'))
const Inventory = lazy(() => import('./pages/production/Inventory'))
const InventorySettings = lazy(() => import('./pages/production/InventorySettings'))
const PurchaseRequests = lazy(() => import('./pages/production/PurchaseRequests'))
const MyDepartment = lazy(() => import('./pages/me/MyDepartment'))
const TeamPermissions = lazy(() => import('./pages/owner/TeamPermissions'))
const PlatformClients = lazy(() => import('./pages/platform/Clients'))
const Customers = lazy(() => import('./pages/sales/Customers'))
const Quotes = lazy(() => import('./pages/sales/Quotes'))
const QuoteDetail = lazy(() => import('./pages/sales/QuoteDetail'))
const SalesDocForm = lazy(() => import('./pages/sales/SalesDocForm'))
const SalesInvoices = lazy(() => import('./pages/sales/Invoices'))
const InvoiceDetail = lazy(() => import('./pages/sales/InvoiceDetail'))
const Receivables = lazy(() => import('./pages/sales/Receivables'))
const Projects = lazy(() => import('./pages/production/Projects'))
const ProjectDetail = lazy(() => import('./pages/production/ProjectDetail'))
const Planning = lazy(() => import('./pages/production/Planning'))
const Workshops = lazy(() => import('./pages/production/Workshops'))
const WorkOrderDetail = lazy(() => import('./pages/production/WorkOrderDetail'))
const Catalog = lazy(() => import('./pages/production/Catalog'))
const ChassisModelEditor = lazy(() => import('./pages/production/ChassisModelEditor'))
const ProductionConfig = lazy(() => import('./pages/production/ProductionConfig'))
const TrackingOverview = lazy(() => import('./pages/logistics/TrackingOverview'))
const ToDeliver = lazy(() => import('./pages/logistics/ToDeliver'))
const DeliveryNotes = lazy(() => import('./pages/logistics/DeliveryNotes'))
const DeliveryNoteForm = lazy(() => import('./pages/logistics/DeliveryNoteForm'))

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

// Purchasing module (service achats) — admins and the "purchasing" department.
function purchasingRoute(element) {
  return <ProtectedRoute permission={canAccessPurchasing}>{element}</ProtectedRoute>
}

// Production module — admins and the "production" department only.
function salesRoute(element) {
  return <ProtectedRoute permission={canAccessSales}>{element}</ProtectedRoute>
}

function projectsRoute(element) {
  return <ProtectedRoute permission={canViewProjects}>{element}</ProtectedRoute>
}

function workshopsRoute(element) {
  return <ProtectedRoute permission={canUseWorkshops}>{element}</ProtectedRoute>
}

function logisticsRoute(element) {
  return <ProtectedRoute permission={canAccessLogistics}>{element}</ProtectedRoute>
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
                {/* Platform operator only (role platform_admin) */}
                <Route
                  path="/platform/clients"
                  element={
                    <ProtectedRoute permission={isPlatformAdmin}>
                      <PlatformClients />
                    </ProtectedRoute>
                  }
                />
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
                    <ProtectedRoute permission={(u) => canManageCompanySettings(u) || can(u, "organization.schedule.edit")}>
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
                    <ProtectedRoute permission={(u) => canManageCompanySettings(u) || can(u, "organization.departments.view")}>
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
                <Route path="/hr/declarations" element={hrRoute(<Declarations />)} />
                {/* Sales (ventes) */}
                <Route path="/sales/customers" element={salesRoute(<Customers />)} />
                <Route path="/sales/quotes" element={salesRoute(<Quotes />)} />
                <Route path="/sales/quotes/new" element={salesRoute(<SalesDocForm kind="quote" />)} />
                <Route path="/sales/quotes/:id" element={salesRoute(<QuoteDetail />)} />
                <Route path="/sales/quotes/:id/edit" element={salesRoute(<SalesDocForm kind="quote" />)} />
                <Route path="/sales/invoices" element={salesRoute(<SalesInvoices />)} />
                <Route path="/sales/invoices/new" element={salesRoute(<SalesDocForm kind="invoice" />)} />
                <Route path="/sales/invoices/:id" element={salesRoute(<InvoiceDetail />)} />
                <Route path="/sales/invoices/:id/edit" element={salesRoute(<SalesDocForm kind="invoice" />)} />
                <Route path="/sales/receivables" element={salesRoute(<Receivables />)} />
                {/* Projects (production) */}
                <Route path="/production/projects" element={projectsRoute(<Projects />)} />
                <Route path="/production/projects/:id" element={projectsRoute(<ProjectDetail />)} />
                <Route path="/production/planning" element={projectsRoute(<Planning />)} />
                <Route path="/production/workshops" element={workshopsRoute(<Workshops />)} />
                <Route path="/production/orders/:id" element={workshopsRoute(<WorkOrderDetail />)} />
                <Route path="/production/catalog" element={<ProtectedRoute permission={canViewCatalog}><Catalog /></ProtectedRoute>} />
                <Route path="/production/catalog/models/:id" element={<ProtectedRoute permission={canViewCatalog}><ChassisModelEditor /></ProtectedRoute>} />
                <Route path="/production/configuration" element={<ProtectedRoute permission={canConfigureProduction}><ProductionConfig /></ProtectedRoute>} />
                <Route path="/production/tracking" element={<ProtectedRoute permission={(u) => can(u, "production.tracking.view") || canViewProjects(u)}><TrackingOverview /></ProtectedRoute>} />
                <Route path="/logistics/to-deliver" element={logisticsRoute(<ToDeliver />)} />
                <Route path="/logistics/delivery-notes" element={logisticsRoute(<DeliveryNotes />)} />
                <Route path="/logistics/delivery-notes/new" element={logisticsRoute(<DeliveryNoteForm />)} />
                <Route path="/logistics/delivery-notes/:id" element={logisticsRoute(<DeliveryNoteForm />)} />
                <Route path="/logistics/tracking" element={<ProtectedRoute permission={(u) => can(u, "logistics.tracking.view") || canAccessLogistics(u)}><TrackingOverview /></ProtectedRoute>} />
                <Route path="/me/team-permissions" element={<ProtectedRoute permission={canManageTeamPermissions}><TeamPermissions /></ProtectedRoute>} />
                <Route path="/organization/roles-permissions" element={<ProtectedRoute permission={canManageTeamPermissions}><TeamPermissions /></ProtectedRoute>} />
                <Route path="/hr/leave-balances" element={hrRoute(<LeaveBalances />)} />

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

                {/* Purchasing module (service achats) */}
                <Route path="/purchasing/requests" element={purchasingRoute(<PurchaseRequestsQueue />)} />
                <Route path="/purchasing/orders" element={purchasingRoute(<PurchaseOrders />)} />
                <Route path="/purchasing/orders/new" element={purchasingRoute(<PurchaseOrderForm />)} />
                <Route path="/purchasing/orders/:id" element={purchasingRoute(<PurchaseOrderDetail />)} />
                <Route path="/purchasing/orders/:id/edit" element={purchasingRoute(<PurchaseOrderForm />)} />
                <Route path="/purchasing/invoices" element={purchasingRoute(<SupplierInvoices />)} />
                <Route path="/purchasing/reports" element={purchasingRoute(<PurchasingReports />)} />
                <Route path="/purchasing/restock" element={purchasingRoute(<Restock />)} />
                <Route path="/purchasing/price-requests" element={purchasingRoute(<PriceRequests />)} />
                <Route path="/purchasing/suppliers" element={purchasingRoute(<Suppliers />)} />
                <Route path="/purchasing/inventory" element={purchasingRoute(<Inventory readOnly />)} />
                <Route path="/purchasing/article-history" element={purchasingRoute(<ArticleHistory />)} />

                {/* Production module */}
                <Route path="/production/inventory" element={<ProtectedRoute permission={(u) => can(u, "inventory.articles.view") || canAccessProduction(u)}><Inventory /></ProtectedRoute>} />
                <Route path="/production/purchase-requests" element={<ProtectedRoute permission={(u) => can(u, "inventory.requests.view") || canAccessProduction(u)}><PurchaseRequests /></ProtectedRoute>} />
                <Route path="/production/settings" element={<ProtectedRoute permission={canManageInventory}><InventorySettings /></ProtectedRoute>} />

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
  const { t } = useI18n()
  return (
    <div className="pageShell">
      <div className="emptyStateBlock">
        <h2>{t("common.pageNotFound")}</h2>
        <p>{t("common.pageNotFoundHint")}</p>
      </div>
    </div>
  )
}
