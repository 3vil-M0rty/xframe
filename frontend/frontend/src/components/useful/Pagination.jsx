import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Pagination.module.css";

/**
 * Simple numbered pagination control.
 *
 * Used to cap how many cards render at once on the Users and
 * Employees grids (and anywhere else a "resource card" grid needs
 * paging) so the page stays fast instead of rendering hundreds of
 * cards at once.
 */
export default function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  summaryLabel,
}) {
  if (!pages || pages <= 1) {
    return null;
  }

  const goTo = (nextPage) => {
    if (nextPage < 1 || nextPage > pages || nextPage === page) {
      return;
    }

    onPageChange?.(nextPage);
  };

  // Build a compact list of page numbers: first, last, current
  // neighbours, and "…" gaps in between — so this stays readable
  // even with a large number of pages.
  const pageNumbers = [];
  const windowSize = 1;

  for (let i = 1; i <= pages; i += 1) {
    const isEdge = i === 1 || i === pages;
    const isNearCurrent = Math.abs(i - page) <= windowSize;

    if (isEdge || isNearCurrent) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== "…") {
      pageNumbers.push("…");
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {typeof total === "number" && (
        <span className={styles.summary}>
          {summaryLabel
            ? summaryLabel
                .replace("{start}", String(rangeStart))
                .replace("{end}", String(rangeEnd))
                .replace("{total}", String(total))
            : `${rangeStart}–${rangeEnd} of ${total}`}
        </span>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pageNumbers.map((entry, index) =>
          entry === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className={styles.ellipsis}
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={`${styles.pageButton} ${
                entry === page ? styles.pageButtonActive : ""
              }`}
              onClick={() => goTo(entry)}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          className={styles.navButton}
          onClick={() => goTo(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
