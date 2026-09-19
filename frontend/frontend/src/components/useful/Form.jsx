import { useState } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import styles from './Form.module.css'

export default function Form({
  onSubmit,
  fields,
  submitButtonText = 'Submit',
  isLoading = false,
  successMessage = null,
  errorMessage = null,
  layout = 'vertical' // vertical or horizontal
}) {
  const [formData, setFormData] = useState(() => {
    const initial = {}
    fields.forEach(field => {
      initial[field.name] = field.defaultValue || ''
    })
    return initial
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [showPassword, setShowPassword] = useState({})

  const validateField = (field, value) => {
    if (field.required && !value.trim()) {
      return `${field.label} is required`
    }
    if (field.type === 'email' && value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return 'Invalid email address'
    }
    if (field.minLength && value.length < field.minLength) {
      return `Minimum ${field.minLength} characters required`
    }
    if (field.validate) {
      const error = field.validate(value)
      if (error) return error
    }
    return null
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value

    setFormData(prev => ({ ...prev, [name]: newValue }))

    // Real-time validation
    if (touched[name]) {
      const field = fields.find(f => f.name === name)
      const error = validateField(field, newValue)
      setErrors(prev => ({
        ...prev,
        [name]: error
      }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))

    const field = fields.find(f => f.name === name)
    const error = validateField(field, value)
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate all fields
    const newErrors = {}
    fields.forEach(field => {
      const error = validateField(field, formData[field.name])
      if (error) newErrors[field.name] = error
    })

    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      onSubmit?.(formData)
    }
  }

  const togglePasswordVisibility = (fieldName) => {
    setShowPassword(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  const containerClass = `${styles.form} ${styles[layout]}`

  return (
    <form onSubmit={handleSubmit} className={containerClass}>
      {/* Success Message */}
      {successMessage && (
        <div className={styles.messageSuccess}>
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className={styles.messageDanger}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Fields */}
      {fields.map(field => {
        const hasError = touched[field.name] && errors[field.name]
        const fieldClass = `${styles.field} ${hasError ? styles.hasError : ''}`

        if (field.type === 'checkbox') {
          return (
            <div key={field.name} className={styles.checkboxField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name={field.name}
                  checked={formData[field.name] || false}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isLoading}
                />
                <span>{field.label}</span>
              </label>
              {hasError && <span className={styles.errorText}>{errors[field.name]}</span>}
            </div>
          )
        }

        if (field.type === 'textarea') {
          return (
            <div key={field.name} className={fieldClass}>
              <label className={styles.label}>{field.label}</label>
              <textarea
                name={field.name}
                placeholder={field.placeholder}
                value={formData[field.name] || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                rows={field.rows || 4}
                className={styles.textarea}
              />
              {hasError && <span className={styles.errorText}>{errors[field.name]}</span>}
            </div>
          )
        }

        if (field.type === 'select') {
          return (
            <div key={field.name} className={fieldClass}>
              <label className={styles.label}>{field.label}</label>
              <select
                name={field.name}
                value={formData[field.name] || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={styles.select}
              >
                <option value="">Select {field.label.toLowerCase()}</option>
                {field.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {hasError && <span className={styles.errorText}>{errors[field.name]}</span>}
            </div>
          )
        }

        // Default text input
        return (
          <div key={field.name} className={fieldClass}>
            <label className={styles.label}>{field.label}</label>
            <div className={styles.inputWrapper}>
              <input
                type={field.type === 'password' && showPassword[field.name] ? 'text' : field.type || 'text'}
                name={field.name}
                placeholder={field.placeholder}
                value={formData[field.name] || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={styles.input}
              />
              {field.type === 'password' && (
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(field.name)}
                  className={styles.passwordToggle}
                  title={showPassword[field.name] ? 'Hide' : 'Show'}
                >
                  {showPassword[field.name] ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
            {hasError && <span className={styles.errorText}>{errors[field.name]}</span>}
          </div>
        )
      })}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className={styles.submitBtn}
      >
        {isLoading ? 'Processing...' : submitButtonText}
      </button>
    </form>
  )
}
