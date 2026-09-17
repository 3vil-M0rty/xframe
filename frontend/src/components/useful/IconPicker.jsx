import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { INVENTORY_ICON_NAMES, getInventoryIcon } from "../../utils/inventoryIcons";

import styles from "./IconPicker.module.css";

/**
 * A small trigger button showing the currently-chosen icon, which
 * opens a grid of the curated inventory icon set to pick from.
 * Controlled — `value` is the icon NAME (a string), not a
 * component, matching how InventoryCategory stores it.
 */
export default function IconPicker({ value, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const SelectedIcon = getInventoryIcon(value);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <SelectedIcon size={18} />
        <span>{value || "Package"}</span>
        <ChevronDown size={14} className={styles.chevron} />
      </button>

      {isOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.grid}>
            {INVENTORY_ICON_NAMES.map((name) => {
              const Icon = getInventoryIcon(name);
              const isSelected = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  className={`${styles.iconBtn} ${isSelected ? styles.iconBtnSelected : ""}`}
                  title={name}
                  onClick={() => {
                    onSelect(name);
                    setIsOpen(false);
                  }}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
