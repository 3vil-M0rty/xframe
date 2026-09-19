import { useEffect, useMemo, useState } from "react";
import { Search, X, User } from "lucide-react";

// Reuses SearchBar's own CSS module so this looks IDENTICAL to
// every other search bar in the app — same box, same suggestions
// dropdown, same spacing. This is intentional: it's not a new
// visual style, just a different behavior (pick one result instead
// of live-filtering a list) layered on the same look.
import styles from "./SearchBar.module.css";

/**
 * A search-as-you-type dropdown that resolves to a single selected
 * value (e.g. picking an employee by name, number, CIN, CNSS...),
 * rather than SearchBar's "every keystroke filters a list" behavior.
 *
 * `options` is an array of:
 *   { value, label, searchText? }
 * `searchText` is what gets matched against as the user types
 * (defaults to `label` if omitted) — pass a combined string of
 * every field you want searchable (name + number + CNSS + phone...).
 *
 * Controlled by `value` / `onSelect`, so it drops into
 * CollapsibleForm's field system exactly like the "select" type
 * does (see CollapsibleForm.jsx's "search-select" field type).
 */
export default function SearchSelect({
  id,
  value,
  onSelect,
  options = [],
  placeholder = "Search...",
  noResultsLabel = "No results found",
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  // Keep the input showing the current selection's label whenever
  // the controlled `value` changes from outside (e.g. prefilled via
  // a row's "Give a raise" button, or reset when the form closes),
  // as long as the user isn't actively typing a new search.
  useEffect(() => {
    if (!isOpen) {
      setQuery(selected ? selected.label : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.value]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) => {
          const haystack = (
            option.searchText || option.label || ""
          ).toLowerCase();
          return haystack.includes(normalizedQuery);
        });

  const handleChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
    // Start from a blank slate so the user can search freely
    // instead of having to clear the current selection's label
    // first.
    setQuery("");
  };

  const handleBlur = () => {
    // Delay so a click on a suggestion registers before we close
    // (mirrors SearchBar's own blur handling).
    setTimeout(() => {
      setIsOpen(false);
      setQuery(selected ? selected.label : "");
    }, 200);
  };

  const handleSelect = (option) => {
    onSelect?.(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect?.("");
    setQuery("");
    setIsOpen(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <Search size={18} className={styles.icon} />
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={styles.input}
          autoComplete="off"
        />
        {(query || selected) && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearBtn}
            title="Clear"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.suggestions}>
          {filteredOptions.length === 0 ? (
            <div className={styles.suggestionItem}>
              <span>{noResultsLabel}</span>
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.suggestionItem}
                // onMouseDown (not onClick) fires before the input's
                // onBlur, so the selection registers before the blur
                // handler resets the query.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
              >
                <User size={14} />
                <span>{option.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
