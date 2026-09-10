import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
} from "../../services/userService";

import { useState, useEffect } from "react";
import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import {
    canCreateUser,
    canManageUser,
    canDeleteUser,
} from "../../utils/permissions";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import SearchBar from "../../components/useful/SearchBar";
import Pagination from "../../components/useful/Pagination";
import UserCard from "../../components/user/UserCard";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import styles from "./Users.module.css";

import {
    Users as UsersIcon,
    UserPlus,
    User,
    ArrowLeft,
    Trash2,
    Edit,
} from "lucide-react";

// Cards per page. Keeping this modest (instead of loading every
// user at once) is what keeps the grid fast as the user list grows.
const USERS_PAGE_SIZE = 12;

export default function Users() {
    const { t } = useI18n();
    const { user: currentUser } = useAuth();

    const translateApiMessage = (message) => {
        const messages = {
            "Only admins can delete users":
                t("users.errors.deleteAdminOnly"),

            "User not found":
                t("users.errors.notFound"),

            "Not authorized to update this user":
                t("users.errors.updateNotAuthorized"),

            "Not authorized to change this password":
                t("users.errors.passwordNotAuthorized"),

            "Please provide firstName, lastName, email, and password":
                t("users.errors.requiredCreateFields"),

            "Please provide firstName, lastName, and email":
                t("users.errors.requiredUpdateFields"),

            "Please provide current and new password":
                t("users.errors.requiredPasswordFields"),

            "A user with this email already exists":
                t("users.errors.emailExists"),

            "Current password is incorrect":
                t("users.errors.currentPasswordIncorrect"),
        };

        return messages[message] || message;
    };

    // ========================================
    // USERS
    // ========================================

    const [users, setUsers] = useState([]);
    const [initialLoading, setInitialLoading] =
        useState(true);

    // ========================================
    // SELECTED USER
    // ========================================

    const [selectedUser, setSelectedUser] =
        useState(null);

    // ========================================
    // MODE
    // false | create | edit
    // ========================================

    const [mode, setMode] = useState(false);
    const [search, setSearch] = useState("");

    // Debounced so typing in the search box doesn't fire a network
    // request on every keystroke.
    const debouncedSearch = useDebouncedValue(search, 400);

    // ========================================
    // PAGINATION
    // Keeps the grid capped at USERS_PAGE_SIZE cards per page
    // instead of always rendering the entire user list.
    // ========================================

    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: USERS_PAGE_SIZE,
        pages: 1,
    });

    // Reset to page 1 whenever the (debounced) search term changes,
    // so a new search doesn't land on a now out-of-range page.
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    // ========================================
    // MODAL
    // ========================================

    const [modal, setModal] = useState({
        open: false,
        type: "confirm",
        title: "",
        message: "",
    });

    // ========================================
    // MODAL ACTION
    // create | edit | delete
    // ========================================

    const [modalAction, setModalAction] =
        useState(null);

    // ========================================
    // SUBMIT LOADING
    // (spinner state for the create/edit/delete confirm modal —
    // kept separate from the grid's own fetch spinner below so the
    // two never interfere with each other)
    // ========================================

    const [loading, setLoading] =
        useState(false);

    // Grid fetch spinner (search / pagination), separate from the
    // ActionModal's `loading` above.
    const [gridLoading, setGridLoading] = useState(false);

    // ========================================
    // PENDING FORM DATA
    // ========================================

    const [pendingData, setPendingData] =
        useState(null);


    // ========================================
    // LOAD USERS
    // Search/pagination are done server-side (see userService.js)
    // so the grid only ever holds one page of cards at a time.
    // ========================================

    useEffect(() => {
        let cancelled = false;

        const loadUsers = async () => {
            try {
                if (!initialLoading) {
                    setGridLoading(true);
                }

                const { users: data, pagination: paginationData } =
                    await getUsers({
                        search: debouncedSearch,
                        page,
                        limit: USERS_PAGE_SIZE,
                    });

                if (cancelled) {
                    return;
                }

                setUsers(data || []);
                setPagination(paginationData);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error(
                    "Failed to load users:",
                    error
                );

                setModal({
                    open: true,
                    type: "error",
                    title: t("users.loadFailTitle"),
                    message: translateApiMessage(
                        error.response?.data?.message ||
                        t("users.loadFailMessage")
                    ),
                });
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                    setGridLoading(false);
                }
            }
        };

        loadUsers();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, page, t]);

    // ========================================
    // FORM FIELDS
    // ========================================

    const userFields = [
        {
            name: "firstName",
            label: t("profile.firstName"),
            type: "text",
            required: true,
        },

        {
            name: "lastName",
            label: t("profile.lastName"),
            type: "text",
            required: true,
        },

        {
            name: "email",
            label: t("profile.email"),
            type: "email",
            required: true,
        },

        // Password is only needed when creating.
        // The backend update route does not change password.
        ...(mode === "create"
            ? [
                {
                    name: "password",
                    label: t("profile.password"),
                    type: "password",
                    required: true,
                    placeholder: "••••••••",
                },
            ]
            : []),

        {
            name: "role",
            label: t("users.role"),
            type: "select",
            required: true,
            options: [
                {
                    value: "admin",
                    label: t("users.roles.admin"),
                },
                {
                    value: "owner",
                    label: t("users.roles.owner"),
                },
                {
                    value: "user",
                    label: t("users.roles.user"),
                },
            ],
        },

        {
            name: "status",
            label: t("users.status"),
            type: "select",
            required: true,
            options: [
                {
                    value: "active",
                    label: t("users.statuses.active"),
                },
                {
                    value: "inactive",
                    label: t("users.statuses.inactive"),
                },
                {
                    value: "suspended",
                    label: t("users.statuses.suspended"),
                },
            ],
        },

        {
            name: "department",
            label: t("users.department"),
            type: "select",
            required: true,
            options: [
                {
                    value: "management",
                    label: t("users.departments.management"),
                },
                {
                    value: "hr",
                    label: t("users.departments.hr"),
                },
                {
                    value: "finance",
                    label: t("users.departments.finance"),
                },
                {
                    value: "accounting",
                    label: t("users.departments.accounting"),
                },
                {
                    value: "sales",
                    label: t("users.departments.sales"),
                },
                {
                    value: "purchasing",
                    label: t("users.departments.purchasing"),
                },
                {
                    value: "marketing",
                    label: t("users.departments.marketing"),
                },
                {
                    value: "production",
                    label: t("users.departments.production"),
                },
                {
                    value: "production_planning",
                    label: t("users.departments.production_planning"),
                },
                {
                    value: "quality_control",
                    label: t("users.departments.quality_control"),
                },
                {
                    value: "maintenance",
                    label: t("users.departments.maintenance"),
                },
                {
                    value: "warehouse",
                    label: t("users.departments.warehouse"),
                },
                {
                    value: "logistics",
                    label: t("users.departments.logistics"),
                },
                {
                    value: "procurement",
                    label: t("users.departments.procurement"),
                },
                {
                    value: "engineering",
                    label: t("users.departments.engineering"),
                },
                {
                    value: "design",
                    label: t("users.departments.design"),
                },
                {
                    value: "research_development",
                    label: t("users.departments.research_development"),
                },
                {
                    value: "it",
                    label: t("users.departments.it"),
                },
                {
                    value: "customer_service",
                    label: t("users.departments.customer_service"),
                },
                {
                    value: "administration",
                    label: t("users.departments.administration"),
                },
                {
                    value: "health_safety_environment",
                    label: t("users.departments.health_safety_environment"),
                },
                {
                    value: "security",
                    label: t("users.departments.security"),
                },
            ],
        },
    ];

    // ========================================
    // CREATE FORM BUTTONS
    // ========================================

    const createButtons = [
        {
            label: t("common.cancel"),
            type: "button",
            variant: "secondary",
            onClick: () => {
                setMode(false);
                setPendingData(null);
                setModalAction(null);
            },
        },

        {
            label: t("common.reset"),
            type: "reset",
            variant: "secondary",
        },

        {
            label: t("common.create"),
            type: "submit",
            variant: "primary",
        },
    ];

    // ========================================
    // EDIT FORM BUTTONS
    // ========================================

    const editButtons = [
        {
            label: t("common.cancel"),
            type: "button",
            variant: "secondary",
            onClick: () => {
                setMode(false);
                setPendingData(null);
                setModalAction(null);
            },
        },

        {
            label: t("common.reset"),
            type: "reset",
            variant: "secondary",
        },

        {
            label: t("common.update"),
            type: "submit",
            variant: "primary",
        },
    ];

    // ========================================
    // OPEN CREATE MODE
    // ========================================

    const handleCreateUser = () => {
        setSelectedUser(null);
        setMode("create");
        setPendingData(null);
        setModalAction(null);
    };

    // ========================================
    // OPEN EDIT MODE
    // ========================================

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setMode("edit");
        setPendingData(null);
        setModalAction(null);
    };

    // ========================================
    // CREATE FORM SUBMIT
    // ========================================

    const handleSubmitCreate = (data) => {
        setPendingData(data);
        setModalAction("create");

        setModal({
            open: true,
            type: "confirm",
            title: t("users.createTitle"),
            message: t("users.createSureMessage"),
        });
    };

    // ========================================
    // CONFIRM CREATE
    // ========================================

    const handleConfirmCreate = async () => {
        if (!pendingData) {
            return;
        }

        setLoading(true);

        try {
            const newUser = await createUser({
                firstName: pendingData.firstName,
                lastName: pendingData.lastName,
                email: pendingData.email,
                password: pendingData.password,
                role: pendingData.role,
                status: pendingData.status,
                department: pendingData.department,
            });

            // Add new user to list
            setUsers((prev) => [
                ...prev,
                newUser,
            ]);

            // Close create mode
            setMode(false);

            // Clear pending data
            setPendingData(null);

            // Clear modal action
            setModalAction(null);

            setLoading(false);

            setModal({
                open: true,
                type: "success",
                title: t("users.createSuccessTitle"),
                message: t("users.createSuccessMessage"),
            });

        } catch (error) {
            console.error(
                "Failed to create user:",
                error.response?.data || error
            );

            setLoading(false);

            setModal({
                open: true,
                type: "error",
                title: t("users.createFailTitle"),
                message: translateApiMessage(
                    error.response?.data?.message ||
                    error.message ||
                    t("users.createFailMessage")
                ),
            });
        }
    };

    // ========================================
    // EDIT FORM SUBMIT
    // ========================================

    const handleSubmitUpdate = (data) => {
        if (!selectedUser) {
            return;
        }

        setPendingData(data);
        setModalAction("edit");

        setModal({
            open: true,
            type: "confirm",
            title: t("users.updateTitle"),
            message: t("users.updateSureMessage"),
        });
    };

    // ========================================
    // CONFIRM UPDATE
    // ========================================

    const handleConfirmUpdate = async () => {
        if (!selectedUser || !pendingData) {
            return;
        }

        setLoading(true);

        try {
            const updatedUser = await updateUser(
                selectedUser._id,
                {
                    firstName: pendingData.firstName,
                    lastName: pendingData.lastName,
                    email: pendingData.email,
                    role: pendingData.role,
                    status: pendingData.status,
                    department: pendingData.department,
                }
            );

            // Update user inside users list
            setUsers((prev) =>
                prev.map((user) =>
                    user._id === updatedUser._id
                        ? updatedUser
                        : user
                )
            );

            // Update selected user
            setSelectedUser(updatedUser);

            // Close edit mode
            setMode(false);

            // Clear pending data
            setPendingData(null);

            // Clear modal action
            setModalAction(null);

            setLoading(false);

            setModal({
                open: true,
                type: "success",
                title: t("users.updateSuccessTitle"),
                message: t("users.updateSuccessMessage"),
            });

        } catch (error) {
            console.error(
                "Failed to update user:",
                error.response?.data || error
            );

            setLoading(false);

            setModal({
                open: true,
                type: "error",
                title: t("users.updateFailTitle"),
                message: translateApiMessage(
                    error.response?.data?.message ||
                    error.message ||
                    t("users.updateFailMessage")
                ),
            });
        }
    };

    // ========================================
    // DELETE USER
    // Accepts the target user explicitly so this can be triggered
    // both from the detail view's Danger Zone (passing
    // `selectedUser`) and directly from a card in the grid
    // (passing that card's `user`), without forcing navigation
    // into the detail view first.
    // ========================================

    const [deleteTarget, setDeleteTarget] = useState(null);

    const handleDeleteUser = (user) => {
        const target = user || selectedUser;

        if (!target) {
            return;
        }

        setDeleteTarget(target);
        setModalAction("delete");

        setModal({
            open: true,
            type: "confirm",
            title: t("users.deleteTitle"),
            message: t("users.deleteSureMessage"),
        });
    };

    // ========================================
    // CONFIRM DELETE
    // ========================================

    const handleConfirmDelete = async () => {
        if (!deleteTarget) {
            return;
        }

        setLoading(true);

        try {
            await deleteUser(deleteTarget._id);

            // Remove deleted user from list
            setUsers((prev) =>
                prev.filter(
                    (user) =>
                        user._id !== deleteTarget._id
                )
            );

            // Clear selected user if we deleted the one being viewed
            setSelectedUser((prev) =>
                prev && prev._id === deleteTarget._id ? null : prev
            );

            // Clear delete target
            setDeleteTarget(null);

            // Clear modal action
            setModalAction(null);

            setLoading(false);

            setModal({
                open: true,
                type: "success",
                title: t("users.deleteSuccessTitle"),
                message: t("users.deleteSuccessMessage"),
            });

        } catch (error) {
            console.error(
                "Failed to delete user:",
                error.response?.data || error
            );

            setLoading(false);

            setModal({
                open: true,
                type: "error",
                title: t("users.deleteFailTitle"),
                message: translateApiMessage(
                    error.response?.data?.message ||
                    error.message ||
                    t("users.deleteFailMessage")
                ),
            });
        }
    };

    // ========================================
    // CONFIRM MODAL ACTION
    // ========================================

    const handleConfirm = async () => {
        if (modalAction === "create") {
            await handleConfirmCreate();
            return;
        }

        if (modalAction === "edit") {
            await handleConfirmUpdate();
            return;
        }

        if (modalAction === "delete") {
            await handleConfirmDelete();
            return;
        }
    };

    // ========================================
    // CLOSE MODAL
    // ========================================

    const handleCloseModal = () => {
        if (loading) {
            return;
        }

        setModal((prev) => ({
            ...prev,
            open: false,
        }));

        if (modal.type === "confirm") {
            setPendingData(null);
            setModalAction(null);
            setDeleteTarget(null);
        }
    };

    // ========================================
    // BREADCRUMB NAVIGATION
    // ========================================

    const handleBreadcrumbNavigate = (item) => {
        if (!item) {
            return;
        }

        if (item.id === "users") {
            setSelectedUser(null);
            setMode(false);
            setPendingData(null);
            setModalAction(null);
        }
    };

    // ========================================
    // FORMAT STATUS
    // ========================================

    const getStatusLabel = (status) => {
        switch (status) {
            case "active":
                return t("users.statuses.active");

            case "inactive":
                return t("users.statuses.inactive");

            case "suspended":
                return t("users.statuses.suspended");

            default:
                return status || "—";
        }
    };

    // ========================================
    // FORMAT ROLE
    // ========================================

    const getRoleLabel = (role) => {
        switch (role) {
            case "admin":
                return t("users.roles.admin");

            case "owner":
                return t("users.roles.owner");

            case "user":
                return t("users.roles.user");

            default:
                return role || "—";
        }
    };

    // ========================================
    // FORMAT DEPARTMENT
    // ========================================

    const getDepartmentLabel = (department) => {
        if (!department) {
            return "—";
        }

        return t(`users.departments.${department}`);
    };

    // ========================================
    // INITIAL LOADING
    // ========================================

    if (initialLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    {t("common.loading")}
                </div>
            </div>
        );
    }

    // ========================================
    // CREATE USER
    // ========================================

    if (mode === "create") {
        return (
            <div className={styles.page}>

                <Breadcrumbs
                    items={[
                        {
                            id: "users",
                            label: t("users.title"),
                        },
                        {
                            id: "create",
                            label: t("users.addUser"),
                        },
                    ]}
                    onNavigate={
                        handleBreadcrumbNavigate
                    }
                />

                <div className={styles.header}>
                    <div>
                        <div className={styles.titleRow}>
                            <UserPlus size={20} />

                            <h1>
                                {t("users.addUser")}
                            </h1>
                        </div>

                        <p className={styles.subtitle}>
                            {t("users.createSubtitle")}
                        </p>
                    </div>
                </div>

                <div className={styles.formContainer}>
                    <CollapsibleForm
                        title={t("users.newUser")}
                        icon={
                            <UserPlus size={16} />
                        }
                        fields={userFields}
                        buttons={createButtons}
                        onSubmit={handleSubmitCreate}
                        defaultOpen={true}
                        initialValues={{
                            firstName: "",
                            lastName: "",
                            email: "",
                            password: "",
                            role: "user",
                            status: "active",
                            department: "administration",
                        }}
                    />
                </div>

                <ActionModal
                    isOpen={modal.open}
                    type={modal.type}
                    title={modal.title}
                    message={modal.message}
                    loading={loading}
                    onConfirm={handleConfirm}
                    onClose={handleCloseModal}
                />

            </div>
        );
    }

    // ========================================
    // EDIT USER
    // ========================================

    if (mode === "edit" && selectedUser) {
        return (
            <div className={styles.page}>

                <Breadcrumbs
                    items={[
                        {
                            id: "users",
                            label: t("users.title"),
                        },
                        {
                            id: selectedUser._id,
                            label:
                                `${selectedUser.firstName} ${selectedUser.lastName}`,
                        },
                        {
                            id: "edit",
                            label: t("users.editUser"),
                        },
                    ]}
                    onNavigate={
                        handleBreadcrumbNavigate
                    }
                />

                <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => {
                        setMode(false);
                        setPendingData(null);
                        setModalAction(null);
                    }}
                >
                    <ArrowLeft size={16} />

                    {t("users.backToUsers")}
                </button>

                <div className={styles.header}>
                    <div>
                        <div className={styles.titleRow}>
                            <Edit size={20} />

                            <h1>
                                {t("users.editUser")}
                            </h1>
                        </div>

                        <p className={styles.subtitle}>
                            {t("users.editSubtitle")}
                        </p>
                    </div>
                </div>

                <div className={styles.formContainer}>
                    <CollapsibleForm
                        title={`${selectedUser.firstName} ${selectedUser.lastName}`}
                        icon={
                            <Edit size={16} />
                        }
                        fields={userFields}
                        buttons={editButtons}
                        onSubmit={handleSubmitUpdate}
                        defaultOpen={true}
                        initialValues={{
                            firstName:
                                selectedUser.firstName || "",
                            lastName:
                                selectedUser.lastName || "",
                            email:
                                selectedUser.email || "",
                            role:
                                selectedUser.role || "user",
                            status:
                                selectedUser.status || "active",
                            department:
                                selectedUser.department ||
                                "administration",
                        }}
                    />
                </div>

                <ActionModal
                    isOpen={modal.open}
                    type={modal.type}
                    title={modal.title}
                    message={modal.message}
                    loading={loading}
                    onConfirm={handleConfirm}
                    onClose={handleCloseModal}
                />

            </div>
        );
    }

    // ========================================
    // USER DETAIL
    // ========================================

    if (selectedUser) {
        return (
            <div className={styles.page}>

                <Breadcrumbs
                    items={[
                        {
                            id: "users",
                            label: t("users.title"),
                        },
                        {
                            id: selectedUser._id,
                            label:
                                `${selectedUser.firstName} ${selectedUser.lastName}`,
                        },
                    ]}
                    onNavigate={
                        handleBreadcrumbNavigate
                    }
                />

                <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => {
                        setSelectedUser(null);
                        setModalAction(null);
                    }}
                >
                    <ArrowLeft size={16} />

                    {t("users.backToUsers")}
                </button>

                <div className={styles.userDetail}>

                    {/* ==================================
                        HEADER
                    ================================== */}

                    <div className={styles.detailHeader}>

                        <div className={styles.avatarLarge}>
                            <User size={30} />
                        </div>

                        <div>
                            <h1>
                                {selectedUser.firstName}{" "}
                                {selectedUser.lastName}
                            </h1>

                            <p>
                                {selectedUser.email}
                            </p>
                        </div>

                        {canManageUser(currentUser, selectedUser) && (
                            <button
                                type="button"
                                className={styles.editDetailButton}
                                onClick={() =>
                                    handleEditUser(selectedUser)
                                }
                            >
                                <Edit size={16} />

                                {t("common.edit")}
                            </button>
                        )}

                    </div>

                    {/* ==================================
                        INFORMATION
                    ================================== */}

                    <div className={styles.section}>

                        <h2>
                            {t("users.information")}
                        </h2>

                        <div className={styles.grid}>

                            <div className={styles.info}>
                                <span>
                                    {t("profile.firstName")}
                                </span>

                                <strong>
                                    {
                                        selectedUser.firstName ||
                                        "—"
                                    }
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("profile.lastName")}
                                </span>

                                <strong>
                                    {
                                        selectedUser.lastName ||
                                        "—"
                                    }
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("profile.email")}
                                </span>

                                <strong>
                                    {
                                        selectedUser.email ||
                                        "—"
                                    }
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("users.role")}
                                </span>

                                <strong>
                                    {getRoleLabel(
                                        selectedUser.role
                                    )}
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("users.department")}
                                </span>

                                <strong>
                                    {getDepartmentLabel(
                                        selectedUser.department
                                    )}
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("users.status")}
                                </span>

                                <strong>
                                    {getStatusLabel(
                                        selectedUser.status
                                    )}
                                </strong>
                            </div>

                            <div className={styles.info}>
                                <span>
                                    {t("users.userId")}
                                </span>

                                <strong>
                                    {
                                        selectedUser._id ||
                                        "—"
                                    }
                                </strong>
                            </div>

                        </div>

                    </div>

                    {/* ==================================
                        DANGER ZONE
                    ================================== */}

                    {canDeleteUser(currentUser, selectedUser) && (
                        <div className={styles.dangerZone}>

                            <button
                                type="button"
                                className={
                                    styles.deleteButton
                                }
                                onClick={() =>
                                    handleDeleteUser(selectedUser)
                                }
                            >
                                <Trash2 size={16} />

                                {t("users.deleteUser")}
                            </button>

                        </div>
                    )}

                </div>

                {/* ==================================
                    ACTION MODAL
                ================================== */}

                <ActionModal
                    isOpen={modal.open}
                    type={modal.type}
                    title={modal.title}
                    message={modal.message}
                    loading={loading}
                    onConfirm={handleConfirm}
                    onClose={handleCloseModal}
                />

            </div>
        );
    }

    // ========================================
    // MAIN USERS PAGE
    // ========================================

    return (
        <div className={styles.page}>

            {/* ==================================
                BREADCRUMBS
            ================================== */}

            <Breadcrumbs
                items={[
                    {
                        id: "users",
                        label: t("users.title"),
                    },
                ]}
                onNavigate={
                    handleBreadcrumbNavigate
                }
            />

            {/* ==================================
                HEADER
            ================================== */}

            <div className={styles.header}>

                <div>
                    <div className={styles.titleRow}>
                        <UsersIcon size={20} />

                        <h1>
                            {t("users.title")}
                        </h1>
                    </div>

                    <p className={styles.subtitle}>
                        {t("users.subtitle")}
                    </p>
                </div>

                {canCreateUser(currentUser) && (
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleCreateUser}
                    >
                        <UserPlus size={16} />

                        {t("users.addUser")}
                    </button>
                )}

            </div>

            {/* ==================================
                TOOLBAR (always visible once loaded, so the
                search box stays available even when a search
                returns zero results)
            ================================== */}

            {!initialLoading && (
                <div className={styles.toolbar}>
                    <div className={styles.searchWrapper}>
                        <SearchBar
                            placeholder={t("users.toolbar.searchPlaceholder")}
                            onSearch={setSearch}
                            onClear={() => setSearch("")}
                            isLoading={loading}
                        />
                    </div>
                </div>
            )}

            {/* ==================================
                EMPTY STATE
            ================================== */}

            {users.length === 0 && (
                <div className={styles.emptyState}>

                    <div className={styles.emptyIcon}>
                        <UsersIcon size={28} />
                    </div>

                    <h2>
                        {search
                            ? t("users.emptySearchTitle")
                            : t("users.emptyTitle")}
                    </h2>

                    <p>
                        {search
                            ? t("users.emptySearchMessage")
                            : t("users.emptyMessage")}
                    </p>

                    {!search && canCreateUser(currentUser) && (
                        <button
                            type="button"
                            className={
                                styles.primaryButton
                            }
                            onClick={handleCreateUser}
                        >
                            <UserPlus size={16} />

                            {t("users.addUser")}
                        </button>
                    )}

                </div>
            )}

            {/* ==================================
                USERS LIST
            ================================== */}

            {users.length > 0 && (
                <>
                    <div className={styles.usersGrid}>

                        {users.map((user) => (
                            <UserCard
                                key={user._id}
                                user={user}
                                canEdit={canManageUser(currentUser, user)}
                                canDelete={canDeleteUser(currentUser, user)}
                                onSelect={setSelectedUser}
                                onEdit={handleEditUser}
                                onDelete={handleDeleteUser}
                                getRoleLabel={getRoleLabel}
                                getDepartmentLabel={getDepartmentLabel}
                                getStatusLabel={getStatusLabel}
                                editLabel={t("users.editUser")}
                                deleteLabel={t("users.deleteUser")}
                            />
                        ))}

                    </div>

                    <Pagination
                        page={pagination.page}
                        pages={pagination.pages}
                        total={pagination.total}
                        limit={pagination.limit}
                        onPageChange={setPage}
                    />
                </>
            )}

            {/* ==================================
                ACTION MODAL
            ================================== */}

            <ActionModal
                isOpen={modal.open}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                loading={loading}
                onConfirm={handleConfirm}
                onClose={handleCloseModal}
            />

        </div>
    );
}