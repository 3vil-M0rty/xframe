import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginPage.module.css'
import ShinyText from '../components/useful/ShinyText'
import { ShieldCheck } from 'lucide-react'
import { useI18n } from "../hooks/useI18n";

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, verifyTwoFactorLogin, loading, token } = useAuth()
  const navigate = useNavigate()

  // 'credentials' is the normal email/password form. An account
  // with 2FA enabled moves to 'twoFactor' after a correct password
  // instead of logging straight in — see handleSubmit below.
  const [step, setStep] = useState('credentials')
  const [challengeToken, setChallengeToken] = useState('')
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)

  // If there's already a valid session (e.g. the user hit the
  // browser's Back button to "/" while still logged in), send them
  // straight to their profile instead of showing the login form
  // again. Waiting for `!loading` avoids a flash of the login form
  // before the stored token has been verified.
  useEffect(() => {
    if (token && !loading) {
      navigate('/profile', { replace: true })
    }
  }, [token, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (result.success) {
      navigate('/profile')
      return
    }
    if (result.requires2FA) {
      setChallengeToken(result.challengeToken)
      setStep('twoFactor')
      return
    }
    setError(result.error || t("login.failed"))
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    const result = await verifyTwoFactorLogin(challengeToken, code)
    if (result.success) {
      navigate('/profile')
      return
    }
    setError(result.error || t("login.invalidCode"))
  }

  const handleBackToCredentials = () => {
    setStep('credentials')
    setChallengeToken('')
    setCode('')
    setUseBackupCode(false)
    setError('')
  }

  // A `useEffect` only runs AFTER a render, so relying on the one
  // above alone means this component still renders the full login
  // form for one paint — or for the whole duration of the /users/me
  // validation call — before the redirect fires. That's the visible
  // "flash of the login page" on refresh, and on navigating back to
  // "/" while already logged in. Whenever a token is present (still
  // being validated, OR just confirmed valid and about to redirect
  // via the effect above), render a neutral placeholder instead of
  // the form — the login form itself should only ever appear once
  // we're sure there's no valid session, i.e. `token` is falsy
  // (nothing stored, or AuthContext determined it was invalid and
  // cleared it).
  if (token) {
    return <div className={styles.container} />
  }

  return (
    <div className={styles.container}>

      <div className={styles.card}>
        <h4 className={styles.title}>FRAME</h4>
        {error && <div className={styles.error}>{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input type="email" placeholder={t("login.email")} value={email} onChange={(e) => setEmail(e.target.value)} required className={styles.input} />
            <input type="password" placeholder={t("login.password")} value={password} onChange={(e) => setPassword(e.target.value)} required className={styles.input} />
            <button type="submit" disabled={loading} className={styles.button}>{loading ? t("login.signingIn") : t("login.signIn")}</button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className={styles.form}>
            <div className={styles.twoFactorHint}>
              <ShieldCheck size={16} />
              <span>
                {useBackupCode ? t("login.backupCodeHint") : t("login.authenticatorHint")}
              </span>
            </div>
            <input
              type="text"
              placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
              className={styles.input}
              inputMode={useBackupCode ? 'text' : 'numeric'}
              maxLength={useBackupCode ? 9 : 6}
            />
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? t("login.verifying") : t("login.verify")}
            </button>
            <div className={styles.twoFactorLinks}>
              <button type="button" className={styles.linkButton} onClick={() => { setUseBackupCode((v) => !v); setCode(''); setError(''); }}>
                {useBackupCode ? t("login.useAuthenticator") : t("login.useBackupCode")}
              </button>
              <button type="button" className={styles.linkButton} onClick={handleBackToCredentials}>
                {t("common.back")}
              </button>
            </div>
          </form>
        )}

        <ShinyText
          text="⬡ FRAME powered by: "
          a="HB"
          mail="belmoudden.hicham@gmail.com"
          className={styles.shinyText}
          speed={3}
          delay={0}
          color="#b5b5b5"
          shineColor="#ffffff"
          spread={120}
          direction="left"
          yoyo={false}
          pauseOnHover={false}
          disabled={false}
        />
      </div>
    </div>
  )
}
