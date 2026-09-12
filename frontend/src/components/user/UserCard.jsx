import { User, Mail, Shield, Edit, Trash2 } from "lucide-react";
import styles from "./UserCard.module.css";

/**
 * A single user card for the Users admin grid.
 *
 * Pulled out of pages/owner/Users.jsx so it can be reused anywhere
 * else a user needs to be shown as a card (e.g. a "members of this
 * department" widget later on) without copy-pasting the markup and
 * CSS again.
 *
 * Formatting of role/department/status is left to the caller (via
 * `getRoleLabel` / `getDepartmentLabel` / `getStatusLabel`) since
 * those already exist in Users.jsx and are translation-aware.
 */
export default function UserCard({
  user,
  canEdit = false,
  canDelete = false,
  onSelect,
  onEdit,
  onDelete,
  getRoleLabel,
  getDepartmentLabel,
  getStatusLabel,
  editLabel = "Edit",
  deleteLabel = "Delete",
}) {
  const handleActivate = () => {
    onSelect?.(user);
  };

  return (
    <div
      className={`resourceCard ${styles.userCard}`}
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
      {/* CARD ACTIONS: EDIT / DELETE */}

      {(canEdit || canDelete) && (
        <div className="cardActionsOverlay">
          {canEdit && (
            <button
              type="button"
              className="cardActionIconBtn"
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.(user);
              }}
              title={editLabel}
              aria-label={editLabel}
            >
              <Edit size={15} />
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="cardActionIconBtnDanger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.(user);
              }}
              title={deleteLabel}
              aria-label={deleteLabel}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}

      {/* AVATAR */}

      <div className={`avatarCircle ${styles.avatar}`}>
        <User size={20} />
      </div>

      {/* USER INFO */}

      <div className={styles.userMain}>
        <h2>
          {user.firstName} {user.lastName}
        </h2>

        <div className={styles.email}>
          <Mail size={13} />
          <span>{user.email}</span>
        </div>
      </div>

      {/* META */}

      <div className={styles.userMeta}>
        <div className={`pillTag ${styles.role}`}>
          <Shield size={13} />
          {getRoleLabel ? getRoleLabel(user.role) : user.role}
        </div>

        <div className={`pillTag ${styles.department}`}>
          {getDepartmentLabel
            ? getDepartmentLabel(user.department)
            : user.department}
        </div>

        <div className={`pillTag ${styles.status}`}>
          {getStatusLabel ? getStatusLabel(user.status) : user.status}
        </div>
      </div>
    </div>
  );
}
