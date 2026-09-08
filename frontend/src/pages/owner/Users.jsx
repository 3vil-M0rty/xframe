import {
    getUsers,
    createUser,
    deleteUser,
} from "../../services/userService";

import { useState, useEffect } from "react";
import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";
import Breadcrumbs from "../../components/useful/Breadcrumbs";

import styles from "./Users.module.css";

import {
    Users as UsersIcon,
    UserPlus,
    User,
    Mail,
    Shield,
    ArrowLeft,
    Trash2,
} from "lucide-react";

export default function Users() {
    const { t } = useI18n();

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
    // ========================================

    const [mode, setMode] = useState(false);

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
    // ========================================

    const [modalAction, setModalAction] =
        useState(null);

    // ========================================
    // SUBMIT LOADING
    // ========================================

    const [loading, setLoading] =
        useState(false);

    // ========================================
    // PENDING FORM DATA
    // ========================================

    const [pendingData, setPendingData] =
        useState(null);

    // ========================================
    // LOAD USERS
    // ========================================

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await getUsers();

                setUsers(data || []);
            } catch (error) {
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
                setInitialLoading(false);
            }
        };

        loadUsers();
    }, [t]);

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

        {
            name: "password",
            label: t("profile.password"),
            type: "password",
            required: true,
            placeholder: "••••••••",
        },

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
    ];

    // ========================================
    // FORM BUTTONS
    // ========================================

    const userButtons = [
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
    // FORM SUBMIT
    // ========================================

    const handleSubmit = (data) => {
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
    // DELETE USER
    // ========================================

    const handleDeleteUser = () => {
        if (!selectedUser) {
            return;
        }

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
        if (!selectedUser) {
            return;
        }

        setLoading(true);

        try {
            await deleteUser(selectedUser._id);

            // Remove deleted user from list
            setUsers((prev) =>
                prev.filter(
                    (user) =>
                        user._id !== selectedUser._id
                )
            );

            // Clear selected user
            setSelectedUser(null);

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
                        buttons={userButtons}
                        onSubmit={handleSubmit}
                        defaultOpen={true}
                        initialValues={{
                            firstName: "",
                            lastName: "",
                            email: "",
                            password: "",
                            role: "user",
                            status: "active",
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

                    <div className={styles.dangerZone}>

                        <button
                            type="button"
                            className={
                                styles.deleteButton
                            }
                            onClick={
                                handleDeleteUser
                            }
                        >
                            <Trash2 size={16} />

                            {t("users.deleteUser")}
                        </button>

                    </div>

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

                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() =>
                        setMode("create")
                    }
                >
                    <UserPlus size={16} />

                    {t("users.addUser")}
                </button>

            </div>

            {/* ==================================
                EMPTY STATE
            ================================== */}

            {users.length === 0 && (
                <div className={styles.emptyState}>

                    <div className={styles.emptyIcon}>
                        <UsersIcon size={28} />
                    </div>

                    <h2>
                        {t("users.emptyTitle")}
                    </h2>

                    <p>
                        {t("users.emptyMessage")}
                    </p>

                    <button
                        type="button"
                        className={
                            styles.primaryButton
                        }
                        onClick={() =>
                            setMode("create")
                        }
                    >
                        <UserPlus size={16} />

                        {t("users.addUser")}
                    </button>

                </div>
            )}

            {/* ==================================
                USERS LIST
            ================================== */}

            {users.length > 0 && (
                <div className={styles.usersGrid}>

                    {users.map((user) => (
                        <button
                            type="button"
                            key={user._id}
                            className={styles.userCard}
                            onClick={() =>
                                setSelectedUser(user)
                            }
                        >

                            {/* AVATAR */}

                            <div className={styles.avatar}>
                                <User size={20} />
                            </div>

                            {/* USER INFO */}

                            <div className={styles.userMain}>

                                <h2>
                                    {user.firstName}{" "}
                                    {user.lastName}
                                </h2>

                                <div
                                    className={
                                        styles.email
                                    }
                                >
                                    <Mail size={13} />

                                    {user.email}
                                </div>

                            </div>

                            {/* ROLE */}

                            <div
                                className={
                                    styles.role
                                }
                            >
                                <Shield size={13} />

                                {getRoleLabel(
                                    user.role
                                )}
                            </div>

                            {/* STATUS */}

                            <div
                                className={
                                    styles.status
                                }
                            >
                                {getStatusLabel(
                                    user.status
                                )}
                            </div>

                        </button>
                    ))}

                </div>
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