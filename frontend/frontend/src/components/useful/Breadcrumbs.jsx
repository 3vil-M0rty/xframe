import React from "react";
import { ChevronRight, Home } from "lucide-react";
import styles from "./Breadcrumbs.module.css";

export default function Breadcrumbs({
  items = [],
  onNavigate,
}) {
  return (
    <nav
      className={styles.breadcrumbs}
      aria-label="Breadcrumb"
    >
      {/* HOME */}

      <button
        type="button"
        className={styles.home}
        onClick={() =>
          onNavigate?.(null)
        }
        aria-label="Home"
      >
        <Home size={14} />
      </button>

      {items.map((item, index) => {
        const isLast =
          index === items.length - 1;

        return (
          <React.Fragment key={item.label}>
            <ChevronRight
              size={14}
              className={styles.separator}
            />

            {isLast ? (
              <span className={styles.current}>
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                className={styles.link}
                onClick={() =>
                  onNavigate?.(item)
                }
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
