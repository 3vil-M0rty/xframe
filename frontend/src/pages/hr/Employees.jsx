import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  Edit,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import SearchBar from "../../components/useful/SearchBar";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import EmployeeCard from "../../components/employee/EmployeeCard";

import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadEmployeePhoto,
  deleteEmployeePhoto,
} from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";

import styles from "./Employees.module.css";

// Cards per page. Keeping this modest (instead of loading up to
// 100 employees at once into a single grid) is what keeps the
// page fast as a company's employee list grows.
const EMPLOYEES_PAGE_SIZE = 24;

/* ============================================================
   HELPERS
   ============================================================ */

function formatCompanyAddress(address) {
  if (!address) return "";

  if (typeof address === "string") {
    return address;
  }

  return [
    address.street,
    address.city,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDate(date) {
  if (!date) return "";

  try {
    return new Date(date).toLocaleDateString("en-GB");
  } catch {
    return "";
  }
}

function formatName(employee) {
  if (!employee) return "";

  return `${employee.firstName || ""} ${employee.lastName || ""
    }`.trim();
}

/* ============================================================
   COMPANY + PHOTO AREA
   ============================================================ */

function EmployeeFormExtras({
  t,
  companies,
  formCompanyId,
  setFormCompanyId,
  photoPreview,
  photoInputRef,
  handlePhotoChange,
  clearPhoto,
}) {
  const formCompany = companies.find(
    (company) => company._id === formCompanyId
  );

  const companyOptions = companies.map((company) => ({
    value: company._id,
    label:
      company.shortName ||
      company.name ||
      company.companyName ||
      t("employees.company.unnamed"),
  }));

  return (
    <div className={styles.formExtras}>
      {/* COMPANY */}
      <div className={styles.formExtraSection}>
        <div className={styles.formExtraHeader}>
          <BriefcaseBusiness size={18} />
          <span>{t("employees.company.label")}</span>
        </div>

        <CustomSelect
          value={formCompanyId}
          onChange={setFormCompanyId}
          onSelect={setFormCompanyId}
          options={companyOptions}
          placeholder={t(
            "employees.company.selectPlaceholder"
          )}
        />

        {formCompany && (
          <div className={styles.companyInfo}>
            <div className={styles.companyInfoHeader}>
              <BriefcaseBusiness size={18} />

              <div>
                <strong>
                  {formCompany.shortName ||
                    formCompany.name ||
                    formCompany.companyName ||
                    t("employees.company.unnamed")}
                </strong>

                {formatCompanyAddress(
                  formCompany.address
                ) && (
                    <span>
                      {formatCompanyAddress(
                        formCompany.address
                      )}
                    </span>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PHOTO */}
      <div className={styles.formExtraSection}>
        <div className={styles.formExtraHeader}>
          <Camera size={18} />
          <span>{t("employees.photo.label")}</span>
        </div>

        <div className={styles.photoUpload}>
          <div className={styles.photoPreview}>
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={t(
                  "employees.detail.employeeLabel"
                )}
              />
            ) : (
              <UserRound size={38} />
            )}
          </div>

          <div className={styles.photoActions}>
            <button
              type="button"
              className={styles.photoButton}
              onClick={() =>
                photoInputRef.current?.click()
              }
            >
              <Camera size={16} />
              {photoPreview
                ? t("employees.photo.change")
                : t("employees.photo.choose")}
            </button>

            {photoPreview && (
              <button
                type="button"
                className={styles.removePhotoButton}
                onClick={clearPhoto}
              >
                <X size={16} />
                {t("employees.photo.remove")}
              </button>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Employees() {
  const { t } = useI18n();
  const { user } = useAuth();

  /* ==========================================================
     STATE
     ========================================================== */

  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [selectedCompanyId, setSelectedCompanyId] =
    useState(
      user?.company?._id ||
      user?.companyId ||
      ""
    );

  const [formCompanyId, setFormCompanyId] =
    useState(
      user?.company?._id ||
      user?.companyId ||
      ""
    );

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  // ========================================
  // PAGINATION
  // Keeps the grid capped at EMPLOYEES_PAGE_SIZE cards per page
  // instead of always rendering the whole company's employee list.
  // ========================================

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: EMPLOYEES_PAGE_SIZE,
    pages: 1,
  });

  // Reset to page 1 whenever the company or the (debounced) search
  // term changes, so we don't land on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, debouncedSearch]);

  const [loading, setLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [editingEmployee, setEditingEmployee] =
    useState(null);

  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] =
    useState(null);

  const photoInputRef = useRef(null);

  /* ==========================================================
     TRANSLATION HELPERS
     ========================================================== */

  const getStatusLabel = (status) => {
    const allowedStatuses = [
      "active",
      "inactive",
      "on_leave",
      "suspended",
      "terminated",
    ];

    const key = allowedStatuses.includes(status)
      ? status
      : "unknown";

    return t(`employees.statuses.${key}`);
  };

  const getEmploymentTypeLabel = (type) => {
    const allowedTypes = [
      "permanent",
      "fixed_term",
      "temporary",
      "intern",
      "apprentice",
      "freelance",
      "part_time",
      "other",
    ];

    const key = allowedTypes.includes(type)
      ? type
      : "other";

    return t(
      `employees.employmentTypes.${key}`
    );
  };

  const getGenderLabel = (gender) => {
    const allowedGenders = [
      "male",
      "female",
      "other",
    ];

    if (!allowedGenders.includes(gender)) {
      return t("employees.detail.empty");
    }

    return t(`employees.genders.${gender}`);
  };

  const getMaritalStatusLabel = (status) => {
    const allowedStatuses = [
      "single",
      "married",
      "divorced",
      "widowed",
      "other",
    ];

    if (!allowedStatuses.includes(status)) {
      return t("employees.detail.empty");
    }

    return t(
      `employees.maritalStatuses.${status}`
    );
  };

  const getTaxStatusLabel = (status) => {
    const taxStatusMap = {
      taxable: "taxable",
      non_taxable: "nonTaxable",
      exempt: "exempt",
    };

    const key = taxStatusMap[status];

    if (!key) {
      return t("employees.detail.empty");
    }

    return t(`employees.taxStatus.${key}`);
  };

  const getEmployeeCountLabel = (count) => {
    const key =
      count === 1
        ? "employees.companyInfo.employeeCount_one"
        : "employees.companyInfo.employeeCount_other";

    return t(key).replace(
      "{count}",
      String(count)
    );
  };

  const getDeleteConfirmationMessage = (
    employee
  ) => {
    return t(
      "employees.deleteSureMessage"
    ).replace(
      "{name}",
      formatName(employee)
    );
  };

  /* ==========================================================
     COMPANY OPTIONS
     ========================================================== */

  const companyOptions = useMemo(() => {
    return companies.map((company) => ({
      value: company._id,
      label:
        company.shortName ||
        company.name ||
        company.companyName ||
        t("employees.company.unnamed"),
    }));
  }, [companies, t]);

  const selectedCompany = useMemo(() => {
    return companies.find(
      (company) =>
        company._id === selectedCompanyId
    );
  }, [companies, selectedCompanyId]);

  /* ==========================================================
     BREADCRUMBS
     ========================================================== */

  const breadcrumbItems = useMemo(() => {
    const items = [
      {
        id: "hr",
        label: t("employees.breadcrumbs.hr"),
      },
      {
        id: "employees",
        label: t(
          "employees.breadcrumbs.employees"
        ),
      },
    ];

    if (selectedEmployee) {
      items.push({
        id: selectedEmployee._id,
        label: formatName(selectedEmployee),
      });
    } else if (editingEmployee) {
      items.push({
        id: "edit",
        label: t(
          "employees.breadcrumbs.editEmployee"
        ),
      });
    } else if (showCreateForm) {
      items.push({
        id: "create",
        label: t(
          "employees.breadcrumbs.addEmployee"
        ),
      });
    }

    return items;
  }, [
    selectedEmployee,
    editingEmployee,
    showCreateForm,
    t,
  ]);

  const handleBreadcrumbNavigate = (item) => {
    if (!item) {
      return;
    }

    if (item.id === "employees") {
      handleBackToEmployees();
      return;
    }

    if (
      selectedEmployee &&
      item.id === selectedEmployee._id
    ) {
      setEditingEmployee(null);
      setShowCreateForm(false);
      clearPhoto();
      setError("");
    }
  };

  /* ==========================================================
     FETCH COMPANIES
     ========================================================== */

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setCompaniesLoading(true);
        setError("");

        // Was previously a raw `fetch()` against a hardcoded
        // "http://localhost:5000/api" — broken in any environment
        // other than local dev. `getCompanies()` goes through the
        // shared `api` client, which respects VITE_API_URL and
        // already attaches the auth token.
        const data = await getCompanies();

        const companyList = Array.isArray(data) ? data : [];

        setCompanies(companyList);

        if (
          !selectedCompanyId &&
          companyList.length > 0
        ) {
          const firstCompany =
            companyList[0];

          setSelectedCompanyId(
            firstCompany._id
          );

          setFormCompanyId(
            firstCompany._id
          );
        }
      } catch (err) {
        console.error(
          "Fetch companies error:",
          err
        );

        setError(
          err.message ||
          t(
            "employees.errors.fetchCompaniesFailed"
          )
        );
      } finally {
        setCompaniesLoading(false);
      }
    };

    fetchCompanies();
  }, [t]);

  /* ==========================================================
     FETCH EMPLOYEES
     ========================================================== */

  useEffect(() => {
    if (!selectedCompanyId) {
      setEmployees([]);
      setPagination({
        total: 0,
        page: 1,
        limit: EMPLOYEES_PAGE_SIZE,
        pages: 1,
      });
      return;
    }

    let cancelled = false;

    const loadEmployees = async () => {
      try {
        setLoading(true);
        setError("");

        const { employees: data, pagination: paginationData } =
          await getEmployees({
            companyId: selectedCompanyId,
            search: debouncedSearch,
            page,
            limit: EMPLOYEES_PAGE_SIZE,
          });

        if (cancelled) {
          return;
        }

        setEmployees(
          Array.isArray(data) ? data : []
        );
        setPagination(paginationData);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Fetch employees error:",
          err
        );

        setError(
          err.message ||
          t(
            "employees.errors.fetchEmployeesFailed"
          )
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [
    selectedCompanyId,
    debouncedSearch,
    page,
    t,
  ]);

  /* ==========================================================
     PHOTO
     ========================================================== */

  const clearPhoto = () => {
    setPhotoFile(null);

    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    if (
      photoPreview &&
      !photoPreview.startsWith("blob:")
    ) {
      setPhotoRemoved(true);
    }

    setPhotoPreview(null);

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handlePhotoChange = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        t("employees.errors.invalidPhoto")
      );
      return;
    }

    setError("");

    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoRemoved(false);
    setPhotoPreview(
      URL.createObjectURL(file)
    );
  };

  /* ==========================================================
     FORM VALUES
     ========================================================== */

  const getInitialValues = (
    employee = null
  ) => {
    if (!employee) {
      return {
        employeeNumber: "",
        firstName: "",
        lastName: "",
        firstNameArabic: "",
        lastNameArabic: "",
        gender: "",
        dateOfBirth: "",
        placeOfBirth: "",
        nationality: "Moroccan",
        maritalStatus: "",
        numberOfDependents: 0,

        cin: "",
        passportNumber: "",
        passportExpiryDate: "",
        workPermitNumber: "",
        workPermitExpiryDate: "",

        personalEmail: "",
        workEmail: "",
        phone: "",
        secondaryPhone: "",

        street: "",
        city: "",
        region: "",
        postalCode: "",
        country: "Morocco",

        emergencyName: "",
        emergencyRelationship: "",
        emergencyPhone: "",
        emergencyEmail: "",

        hireDate: "",
        terminationDate: "",
        employmentStatus: "active",
        employmentType: "permanent",

        jobTitle: "",
        department: "",
        service: "",
        position: "",
        workLocation: "",

        cnssNumber: "",
        cnssRegistrationDate: "",
        taxIdentificationNumber: "",
        taxStatus: "taxable",

        numberOfChildren: 0,
        spouseWorking: false,

        bankName: "",
        accountName: "",
        rib: "",
        iban: "",

        paymentMethod: "bank_transfer",
        notes: "",
        isActive: true,
      };
    }

    return {
      employeeNumber:
        employee.employeeNumber || "",
      firstName:
        employee.firstName || "",
      lastName:
        employee.lastName || "",
      firstNameArabic:
        employee.firstNameArabic || "",
      lastNameArabic:
        employee.lastNameArabic || "",
      gender:
        employee.gender || "",
      dateOfBirth:
        employee.dateOfBirth
          ? employee.dateOfBirth.substring(0, 10)
          : "",
      placeOfBirth:
        employee.placeOfBirth || "",
      nationality:
        employee.nationality ||
        "Moroccan",
      maritalStatus:
        employee.maritalStatus || "",
      numberOfDependents:
        employee.numberOfDependents ?? 0,

      cin:
        employee.cin || "",
      passportNumber:
        employee.passportNumber || "",
      passportExpiryDate:
        employee.passportExpiryDate
          ? employee.passportExpiryDate.substring(
            0,
            10
          )
          : "",
      workPermitNumber:
        employee.workPermitNumber || "",
      workPermitExpiryDate:
        employee.workPermitExpiryDate
          ? employee.workPermitExpiryDate.substring(
            0,
            10
          )
          : "",

      personalEmail:
        employee.personalEmail || "",
      workEmail:
        employee.workEmail || "",
      phone:
        employee.phone || "",
      secondaryPhone:
        employee.secondaryPhone || "",

      street:
        employee.address?.street || "",
      city:
        employee.address?.city || "",
      region:
        employee.address?.region || "",
      postalCode:
        employee.address?.postalCode || "",
      country:
        employee.address?.country ||
        "Morocco",

      emergencyName:
        employee.emergencyContact?.name ||
        "",
      emergencyRelationship:
        employee.emergencyContact
          ?.relationship || "",
      emergencyPhone:
        employee.emergencyContact?.phone ||
        "",
      emergencyEmail:
        employee.emergencyContact?.email ||
        "",

      hireDate:
        employee.hireDate
          ? employee.hireDate.substring(
            0,
            10
          )
          : "",
      terminationDate:
        employee.terminationDate
          ? employee.terminationDate.substring(
            0,
            10
          )
          : "",
      employmentStatus:
        employee.employmentStatus ||
        "active",
      employmentType:
        employee.employmentType ||
        "permanent",

      jobTitle:
        employee.jobTitle || "",
      department:
        employee.department || "",
      service:
        employee.service || "",
      position:
        employee.position || "",
      workLocation:
        employee.workLocation || "",

      cnssNumber:
        employee.cnssNumber || "",
      cnssRegistrationDate:
        employee.cnssRegistrationDate
          ? employee.cnssRegistrationDate.substring(
            0,
            10
          )
          : "",
      taxIdentificationNumber:
        employee.taxIdentificationNumber ||
        "",
      taxStatus:
        employee.taxStatus || "taxable",

      numberOfChildren:
        employee.familyStatus
          ?.numberOfChildren ?? 0,
      spouseWorking:
        employee.familyStatus
          ?.spouseWorking || false,

      bankName:
        employee.bank?.bankName || "",
      accountName:
        employee.bank?.accountName || "",
      rib:
        employee.bank?.rib || "",
      iban:
        employee.bank?.iban || "",

      paymentMethod:
        employee.paymentMethod ||
        "bank_transfer",
      notes:
        employee.notes || "",
      isActive:
        employee.isActive ?? true,
    };
  };

  /* ==========================================================
     FORM FIELDS
     ========================================================== */

  const employeeFields = useMemo(
    () => [
      {
        name: "employeeNumber",
        label: t(
          "employees.fields.employeeNumber"
        ),
        placeholder: t(
          "employees.fields.employeeNumberPlaceholder"
        ),
        required: true,
      },
      {
        name: "firstName",
        label: t(
          "employees.fields.firstName"
        ),
        placeholder: t(
          "employees.fields.firstNamePlaceholder"
        ),
        required: true,
      },
      {
        name: "lastName",
        label: t(
          "employees.fields.lastName"
        ),
        placeholder: t(
          "employees.fields.lastNamePlaceholder"
        ),
        required: true,
      },
      {
        name: "firstNameArabic",
        label: t(
          "employees.fields.firstNameArabic"
        ),
        placeholder: t(
          "employees.fields.firstNameArabicPlaceholder"
        ),
      },
      {
        name: "lastNameArabic",
        label: t(
          "employees.fields.lastNameArabic"
        ),
        placeholder: t(
          "employees.fields.lastNameArabicPlaceholder"
        ),
      },
      {
        name: "gender",
        label: t(
          "employees.fields.gender"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.genderPlaceholder"
        ),
        options: [
          {
            value: "male",
            label: t(
              "employees.genders.male"
            ),
          },
          {
            value: "female",
            label: t(
              "employees.genders.female"
            ),
          },
          {
            value: "other",
            label: t(
              "employees.genders.other"
            ),
          },
        ],
      },
      {
        name: "dateOfBirth",
        label: t(
          "employees.fields.dateOfBirth"
        ),
        type: "date",
      },
      {
        name: "placeOfBirth",
        label: t(
          "employees.fields.placeOfBirth"
        ),
        placeholder: t(
          "employees.fields.placeOfBirthPlaceholder"
        ),
      },
      {
        name: "nationality",
        label: t(
          "employees.fields.nationality"
        ),
        placeholder: t(
          "employees.fields.nationalityPlaceholder"
        ),
      },
      {
        name: "maritalStatus",
        label: t(
          "employees.fields.maritalStatus"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.maritalStatusPlaceholder"
        ),
        options: [
          {
            value: "single",
            label: t(
              "employees.maritalStatuses.single"
            ),
          },
          {
            value: "married",
            label: t(
              "employees.maritalStatuses.married"
            ),
          },
          {
            value: "divorced",
            label: t(
              "employees.maritalStatuses.divorced"
            ),
          },
          {
            value: "widowed",
            label: t(
              "employees.maritalStatuses.widowed"
            ),
          },
          {
            value: "other",
            label: t(
              "employees.maritalStatuses.other"
            ),
          },
        ],
      },
      {
        name: "numberOfDependents",
        label: t(
          "employees.fields.numberOfDependents"
        ),
        type: "number",
        placeholder: "0",
      },
      {
        name: "cin",
        label: t(
          "employees.fields.cin"
        ),
        placeholder: t(
          "employees.fields.cinPlaceholder"
        ),
      },
      {
        name: "passportNumber",
        label: t(
          "employees.fields.passportNumber"
        ),
        placeholder: t(
          "employees.fields.passportNumberPlaceholder"
        ),
      },
      {
        name: "passportExpiryDate",
        label: t(
          "employees.fields.passportExpiryDate"
        ),
        type: "date",
      },
      {
        name: "workPermitNumber",
        label: t(
          "employees.fields.workPermitNumber"
        ),
        placeholder: t(
          "employees.fields.workPermitNumberPlaceholder"
        ),
      },
      {
        name: "workPermitExpiryDate",
        label: t(
          "employees.fields.workPermitExpiryDate"
        ),
        type: "date",
      },
      {
        name: "personalEmail",
        label: t(
          "employees.fields.personalEmail"
        ),
        type: "email",
        placeholder: t(
          "employees.fields.personalEmailPlaceholder"
        ),
      },
      {
        name: "workEmail",
        label: t(
          "employees.fields.workEmail"
        ),
        type: "email",
        placeholder: t(
          "employees.fields.workEmailPlaceholder"
        ),
      },
      {
        name: "phone",
        label: t(
          "employees.fields.phone"
        ),
        type: "tel",
        placeholder: t(
          "employees.fields.phonePlaceholder"
        ),
      },
      {
        name: "secondaryPhone",
        label: t(
          "employees.fields.secondaryPhone"
        ),
        type: "tel",
        placeholder: t(
          "employees.fields.secondaryPhonePlaceholder"
        ),
      },
      {
        name: "street",
        label: t(
          "employees.fields.street"
        ),
        placeholder: t(
          "employees.fields.streetPlaceholder"
        ),
        fullWidth: true,
      },
      {
        name: "city",
        label: t(
          "employees.fields.city"
        ),
        placeholder: t(
          "employees.fields.cityPlaceholder"
        ),
      },
      {
        name: "region",
        label: t(
          "employees.fields.region"
        ),
        placeholder: t(
          "employees.fields.regionPlaceholder"
        ),
      },
      {
        name: "postalCode",
        label: t(
          "employees.fields.postalCode"
        ),
        placeholder: t(
          "employees.fields.postalCodePlaceholder"
        ),
      },
      {
        name: "country",
        label: t(
          "employees.fields.country"
        ),
        placeholder: t(
          "employees.fields.countryPlaceholder"
        ),
      },
      {
        name: "emergencyName",
        label: t(
          "employees.fields.emergencyName"
        ),
        placeholder: t(
          "employees.fields.emergencyNamePlaceholder"
        ),
      },
      {
        name: "emergencyRelationship",
        label: t(
          "employees.fields.emergencyRelationship"
        ),
        placeholder: t(
          "employees.fields.emergencyRelationshipPlaceholder"
        ),
      },
      {
        name: "emergencyPhone",
        label: t(
          "employees.fields.emergencyPhone"
        ),
        type: "tel",
        placeholder: t(
          "employees.fields.emergencyPhonePlaceholder"
        ),
      },
      {
        name: "emergencyEmail",
        label: t(
          "employees.fields.emergencyEmail"
        ),
        type: "email",
        placeholder: t(
          "employees.fields.emergencyEmailPlaceholder"
        ),
      },
      {
        name: "hireDate",
        label: t(
          "employees.fields.hireDate"
        ),
        type: "date",
        required: true,
      },
      {
        name: "terminationDate",
        label: t(
          "employees.fields.terminationDate"
        ),
        type: "date",
      },
      {
        name: "employmentStatus",
        label: t(
          "employees.fields.employmentStatus"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.employmentStatusPlaceholder"
        ),
        options: [
          {
            value: "active",
            label: t(
              "employees.statuses.active"
            ),
          },
          {
            value: "inactive",
            label: t(
              "employees.statuses.inactive"
            ),
          },
          {
            value: "on_leave",
            label: t(
              "employees.statuses.on_leave"
            ),
          },
          {
            value: "suspended",
            label: t(
              "employees.statuses.suspended"
            ),
          },
          {
            value: "terminated",
            label: t(
              "employees.statuses.terminated"
            ),
          },
        ],
      },
      {
        name: "employmentType",
        label: t(
          "employees.fields.employmentType"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.employmentTypePlaceholder"
        ),
        options: [
          {
            value: "permanent",
            label: t(
              "employees.employmentTypes.permanent"
            ),
          },
          {
            value: "fixed_term",
            label: t(
              "employees.employmentTypes.fixed_term"
            ),
          },
          {
            value: "temporary",
            label: t(
              "employees.employmentTypes.temporary"
            ),
          },
          {
            value: "intern",
            label: t(
              "employees.employmentTypes.intern"
            ),
          },
          {
            value: "apprentice",
            label: t(
              "employees.employmentTypes.apprentice"
            ),
          },
          {
            value: "freelance",
            label: t(
              "employees.employmentTypes.freelance"
            ),
          },
          {
            value: "part_time",
            label: t(
              "employees.employmentTypes.part_time"
            ),
          },
          {
            value: "other",
            label: t(
              "employees.employmentTypes.other"
            ),
          },
        ],
      },
      {
        name: "jobTitle",
        label: t(
          "employees.fields.jobTitle"
        ),
        placeholder: t(
          "employees.fields.jobTitlePlaceholder"
        ),
      },
      {
        name: "department",
        label: t(
          "employees.fields.department"
        ),
        placeholder: t(
          "employees.fields.departmentPlaceholder"
        ),
      },
      {
        name: "service",
        label: t(
          "employees.fields.service"
        ),
        placeholder: t(
          "employees.fields.servicePlaceholder"
        ),
      },
      {
        name: "position",
        label: t(
          "employees.fields.position"
        ),
        placeholder: t(
          "employees.fields.positionPlaceholder"
        ),
      },
      {
        name: "workLocation",
        label: t(
          "employees.fields.workLocation"
        ),
        placeholder: t(
          "employees.fields.workLocationPlaceholder"
        ),
      },
      {
        name: "cnssNumber",
        label: t(
          "employees.fields.cnssNumber"
        ),
        placeholder: t(
          "employees.fields.cnssNumberPlaceholder"
        ),
      },
      {
        name: "cnssRegistrationDate",
        label: t(
          "employees.fields.cnssRegistrationDate"
        ),
        type: "date",
      },
      {
        name: "taxIdentificationNumber",
        label: t(
          "employees.fields.taxIdentificationNumber"
        ),
        placeholder: t(
          "employees.fields.taxIdentificationNumberPlaceholder"
        ),
      },
      {
        name: "taxStatus",
        label: t(
          "employees.fields.taxStatus"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.taxStatusPlaceholder"
        ),
        options: [
          {
            value: "taxable",
            label: t(
              "employees.taxStatus.taxable"
            ),
          },
          {
            value: "non_taxable",
            label: t(
              "employees.taxStatus.nonTaxable"
            ),
          },
          {
            value: "exempt",
            label: t(
              "employees.taxStatus.exempt"
            ),
          },
        ],
      },
      {
        name: "numberOfChildren",
        label: t(
          "employees.fields.numberOfChildren"
        ),
        type: "number",
        placeholder: "0",
      },
      {
        name: "spouseWorking",
        label: t(
          "employees.fields.spouseWorking"
        ),
        type: "checkbox",
        checkboxLabel: t(
          "employees.fields.spouseWorkingCheckboxLabel"
        ),
      },
      {
        name: "bankName",
        label: t(
          "employees.fields.bankName"
        ),
        placeholder: t(
          "employees.fields.bankNamePlaceholder"
        ),
      },
      {
        name: "accountName",
        label: t(
          "employees.fields.accountName"
        ),
        placeholder: t(
          "employees.fields.accountNamePlaceholder"
        ),
      },
      {
        name: "rib",
        label: t(
          "employees.fields.rib"
        ),
        placeholder: t(
          "employees.fields.ribPlaceholder"
        ),
      },
      {
        name: "iban",
        label: t(
          "employees.fields.iban"
        ),
        placeholder: t(
          "employees.fields.ibanPlaceholder"
        ),
      },
      {
        name: "paymentMethod",
        label: t(
          "employees.fields.paymentMethod"
        ),
        type: "select",
        placeholder: t(
          "employees.fields.paymentMethodPlaceholder"
        ),
        options: [
          {
            value: "bank_transfer",
            label: t(
              "employees.paymentMethods.bank_transfer"
            ),
          },
          {
            value: "cash",
            label: t(
              "employees.paymentMethods.cash"
            ),
          },
          {
            value: "check",
            label: t(
              "employees.paymentMethods.check"
            ),
          },
        ],
      },
      {
        name: "notes",
        label: t(
          "employees.fields.notes"
        ),
        type: "textarea",
        placeholder: t(
          "employees.fields.notesPlaceholder"
        ),
        fullWidth: true,
        rows: 5,
      },
      {
        name: "isActive",
        label: t(
          "employees.fields.isActive"
        ),
        type: "checkbox",
        checkboxLabel: t(
          "employees.fields.isActiveCheckboxLabel"
        ),
      },
    ],
    [t]
  );

  /* ==========================================================
     BUILD PAYLOAD
     ========================================================== */

  const buildEmployeePayload = (
    formData
  ) => {
    return {
      company: formCompanyId,

      employeeNumber:
        formData.employeeNumber,
      firstName:
        formData.firstName,
      lastName:
        formData.lastName,

      firstNameArabic:
        formData.firstNameArabic,
      lastNameArabic:
        formData.lastNameArabic,

      gender:
        formData.gender || undefined,

      dateOfBirth:
        formData.dateOfBirth || undefined,

      placeOfBirth:
        formData.placeOfBirth,

      nationality:
        formData.nationality,

      maritalStatus:
        formData.maritalStatus ||
        undefined,

      numberOfDependents:
        Number(
          formData.numberOfDependents || 0
        ),

      cin:
        formData.cin,

      passportNumber:
        formData.passportNumber,

      passportExpiryDate:
        formData.passportExpiryDate ||
        undefined,

      workPermitNumber:
        formData.workPermitNumber,

      workPermitExpiryDate:
        formData.workPermitExpiryDate ||
        undefined,

      personalEmail:
        formData.personalEmail,

      workEmail:
        formData.workEmail,

      phone:
        formData.phone,

      secondaryPhone:
        formData.secondaryPhone,

      address: {
        street:
          formData.street,
        city:
          formData.city,
        region:
          formData.region,
        postalCode:
          formData.postalCode,
        country:
          formData.country,
      },

      emergencyContact: {
        name:
          formData.emergencyName,
        relationship:
          formData.emergencyRelationship,
        phone:
          formData.emergencyPhone,
        email:
          formData.emergencyEmail,
      },

      hireDate:
        formData.hireDate,

      terminationDate:
        formData.terminationDate ||
        undefined,

      employmentStatus:
        formData.employmentStatus,

      employmentType:
        formData.employmentType,

      jobTitle:
        formData.jobTitle,

      department:
        formData.department,

      service:
        formData.service,

      position:
        formData.position,

      workLocation:
        formData.workLocation,

      cnssNumber:
        formData.cnssNumber,

      cnssRegistrationDate:
        formData.cnssRegistrationDate ||
        undefined,

      taxIdentificationNumber:
        formData.taxIdentificationNumber,

      taxStatus:
        formData.taxStatus ||
        undefined,

      familyStatus: {
        numberOfChildren:
          Number(
            formData.numberOfChildren || 0
          ),
        spouseWorking:
          Boolean(
            formData.spouseWorking
          ),
      },

      bank: {
        bankName:
          formData.bankName,
        accountName:
          formData.accountName,
        rib:
          formData.rib,
        iban:
          formData.iban,
      },

      paymentMethod:
        formData.paymentMethod,

      notes:
        formData.notes,

      isActive:
        Boolean(formData.isActive),
    };
  };

  /* ==========================================================
     CREATE
     ========================================================== */

  const openCreateForm = () => {
    setSelectedEmployee(null);
    setEditingEmployee(null);

    setFormCompanyId(
      selectedCompanyId ||
      companies[0]?._id ||
      ""
    );

    setPhotoRemoved(false);
    clearPhoto();

    setError("");
    setShowCreateForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleCreate = async (
    formData
  ) => {
    try {
      setSaving(true);
      setError("");

      if (!formCompanyId) {
        throw new Error(
          t(
            "employees.errors.companyRequired"
          )
        );
      }

      const payload =
        buildEmployeePayload(
          formData
        );

      let employee =
        await createEmployee(
          payload
        );

      if (photoFile) {
        employee =
          await uploadEmployeePhoto(
            employee._id,
            photoFile
          );
      }

      setEmployees((prev) => [
        employee,
        ...prev,
      ]);

      setSelectedCompanyId(
        formCompanyId
      );

      closeForm();
    } catch (err) {
      console.error(
        "Create employee error:",
        err
      );

      setError(
        err.message ||
        t(
          "employees.errors.createFailed"
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     EDIT
     ========================================================== */

  const openEditForm = (
    employee
  ) => {
    setSelectedEmployee(null);
    setEditingEmployee(employee);

    setFormCompanyId(
      employee.company?._id ||
      employee.company ||
      selectedCompanyId ||
      ""
    );

    setPhotoFile(null);
    setPhotoRemoved(false);

    setPhotoPreview(
      employee.photo?.url ||
      null
    );

    setError("");
    setShowCreateForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleUpdate = async (
    formData
  ) => {
    if (!editingEmployee) return;

    try {
      setSaving(true);
      setError("");

      const payload =
        buildEmployeePayload(
          formData
        );

      delete payload.company;

      let updatedEmployee =
        await updateEmployee(
          editingEmployee._id,
          payload
        );

      if (photoFile) {
        updatedEmployee =
          await uploadEmployeePhoto(
            editingEmployee._id,
            photoFile
          );
      } else if (
        photoRemoved &&
        editingEmployee.photo?.url
      ) {
        updatedEmployee =
          await deleteEmployeePhoto(
            editingEmployee._id
          );
      }

      setEmployees((prev) =>
        prev.map(
          (employee) =>
            employee._id ===
              editingEmployee._id
              ? updatedEmployee
              : employee
        )
      );

      closeForm();
    } catch (err) {
      console.error(
        "Update employee error:",
        err
      );

      setError(
        err.message ||
        t(
          "employees.errors.updateFailed"
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     DELETE
     ========================================================== */

  const handleDelete = async (
    employee
  ) => {
    if (!employee?._id) return;

    const confirmed =
      window.confirm(
        getDeleteConfirmationMessage(
          employee
        )
      );

    if (!confirmed) return;

    try {
      setLoading(true);
      setError("");

      await deleteEmployee(
        employee._id
      );

      setEmployees((prev) =>
        prev.filter(
          (item) =>
            item._id !==
            employee._id
        )
      );

      setSelectedEmployee((prev) =>
        prev &&
          prev._id === employee._id
          ? null
          : prev
      );
    } catch (err) {
      console.error(
        "Delete employee error:",
        err
      );

      setError(
        err.message ||
        t(
          "employees.errors.deleteFailed"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     CLOSE FORM
     ========================================================== */

  const closeForm = () => {
    setShowCreateForm(false);
    setEditingEmployee(null);

    setPhotoRemoved(false);
    clearPhoto();

    setError("");
  };

  /* ==========================================================
     BACK TO EMPLOYEES
     ========================================================== */

  const handleBackToEmployees =
    () => {
      setSelectedEmployee(null);
      setEditingEmployee(null);
      setShowCreateForm(false);

      setPhotoRemoved(false);
      clearPhoto();

      setError("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  /* ==========================================================
     SELECT EMPLOYEE
     ========================================================== */

  const handleSelectEmployee = (
    employee
  ) => {
    setSelectedEmployee(employee);
    setShowCreateForm(false);
    setEditingEmployee(null);

    setPhotoRemoved(false);
    clearPhoto();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* ==========================================================
     FORM SUBMIT
     ========================================================== */

  const handleFormSubmit = (
    formData
  ) => {
    if (editingEmployee) {
      handleUpdate(formData);
    } else {
      handleCreate(formData);
    }
  };

  /* ==========================================================
     DETAIL VIEW
     ========================================================== */

  if (selectedEmployee) {
    const employeeCompany =
      typeof selectedEmployee.company ===
        "object"
        ? selectedEmployee.company
        : companies.find(
          (company) =>
            company._id ===
            selectedEmployee.company
        );

    return (
      <div className={styles.page}>
        <Breadcrumbs
          items={breadcrumbItems}
          onNavigate={
            handleBreadcrumbNavigate
          }
        />

        <div className={styles.detailHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={
              handleBackToEmployees
            }
          >
            <ArrowLeft size={18} />
            {t(
              "employees.backToEmployees"
            )}
          </button>

          <div
            className={
              styles.detailActions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={() =>
                openEditForm(
                  selectedEmployee
                )
              }
            >
              <Edit size={16} />
              {t("employees.card.edit")}
            </button>

            <button
              type="button"
              className={
                styles.dangerButton
              }
              onClick={() =>
                handleDelete(
                  selectedEmployee
                )
              }
            >
              <Trash2 size={16} />
              {t(
                "employees.deleteTitle"
              )}
            </button>
          </div>
        </div>

        <div className={styles.profileCard}>
          <div
            className={
              styles.profilePhoto
            }
          >
            {selectedEmployee.photo
              ?.url ? (
              <img
                src={
                  selectedEmployee.photo
                    .url
                }
                alt={formatName(
                  selectedEmployee
                )}
              />
            ) : (
              <UserRound size={52} />
            )}
          </div>

          <div
            className={
              styles.profileMain
            }
          >
            <div
              className={
                styles.profileNameRow
              }
            >
              <h1>
                {formatName(
                  selectedEmployee
                )}
              </h1>

              <span
                className={`${styles.statusBadge} ${selectedEmployee.employmentStatus ===
                    "active"
                    ? styles.statusActive
                    : styles.statusInactive
                  }`}
              >
                {getStatusLabel(
                  selectedEmployee.employmentStatus
                )}
              </span>
            </div>

            <p
              className={
                styles.profileJob
              }
            >
              {selectedEmployee.jobTitle ||
                selectedEmployee.position ||
                t(
                  "employees.detail.employeeLabel"
                )}
            </p>

            <div
              className={
                styles.profileMeta
              }
            >
              {selectedEmployee.employeeNumber && (
                <span>
                  <FileText size={15} />
                  {
                    selectedEmployee.employeeNumber
                  }
                </span>
              )}

              {employeeCompany && (
                <span>
                  <BriefcaseBusiness
                    size={15}
                  />
                  {employeeCompany.shortName ||
                    employeeCompany.name ||
                    employeeCompany.companyName ||
                    t(
                      "employees.company.unnamed"
                    )}
                </span>
              )}

              {selectedEmployee.department && (
                <span>
                  <Users size={15} />
                  {
                    selectedEmployee.department
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={styles.detailGrid}
        >
          {/* PERSONAL */}
          <div
            className={
              styles.detailSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <UserRound size={18} />
              {t(
                "employees.sections.personalInformation"
              )}
            </div>

            <div
              className={
                styles.infoGrid
              }
            >
              <div>
                <label>
                  {t(
                    "employees.detail.firstName"
                  )}
                </label>
                <span>
                  {
                    selectedEmployee.firstName
                  }
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.lastName"
                  )}
                </label>
                <span>
                  {
                    selectedEmployee.lastName
                  }
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.gender"
                  )}
                </label>
                <span>
                  {getGenderLabel(
                    selectedEmployee.gender
                  )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.dateOfBirth"
                  )}
                </label>
                <span>
                  {formatDate(
                    selectedEmployee.dateOfBirth
                  ) ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.nationality"
                  )}
                </label>
                <span>
                  {selectedEmployee.nationality ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.maritalStatus"
                  )}
                </label>
                <span>
                  {getMaritalStatusLabel(
                    selectedEmployee.maritalStatus
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* CONTACT */}
          <div
            className={
              styles.detailSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <Phone size={18} />
              {t(
                "employees.sections.contactInformation"
              )}
            </div>

            <div
              className={
                styles.infoGrid
              }
            >
              <div>
                <label>
                  {t(
                    "employees.detail.phone"
                  )}
                </label>
                <span>
                  {selectedEmployee.phone ? (
                    <>
                      <Phone size={14} />
                      {
                        selectedEmployee.phone
                      }
                    </>
                  ) : (
                    t(
                      "employees.detail.empty"
                    )
                  )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.email"
                  )}
                </label>
                <span>
                  {selectedEmployee.workEmail ? (
                    <>
                      <Mail size={14} />
                      {
                        selectedEmployee.workEmail
                      }
                    </>
                  ) : (
                    t(
                      "employees.detail.empty"
                    )
                  )}
                </span>
              </div>

              <div
                className={
                  styles.fullWidth
                }
              >
                <label>
                  {t(
                    "employees.detail.address"
                  )}
                </label>
                <span>
                  {formatCompanyAddress(
                    selectedEmployee.address
                  ) ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>
            </div>
          </div>

          {/* EMPLOYMENT */}
          <div
            className={
              styles.detailSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <BriefcaseBusiness
                size={18}
              />
              {t(
                "employees.sections.employment"
              )}
            </div>

            <div
              className={
                styles.infoGrid
              }
            >
              <div>
                <label>
                  {t(
                    "employees.detail.jobTitle"
                  )}
                </label>
                <span>
                  {selectedEmployee.jobTitle ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.department"
                  )}
                </label>
                <span>
                  {selectedEmployee.department ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.employmentType"
                  )}
                </label>
                <span>
                  {selectedEmployee.employmentType
                    ? getEmploymentTypeLabel(
                      selectedEmployee.employmentType
                    )
                    : t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.hireDate"
                  )}
                </label>
                <span>
                  {formatDate(
                    selectedEmployee.hireDate
                  ) ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.workLocation"
                  )}
                </label>
                <span>
                  {selectedEmployee.workLocation ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.service"
                  )}
                </label>
                <span>
                  {selectedEmployee.service ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>
            </div>
          </div>

          {/* IDENTIFICATION */}
          <div
            className={
              styles.detailSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <FileText size={18} />
              {t(
                "employees.sections.identification"
              )}
            </div>

            <div
              className={
                styles.infoGrid
              }
            >
              <div>
                <label>
                  {t(
                    "employees.detail.cin"
                  )}
                </label>
                <span>
                  {selectedEmployee.cin ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.passport"
                  )}
                </label>
                <span>
                  {selectedEmployee.passportNumber ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.cnssNumber"
                  )}
                </label>
                <span>
                  {selectedEmployee.cnssNumber ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>

              <div>
                <label>
                  {t(
                    "employees.detail.taxId"
                  )}
                </label>
                <span>
                  {selectedEmployee.taxIdentificationNumber ||
                    t(
                      "employees.detail.empty"
                    )}
                </span>
              </div>
            </div>
          </div>

          {/* COMPANY */}
          {employeeCompany && (
            <div
              className={
                styles.detailSection
              }
            >
              <div
                className={
                  styles.sectionTitle
                }
              >
                <BriefcaseBusiness
                  size={18}
                />
                {t(
                  "employees.sections.company"
                )}
              </div>

              <div
                className={
                  styles.companyDetail
                }
              >
                <strong>
                  {employeeCompany.shortName ||
                    employeeCompany.name ||
                    employeeCompany.companyName ||
                    t(
                      "employees.company.unnamed"
                    )}
                </strong>

                {formatCompanyAddress(
                  employeeCompany.address
                ) && (
                    <span>
                      <MapPin size={15} />
                      {formatCompanyAddress(
                        employeeCompany.address
                      )}
                    </span>
                  )}

                {employeeCompany.phone && (
                  <span>
                    <Phone size={15} />
                    {
                      employeeCompany.phone
                    }
                  </span>
                )}

                {employeeCompany.email && (
                  <span>
                    <Mail size={15} />
                    {
                      employeeCompany.email
                    }
                  </span>
                )}
              </div>
            </div>
          )}

          {/* NOTES */}
          {selectedEmployee.notes && (
            <div
              className={`${styles.detailSection} ${styles.fullWidthSection}`}
            >
              <div
                className={
                  styles.sectionTitle
                }
              >
                <FileText size={18} />
                {t(
                  "employees.sections.notes"
                )}
              </div>

              <p
                className={styles.notes}
              >
                {selectedEmployee.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ==========================================================
     MAIN PAGE
     ========================================================== */

  return (
    <div className={styles.page}>
      <Breadcrumbs
        items={breadcrumbItems}
        onNavigate={
          handleBreadcrumbNavigate
        }
      />

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <div
            className={styles.titleRow}
          >
            <Users size={26} />
            <h1>
              {t("employees.title")}
            </h1>
          </div>

          <p>
            {t("employees.subtitle")}
          </p>
        </div>

        {!showCreateForm && (
          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={
              openCreateForm
            }
          >
            <Plus size={18} />
            {t(
              "employees.addEmployee"
            )}
          </button>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div
          className={
            styles.errorMessage
          }
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      {showCreateForm && (
        <div
          className={
            styles.formArea
          }
        >
          <div
            className={
              styles.formTopBar
            }
          >
            <button
              type="button"
              className={
                styles.backButton
              }
              onClick={closeForm}
            >
              <ArrowLeft size={18} />
              {t(
                "employees.backToEmployees"
              )}
            </button>

            <span>
              {editingEmployee
                ? t(
                  "employees.editEmployee"
                )
                : t(
                  "employees.addEmployee"
                )}
            </span>
          </div>

          <EmployeeFormExtras
            t={t}
            companies={companies}
            formCompanyId={
              formCompanyId
            }
            setFormCompanyId={
              setFormCompanyId
            }
            photoPreview={
              photoPreview
            }
            photoInputRef={
              photoInputRef
            }
            handlePhotoChange={
              handlePhotoChange
            }
            clearPhoto={
              clearPhoto
            }
          />

          <CollapsibleForm
            title={
              editingEmployee
                ? t(
                  "employees.employeeInformation"
                )
                : t(
                  "employees.newEmployee"
                )
            }
            icon={
              <UserRound
                size={18}
                style={{
                  marginRight: 8,
                }}
              />
            }
            fields={
              employeeFields
            }
            initialValues={getInitialValues(
              editingEmployee
            )}
            defaultOpen={true}
            onSubmit={
              handleFormSubmit
            }
            buttons={[
              {
                label: saving
                  ? t(
                    "employees.buttons.save"
                  )
                  : editingEmployee
                    ? t(
                      "employees.buttons.updateEmployee"
                    )
                    : t(
                      "employees.buttons.createEmployee"
                    ),
                type: "submit",
                variant: "primary",
                disabled:
                  saving ||
                  companiesLoading,
              },
              {
                label: t(
                  "employees.buttons.cancel"
                ),
                type: "reset",
                variant: "secondary",
                onClick:
                  closeForm,
                disabled: saving,
              },
            ]}
          />
        </div>
      )}

      {/* LIST */}
      {!showCreateForm && (
        <>
          {/* TOOLBAR */}
          <div
            className={
              styles.toolbar
            }
          >
            <div
              className={
                styles.companySelector
              }
            >
              <label>
                {t(
                  "employees.toolbar.company"
                )}
              </label>

              <CustomSelect
                value={
                  selectedCompanyId
                }
                onChange={
                  setSelectedCompanyId
                }
                onSelect={
                  setSelectedCompanyId
                }
                options={
                  companyOptions
                }
                placeholder={
                  companiesLoading
                    ? t(
                      "employees.toolbar.loadingCompanies"
                    )
                    : t(
                      "employees.toolbar.selectCompany"
                    )
                }
              />
            </div>

            <div
              className={
                styles.searchWrapper
              }
            >
              <SearchBar
                placeholder={t(
                  "employees.toolbar.searchPlaceholder"
                )}
                onSearch={
                  setSearch
                }
                onClear={() =>
                  setSearch("")
                }
                isLoading={
                  loading
                }
              />
            </div>
          </div>

          {/* COMPANY INFO */}
          {selectedCompany && (
            <div
              className={
                styles.companyInfo
              }
            >
              <div
                className={
                  styles.companyInfoHeader
                }
              >
                <BriefcaseBusiness
                  size={18}
                />

                <div>
                  <strong>
                    {selectedCompany.shortName ||
                      selectedCompany.name ||
                      selectedCompany.companyName ||
                      t(
                        "employees.company.unnamed"
                      )}
                  </strong>

                  {formatCompanyAddress(
                    selectedCompany.address
                  ) && (
                      <span>
                        <MapPin size={14} />
                        {formatCompanyAddress(
                          selectedCompany.address
                        )}
                      </span>
                    )}
                </div>
              </div>

              <div
                className={
                  styles.companyStats
                }
              >
                <span>
                  {getEmployeeCountLabel(
                    pagination.total
                  )}
                </span>
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div
              className={
                styles.loading
              }
            >
              {t(
                "employees.loading"
              )}
            </div>
          )}

          {/* EMPTY - NO EMPLOYEES FOR THIS COMPANY */}
          {!loading &&
            selectedCompanyId &&
            employees.length === 0 && (
              <div
                className={
                  styles.emptyState
                }
              >
                <div
                  className={
                    styles.emptyIcon
                  }
                >
                  <Users size={32} />
                </div>

                <h3>
                  {t(
                    "employees.emptyNoEmployees.title"
                  )}
                </h3>

                <p>
                  {search
                    ? t(
                      "employees.emptyNoEmployees.messageSearch"
                    )
                    : t(
                      "employees.emptyNoEmployees.messageDefault"
                    )}
                </p>

                {!search && (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      openCreateForm
                    }
                  >
                    <Plus size={18} />
                    {t(
                      "employees.emptyNoEmployees.cta"
                    )}
                  </button>
                )}
              </div>
            )}

          {/* EMPLOYEE GRID */}
          {!loading &&
            employees.length > 0 && (
              <>
                <div
                  className={
                    styles.employeeGrid
                  }
                >
                  {employees.map((employee) => (
                    <EmployeeCard
                      key={employee._id}
                      employee={employee}
                      onSelect={handleSelectEmployee}
                      onEdit={openEditForm}
                      onDelete={handleDelete}
                      getStatusLabel={getStatusLabel}
                      viewLabel={t("employees.card.view")}
                      editLabel={t("employees.card.edit")}
                      deleteLabel={t("common.delete")}
                      employeeFallbackLabel={t(
                        "employees.detail.employeeLabel"
                      )}
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


          {/* EMPTY - NO COMPANIES AT ALL */}
          {!companiesLoading &&
            companies.length ===
            0 && (
              <div
                className={
                  styles.emptyState
                }
              >
                <div
                  className={
                    styles.emptyIcon
                  }
                >
                  <BriefcaseBusiness
                    size={32}
                  />
                </div>

                <h3>
                  {t(
                    "employees.emptyNoCompany.title"
                  )}
                </h3>

                <p>
                  {t(
                    "employees.emptyNoCompany.message"
                  )}
                </p>
              </div>
            )}
        </>
      )}
    </div>
  );
}