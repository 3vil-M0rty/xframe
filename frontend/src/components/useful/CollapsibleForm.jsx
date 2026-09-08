import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./CollapsibleForm.module.css";

export default function CollapsibleForm({
  title = "Form",
  icon,
  fields = [],
  buttons = [],
  onSubmit,
  defaultOpen = false,
  initialValues = {},
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // ========================================
  // FORM DATA
  // ========================================

  const [formData, setFormData] = useState(initialValues);

  // Keep form synchronized when initialValues change
  useEffect(() => {
    setFormData(initialValues);
  }, [initialValues]);

  // ========================================
  // PASSWORD VISIBILITY
  // ========================================

  const [showPasswords, setShowPasswords] = useState({});

  // ========================================
  // HANDLE INPUT CHANGES
  // ========================================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
      files,
    } = e.target;

    setFormData((prev) => ({
      ...prev,

      ...(type === "file"
        ? {
            [name]: files?.[0] || null,
          }
        : {
            [name]:
              type === "checkbox"
                ? checked
                : value,
          }),
    }));
  };

  // ========================================
  // RESET FORM
  // ========================================

  const resetForm = () => {
    setFormData(initialValues);

    // Also hide any visible passwords
    setShowPasswords({});
  };

  // ========================================
  // TOGGLE PASSWORD VISIBILITY
  // ========================================

  const togglePassword = (fieldName) => {
    setShowPasswords((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  // ========================================
  // SUBMIT FORM
  // ========================================

  const handleSubmit = (e) => {
    e.preventDefault();

    if (onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <div className={styles.formContainer}>

      {/* ==============================
          HEADER
          ============================== */}

      <button
        type="button"
        className={styles.formHeader}
        onClick={() =>
          setIsOpen((prev) => !prev)
        }
      >
        <span className={styles.formTitle}>
          {icon}
          {title}
        </span>

        <span
          className={`${styles.chevron} ${
            isOpen ? styles.chevronOpen : ""
          }`}
        >
          ↓
        </span>
      </button>

      {/* ==============================
          FORM CONTENT
          ============================== */}

      <div
        className={`${styles.formContent} ${
          isOpen ? styles.formContentOpen : ""
        }`}
      >
        <form onSubmit={handleSubmit}>

          {/* ==============================
              FIELDS
              ============================== */}

          <div className={styles.fields}>

            {fields.map((field) => (
              <div
                key={field.name}
                className={`${styles.field} ${
                  field.fullWidth ? styles.fullWidth : ""
                }`}
              >

                {/* LABEL */}

                <label htmlFor={field.name}>
                  {field.label}

                  {field.required && (
                    <span className={styles.required}>
                      *
                    </span>
                  )}
                </label>

                {/* TEXTAREA */}

                {field.type === "textarea" && (
                  <textarea
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    value={formData[field.name] ?? ""}
                    onChange={handleChange}
                    required={field.required}
                    rows={field.rows || 4}
                  />
                )}

                {/* SELECT */}

                {field.type === "select" && (
                  <select
                    id={field.name}
                    name={field.name}
                    value={formData[field.name] ?? ""}
                    onChange={handleChange}
                    required={field.required}
                  >
                    <option value="">
                      {field.placeholder || "Select..."}
                    </option>

                    {field.options?.map((option) => {
                      const value =
                        typeof option === "object"
                          ? option.value
                          : option;

                      const label =
                        typeof option === "object"
                          ? option.label
                          : option;

                      return (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* CHECKBOX */}

                {field.type === "checkbox" && (
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      id={field.name}
                      name={field.name}
                      checked={
                        formData[field.name] || false
                      }
                      onChange={handleChange}
                    />

                    <span>
                      {field.checkboxLabel}
                    </span>
                  </label>
                )}

                {/* PASSWORD */}

                {field.type === "password" && (
                  <div className={styles.passwordWrapper}>
                    <input
                      id={field.name}
                      name={field.name}
                      type={
                        showPasswords[field.name]
                          ? "text"
                          : "password"
                      }
                      placeholder={field.placeholder}
                      value={formData[field.name] ?? ""}
                      onChange={handleChange}
                      required={field.required}
                    />

                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() =>
                        togglePassword(field.name)
                      }
                      aria-label={
                        showPasswords[field.name]
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPasswords[field.name] ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                )}

                {/* FILE */}

                {field.type === "file" && (
                  <div className={styles.fileWrapper}>
                    <input
                      id={field.name}
                      name={field.name}
                      type="file"
                      accept={field.accept}
                      onChange={handleChange}
                      required={field.required}
                    />

                    {formData[field.name] instanceof File && (
                      <small className={styles.fileName}>
                        {formData[field.name].name}
                      </small>
                    )}
                  </div>
                )}

                {/* NORMAL INPUT */}

                {![
                  "textarea",
                  "select",
                  "checkbox",
                  "password",
                  "file",
                ].includes(field.type) && (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    value={formData[field.name] ?? ""}
                    onChange={handleChange}
                    required={field.required}
                  />
                )}

                {/* HELP TEXT */}

                {field.helpText && (
                  <small className={styles.helpText}>
                    {field.helpText}
                  </small>
                )}

              </div>
            ))}

          </div>

          {/* ==============================
              BUTTONS
              ============================== */}

          {buttons.length > 0 && (
            <div className={styles.actions}>

              {buttons.map((button) => (

                <button
                  key={button.label}
                  type={button.type || "button"}
                  className={`${styles.button} ${
                    styles[button.variant || "primary"]
                  }`}
                  onClick={
                    button.type === "reset"
                      ? resetForm
                      : button.onClick
                  }
                  disabled={button.disabled}
                >
                  {button.label}
                </button>

              ))}

            </div>
          )}

        </form>
      </div>
    </div>
  );
}
