import {
  Eye,
  Edit,
  Trash2,
  UserRound,
  Users,
  FileText,
  Phone,
  Mail,
} from "lucide-react";

import styles from "./EmployeeCard.module.css";

function formatEmployeeName(employee) {
  if (!employee) return "";

  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

/**
 * A single employee card for the Employees grid.
 *
 * Pulled out of pages/hr/Employees.jsx so it can be reused anywhere
 * else an employee needs to be shown as a card, and so the grid
 * itself only has to render <EmployeeCard /> instead of ~230 lines
 * of inline JSX per card.
 */
export default function EmployeeCard({
  employee,
  onSelect,
  onEdit,
  onDelete,
  getStatusLabel,
  viewLabel = "View",
  editLabel = "Edit",
  deleteLabel = "Delete",
  employeeFallbackLabel = "Employee",
}) {
  const handleActivate = () => {
    onSelect?.(employee);
  };

  const statusLabel = getStatusLabel
    ? getStatusLabel(employee.employmentStatus)
    : employee.employmentStatus;

  return (
    <div
      className={styles.employeeCard}
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className={styles.employeeCardTop}>
        <div className={styles.employeeAvatar}>
          {employee.photo?.url ? (
            <img
              src={employee.photo.url}
              alt={formatEmployeeName(employee)}
            />
          ) : (
            <UserRound size={26} />
          )}
        </div>

        <span
          className={`${styles.statusBadge} ${
            employee.employmentStatus === "active"
              ? styles.statusActive
              : styles.statusInactive
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className={styles.employeeCardBody}>
        <h3>{formatEmployeeName(employee)}</h3>

        <p className={styles.employeeJob}>
          {employee.jobTitle || employee.position || employeeFallbackLabel}
        </p>

        <div className={styles.employeeMeta}>
          {employee.employeeNumber && (
            <span className={styles.employeeMetaItem}>
              <FileText size={14} />
              {employee.employeeNumber}
            </span>
          )}

          {employee.department && (
            <span className={styles.employeeMetaItem}>
              <Users size={14} />
              {employee.department}
            </span>
          )}

          {employee.phone && (
            <span className={styles.employeeMetaItem}>
              <Phone size={14} />
              {employee.phone}
            </span>
          )}

          {employee.workEmail && (
            <span className={styles.employeeMetaItem}>
              <Mail size={14} />
              {employee.workEmail}
            </span>
          )}
        </div>
      </div>

      <div className={styles.employeeCardActions}>
        <button
          type="button"
          className={styles.actionButton}
          title={viewLabel}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(employee);
          }}
        >
          <Eye size={16} />
        </button>

        <button
          type="button"
          className={styles.actionButton}
          title={editLabel}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.(employee);
          }}
        >
          <Edit size={16} />
        </button>

        <button
          type="button"
          className={styles.actionButtonDanger}
          title={deleteLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(employee);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
