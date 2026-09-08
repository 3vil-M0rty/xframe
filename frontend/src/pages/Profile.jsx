import {
  getCurrentUser,
  updateUser,
  changePassword,
} from "../services/userService";

import { useState, useEffect } from "react";
import { useI18n } from "../hooks/useI18n";

import CollapsibleForm from "../components/useful/CollapsibleForm";
import ActionModal from "../components/useful/ActionModal";
import styles from "./Profile.module.css"
import { Cog, FileUser } from "lucide-react";

export default function Profile() {
  const { t } = useI18n();

  // ========================================
  // USER
  // ========================================

  const [user, setUser] = useState(null);

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
  // LOADING
  // ========================================

  const [loading, setLoading] = useState(false);

  // Stores the form data while the
  // confirmation modal is open
  const [pendingData, setPendingData] = useState(null);

  // ========================================
  // LOAD CURRENT USER
  // ========================================

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getCurrentUser();

        setUser(userData);
      } catch (error) {
        console.error("Failed to load user:", error);

        setModal({
          open: true,
          type: "error",
          title: "Failed to Load Profile",
          message:
            error.response?.data?.message ||
            "We couldn't load your profile. Please try again.",
        });
      }
    };

    loadUser();
  }, []);

  // ========================================
  // FORM FIELDS
  // ========================================

  if (!user) {
    return <p>Loading...</p>;
  }

  const profileFields = [
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
      name: "currentPassword",
      label: t("profile.currentPassword"),
      type: "password",
      placeholder: "••••••••",
    },

    {
      name: "newPassword",
      label: t("profile.newPassword"),
      type: "password",
      placeholder: "••••••••",
    },
  ];

  // ========================================
  // FORM BUTTONS
  // ========================================

  const profileButtons = [
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
  // FORM SUBMIT
  // ========================================
  //
  // IMPORTANT:
  // We DON'T call the API here.
  //
  // We first save the data and open
  // the confirmation modal.
  // ========================================

  const handleSubmit = (data) => {
    setPendingData(data);

    setModal({
      open: true,
      type: "confirm",
      title: `${t('common.update')} ${t('sidebar.profile')}`,
      message: t('profile.updateSureMessage'),
    });
  };

  // ========================================
  // CONFIRM ACTION
  // ========================================

  const handleConfirm = async () => {
    if (!pendingData) {
      return;
    }

    setLoading(true);

    try {
      // ------------------------------------
      // UPDATE PROFILE
      // ------------------------------------

      const updatedUser = await updateUser(user._id, {
        firstName: pendingData.firstName,
        lastName: pendingData.lastName,
        email: pendingData.email,
      });

      setUser(updatedUser);

      // ------------------------------------
      // CHANGE PASSWORD
      // ------------------------------------

      const wantsToChangePassword =
        pendingData.currentPassword ||
        pendingData.newPassword;

      if (wantsToChangePassword) {
        // Both passwords are required
        if (
          !pendingData.currentPassword ||
          !pendingData.newPassword
        ) {
          throw new Error(
            t('profile.bothPasswords')
          );
        }

        await changePassword(user._id, {
          currentPassword: pendingData.currentPassword,
          newPassword: pendingData.newPassword,
        });
      }

      // ------------------------------------
      // SUCCESS
      // ------------------------------------

      setLoading(false);

      setPendingData(null);

      setModal({
        open: true,
        type: "success",
        title: `${t('common.update')} ${t('common.success')}`,
        message:
          t('profile.updateSuccessMessage'),
      });
    } catch (error) {
      console.error(
        "Failed to update profile:",
        error.response?.data || error
      );

      // ------------------------------------
      // ERROR
      // ------------------------------------

      setLoading(false);

      setModal({
        open: true,
        type: "error",
        title: `${t('common.update')} ${t('common.fail')}`,
        message:
          error.response?.data?.message ||
          error.message ||
          t('profile.updateFailMessage')
      });
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

    // Clear pending data when cancelling
    if (modal.type === "confirm") {
      setPendingData(null);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      <h1>
        {t("common.welcome")}, {user.firstName}, {user.role}
      </h1>

      <div className={styles.rows}>
        <CollapsibleForm
          title={t("profile.settings")}
          icon={<Cog size={16} />}
          fields={profileFields}
          buttons={profileButtons}
          onSubmit={handleSubmit}
          initialValues={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currentPassword: "",
            newPassword: "",
          }}
        />

        {/* <CollapsibleForm
          title={t("profile.info")}
          icon={<FileUser size={16} />}
          fields={employeeFields}
          buttons={employeeButtons}
          onSubmit={handleSubmit}
          initialValues={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currentPassword: "",
            newPassword: "",
          }}
        /> */}
      </div>


      {/* ==================================
          ACTION RESULT MODAL
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
    </>
  );
}