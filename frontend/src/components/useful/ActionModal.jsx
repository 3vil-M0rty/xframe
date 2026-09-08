import React, { useEffect, useState } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import styles from "./ActionModal.module.css";

export default function ActionModal({
  isOpen,
  type = "confirm",

  title,
  message,

  confirmText = "common.confirm",
  cancelText = "common.cancel",
  closeText = "common.close",

  onConfirm,
  onClose,

  loading = false,
}) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const {t} = useI18n();

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  // Escape closes modal
  useEffect(() => {
    if (!isOpen || loading) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isVisible) return null;

  const isConfirm = type === "confirm";
  const isSuccess = type === "success";
  const isError = type === "error";

  const handleBackdropClick = () => {
    if (!loading) {
      onClose?.();
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ==============================
            CLOSE BUTTON
            ============================== */}

        {!loading && (
          <button
            type="button"
            className={styles.closeIcon}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}


        {/* ==============================
            ICON
            ============================== */}

        <div
          className={`${styles.iconWrapper} ${
            isSuccess
              ? styles.success
              : isError
              ? styles.error
              : styles.confirm
          }`}
        >
          {isSuccess && (
            <Check size={25} strokeWidth={2} />
          )}

          {isError && (
            <X size={25} strokeWidth={2} />
          )}

          {isConfirm && (
            <AlertTriangle
              size={25}
              strokeWidth={1.8}
            />
          )}
        </div>


        {/* ==============================
            CONTENT
            ============================== */}

        <div className={styles.content}>
          <h3>
            {title ||
              (isConfirm
                ? "Confirm Action"
                : isSuccess
                ? "Success"
                : "Something went wrong")}
          </h3>

          <p>
            {message}
          </p>
        </div>


        {/* ==============================
            CONFIRM BUTTONS
            ============================== */}

        {isConfirm && (
          <div className={styles.actions}>

            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              {t(cancelText)}
            </button>

            <button
              type="button"
              className={styles.confirmButton}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2
                    size={16}
                    className={styles.spinner}
                  />
                  Processing...
                </>
              ) : (
                t(confirmText)
              )}
            </button>

          </div>
        )}


        {/* ==============================
            RESULT BUTTON
            ============================== */}

        {(isSuccess || isError) && (
          <button
            type="button"
            className={
              isSuccess
                ? styles.successButton
                : styles.errorButton
            }
            onClick={onClose}
          >
            {t(closeText)}
          </button>
        )}

      </div>
    </div>
  );
}