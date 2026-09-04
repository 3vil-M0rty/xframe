import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useStore } from '../store';
import { useToast } from '../context/toastContext';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/Modal';
import UserForm from '../components/UserForm';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { getHeaders, token } = useStore();
  const { addToast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: getHeaders()
      });
      setUsers(res.data.users || []);
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    setSelectedUser(user || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedUser) {
        await axios.put(`${API_URL}/users/${selectedUser._id}`, formData, {
          headers: getHeaders()
        });
      } else {
        await axios.post(`${API_URL}/users`, formData, {
          headers: getHeaders()
        });
      }
      await fetchUsers();
      handleCloseModal();
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm(t('users.confirmDelete'))) {
      setDeletingId(userId);
      try {
        await axios.delete(`${API_URL}/users/${userId}`, {
          headers: getHeaders()
        });
        addToast(t('users.userDeleted'), 'success');
        await fetchUsers();
      } catch (err) {
        addToast(t('errors.somethingWentWrong'), 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredUsers = users.filter(user =>
    user.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('users.title')}</h1>
          <p className="text-gray-600 mt-2">{t('users.subtitle')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {t('users.addUser')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('users.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('users.email')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('users.role')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('users.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="table-row-hover">
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.firstName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="badge badge-success">{t(`users.${user.role}`)}</span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {t(`users.${user.status}`)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(user)}
                      className="p-1 hover:bg-gray-100 rounded transition"
                      title={t('common.edit')}
                    >
                      <Edit2 size={16} className="text-blue-600" />
                    </button>
                    <button 
                      onClick={() => handleDelete(user._id)}
                      disabled={deletingId === user._id}
                      className="p-1 hover:bg-gray-100 rounded transition disabled:opacity-50"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('users.noUsersFound')}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedUser ? t('users.updateUser') : t('users.createUser')}
        size="md"
      >
        <UserForm
          user={selectedUser}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          token={token}
        />
      </Modal>
    </div>
  );
}
