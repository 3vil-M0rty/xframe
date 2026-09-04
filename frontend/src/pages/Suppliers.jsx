import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useStore } from '../store';
import { useToast } from '../context/toastContext';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconPackage } from '../components/Icons';
import Modal from '../components/Modal';
import SupplierForm from '../components/SupplierForm';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Suppliers() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { getHeaders, token } = useStore();
  const { addToast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, [statusFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? `${API_URL}/suppliers`
        : `${API_URL}/suppliers?status=${statusFilter}`;
      
      const res = await axios.get(url, {
        headers: getHeaders()
      });
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (supplier = null) => {
    setSelectedSupplier(supplier || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSupplier(null);
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedSupplier) {
        await axios.put(`${API_URL}/suppliers/${selectedSupplier._id}`, formData, {
          headers: getHeaders()
        });
      } else {
        await axios.post(`${API_URL}/suppliers`, formData, {
          headers: getHeaders()
        });
      }
      await fetchSuppliers();
      handleCloseModal();
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (supplierId) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      setDeletingId(supplierId);
      try {
        await axios.delete(`${API_URL}/suppliers/${supplierId}`, {
          headers: getHeaders()
        });
        addToast('Supplier deleted successfully', 'success');
        await fetchSuppliers();
      } catch (err) {
        addToast(t('errors.somethingWentWrong'), 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(search.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(search.toLowerCase()) ||
    supplier.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers (Fournisseurs)</h1>
          <p className="text-gray-600 mt-2">Manage supplier relationships and information</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center gap-2"
        >
          <IconPlus size={20} />
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier._id} className="table-row-hover">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{supplier.email || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{supplier.phone || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{supplier.city || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span>{'⭐'.repeat(Math.floor(supplier.rating || 0))}</span>
                    <span className="text-gray-600 ml-1">{(supplier.rating || 0).toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`badge ${
                    supplier.status === 'active' ? 'badge-success' : 
                    supplier.status === 'blocked' ? 'badge-warning' : 
                    'badge-secondary'
                  }`}>
                    {supplier.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(supplier)}
                      className="p-1 hover:bg-gray-100 rounded transition"
                      title="Edit"
                    >
                      <IconEdit size={16} className="text-blue-600" />
                    </button>
                    <button 
                      onClick={() => handleDelete(supplier._id)}
                      disabled={deletingId === supplier._id}
                      className="p-1 hover:bg-gray-100 rounded transition disabled:opacity-50"
                      title="Delete"
                    >
                      <IconTrash size={16} className="text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <IconPackage className="mx-auto mb-2 opacity-30" size={40} />
            <p>No suppliers found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedSupplier ? 'Update Supplier' : 'Create Supplier'}
        size="lg"
      >
        <SupplierForm
          supplier={selectedSupplier}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          token={token}
        />
      </Modal>
    </div>
  );
}
