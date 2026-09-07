import { RotateCcw, Trash2, Edit2 } from 'lucide-react'
import api from '../../services/api'
import styles from './CompanyCard.module.css'

export default function CompanyCard({ company, onDelete, onRefresh, onEdit }) {
  const handleDelete = async () => {
    if (window.confirm('Delete this company? This action cannot be undone.')) {
      try {
        await api.delete(`/companies/${company._id}`)
        onDelete()
      } catch (error) {
        alert('Error deleting company: ' + (error.response?.data?.message || error.message))
      }
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {company.logo?.url && (
          <img src={company.logo.url} alt={company.name} className={styles.logo} />
        )}
        <div>
          <h2>{company.name}</h2>
          <p className={styles.legalForm}>{company.legalForm}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={() => onEdit(company)} title="Edit" className={styles.editBtn}>
            <Edit2 size={20} />
          </button>
          <button onClick={onRefresh} title="Refresh" className={styles.actionBtn}>
            <RotateCcw size={20} />
          </button>
          <button onClick={handleDelete} title="Delete" className={styles.deleteBtn}>
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label>Legal Form</label>
          <p>{company.legalForm}</p>
        </div>
        <div className={styles.field}>
          <label>Industry</label>
          <p>{company.industry || '-'}</p>
        </div>
        <div className={styles.field}>
          <label>Email</label>
          <p>{company.email || '-'}</p>
        </div>
        <div className={styles.field}>
          <label>Phone</label>
          <p>{company.phone || '-'}</p>
        </div>
        <div className={styles.field}>
          <label>Website</label>
          <p>{company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a> : '-'}</p>
        </div>
        <div className={styles.field}>
          <label>Currency</label>
          <p>{company.currency}</p>
        </div>
        <div className={styles.field}>
          <label>Size</label>
          <p>{company.size}</p>
        </div>
        <div className={styles.field}>
          <label>Employees</label>
          <p>{company.employeeCount}</p>
        </div>

        {company.address && (
          <>
            <div className={styles.field}>
              <label>City</label>
              <p>{company.address.city || '-'}</p>
            </div>
            <div className={styles.field}>
              <label>Region</label>
              <p>{company.address.region || '-'}</p>
            </div>
            <div className={styles.field}>
              <label>Street</label>
              <p>{company.address.street || '-'}</p>
            </div>
            <div className={styles.field}>
              <label>Zip Code</label>
              <p>{company.address.zipCode || '-'}</p>
            </div>
          </>
        )}

        <div className={styles.field}>
          <label>Created</label>
          <p>{new Date(company.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
