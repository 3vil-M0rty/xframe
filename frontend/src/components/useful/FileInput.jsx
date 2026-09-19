import { useRef } from "react";

import styles from "./FileInput.module.css";

/**
 * A styled file picker that looks/behaves consistently across every
 * browser. Native <input type="file"> renders its "choose file"
 * button and filename label as internal, browser-drawn shadow-DOM
 * content — the ::file-selector-button pseudo-element can restyle
 * its colors, but relying on flex/align-items to vertically center
 * it turned out to be inconsistent across browsers (fine in some,
 * top-aligned in others). This component sidesteps that entirely:
 * the real <input type="file"> is visually hidden and triggered
 * programmatically, while the button and filename the user actually
 * sees are ordinary DOM elements we fully control, so centering,
 * spacing, and hover states behave exactly like any other button.
 *
 *   <FileInput
 *     value={selectedFile}
 *     onChange={setSelectedFile}
 *     accept="image/*,application/pdf"
 *     chooseLabel={t("common.chooseFile")}
 *     emptyLabel={t("common.noFileChosen")}
 *   />
 */
export default function FileInput({
  value,
  onChange,
  accept,
  chooseLabel,
  emptyLabel,
  disabled = false,
  id,
}) {
  const inputRef = useRef(null);

  return (
    <div className={`${styles.wrapper} ${disabled ? styles.wrapperDisabled : ""}`}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {chooseLabel}
      </button>
      <span className={styles.fileName} title={value?.name || emptyLabel}>
        {value?.name || emptyLabel}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        style={{ display: "none" }}
      />
    </div>
  );
}
