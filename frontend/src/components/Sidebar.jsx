import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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
import api from "../services/api";
import styles from "./Sidebar.module.css";
import LanguageSwitcher from "./useful/LanguageSwitcher";
import { canAccessHR } from "../utils/permissions";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSection, setExpandedSection] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const { t } = useI18n();
  const location = useLocation();

  // ============================================================
  // FETCH CURRENT USER
  // ============================================================

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setLoading(false);
          return;
        }

        const response = await api.get("/users/me");

        if (response.data.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        console.error(
          "Error fetching user:",
          error.response?.data || error.message
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

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
  const visibleMenuItems = menuItems.filter(
    (item) => !item.permission || item.permission(user)
  );

  // ============================================================
  // AUTO EXPAND ACTIVE SECTION
  // ============================================================

  useEffect(() => {
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
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "/";
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



