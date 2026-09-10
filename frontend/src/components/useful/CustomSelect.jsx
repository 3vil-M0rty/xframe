import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./CustomSelect.module.css";

export default function CustomSelect({
  id,
  value,
  onSelect,
  options = [],
  placeholder = "Select...",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  /* ============================================================
     NORMALIZE OPTIONS
     ============================================================ */

  const normalizedOptions = options.map((option) =>
    typeof option === "object"
      ? option
      : {
          value: option,
          label: option,
        }
  );

  const selected = normalizedOptions.find(
    (option) => String(option.value) === String(value)
  );

  /* ============================================================
     POSITION DROPDOWN
     ============================================================ */

  const updatePosition = () => {
    const trigger = triggerRef.current;

    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();

    const viewportHeight = window.innerHeight;

    const maxMenuHeight = 220;

    const spaceBelow =
      viewportHeight - rect.bottom;

    const spaceAbove = rect.top;

    const shouldFlip =
      spaceBelow < maxMenuHeight &&
      spaceAbove > spaceBelow;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,

      ...(shouldFlip
        ? {
            bottom:
              viewportHeight -
              rect.top +
              4,
          }
        : {
            top:
              rect.bottom +
              4,
          }),

      maxHeight: maxMenuHeight,
    });
  };

  /* ============================================================
     UPDATE POSITION WHEN OPEN
     ============================================================ */

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener(
      "scroll",
      handleReposition,
      true
    );

    window.addEventListener(
      "resize",
      handleReposition
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleReposition,
        true
      );

      window.removeEventListener(
        "resize",
        handleReposition
      );
    };
  }, [isOpen]);

  /* ============================================================
     CLICK OUTSIDE
     ============================================================ */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target
        ) &&
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* ============================================================
     ESCAPE KEY
     ============================================================ */

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  /* ============================================================
     SELECT
     ============================================================ */

  const handleSelect = (option) => {
    if (disabled) return;

    onSelect(option.value);

    setIsOpen(false);
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div
      className={`${styles.customSelect} ${
        disabled ? styles.disabled : ""
      }`}
      ref={wrapperRef}
    >
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`${styles.customSelectTrigger} ${
          isOpen
            ? styles.customSelectTriggerOpen
            : ""
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span
          className={
            selected
              ? styles.customSelectValue
              : styles.customSelectPlaceholder
          }
        >
          {selected
            ? selected.label
            : placeholder}
        </span>

        <span
          className={`${styles.customSelectChevron} ${
            isOpen
              ? styles.customSelectChevronOpen
              : ""
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
            className={
              styles.customSelectOptions
            }
            style={menuStyle}
            role="listbox"
          >
            {normalizedOptions.length === 0 ? (
              <li
                className={
                  styles.customSelectEmpty
                }
              >
                No options available
              </li>
            ) : (
              normalizedOptions.map(
                (option) => {
                  const isSelected =
                    String(
                      option.value
                    ) ===
                    String(value);

                  return (
                    <li
                      key={String(
                        option.value
                      )}
                      role="option"
                      aria-selected={
                        isSelected
                      }
                      className={`${styles.customSelectOption} ${
                        isSelected
                          ? styles.customSelectOptionActive
                          : ""
                      }`}
                      onClick={() =>
                        handleSelect(
                          option
                        )
                      }
                    >
                      {option.label}
                    </li>
                  );
                }
              )
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}