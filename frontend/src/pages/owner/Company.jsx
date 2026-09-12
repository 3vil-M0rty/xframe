import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  uploadCompanyLogo,
} from "../../services/companyService";

import { useState, useEffect } from "react";
import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import {
  canCreateCompany,
  canManageCompany,
} from "../../utils/permissions";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";

import styles from "./Company.module.css";

import {
  Building2,
  Users,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

export default function Company() {
  const { t } = useI18n();
  const { user } = useAuth();

  // ========================================
  // TRANSLATE BACKEND MESSAGES
  // ========================================

  const translateApiMessage = (message) => {
    const messages = {
      "Company not found":
        t("company.errors.notFound"),

      "Not authorized to view this company":
        t("company.errors.viewNotAuthorized"),

      "Not authorized to update this company":
        t("company.errors.updateNotAuthorized"),

      "Not authorized to delete this company":
        t("company.errors.deleteNotAuthorized"),

      "A company with this ICE, tax ID, registration number, or CNSS number already exists":
        t("company.errors.duplicateCompany"),

      "Error creating company":
        t("company.errors.createFailed"),

      "Error updating company":
        t("company.errors.updateFailed"),

      "Error deleting company":
        t("company.errors.deleteFailed"),

      "Company logo not found":
        t("company.errors.logoNotFound"),

      "Please select a logo":
        t("company.errors.logoRequired"),

      "Error uploading company logo":
        t("company.errors.logoUploadFailed"),

      "Error deleting company logo":
        t("company.errors.logoDeleteFailed"),
    };

    return messages[message] || message;
  };

  // ========================================
  // COMPANY
  // ========================================

  const [company, setCompany] = useState(null);

  const [initialLoading, setInitialLoading] =
    useState(true);

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

  // Possible values:
  //
  // "save"
  // "delete"

  // ========================================
  // SUBMIT LOADING
  // ========================================

  const [loading, setLoading] = useState(false);

  // ========================================
  // PENDING FORM DATA
  // ========================================

  const [pendingData, setPendingData] =
    useState(null);

  // ========================================
  // LOAD COMPANY
  // ========================================

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const companies = await getCompanies();

        setCompany(companies?.[0] || null);
      } catch (error) {
        console.error(
          "Failed to load company:",
          error
        );

        setModal({
          open: true,
          type: "error",
          title: t("company.loadFailTitle"),
          message: translateApiMessage(
            error.response?.data?.message ||
            t("company.loadFailMessage")
          ),
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadCompany();
  }, [t]);

  // ========================================
  // FORM FIELDS
  // ========================================

  const companyFields = [
    {
      name: "name",
      label: t("company.name"),
      type: "text",
      required: true,
    },

    {
      name: "tradeName",
      label: t("company.tradeName"),
      type: "text",
    },

    {
      name: "legalForm",
      label: t("company.legalForm"),
      type: "select",
      required: true,
      options: [
        "SARL",
        "SARL_AU",
        "SA",
        "SAS",
        "SASU",
        "SNC",
        "SCS",
        "SCA",
        "SP",
        "COOPERATIVE",
        "ASSOCIATION",
        "OTHER",
      ],
    },

    {
      name: "industry",
      label: t("company.industry"),
      type: "text",
      required: true,
    },

    {
      name: "ice",
      label: t("company.ice"),
      type: "text",
      placeholder: "000000000000000",
    },

    {
      name: "taxId",
      label: t("company.taxId"),
      type: "text",
    },

    {
      name: "registrationNumber",
      label: t("company.registrationNumber"),
      type: "text",
    },

    {
      name: "email",
      label: t("company.email"),
      type: "email",
    },

    {
      name: "phone",
      label: t("company.phone"),
      type: "text",
      placeholder: "+212 6XX XXX XXX",
    },

    {
      name: "website",
      label: t("company.website"),
      type: "text",
    },

    {
      name: "street",
      label: t("company.street"),
      type: "text",
    },

    {
      name: "city",
      label: t("company.city"),
      type: "text",
    },

    {
      name: "postalCode",
      label: t("company.postalCode"),
      type: "text",
    },

    // ========================================
    // COMPANY LOGO
    // ========================================

    {
      name: "logo",
      label: t("company.logo"),
      type: "file",
      accept:
        "image/png,image/jpeg,image/webp,image/gif",
    },
  ];

  // ========================================
  // FORM BUTTONS
  // ========================================

  const companyButtons = [
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
      label:
        mode === "create"
          ? t("common.create")
          : t("common.update"),

      type: "submit",
      variant: "primary",
    },
  ];

  // ========================================
  // FORM SUBMIT
  // ========================================

  const handleSubmit = (data) => {
    setPendingData(data);

    setModalAction("save");

    setModal({
      open: true,
      type: "confirm",

      title:
        mode === "create"
          ? t("company.createTitle")
          : `${t("common.update")} ${t(
            "company.title"
          )}`,

      message:
        mode === "create"
          ? t("company.createSureMessage")
          : t("company.updateSureMessage"),
    });
  };

  // ========================================
  // DELETE COMPANY
  // ========================================

  const handleDeleteCompany = () => {
    if (!company) {
      return;
    }

    setModalAction("delete");

    setModal({
      open: true,
      type: "confirm",
      title: t("company.deleteTitle"),
      message: t("company.deleteSureMessage"),
    });
  };

  // ========================================
  // CONFIRM SAVE
  // CREATE OR UPDATE
  // ========================================

  const handleConfirmSave = async () => {
    if (!pendingData) {
      return;
    }

    setLoading(true);

    try {
      // ======================================
      // GET LOGO FILE
      // ======================================

      const logo = pendingData.logo;

      // ======================================
      // COMPANY DATA
      // ======================================

      const payload = {
        name: pendingData.name,
        tradeName: pendingData.tradeName,
        legalForm: pendingData.legalForm,
        industry: pendingData.industry,
        ice: pendingData.ice,
        taxId: pendingData.taxId,

        registrationNumber:
          pendingData.registrationNumber,

        email: pendingData.email,
        phone: pendingData.phone,
        website: pendingData.website,

        address: {
          street: pendingData.street,
          city: pendingData.city,
          postalCode: pendingData.postalCode,
        },
      };

      // ======================================
      // CREATE OR UPDATE COMPANY
      // ======================================

      let savedCompany;

      if (mode === "create") {
        savedCompany =
          await createCompany(payload);
      } else {
        savedCompany =
          await updateCompany(
            company._id,
            payload
          );
      }

      // ======================================
      // UPLOAD LOGO
      // ======================================

      let finalCompany = savedCompany;

      if (logo instanceof File) {
        const logoResponse =
          await uploadCompanyLogo(
            savedCompany._id,
            logo
          );

        finalCompany = logoResponse.data;
      }

      // ======================================
      // UPDATE UI
      // ======================================

      setCompany(finalCompany);

      setMode(false);

      setPendingData(null);

      setModalAction(null);

      setLoading(false);

      // ======================================
      // SUCCESS
      // ======================================

      setModal({
        open: true,
        type: "success",

        title:
          mode === "create"
            ? t("company.createSuccessTitle")
            : `${t("common.update")} ${t(
              "common.success"
            )}`,

        message:
          mode === "create"
            ? t(
              "company.createSuccessMessage"
            )
            : t(
              "company.updateSuccessMessage"
            ),
      });
    } catch (error) {
      console.error(
        "Failed to save company:",
        error.response?.data || error
      );

      setLoading(false);

      setModal({
        open: true,
        type: "error",

        title:
          mode === "create"
            ? t("company.createFailTitle")
            : `${t("common.update")} ${t(
              "common.fail"
            )}`,

        message: translateApiMessage(
          error.response?.data?.message ||
          error.message ||
          t("company.saveFailMessage")
        ),
      });
    }
  };

  // ========================================
  // CONFIRM DELETE
  // ========================================

  const handleConfirmDelete = async () => {
    if (!company) {
      return;
    }

    setLoading(true);

    try {
      // ======================================
      // DELETE COMPANY
      // ======================================

      await deleteCompany(company._id);

      // ======================================
      // REMOVE COMPANY FROM UI
      // ======================================

      setCompany(null);

      // ======================================
      // CLEAR STATE
      // ======================================

      setModalAction(null);

      setPendingData(null);

      setLoading(false);

      // ======================================
      // SUCCESS
      // ======================================

      setModal({
        open: true,
        type: "success",

        title: t(
          "company.deleteSuccessTitle"
        ),

        message: t(
          "company.deleteSuccessMessage"
        ),
      });
    } catch (error) {
      console.error(
        "Failed to delete company:",
        error.response?.data || error
      );

      setLoading(false);

      setModal({
        open: true,
        type: "error",

        title: t(
          "company.deleteFailTitle"
        ),

        message: translateApiMessage(
          error.response?.data?.message ||
          error.message ||
          t("company.deleteFailMessage")
        ),
      });
    }
  };

  // ========================================
  // CONFIRM MODAL ACTION
  // ========================================

  const handleConfirm = async () => {
    if (modalAction === "save") {
      await handleConfirmSave();
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
  // INITIAL LOADING
  // ========================================

  if (initialLoading) {
    return (
      <div className="pageShell">
        <div className="loadingState">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  // ========================================
  // INITIAL FORM VALUES
  // ========================================

  const initialFormValues = {
    name: company?.name || "",

    tradeName:
      company?.tradeName || "",

    legalForm:
      company?.legalForm || "SARL",

    industry:
      company?.industry || "",

    ice:
      company?.ice || "",

    taxId:
      company?.taxId || "",

    registrationNumber:
      company?.registrationNumber || "",

    email:
      company?.email || "",

    phone:
      company?.phone || "",

    website:
      company?.website || "",

    street:
      company?.address?.street || "",

    city:
      company?.address?.city || "",

    postalCode:
      company?.address?.postalCode || "",
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="pageShell">

      {/* ==================================
          HEADER
          ================================== */}

      <div className="pageHeader">

        <div>
          <div className="pageTitleRow">

            <Building2 size={20} />

            <h1>
              {company
                ? company.name
                : t("company.title")}
            </h1>

          </div>

          <p className="pageSubtitle">
            {company
              ? t("company.subtitle")
              : t(
                "company.emptySubtitle"
              )}
          </p>
        </div>

        {/* ==================================
            HEADER ACTIONS
            ================================== */}

        {company && !mode && canManageCompany(user, company) && (
          <div className="pageHeaderActions">

            {/* EDIT */}

            <button
              type="button"
              className={
                `btnEdit ${styles.editButton}`
              }
              onClick={() =>
                setMode("edit")
              }
            >
              <Pencil size={16} />

              {t("common.edit")}
            </button>

            {/* DELETE */}

            <button
              type="button"
              className={
                "btnDelete"
              }
              onClick={
                handleDeleteCompany
              }
            >
              <Trash2 size={16} />

              {t(
                "company.deleteCompany"
              )}
            </button>

          </div>
        )}

      </div>

      {/* ==================================
          EMPTY STATE
          ================================== */}

      {!company && !mode && (
        <div className="emptyStateBlock">

          <div className="emptyStateIcon">
            <Building2 size={28} />
          </div>

          <h2>
            {t(
              "company.emptyTitle"
            )}
          </h2>

          <p>
            {t(
              "company.emptyMessage"
            )}
          </p>

          {canCreateCompany(user) && (
            <button
              type="button"
              className={
                "btnPrimary"
              }
              onClick={() =>
                setMode("create")
              }
            >
              <Plus size={16} />

              {t("company.create")}
            </button>
          )}

        </div>
      )}

      {/* ==================================
          FORM
          ================================== */}

      {mode && (
        <div
          className={
            "formShell"
          }
        >

          <CollapsibleForm
            title={
              mode === "create"
                ? t("company.create")
                : t(
                  "company.editTitle"
                )
            }

            icon={
              <Building2 size={16} />
            }

            fields={companyFields}

            buttons={companyButtons}

            onSubmit={handleSubmit}

            initialValues={
              initialFormValues
            }
          />

        </div>
      )}

      {/* ==================================
          COMPANY CARD
          ================================== */}

      {company && !mode && (
        <div
          className={
            "detailCard"
          }
        >

          {/* ==================================
              LOGO
              ================================== */}

          {company.logo?.url && (
            <div
              className={
                styles.logoSection
              }
            >
              <img
                src={company.logo.url}
                alt={company.name}
                className={
                  styles.logo
                }
              />
            </div>
          )}

          {/* ==================================
              IDENTITY
              ================================== */}

          <div
            className={
              "detailSection"
            }
          >

            <h2>
              {t(
                "company.section.identity"
              )}
            </h2>

            <div
              className={
                "detailGrid"
              }
            >

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.name"
                  )}
                </span>

                <strong>
                  {company.name}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.tradeName"
                  )}
                </span>

                <strong>
                  {company.tradeName ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.legalForm"
                  )}
                </span>

                <strong>
                  {company.legalForm}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.industry"
                  )}
                </span>

                <strong>
                  {company.industry}
                </strong>
              </div>

            </div>

          </div>

          {/* ==================================
              LEGAL
              ================================== */}

          <div
            className={
              "detailSection"
            }
          >

            <h2>
              {t(
                "company.section.legal"
              )}
            </h2>

            <div
              className={
                "detailGrid"
              }
            >

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.ice"
                  )}
                </span>

                <strong>
                  {company.ice ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.taxId"
                  )}
                </span>

                <strong>
                  {company.taxId ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.registrationNumber"
                  )}
                </span>

                <strong>
                  {
                    company.registrationNumber ||
                    "—"
                  }
                </strong>
              </div>

            </div>

          </div>

          {/* ==================================
              CONTACT
              ================================== */}

          <div
            className={
              "detailSection"
            }
          >

            <h2>
              {t(
                "company.section.contact"
              )}
            </h2>

            <div
              className={
                "detailGrid"
              }
            >

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.email"
                  )}
                </span>

                <strong>
                  {company.email ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.phone"
                  )}
                </span>

                <strong>
                  {company.phone ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.website"
                  )}
                </span>

                <strong>
                  {company.website ||
                    "—"}
                </strong>
              </div>

              <div
                className={
                  "detailInfo"
                }
              >
                <span>
                  {t(
                    "company.street"
                  )}
                </span>

                <strong>
                  {
                    company.address
                      ?.street || "—"
                  }

                  {company.address
                    ?.city
                    ? `, ${company.address.city}`
                    : ""}
                </strong>
              </div>

            </div>

          </div>

          {/* ==================================
              EMPLOYEE COUNT
              ================================== */}

          <div
            className={
              styles.employeeSection
            }
          >

            <div
              className={
                styles.employeeIcon
              }
            >
              <Users size={20} />
            </div>

            <div>

              <span>
                {t(
                  "company.employeeCount"
                )}
              </span>

              <strong>
                {company.employeeCount ??
                  0}
              </strong>

            </div>

          </div>

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
