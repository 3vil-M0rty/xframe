import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { can } from "../utils/permissions";

/**
 * const can = useCan(); can("sales.quotes.create") — shows / hides a
 * button from the login's fine-grained permissions (the server checks
 * them again). Before /users/me has loaded the permission list, every
 * button shows and the server has the last word.
 */
export function useCan() {
  const { user } = useAuth();
  return useCallback((key) => (Array.isArray(user?.permissions) ? can(user, key) : true), [user]);
}
