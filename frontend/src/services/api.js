import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

// ← ADD THIS: Interceptor adds token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ← ADD THIS: Handle 401 errors (redirect to login if token invalid)
// A 403 "missing permission" names the permission key: turn it into a
// readable sentence ("Ventes › Devis › Créer") in the user's language,
// so every page shows the same clear message without extra code.
const MISSING = {
  fr: "Vous n'avez pas le droit : {p}. Demandez-le à votre responsable.",
  en: "You don't have the permission: {p}. Ask your manager.",
  ar: "ليست لديك صلاحية: {p}. اطلبها من مسؤولك.",
  es: "No tiene el permiso: {p}. Pídalo a su responsable.",
  pt: "Não tem a permissão: {p}. Peça-a ao seu responsável.",
  de: "Ihnen fehlt die Berechtigung: {p}. Fragen Sie Ihren Vorgesetzten.",
}
// Quota reached (limits given by the platform — backend services/tenantLimits.js).
const QUOTA = {
  COMPANY_QUOTA: {
    fr: "Limite de sociétés atteinte ({used} / {max}). Contactez la plateforme pour l'augmenter.",
    en: "Company limit reached ({used} / {max}). Contact the platform to raise it.",
    ar: "تم بلوغ الحد الأقصى للشركات ({used} / {max}). تواصل مع المنصة لرفعه.",
    es: "Límite de empresas alcanzado ({used} / {max}). Contacte con la plataforma para aumentarlo.",
    pt: "Limite de empresas atingido ({used} / {max}). Contacte a plataforma para o aumentar.",
    de: "Unternehmenslimit erreicht ({used} / {max}). Wenden Sie sich an die Plattform, um es zu erhöhen.",
  },
  EMPLOYEE_QUOTA: {
    fr: "Limite d'employés atteinte ({used} / {max}{extra}). Contactez la plateforme pour l'augmenter.",
    en: "Employee limit reached ({used} / {max}{extra}). Contact the platform to raise it.",
    ar: "تم بلوغ الحد الأقصى للموظفين ({used} / {max}{extra}). تواصل مع المنصة لرفعه.",
    es: "Límite de empleados alcanzado ({used} / {max}{extra}). Contacte con la plataforma para aumentarlo.",
    pt: "Limite de funcionários atingido ({used} / {max}{extra}). Contacte a plataforma para o aumentar.",
    de: "Mitarbeiterlimit erreicht ({used} / {max}{extra}). Wenden Sie sich an die Plattform, um es zu erhöhen.",
  },
}
const REQUESTED = { fr: " — {n} demandés", en: " — {n} requested", ar: " — {n} مطلوب", es: " — {n} solicitados", pt: " — {n} pedidos", de: " — {n} angefragt" }

let permissionLabels = null
async function permissionLabel(key, language) {
  if (!permissionLabels) {
    permissionLabels = new Map()
    try {
      const r = await api.get('/permissions/catalog')
      const lang = language === 'fr' || language === 'ar' ? 'fr' : 'en'
      for (const m of r.data?.data?.modules || []) {
        for (const res of m.resources) {
          for (const a of res.actions) permissionLabels.set(a.perm, [m.label, res.label, a.label].map((l) => l[lang] || l.fr).join(' › '))
        }
      }
    } catch { /* keep the key */ }
  }
  return permissionLabels.get(key) || key
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    const data = error.response?.data
    if (error.response?.status === 403 && data && typeof data.permission === 'string') {
      const language = localStorage.getItem('language') || 'fr'
      data.message = (MISSING[language] || MISSING.fr).replace('{p}', await permissionLabel(data.permission, language))
    }
    if (error.response?.status === 403 && data && QUOTA[data.code] && data.quota) {
      const language = localStorage.getItem('language') || 'fr'
      const company = data.code === 'COMPANY_QUOTA'
      const extra = !company && data.requested > 1 ? (REQUESTED[language] || REQUESTED.fr).replace('{n}', data.requested) : ''
      data.message = (QUOTA[data.code][language] || QUOTA[data.code].fr)
        .replace('{used}', company ? data.quota.companies : data.quota.employees)
        .replace('{max}', company ? data.quota.maxCompanies : data.quota.maxEmployees)
        .replace('{extra}', extra)
    }
    return Promise.reject(error)
  }
)

export default api