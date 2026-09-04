import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import {
  IconSettings,
  IconUsers,
  IconLock,
  IconPackage,
  IconCheck,
  IconDocument,
  IconFilter,
  IconPlus
} from './Icons';
import { XCircle, LogOut, Menu } from 'lucide-react';

export default function Layout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, company, logout } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: t('nav.dashboard'), path: '/dashboard', icon: <IconCheck size={20} /> },
    { label: t('nav.users'), path: '/users', icon: <IconUsers size={20} /> },
    { label: t('nav.permissions'), path: '/permissions', icon: <IconLock size={20} /> },
    { label: t('nav.inventory'), path: '/inventory', icon: <IconPackage size={20} /> },
    { label: 'Suppliers', path: '/suppliers', icon: <IconPlus size={20} /> },
    { label: t('nav.projects'), path: '/projects', icon: <IconDocument size={20} /> },
    { label: t('nav.payroll'), path: '/payroll', icon: <IconFilter size={20} /> },
    { label: t('nav.settings'), path: '/settings', icon: <IconSettings size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {sidebarOpen && (
              <>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                  F
                </div>
                <span className="font-bold text-lg">Frame</span>
              </>
            )}
            {!sidebarOpen && <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">F</div>}
          </div>
        </div>

        {/* Company Info */}
        {sidebarOpen && company && (
          <div className="px-6 py-4 border-b border-gray-800">
            <p className="text-xs text-gray-400">Company</p>
            <p className="text-sm font-semibold text-white truncate">{company.name}</p>
            <p className="text-xs text-gray-400 mt-2">{user?.firstName} {user?.lastName}</p>
          </div>
        )}

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition text-gray-300 hover:text-white"
              title={item.label}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Toggle Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-800 transition"
          >
            {sidebarOpen ? <XCircle size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="m-4 w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
        >
          <LogOut size={16} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Frame {t('app.name')}</h1>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <LanguageSwitcher />
            <Link to="/settings" className="text-gray-600 hover:text-gray-900 p-2">
              <IconSettings size={20} />
            </Link>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {user?.firstName?.[0]}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
