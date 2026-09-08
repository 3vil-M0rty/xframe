import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginPage.module.css'
import ShinyText from '../components/useful/ShinyText'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (result.success) navigate('/profile')
    else setError(result.error || 'Login failed')
  }

  return (
    <div className={styles.container}>

      <div className={styles.card}>
        <h4 className={styles.title}>FRAME</h4>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={styles.input} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={styles.input} />
          <button type="submit" disabled={loading} className={styles.button}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
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
