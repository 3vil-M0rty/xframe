import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import api from '../services/api'
import Sidebar from '../components/Sidebar'
import CompanyForm from '../components/company/CompanyForm'
import EditCompanyForm from '../components/company/EditCompanyForm'
import CompanyCard from '../components/company/CompanyCard'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const response = await api.get('/companies')
      const data = response.data.data || []
      setCompanies(data)
      if (data.length > 0 && !selectedCompany) {
        setSelectedCompany(data[0])
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateForm(false)
    fetchCompanies()
  }

  const handleEditSuccess = () => {
    setShowEditForm(false)
    setEditingCompany(null)
    fetchCompanies()
  }

  const handleDeleteCompany = () => {
    setSelectedCompany(null)
    fetchCompanies()
  }

  const handleEditClick = (company) => {
    setEditingCompany(company)
    setShowEditForm(true)
  }

  return (
    <div className={styles.container}>
      {/* Sidebar - No props needed, handles its own state */}
      <Sidebar />

      <main className={styles.main}>
        {showCreateForm ? (
          <CompanyForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : showEditForm && editingCompany ? (
          <EditCompanyForm
            company={editingCompany}
            onSuccess={handleEditSuccess}
            onCancel={() => {
              setShowEditForm(false)
              setEditingCompany(null)
            }}
          />
        ) : selectedCompany ? (
          <CompanyCard
            company={selectedCompany}
            onDelete={handleDeleteCompany}
            onRefresh={fetchCompanies}
            onEdit={handleEditClick}
          />
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <h2>No Companies Yet</h2>
              <p>Create your first company to get started</p>
              <button onClick={() => setShowCreateForm(true)} className={styles.emptyButton}>
                <Plus size={20} />
                Create Company
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}