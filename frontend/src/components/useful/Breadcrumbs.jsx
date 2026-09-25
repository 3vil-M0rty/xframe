import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import styles from "./Breadcrumbs.module.css";
import { useI18n } from "../../hooks/useI18n";

/**
 * Breadcrumb trail. Each item: { label, href?, id? }
 *   - item with `href`      -> navigates there
 *   - item without `href`   -> calls `onNavigate(item)` if the page passed
 *                              one (in-page views, e.g. Employees list/detail)
 *   - neither               -> plain text (a section name) — never a
 *                              button that looks clickable but does nothing
 *   - last item             -> the current page, not clickable
 * The home icon always goes to the landing page.
 *
 * Before: clicks ONLY called `onNavigate`, which just two pages passed,
 * so on every other page no breadcrumb (not even Home) did anything.
 */
export default function Breadcrumbs({ items = [], onNavigate }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const go = (item) => {
    if (item.href) navigate(item.href);
    else onNavigate?.(item);
  };

  return (
    <nav className={styles.breadcrumbs} aria-label={t("common.breadcrumb")}>
      <button type="button" className={styles.home} onClick={() => navigate("/profile")} aria-label={t("common.home")}>
        <Home size={14} />
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const clickable = !isLast && (item.href || (onNavigate && item.id));

        return (
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={`${index}-${item.label}`}>
            <ChevronRight size={14} className={styles.separator} />
            {isLast ? (
              <span className={styles.current} aria-current="page">{item.label}</span>
            ) : clickable ? (
              <button type="button" className={styles.link} onClick={() => go(item)}>{item.label}</button>
            ) : (
              <span className={styles.section}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
