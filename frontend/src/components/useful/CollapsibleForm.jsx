import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createPortal } from "react-dom";

import styles from "./CollapsibleForm.module.css";

// ========================================
// CUSTOM SELECT (styled dropdown, replaces native <select>)
// ========================================

function CustomSelect({ id, value, onSelect, options = [], placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const maxMenuHeight = 220;
    const spaceBelow = viewportHeight - rect.bottom;
    const shouldFlip = spaceBelow < maxMenuHeight && rect.top > spaceBelow;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(shouldFlip
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      maxHeight: maxMenuHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => updatePosition();

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedOptions = options.map((option) =>
    typeof option === "object" ? option : { value: option, label: option }
  );

  const selected = normalizedOptions.find((option) => option.value === value);

  return (
    <div className={styles.customSelect} ref={wrapperRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`${styles.customSelectTrigger} ${isOpen ? styles.customSelectTriggerOpen : ""
          }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={
            selected ? styles.customSelectValue : styles.customSelectPlaceholder
          }
        >
          {selected ? selected.label : placeholder || "Select..."}
        </span>
        <span
          className={`${styles.customSelectChevron} ${isOpen ? styles.customSelectChevronOpen : ""
            }`}
        >
          ↓
        </span>
      </button>

      {isOpen &&
        menuStyle &&
        createPortal(
          <ul
            ref={menuRef}
            className={styles.customSelectOptions}
            style={menuStyle}
            role="listbox"
          >
            {normalizedOptions.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`${styles.customSelectOption} ${option.value === value ? styles.customSelectOptionActive : ""
                  }`}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

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
    const { name, value, type, checked, files } = e.target;

    setFormData((prev) => ({
      ...prev,
      ...(type === "file"
        ? { [name]: files?.[0] || null }
        : { [name]: type === "checkbox" ? checked : value }),
    }));
  };

  // ========================================
  // HANDLE CUSTOM SELECT CHANGES
  // (mirrors handleChange but for the custom dropdown,
  // which has no native input event to read from)
  // ========================================

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ========================================
  // RESET FORM
  // ========================================

  const resetForm = () => {
    setFormData(initialValues);
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

      <button
        type="button"
        className={styles.formHeader}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={styles.formTitle}>
          {icon}
          {title}
        </span>

        <span
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""
            }`}
        >
          ↓
        </span>
      </button>

      <div
        className={`${styles.formContent} ${isOpen ? styles.formContentOpen : ""
          }`}
      >
        <form onSubmit={handleSubmit}>

          <div className={styles.fields}>
            {fields.map((field) => (
              <div
                key={field.name}
                className={`${styles.field} ${field.fullWidth ? styles.fullWidth : ""
                  }`}
              >
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && (
                    <span className={styles.required}>*</span>
                  )}
                </label>

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

                {/* SELECT — now a styled custom dropdown */}

                {field.type === "select" && (
                  <CustomSelect
                    id={field.name}
                    value={formData[field.name] ?? ""}
                    onSelect={(value) =>
                      handleSelectChange(field.name, value)
                    }
                    options={field.options}
                    placeholder={field.placeholder}
                  />
                )}

                {field.type === "checkbox" && (
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      id={field.name}
                      name={field.name}
                      checked={formData[field.name] || false}
                      onChange={handleChange}
                    />
                    <span>{field.checkboxLabel}</span>
                  </label>
                )}

                {field.type === "password" && (
                  <div className={styles.passwordWrapper}>
                    <input
                      id={field.name}
                      name={field.name}
                      type={showPasswords[field.name] ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={formData[field.name] ?? ""}
                      onChange={handleChange}
                      required={field.required}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => togglePassword(field.name)}
                      aria-label={
                        showPasswords[field.name] ? "Hide password" : "Show password"
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

                {field.helpText && (
                  <small className={styles.helpText}>
                    {field.helpText}
                  </small>
                )}
              </div>
            ))}
          </div>

          {buttons.length > 0 && (
            <div className={styles.actions}>
              {buttons.map((button) => (
                <button
                  key={button.label}
                  type={button.type || "button"}
                  className={`${styles.button} ${styles[button.variant || "primary"]
                    }`}
                  onClick={
                    button.type === "reset" ? resetForm : button.onClick
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