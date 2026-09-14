import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
    Settings2,
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
import {
    canAccessHR,
    canSelfService,
} from "../utils/permissions";

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(true);
    const [expandedSection, setExpandedSection] = useState(null);

    const { user, loading, logout } = useAuth();

    const { t } = useI18n();
    const location = useLocation();
    const navigate = useNavigate();

    // ============================================================
    // MENU
    // ============================================================

    const menuItems = useMemo(
        () => [
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
        ],
        [t]
    );

    // ============================================================
    // VISIBLE MENU ITEMS
    // ============================================================

    const visibleMenuItems = useMemo(
        () =>
            menuItems.filter(
                (item) =>
                    !item.permission ||
                    item.permission(user)
            ),
        [menuItems, user]
    );

    // ============================================================
    // AUTO EXPAND ACTIVE SECTION
    // ============================================================

    useEffect(() => {
        const match = visibleMenuItems.find((item) =>
            item.subsections?.some(
                (sub) =>
                    location.pathname === sub.href
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
        setExpandedSection((current) =>
            current === id ? null : id
        );
    };

    const handleNavigation = (href) => {
        if (!href) return;

        navigate(href);

        if (window.innerWidth <= 700) {
            setIsOpen(false);
        }
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
                (acc, char) =>
                    acc + char.charCodeAt(0),
                0
            );

        return colors[hash % colors.length];
    };

    // ============================================================
    // LOGOUT
    // ============================================================

    const handleLogout = () => {
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
                        <div
                            className={
                                styles.skeletonAvatar
                            }
                        />

                        {isOpen && (
                            <div
                                className={
                                    styles.skeletonText
                                }
                            />
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
            {!isOpen && (
                <button
                    type="button"
                    className={styles.mobileMenuButton}
                    onClick={() => setIsOpen(true)}
                    aria-label={t(
                        "sidebar.openSidebar"
                    )}
                >
                    <Menu size={20} />
                </button>
            )}

            {isOpen && (
                <div
                    className={styles.mobileOverlay}
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

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
                    {/* HEADER */}

                    <div className={styles.header}>
                        {user ? (
                            <>
                                <div
                                    className={styles.avatar}
                                    style={{
                                        backgroundColor:
                                            getAvatarColor(
                                                user?.firstName +
                                                    user?.lastName
                                            ),
                                    }}
                                >
                                    <span
                                        className={
                                            styles.avatarText
                                        }
                                    >
                                        {getInitials(
                                            user?.firstName,
                                            user?.lastName
                                        )}
                                    </span>
                                </div>

                                {isOpen && (
                                    <div
                                        className={
                                            styles.userInfo
                                        }
                                    >
                                        <div
                                            className={
                                                styles.userName
                                            }
                                        >
                                            {user?.firstName}{" "}
                                            {user?.lastName}
                                        </div>

                                        <div
                                            className={
                                                styles.userEmail
                                            }
                                        >
                                            {user?.email}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div
                                    className={
                                        styles.skeletonAvatar
                                    }
                                />

                                {isOpen && (
                                    <div
                                        className={
                                            styles.skeletonText
                                        }
                                    />
                                )}
                            </>
                        )}

                        {isOpen && (
                            <button
                                type="button"
                                className={styles.footerBtn}
                                title={t(
                                    "sidebar.profile"
                                )}
                                onClick={() =>
                                    handleNavigation(
                                        "/profile"
                                    )
                                }
                            >
                                <UserRoundCog size={16} />
                            </button>
                        )}
                    </div>

                    {/* NAVIGATION */}

                    <nav className={styles.nav}>
                        {visibleMenuItems.map((item) => {
                            const Icon = item.icon;

                            return (
                                <div key={item.id}>
                                    {/* MAIN MENU */}

                                    {item.href ? (
                                        <button
                                            type="button"
                                            className={
                                                styles.navItem
                                            }
                                            onClick={() =>
                                                handleNavigation(
                                                    item.href
                                                )
                                            }
                                        >
                                            <Icon
                                                size={16}
                                                className={
                                                    styles.icon
                                                }
                                            />

                                            {isOpen && (
                                                <span
                                                    className={
                                                        styles.label
                                                    }
                                                >
                                                    {item.label}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className={
                                                styles.navItem
                                            }
                                            onClick={() =>
                                                toggleSection(
                                                    item.id
                                                )
                                            }
                                        >
                                            <Icon
                                                size={16}
                                                className={
                                                    styles.icon
                                                }
                                            />

                                            {isOpen && (
                                                <>
                                                    <span
                                                        className={
                                                            styles.label
                                                        }
                                                    >
                                                        {item.label}
                                                    </span>

                                                    {item.subsections && (
                                                        <span
                                                            className={
                                                                styles.chevron
                                                            }
                                                        >
                                                            {expandedSection ===
                                                            item.id ? (
                                                                <ChevronDown
                                                                    size={
                                                                        14
                                                                    }
                                                                />
                                                            ) : (
                                                                <ChevronRight
                                                                    size={
                                                                        14
                                                                    }
                                                                />
                                                            )}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {/* SUBSECTIONS */}

                                    {isOpen &&
                                        item.subsections &&
                                        expandedSection ===
                                            item.id && (
                                            <div
                                                className={
                                                    styles.subsections
                                                }
                                            >
                                                {item.subsections.map(
                                                    (sub) => {
                                                        const isActive =
                                                            location.pathname ===
                                                            sub.href;

                                                        return (
                                                            <button
                                                                key={
                                                                    sub.href
                                                                }
                                                                type="button"
                                                                className={`${styles.subItem} ${
                                                                    isActive
                                                                        ? styles.subItemActive
                                                                        : ""
                                                                }`}
                                                                onClick={() =>
                                                                    handleNavigation(
                                                                        sub.href
                                                                    )
                                                                }
                                                            >
                                                                <span
                                                                    className={
                                                                        styles.subDot
                                                                    }
                                                                />

                                                                {
                                                                    sub.label
                                                                }
                                                            </button>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* FOOTER */}

                    <div className={styles.footer}>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className={`${styles.footerBtn} logoutBtn`}
                            title={t(
                                "sidebar.logout"
                            )}
                        >
                            <LogOut size={16} />
                        </button>

                        {isOpen && (
                            <LanguageSwitcher />
                        )}
                    </div>

                    {/* DESKTOP COLLAPSE */}

                    <button
                        type="button"
                        onClick={() =>
                            setIsOpen(!isOpen)
                        }
                        className={
                            styles.toggleArrow
                        }
                        title={
                            isOpen
                                ? t(
                                      "sidebar.closeSidebar"
                                  )
                                : t(
                                      "sidebar.openSidebar"
                                  )
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