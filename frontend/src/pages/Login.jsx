import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import DepthText from '../components/DepthText';
import styles from './Login.module.css';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await login(email, password)) {
      navigate('/dashboard');
    }
  };

  return (
    <div className={styles.loginPage}>
      <DepthText
        text="FRAME"
        layers={150}
        depth={1.4}
        faceColor="#f8fafc"
        depthColor="#000000"
        tilt={15.5}
        pointerTracking
        smoothing={0.14}
        perspective={200}
        autoOrbit
        orbitSpeed={0.8}
        fontSize="clamp(3rem, 12vw, 12rem)"
        fontWeight={50}
        shadow
        className={styles.depthText}
      />
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div className={styles.logoMark}>
            F
          </div>

          <h1 className={styles.title}>
            {t('app.name')}
          </h1>

          <p className={styles.tagline}>
            {t('app.tagline')}
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t('auth.email')}
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.formInput}
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t('auth.password')}
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.formInput}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.loginButton}
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>

        {/* <div className={styles.registerSection}>
          <p className={styles.registerText}>
            {t('auth.dontHaveAccount')}{' '}
            <Link
              to="/register"
              className={styles.registerLink}
            >
              {t('auth.registerHere')}
            </Link>
          </p>
        </div>

        <div className={styles.demoSection}>
          <p className={styles.demoCredentials}>
            {t('auth.demoCredentials')}:<br />
            Email: admin@demo.com<br />
            Password: demo123
          </p>
        </div> */}
      </div>
    </div>
  );
}