import { useState, useEffect, useMemo, useRef } from "react";
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
} from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import styles from "./Sidebar.module.css";
import LanguageSwitcher from "./useful/LanguageSwitcher";
import { canAccessHR, canSelfService } from "../utils/permissions";

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
  const location = useLocation();
  const navigate = useNavigate();

  // ============================================================
  // MENU
  // ============================================================

  const menuItems = [
    {
      id: "organization",
      label: t("sidebar.organization"),
      icon: Settings2,
      subsections: [
        {
          label: t("sidebar.company"),
          href: "/organization/company",
        },
        {
          label: t("sidebar.users"),
          href: "/organization/users",
        },
        {
          label: t("sidebar.workSchedule"),
          href: "/organization/work-schedule",
        },
        {
          label: t("sidebar.departments"),
          href: "/organization/departments",
        },
        {
          label: t("sidebar.jobPositions"),
          href: "/organization/job-positions",
        },
        {
          label: t("sidebar.rolesPermissions"),
          href: "/organization/roles-permissions",
        },
        {
          label: t("sidebar.locations"),
          href: "/organization/locations",
        },
        {
          label: t("sidebar.documents"),
          href: "/organization/documents",
        },
        {
          label: t("sidebar.preferences"),
          href: "/organization/preferences",
        },
        {
          label: t("sidebar.integrations"),
          href: "/organization/integrations",
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
        },
        {
          label: t("sidebar.salaries"),
          href: "/hr/salaries",
        },
        {
          label: t("sidebar.absences"),
          href: "/hr/absences",
        },
        {
          label: t("sidebar.advances"),
          href: "/hr/advances",
        },
        {
          label: t("sidebar.payroll"),
          href: "/hr/payroll",
        },
        {
          label: t("sidebar.contracts"),
          href: "/hr/contracts",
        },
        {
          label: t("sidebar.employeeDocuments"),
          href: "/hr/documents",
        },
        {
          label: t("sidebar.attendance"),
          href: "/hr/attendance",
        },
        {
          label: t("sidebar.orgChart"),
          href: "/hr/org-chart",
        },
        {
          label: t("sidebar.reports"),
          href: "/hr/reports",
        },
        {
          label: t("sidebar.auditLog"),
          href: "/hr/audit-log",
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
  const permissionKey = `${user?.role || ""}:${user?.department || ""}:${user?.employee || ""}`;
  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => !item.permission || item.permission(user)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionKey]
  );

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



