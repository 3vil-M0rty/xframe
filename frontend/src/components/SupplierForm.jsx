import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/toastContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function SupplierForm({ supplier, onSubmit, onCancel, token }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    contactPerson: '',
    currency: 'EUR',
    minOrderQuantity: 1,
    deliveryDays: 7,
    status: 'active',
    paymentTerms: '',
    rating: 0,
    taxId: '',
    ...supplier
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (supplier) {
      setFormData(prev => ({ ...prev, ...supplier }));
    }
  }, [supplier]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('common.required');
    }
    if (formData.rating < 0 || formData.rating > 5) {
      newErrors.rating = 'Rating must be between 0 and 5';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rating' || name === 'minOrderQuantity' || name === 'deliveryDays' ? parseFloat(value) : value
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
      addToast(supplier ? 'Supplier updated successfully' : 'Supplier created successfully', 'success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        contactPerson: '',
        currency: 'EUR',
        minOrderQuantity: 1,
        deliveryDays: 7,
        status: 'active',
        paymentTerms: '',
        rating: 0,
        taxId: ''
      });
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Supplier Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`input-field ${errors.name ? 'border-red-500' : ''}`}
          placeholder="Supplier name"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="input-field"
            placeholder="email@supplier.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="input-field"
            placeholder="+1 555 1234"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="input-field"
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="input-field"
            placeholder="City"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="input-field"
            placeholder="Country"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code
          </label>
          <input
            type="text"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            className="input-field"
            placeholder="12345"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Person
          </label>
          <input
            type="text"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            className="input-field"
            placeholder="Name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax ID
          </label>
          <input
            type="text"
            name="taxId"
            value={formData.taxId}
            onChange={handleChange}
            className="input-field"
            placeholder="VAT/Tax ID"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className="input-field"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="MAD">MAD (د.م.)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Order Qty
          </label>
          <input
            type="number"
            name="minOrderQuantity"
            value={formData.minOrderQuantity}
            onChange={handleChange}
            className="input-field"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery Days
          </label>
          <input
            type="number"
            name="deliveryDays"
            value={formData.deliveryDays}
            onChange={handleChange}
            className="input-field"
            min="1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rating (0-5 stars)
          </label>
          <input
            type="number"
            name="rating"
            min="0"
            max="5"
            step="0.5"
            value={formData.rating}
            onChange={handleChange}
            className={`input-field ${errors.rating ? 'border-red-500' : ''}`}
          />
          {errors.rating && (
            <p className="text-red-500 text-xs mt-1">{errors.rating}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="input-field"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Terms
        </label>
        <textarea
          name="paymentTerms"
          value={formData.paymentTerms}
          onChange={handleChange}
          rows="2"
          className="input-field"
          placeholder="e.g., Net 30, 2/10 Net 30"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t">
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
