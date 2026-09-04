import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/toastContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function UserForm({ user, onSubmit, onCancel, token }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'staff',
    department: '',
    status: 'active',
    ...user
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, ...user }));
    }
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('common.required');
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('common.required');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('common.required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('common.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      addToast(user ? t('users.userUpdated') : t('users.userCreated'), 'success');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'staff',
        department: '',
        status: 'active'
      });
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('auth.firstName')} *
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className={`input-field ${errors.firstName ? 'border-red-500' : ''}`}
            placeholder={t('auth.firstName')}
          />
          {errors.firstName && (
            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('auth.lastName')} *
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className={`input-field ${errors.lastName ? 'border-red-500' : ''}`}
            placeholder={t('auth.lastName')}
          />
          {errors.lastName && (
            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('auth.email')} *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`input-field ${errors.email ? 'border-red-500' : ''}`}
          placeholder={t('auth.email')}
          disabled={!!user}
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('users.phone')}
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="input-field"
          placeholder={t('users.phone')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('users.department')}
        </label>
        <input
          type="text"
          name="department"
          value={formData.department}
          onChange={handleChange}
          className="input-field"
          placeholder={t('users.department')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('users.role')} *
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="input-field"
          >
            <option value="staff">{t('users.staff')}</option>
            <option value="supervisor">{t('users.supervisor')}</option>
            <option value="manager">{t('users.manager')}</option>
            <option value="admin">{t('users.admin')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('users.status')} *
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="input-field"
          >
            <option value="active">{t('users.active')}</option>
            <option value="inactive">{t('users.inactive')}</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
        >
          {loading ? t('common.loading') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
