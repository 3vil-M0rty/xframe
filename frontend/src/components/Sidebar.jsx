import { useState, useEffect } from 'react'
import {
  Settings2,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut
} from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import api from '../services/api'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [expandedSection, setExpandedSection] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useI18n()

  // Fetch user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token')
        
        if (!token) {
          console.error('❌ No token found in localStorage')
          setLoading(false)
          return
        }

        // Use the api client instead of fetch - it has the correct baseURL!
        const response = await api.get('/users/me')
        
        
        if (response.data.success && response.data.data) {
          setUser(response.data.data)
        }
      } catch (error) {
        console.error('❌ Error fetching user:', error.response?.data || error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const menuItems = [
    {
      id: 'admin',
      label: t('sidebar.admin'),
      icon: Settings2,
      subsections: [
        { label: t('sidebar.profile'), href: '#' },
        { label: t('sidebar.preferences'), href: '#' },
        { label: t('sidebar.integrations'), href: '#' }
      ]
    },
    {
      id: 'settings',
      label: t('sidebar.settings'),
      icon: Settings,
      subsections: [
        { label: t('sidebar.companies'), href: '#' },
        { label: t('sidebar.preferences'), href: '#' },
        { label: t('sidebar.integrations'), href: '#' }
      ]
    },
    {
      id: 'help',
      label: t('sidebar.help'),
      icon: HelpCircle,
      href: '#'
    }
  ]

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id)
  }

  // Generate avatar from user initials
  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  // Get avatar background color
  const getAvatarColor = (name) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C4A1'
    ]
    const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className={`${styles.sidebarWrapper} ${isOpen ? styles.wrapperOpen : styles.wrapperClosed}`}>
        <aside className={`${styles.sidebar}`}>
          <div className={styles.header}>
            <div className={styles.skeletonAvatar}></div>
            {isOpen && <div className={styles.skeletonText}></div>}
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className={`${styles.sidebarWrapper} ${isOpen ? styles.wrapperOpen : styles.wrapperClosed}`}>
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        {/* Header - User Avatar & Name */}
        <div className={styles.header}>
          {user ? (
            <>
              <div 
                className={styles.avatar}
                style={{ 
                  backgroundColor: getAvatarColor(user?.firstName + user?.lastName)
                }}
              >
                <span className={styles.avatarText}>
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              {isOpen && (
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className={styles.userEmail}>{user?.email}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.skeletonAvatar}></div>
              {isOpen && <div className={styles.skeletonText}></div>}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {menuItems.map((item) => (
            <div key={item.id}>
              <div
                className={styles.navItem}
                onClick={() => item.subsections && toggleSection(item.id)}
              >
                <item.icon size={16} className={styles.icon} />
                {isOpen && (
                  <>
                    <span className={styles.label}>{item.label}</span>
                    {item.subsections && (
                      <span className={styles.chevron}>
                        {expandedSection === item.id ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Subsections */}
              {isOpen && item.subsections && expandedSection === item.id && (
                <div className={styles.subsections}>
                  {item.subsections.map((sub, idx) => (
                    <a key={idx} href={sub.href} className={styles.subItem}>
                      <span className={styles.subDot}></span>
                      {sub.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer - Only Logout */}
        <div className={styles.footer}>
          <button
            onClick={handleLogout}
            className={styles.footerBtn}
            title={t('sidebar.logout')}
          >
            <LogOut size={16} />
            {isOpen && <span>{t('sidebar.logout')}</span>}
          </button>
        </div>

        {/* Toggle Button - Arrow on right edge */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={styles.toggleArrow}
          title={isOpen ? t('sidebar.closeSidebar') : t('sidebar.openSidebar')}
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </aside>
    </div>
  )
}