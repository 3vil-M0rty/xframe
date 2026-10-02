import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings2,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  UserRoundCog,
  Menu,
  IdCardLanyard,
  Factory,
  ShoppingBag,
  Building2,
  Handshake,
  Truck,
  Sun,
  Moon,
  DraftingCompass,
} from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import styles from "./Sidebar.module.css";
import LanguageSwitcher from "./useful/LanguageSwitcher";
import { canAccessHR, canSelfService, canAccessProduction, canManageCompanySettings, isDepartmentManager, canAccessPurchasing, isPlatformAdmin, canAccessSales, canViewProjects, canUseWorkshops, canConfigureProduction, canAccessLogistics, can, canAny, canViewCatalog, canManageInventory, canManageTeamPermissions, isAdmin } from "../utils/permissions";
import { getOpenRequestCount } from "../services/purchasingService";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSection, setExpandedSection] = useState(null);

  // Previously the sidebar fetched its own separate copy of the
  // current user (a second, independent `/users/me` call on mount),
  // completely disconnected from AuthContext. That meant logging
  // out (which clears AuthContext's user/token) left the sidebar
  // showing a STALE user and stale permission-gated menu items —
  // the sidebar had no way to find out anything had changed. Using
  // the same `user`/`loading` AuthContext already tracks keeps the
  // sidebar and the rest of the app looking at one source of truth.
  const { user, loading, logout } = useAuth();

  const { t } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // ============================================================
  // MENU
  // ============================================================

  // "Demandes d'achat (N)": requests still waiting for the purchasing
  // team (pending + delayed). Polled like the notification bell, and
  // only for people who can see the purchasing module.
  const [openRequestCount, setOpenRequestCount] = useState(0);
  const purchasingUser = canAccessPurchasing(user);
  useEffect(() => {
    if (!purchasingUser) { setOpenRequestCount(0); return undefined; }
    let cancelled = false;
    const load = async () => {
      try {
        const count = await getOpenRequestCount();
        if (!cancelled) setOpenRequestCount(count);
      } catch {
        // non-critical: keep the last known count
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [purchasingUser]);

  const menuItems = [
    {
      // Platform operator only: the platform's clients. A platform
      // admin passes none of the other sections' checks.
      id: "platform",
      label: t("sidebar.platform"),
      icon: Building2,
      permission: isPlatformAdmin,
      subsections: [
        { label: t("sidebar.clients"), href: "/platform/clients" },
      ],
    },

    {
      id: "organization",
      label: t("sidebar.organization"),
      // Company setup (company profile, user accounts, departments,
      // schedules) is for admins and company owners only — it had no
      // permission at all before, so every logged-in employee saw it.
      permission: (u) => canManageCompanySettings(u) || canAny(u, ["organization.departments.view", "organization.positions.view", "organization.schedule.edit"]),
      icon: Settings2,
      subsections: [
        {
          label: t("sidebar.company"),
          href: "/organization/company",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.users"),
          href: "/organization/users",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.workSchedule"),
          href: "/organization/work-schedule",
          permission: (u) => canManageCompanySettings(u) || can(u, "organization.schedule.edit"),
        },
        {
          label: t("sidebar.departments"),
          href: "/organization/departments",
          permission: (u) => canManageCompanySettings(u) || can(u, "organization.departments.view"),
        },
        {
          label: t("sidebar.departmentAccess"),
          href: "/organization/department-access",
          permission: canManageCompanySettings,
        },
        {
          // Fine-grained permissions of everyone (admins / owners).
          label: t("sidebar.rolesPermissions"),
          href: "/organization/roles-permissions",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.locations"),
          href: "/organization/locations",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.documents"),
          href: "/organization/documents",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.preferences"),
          href: "/organization/preferences",
          permission: canManageCompanySettings,
        },
        {
          label: t("sidebar.integrations"),
          href: "/organization/integrations",
          permission: canManageCompanySettings,
        },
      ],
    },

    {
      id: "hr",
      label: t("sidebar.hr"),
      icon: IdCardLanyard,
      // Declarative permission check: this whole section (and
      // every subsection under it) only shows up for someone
      // `canAccessHR` says yes to (admin, owner, or a "hr"
      // department user). Adding a new HR page later is just
      // another entry in `subsections` below — no new permission
      // wiring needed, it inherits this same gate.
      permission: canAccessHR,
      subsections: [
        {
          label: t("sidebar.employees"),
          href: "/hr/employees",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.employees.view"]),
        },
        {
          label: t("sidebar.salaries"),
          href: "/hr/salaries",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.salaries.view"]),
        },
        {
          label: t("sidebar.absences"),
          href: "/hr/absences",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.absences.view"]),
        },
        {
          label: t("sidebar.advances"),
          href: "/hr/advances",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.advances.view"]),
        },
        {
          label: t("sidebar.payroll"),
          href: "/hr/payroll",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.payroll.view"]),
        },
        {
          label: t("sidebar.declarations"),
          href: "/hr/declarations",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.declarations.view"]),
        },
        {
          label: t("sidebar.contracts"),
          href: "/hr/contracts",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.contracts.view"]),
        },
        {
          label: t("sidebar.employeeDocuments"),
          href: "/hr/documents",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.documents.view"]),
        },
        {
          label: t("sidebar.attendance"),
          href: "/hr/attendance",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.attendance.view"]),
        },
        {
          label: t("sidebar.orgChart"),
          href: "/hr/org-chart",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.employees.view"]),
        },
        {
          label: t("sidebar.leaveCalendar"),
          href: "/hr/leave-calendar",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.absences.view"]),
        },
        {
          label: t("sidebar.leaveBalances"),
          href: "/hr/leave-balances",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.leave.view"]),
        },
        {
          label: t("sidebar.holidays"),
          href: "/hr/holidays",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.holidays.view"]),
        },
        {
          label: t("sidebar.performanceReviews"),
          href: "/hr/performance-reviews",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.reviews.view"]),
        },
        {
          label: t("sidebar.disciplinaryActions"),
          href: "/hr/disciplinary-actions",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.discipline.view"]),
        },
        {
          label: t("sidebar.reports"),
          href: "/hr/reports",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.reports.view"]),
        },
        {
          label: t("sidebar.auditLog"),
          href: "/hr/audit-log",
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["hr.auditLogs.view"]),
        },
      ],
    },

    {
      id: "mySpace",
      label: t("sidebar.mySpace"),
      icon: UserRoundCog,
      // Shows up for ANYONE whose account is linked to an employee
      // record — completely independent of role/department, since
      // self-service is about "is this login tied to a person",
      // not "does this login manage HR". See utils/permissions.js.
      permission: canSelfService,
      subsections: [
        {
          label: t("sidebar.myProfile"),
          href: "/me",
        },
        {
          label: t("sidebar.myPayslips"),
          href: "/me/payslips",
        },
        {
          label: t("sidebar.myAbsences"),
          href: "/me/absences",
        },
        {
          label: t("sidebar.myAdvances"),
          href: "/me/advances",
        },
        {
          label: t("sidebar.myAttendance"),
          href: "/me/attendance",
        },
        {
          label: t("sidebar.myRecords"),
          href: "/me/records",
        },
        {
          label: t("sidebar.myDepartment"),
          href: "/me/department",
          permission: isDepartmentManager,
        },
        {
          // Managers hand out permissions to the people under them.
          label: t("perm.teamMenu"),
          href: "/me/team-permissions",
          permission: (u) => canManageTeamPermissions(u) && !isAdmin(u) && u?.role !== "owner",
        },
      ],
    },

    {
      id: "sales",
      label: t("sidebar.sales"),
      icon: Handshake,
      permission: canAccessSales,
      subsections: [
        { label: t("sidebar.quotes"), href: "/sales/quotes", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["sales.quotes.view"]) },
        { label: t("sidebar.salesInvoices"), href: "/sales/invoices", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["sales.invoices.view"]) },
        { label: t("sidebar.receivables"), href: "/sales/receivables", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["sales.reports.view", "sales.invoices.view"]) },
        { label: t("sidebar.customers"), href: "/sales/customers", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["sales.customers.view"]) },
      ],
    },

    {
      id: "purchasing",
      label: t("sidebar.purchasing"),
      icon: ShoppingBag,
      permission: canAccessPurchasing,
      subsections: [
        {
          label: t("sidebar.purchaseRequestsQueue"),
          href: "/purchasing/requests",
          // requests still waiting for an answer (pending + delayed)
          badge: openRequestCount,
          permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.requests.view"]),
        },
        { label: t("sidebar.purchaseOrders"), href: "/purchasing/orders", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.orders.view"]) },
        { label: t("sidebar.supplierInvoices"), href: "/purchasing/invoices", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.invoices.view"]) },
        { label: t("sidebar.restock"), href: "/purchasing/restock", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.reports.view"]) },
        { label: t("sidebar.purchasingReports"), href: "/purchasing/reports", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.reports.view"]) },
        { label: t("sidebar.priceRequests"), href: "/purchasing/price-requests", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.priceRequests.view"]) },
        { label: t("sidebar.suppliers"), href: "/purchasing/suppliers", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.suppliers.view"]) },
        { label: t("sidebar.purchasingInventory"), href: "/purchasing/inventory", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["inventory.articles.view"]) },
        { label: t("sidebar.articleHistory"), href: "/purchasing/article-history", permission: (u) => !Array.isArray(u?.permissions) || canAny(u, ["purchasing.orders.view"]) },
      ],
    },

    {
      id: "production",
      label: t("sidebar.production"),
      icon: Factory,
      // Inventory stays production-only (admins + "production"
      // department); projects and planning are also visible to sales,
      // purchasing and owners. See utils/permissions.js.
      permission: (u) => canAccessProduction(u) || canViewProjects(u) || canUseWorkshops(u) || canManageInventory(u) || canConfigureProduction(u) || can(u, "production.tracking.view"),
      subsections: [
        { label: t("sidebar.workshops"), href: "/production/workshops", permission: canUseWorkshops },
        { label: t("sidebar.projects"), href: "/production/projects", permission: canViewProjects },
        { label: t("sidebar.planning"), href: "/production/planning", permission: canViewProjects },
        { label: t("sidebar.tracking"), href: "/production/tracking", permission: (u) => canAny(u, ["production.tracking.view"]) || canViewProjects(u) },
        { label: t("sidebar.offcuts"), href: "/production/offcuts", permission: (u) => can(u, "production.flow.offcuts") || can(u, "production.flow.issueBars") || canUseWorkshops(u) },
        { label: t("sidebar.glazing"), href: "/production/glazing", permission: (u) => canViewCatalog(u) || canConfigureProduction(u) || canViewProjects(u) },
        {
          label: t("sidebar.inventory"),
          href: "/production/inventory",
          permission: (u) => can(u, "inventory.articles.view") || canAccessProduction(u),
        },
        {
          label: t("sidebar.purchaseRequests"),
          href: "/production/purchase-requests",
          permission: (u) => can(u, "inventory.requests.view") || canAccessProduction(u),
        },
        { label: t("sidebar.productionConfig"), href: "/production/configuration", permission: canConfigureProduction },
      ],
    },

    {
      // TECHNIQUE: how the products are defined — the bureau d'études /
      // méthodes. Production only USES these (projects, workshops, débit).
      id: "technical",
      label: t("sidebar.technical"),
      icon: DraftingCompass,
      permission: (u) => canViewCatalog(u) || canConfigureProduction(u) || canManageInventory(u) || can(u, "inventory.articles.view"),
      subsections: [
        { label: t("sidebar.chassisCatalog"), href: "/technical/catalog", permission: canViewCatalog },
        { label: t("sidebar.glassTypes"), href: "/technical/glass-types", permission: (u) => canViewCatalog(u) || canConfigureProduction(u) },
        { label: t("sidebar.techArticles"), href: "/technical/articles", permission: (u) => can(u, "inventory.articles.view") || canManageInventory(u) || canConfigureProduction(u) },
        { label: t("sidebar.finishes"), href: "/technical/finishes", permission: canConfigureProduction },
        {
          label: t("sidebar.articleCategories"),
          href: "/technical/categories",
          permission: (u) => canAny(u, ["inventory.categories.create", "inventory.categories.edit", "inventory.categories.delete"]) || canAccessProduction(u),
        },
        { label: t("sidebar.calcSettings"), href: "/technical/settings", permission: canConfigureProduction },
      ],
    },

    {
      id: "logistics",
      label: t("sidebar.logistics"),
      icon: Truck,
      permission: (u) => canAccessLogistics(u) || can(u, "logistics.tracking.view"),
      subsections: [
        { label: t("sidebar.toDeliver"), href: "/logistics/to-deliver", permission: (u) => can(u, "logistics.toDeliver.view") || (!Array.isArray(u?.permissions) && canAccessLogistics(u)) },
        { label: t("sidebar.deliveryNotes"), href: "/logistics/delivery-notes", permission: (u) => can(u, "logistics.notes.view") || (!Array.isArray(u?.permissions) && canAccessLogistics(u)) },
        { label: t("sidebar.tracking"), href: "/logistics/tracking", permission: (u) => can(u, "logistics.tracking.view") || (!Array.isArray(u?.permissions) && canAccessLogistics(u)) },
      ],
    },

    {
      id: "help",
      label: t("sidebar.help"),
      icon: HelpCircle,
      href: "/help",
    },
  ];

  // Menu items are only shown once we know who the user is, and
  // only if they have no `permission` check or they pass it. Any
  // future sidebar section can opt into the same gating just by
  // adding a `permission: someCheckFn` field above — nothing here
  // needs to change.
  //
  // Memoized on a PRIMITIVE key (not the `user` object itself, and
  // not `menuItems`, which is a fresh array literal every render)
  // — this used to be a plain, unmemoized `.filter()` call, so it
  // returned a brand-new array on every single render. That fed
  // straight into the auto-expand effect below as an "unstable"
  // dependency, so the effect re-ran on every render (not just on
  // navigation) and kept forcing `expandedSection` back to whatever
  // section matches the CURRENT route — silently undoing any
  // attempt to manually expand a different section. That's what
  // made the sidebar look "stuck"/unable to open another section.
  // Not memoized: this used to be wrapped in useMemo with only
  // [permissionKey] as its dependency. menuItems itself is rebuilt
  // fresh on every render (translated labels included), but the
  // memoized FILTER of it stayed frozen on whatever language was
  // active the last time permissionKey changed — switching the
  // language from the sidebar's own switcher never touched
  // permissionKey, so the menu silently kept showing the old
  // language until a full page refresh forced a remount. Filtering
  // this array is computationally trivial, so there's no real
  // performance reason to memoize it in the first place — removing
  // it removes the staleness risk entirely instead of just patching
  // this one dependency array.
  // Sections AND individual links inside them can carry a
  // `permission` check (e.g. "My department" is only for department
  // managers, inside the otherwise-everyone My Space section).
  const visibleMenuItems = menuItems
    .filter((item) => !item.permission || item.permission(user))
    .map((item) => (Array.isArray(item.subsections)
      ? { ...item, subsections: item.subsections.filter((sub) => !sub.permission || sub.permission(user)) }
      : item));

  // ============================================================
  // AUTO EXPAND ACTIVE SECTION
  // ============================================================
  // Second layer of defense against the same class of bug: only
  // actually do anything when the pathname has genuinely changed
  // since the last time this ran, regardless of why the effect
  // fired. A manual click on a section header only changes local
  // `expandedSection` state — it never touches `location.pathname`
  // — so this can never re-fight a manual expand/collapse.

  const lastAutoExpandedPathRef = useRef(null);

  useEffect(() => {
    if (lastAutoExpandedPathRef.current === location.pathname) return;
    lastAutoExpandedPathRef.current = location.pathname;

    const match = visibleMenuItems.find((item) =>
      item.subsections?.some(
        (sub) => location.pathname === sub.href
      )
    );

    if (match) {
      setExpandedSection(match.id);
    }
  }, [location.pathname, visibleMenuItems]);

  // ============================================================
  // HELPERS
  // ============================================================

  const toggleSection = (id) => {
    setExpandedSection(
      expandedSection === id ? null : id
    );
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
      "#F8B739",
      "#52C4A1",
    ];

    const hash = (name || "")
      .split("")
      .reduce(
        (acc, char) => acc + char.charCodeAt(0),
        0
      );

    return colors[hash % colors.length];
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    // Goes through AuthContext's logout() (clears token/user state
    // and the axios auth header) instead of only removing the
    // localStorage keys directly — the previous version relied on
    // window.location.href's hard reload to paper over the fact
    // that AuthContext's in-memory state was never actually cleared.
    logout();
    navigate("/");
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div
        className={`${styles.sidebarWrapper} ${
          isOpen
            ? styles.wrapperOpen
            : styles.wrapperClosed
        }`}
      >
        <aside className={styles.sidebar}>
          <div className={styles.header}>
            <div className={styles.skeletonAvatar}></div>

            {isOpen && (
              <div className={styles.skeletonText}></div>
            )}
          </div>
        </aside>
      </div>
    );
  }

  // ============================================================
  // SIDEBAR
  // ============================================================

  return (
    <>
      {/* ========================================================
          MOBILE OPEN BUTTON
      ======================================================== */}

      {!isOpen && (
        <button
          type="button"
          className={styles.mobileMenuButton}
          onClick={() => setIsOpen(true)}
          aria-label={t("sidebar.openSidebar")}
        >
          <Menu size={20} />
        </button>
      )}

      {/* ========================================================
          MOBILE OVERLAY
      ======================================================== */}

      {isOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ========================================================
          SIDEBAR WRAPPER
      ======================================================== */}

      <div
        className={`${styles.sidebarWrapper} ${
          isOpen
            ? styles.wrapperOpen
            : styles.wrapperClosed
        }`}
      >
        <aside
          className={`${styles.sidebar} ${
            isOpen
              ? styles.sidebarOpen
              : styles.sidebarClosed
          }`}
        >
          {/* ====================================================
              HEADER
          ==================================================== */}

          <div className={styles.header}>
            {user ? (
              <>
                <div
                  className={styles.avatar}
                  style={{
                    backgroundColor: getAvatarColor(
                      user?.firstName + user?.lastName
                    ),
                  }}
                >
                  <span className={styles.avatarText}>
                    {getInitials(
                      user?.firstName,
                      user?.lastName
                    )}
                  </span>
                </div>

                {isOpen && (
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      {user?.firstName} {user?.lastName}
                    </div>

                    <div className={styles.userEmail}>
                      {user?.email}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className={styles.skeletonAvatar}
                />

                {isOpen && (
                  <div className={styles.skeletonText} />
                )}
              </>
            )}

            {isOpen && (
              <Link
                to="/profile"
                className={styles.footerBtn}
                title={t("sidebar.profile")}
                onClick={() => {
                  if (window.innerWidth <= 700) {
                    setIsOpen(false);
                  }
                }}
              >
                <UserRoundCog size={16} />
              </Link>
            )}
          </div>

          {/* ====================================================
              NAVIGATION
          ==================================================== */}

          <nav className={styles.nav}>
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.id}>
                  {/* Main menu item */}

                  {item.href ? (
                    <Link
                      to={item.href}
                      className={styles.navItem}
                      onClick={() => {
                        if (
                          window.innerWidth <= 700
                        ) {
                          setIsOpen(false);
                        }
                      }}
                    >
                      <Icon
                        size={16}
                        className={styles.icon}
                      />

                      {isOpen && (
                        <span className={styles.label}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={styles.navItem}
                      onClick={() =>
                        toggleSection(item.id)
                      }
                    >
                      <Icon
                        size={16}
                        className={styles.icon}
                      />

                      {isOpen && (
                        <>
                          <span className={styles.label}>
                            {item.label}
                          </span>

                          {item.subsections && (
                            <span
                              className={styles.chevron}
                            >
                              {expandedSection ===
                              item.id ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  )}

                  {/* Subsections */}

                  {isOpen &&
                    item.subsections &&
                    expandedSection === item.id && (
                      <div
                        className={styles.subsections}
                      >
                        {item.subsections.map(
                          (sub) => {
                            const isActive =
                              location.pathname ===
                              sub.href;

                            return (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                className={`${styles.subItem} ${
                                  isActive
                                    ? styles.subItemActive
                                    : ""
                                }`}
                                onClick={() => {
                                  if (
                                    window.innerWidth <=
                                    700
                                  ) {
                                    setIsOpen(false);
                                  }
                                }}
                              >
                                <span
                                  className={
                                    styles.subDot
                                  }
                                />

                                {sub.label}
                                {sub.badge > 0 && (
                                  <span className={styles.subBadge}>{sub.badge > 99 ? "99+" : sub.badge}</span>
                                )}
                              </Link>
                            );
                          }
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </nav>

          {/* ====================================================
              FOOTER
          ==================================================== */}

          <div className={styles.footer}>
            <button
              type="button"
              onClick={handleLogout}
              className={styles.footerBtn}
              title={t("sidebar.logout")}
            >
              <LogOut size={16} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className={styles.footerBtn}
              title={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
              aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isOpen && <LanguageSwitcher />}
          </div>

          {/* ====================================================
              DESKTOP COLLAPSE BUTTON
          ==================================================== */}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={styles.toggleArrow}
            title={
              isOpen
                ? t("sidebar.closeSidebar")
                : t("sidebar.openSidebar")
            }
          >
            {isOpen ? (
              <ChevronLeft size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </aside>
      </div>
    </>
  );
}



