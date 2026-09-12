import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * `permission` is optional: pass a function like `canAccessHR` from
 * utils/permissions.js to also gate this route by role/department,
 * on top of the base "must be logged in" check. Someone who's
 * logged in but fails the permission check is bounced to /profile
 * rather than /login, since they ARE authenticated — they just
 * can't see this particular section.
 *
 * Usage:
 *   <ProtectedRoute><Layout /></ProtectedRoute>                    // auth only
 *   <ProtectedRoute permission={canAccessHR}><Layout /></ProtectedRoute>  // auth + permission
 */
export default function ProtectedRoute({ children, permission }) {
  const { token, user, loading } = useAuth()

  if (!token) return <Navigate to="/" replace />

  // Wait for the real user (with role/department) to load before
  // evaluating a permission check — otherwise a hard refresh on a
  // permission-gated route would momentarily see `user === null`
  // and redirect away even for someone who's actually allowed in.
  if (permission && !loading && !permission(user)) {
    return <Navigate to="/profile" replace />
  }

  return children
}
