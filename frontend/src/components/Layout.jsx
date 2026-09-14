import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import styles from './Layout.module.css'
export default function Layout() {
  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  )
}