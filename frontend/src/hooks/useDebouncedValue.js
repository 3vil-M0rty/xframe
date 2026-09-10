import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after
 * `delay` ms have passed without `value` changing.
 *
 * Used by search inputs (Users, Employees) that trigger a backend
 * request on every change — without this, every keystroke would
 * fire its own request.
 */
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
