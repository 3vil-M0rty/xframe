import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

/**
 * Interface theme (dark / light), applied as <html data-theme="…">.
 *
 * Which theme a user sees:
 *   1. their own choice (User.preferences.theme), saved on their account
 *      so it follows them from one device to another;
 *   2. otherwise the company default — the "Thème sombre" box of the
 *      company page (Company.branding.darkMode), sent by /users/me as
 *      `companyTheme`;
 *   3. otherwise dark (the historic look).
 *
 * The last applied theme is also kept in localStorage so a reload paints
 * the right colours before /users/me answers (see main.jsx).
 */
export const ThemeContext = createContext()

const STORAGE_KEY = 'theme'
const valid = (t) => (t === 'light' || t === 'dark' ? t : null)

export function applyTheme(theme) {
  const t = valid(theme) || 'dark'
  document.documentElement.dataset.theme = t
  try { localStorage.setItem(STORAGE_KEY, t) } catch { /* private mode */ }
}

export function storedTheme() {
  try { return valid(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth()
  // undefined = not changed in this session → use what /users/me said
  const [preference, setPreferenceState] = useState(undefined)
  const [companyTheme, setCompanyTheme] = useState(undefined)

  // A new login (or logout) starts again from the account's values
  useEffect(() => {
    setPreferenceState(undefined)
    setCompanyTheme(undefined)
  }, [user?._id])

  const userPreference = preference !== undefined ? preference : valid(user?.preferences?.theme)
  const companyDefault = companyTheme !== undefined ? companyTheme : valid(user?.companyTheme)
  const theme = user ? (userPreference || companyDefault || 'dark') : (storedTheme() || 'dark')

  useEffect(() => { applyTheme(theme) }, [theme])

  /** 'dark' | 'light' | null (null = follow the company) */
  const setPreference = useCallback(async (next) => {
    const value = valid(next)
    setPreferenceState(value)
    try {
      await api.patch('/users/me/preferences', { theme: value })
    } catch {
      // The theme still changes for this session; it just isn't saved.
    }
  }, [])

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference])

  /** After the company page saves "Thème sombre", reflect it at once. */
  const refreshCompanyTheme = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me')
      setCompanyTheme(valid(data?.data?.companyTheme))
    } catch { /* keep the current one */ }
  }, [])

  const value = useMemo(() => ({
    theme,
    preference: userPreference,
    companyTheme: companyDefault || 'dark',
    setPreference,
    toggle,
    refreshCompanyTheme,
  }), [theme, userPreference, companyDefault, setPreference, toggle, refreshCompanyTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
