import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import api from '../../services/api'
import styles from './CompanyForm.module.css'

export default function EditCompanyForm({ company, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoPreview, setLogoPreview] = useState(company.logo?.url || null)
  const [logoFile, setLogoFile] = useState(null)
  const [formData, setFormData] = useState({
    name: company.name || '',
    legalForm: company.legalForm || 'SARL',
    industry: company.industry || '',
    email: company.email || '',
    phone: company.phone || '',
    address: company.address || { street: '', city: '', region: '', zipCode: '' },
    website: company.website || '',
    size: company.size || 'Small',
    employeeCount: company.employeeCount || 1,
    currency: company.currency || 'MAD'
  })

  const maroccanRegions = [
    'Dakhla-Oued Ed-Dahab',
    'Laâyoune-Sakia El Hamra',
    'Souss-Massa',
    'Béni Mellal-Khénifra',
    'Casablanca-Settat',
    'Fès-Meknès',
    'Rabat-Salé-Kénitra',
    'Marrakech-Safi',
    'Drâa-Tafilalet',
    'Tanger-Tétouan-Al Hoceïma',
    'Oriental'
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.includes('address.')) {
      const field = name.split('.')[1]
      setFormData({
        ...formData,
        address: { ...formData.address, [field]: value }
      })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()
      Object.keys(formData).forEach(key => {
        if (key === 'address') {
          formDataToSend.append('address', JSON.stringify(formData.address))
        } else {
          formDataToSend.append(key, formData[key])
        }
      })

      if (logoFile) {
        formDataToSend.append('logo', logoFile)
      }

      await api.put(`/companies/${company._id}`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating company')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Edit Company</h2>
        <button onClick={onCancel} className={styles.closeBtn}>
          <X size={24} />
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Logo Upload */}
        <div className={styles.section}>
          <h3>Company Logo</h3>
          <div className={styles.logoSection}>
            {logoPreview ? (
              <div className={styles.logoPreview}>
                <img src={logoPreview} alt="Logo preview" />
                <button type="button" onClick={removeLogo} className={styles.removeLogo}>
                  <X size={20} />
                </button>
              </div>
            ) : (
              <label className={styles.logoUpload}>
                <Upload size={32} />
                <span>Click to upload logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  hidden
                />
              </label>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className={styles.section}>
          <h3>Basic Information</h3>
          <div className={styles.row}>
            <input
              type="text"
              name="name"
              placeholder="Company Name *"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <select name="legalForm" value={formData.legalForm} onChange={handleChange}>
              <option value="SARL">SARL</option>
              <option value="SA">SA</option>
              <option value="EIRL">EIRL</option>
              <option value="SARUE">SARUE</option>
              <option value="SCS">SCS</option>
              <option value="SNC">SNC</option>
              <option value="Cooperative">Cooperative</option>
              <option value="Association">Association</option>
            </select>
          </div>

          <div className={styles.row}>
            <input
              type="text"
              name="industry"
              placeholder="Industry *"
              value={formData.industry}
              onChange={handleChange}
              required
            />
            <select name="size" value={formData.size} onChange={handleChange}>
              <option value="Startup">Startup</option>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>

          <div className={styles.row}>
            <input
              type="number"
              name="employeeCount"
              placeholder="Employee Count"
              value={formData.employeeCount}
              onChange={handleChange}
              min="1"
            />
            <select name="currency" value={formData.currency} onChange={handleChange}>
              <option value="MAD">MAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {/* Contact Info */}
        <div className={styles.section}>
          <h3>Contact Information</h3>
          <div className={styles.row}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />
            <input
              type="tel"
              name="phone"
              placeholder="Phone (+212XXXXXXXXX)"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <input
            type="url"
            name="website"
            placeholder="Website (https://...)"
            value={formData.website}
            onChange={handleChange}
          />
        </div>

        {/* Address */}
        <div className={styles.section}>
          <h3>Address</h3>
          <input
            type="text"
            name="address.street"
            placeholder="Street"
            value={formData.address.street}
            onChange={handleChange}
          />

          <div className={styles.row}>
            <input
              type="text"
              name="address.city"
              placeholder="City"
              value={formData.address.city}
              onChange={handleChange}
            />
            <input
              type="text"
              name="address.zipCode"
              placeholder="Zip Code"
              value={formData.address.zipCode}
              onChange={handleChange}
            />
          </div>

          <select
            name="address.region"
            value={formData.address.region}
            onChange={handleChange}
          >
            <option value="">Select Region</option>
            {maroccanRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
