import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/toastContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ArticleForm({ article, categories, subCategories, suppliers, onSubmit, onCancel, token }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    names: {
      en: '',
      fr: '',
      ar: ''
    },
    internalReference: '',
    supplierReference: '',
    supplier: '',
    description: '',
    sku: '',
    categoryId: '',
    subCategoryId: '',
    quantity: 0,
    minQuantity: 0,
    unitPrice: 0,
    supplierPrice: 0,
    unit: 'kg',
    leadTimeDays: 7,
    status: 'active',
    ...(article && {
      names: article.names || { en: '', fr: '', ar: '' },
      internalReference: article.internalReference || '',
      supplierReference: article.supplierReference || '',
      supplier: article.supplier?._id || article.supplier || '',
      description: article.description || '',
      sku: article.sku || '',
      categoryId: article.category?._id || article.category || '',
      subCategoryId: article.subCategory?._id || article.subCategory || '',
      quantity: article.quantity || 0,
      minQuantity: article.minQuantity || 0,
      unitPrice: article.unitPrice || 0,
      supplierPrice: article.supplierPrice || 0,
      unit: article.unit || 'kg',
      leadTimeDays: article.leadTimeDays || 7,
      status: article.status || 'active'
    })
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.names.en?.trim()) newErrors['names.en'] = t('common.required');
    if (!formData.names.fr?.trim()) newErrors['names.fr'] = t('common.required');
    if (!formData.names.ar?.trim()) newErrors['names.ar'] = t('common.required');
    if (!formData.sku?.trim()) newErrors.sku = t('common.required');
    if (!formData.internalReference?.trim()) newErrors.internalReference = t('common.required');
    if (!formData.categoryId) newErrors.categoryId = t('common.required');
    if (!formData.subCategoryId) newErrors.subCategoryId = t('common.required');
    if (formData.unitPrice <= 0) newErrors.unitPrice = 'Price must be > 0';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('names.')) {
      const lang = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        names: { ...prev.names, [lang]: value }
      }));
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'quantity' || name === 'minQuantity' || name === 'unitPrice' || name === 'supplierPrice' || name === 'leadTimeDays' 
          ? parseFloat(value) || 0 
          : value
      }));
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      addToast(err.response?.data?.error || t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubCategories = subCategories.filter(
    sub => sub.category === formData.categoryId || sub.category?._id === formData.categoryId
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
      {/* Multi-language Names */}
      <div className="bg-blue-50 p-4 rounded-lg space-y-3">
        <h3 className="font-semibold text-gray-900">Article Names (Multi-language)</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            English Name *
          </label>
          <input
            type="text"
            name="names.en"
            value={formData.names.en}
            onChange={handleChange}
            className={`input-field ${errors['names.en'] ? 'border-red-500' : ''}`}
            placeholder="Article name in English"
          />
          {errors['names.en'] && <p className="text-red-500 text-xs mt-1">{errors['names.en']}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            French Name (Nom en Français) *
          </label>
          <input
            type="text"
            name="names.fr"
            value={formData.names.fr}
            onChange={handleChange}
            className={`input-field ${errors['names.fr'] ? 'border-red-500' : ''}`}
            placeholder="Nom de l'article en français"
          />
          {errors['names.fr'] && <p className="text-red-500 text-xs mt-1">{errors['names.fr']}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arabic Name (الاسم بالعربية) *
          </label>
          <input
            type="text"
            name="names.ar"
            value={formData.names.ar}
            onChange={handleChange}
            className={`input-field ${errors['names.ar'] ? 'border-red-500' : ''}`}
            placeholder="اسم المادة بالعربية"
          />
          {errors['names.ar'] && <p className="text-red-500 text-xs mt-1">{errors['names.ar']}</p>}
        </div>
      </div>

      {/* References */}
      <div className="space-y-3 bg-purple-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-900">References</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Reference *
            </label>
            <input
              type="text"
              name="internalReference"
              value={formData.internalReference}
              onChange={handleChange}
              className={`input-field ${errors.internalReference ? 'border-red-500' : ''}`}
              placeholder="INT-001"
              disabled={!!article}
            />
            {errors.internalReference && <p className="text-red-500 text-xs mt-1">{errors.internalReference}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Reference (Référence Fournisseur)
            </label>
            <input
              type="text"
              name="supplierReference"
              value={formData.supplierReference}
              onChange={handleChange}
              className="input-field"
              placeholder="SUP-12345"
            />
          </div>
        </div>
      </div>

      {/* SKU & Supplier */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU *
          </label>
          <input
            type="text"
            name="sku"
            value={formData.sku}
            onChange={handleChange}
            className={`input-field ${errors.sku ? 'border-red-500' : ''}`}
            placeholder="SKU-001"
            disabled={!!article}
          />
          {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier (Fournisseur)
          </label>
          <select
            name="supplier"
            value={formData.supplier}
            onChange={handleChange}
            className="input-field"
          >
            <option value="">Select supplier...</option>
            {suppliers?.map(sup => (
              <option key={sup._id} value={sup._id}>{sup.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category & SubCategory */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            className={`input-field ${errors.categoryId ? 'border-red-500' : ''}`}
          >
            <option value="">Select category...</option>
            {categories?.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-red-500 text-xs mt-1">{errors.categoryId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subcategory *
          </label>
          <select
            name="subCategoryId"
            value={formData.subCategoryId}
            onChange={handleChange}
            className={`input-field ${errors.subCategoryId ? 'border-red-500' : ''}`}
          >
            <option value="">Select subcategory...</option>
            {filteredSubCategories?.map(sub => (
              <option key={sub._id} value={sub._id}>{sub.name}</option>
            ))}
          </select>
          {errors.subCategoryId && <p className="text-red-500 text-xs mt-1">{errors.subCategoryId}</p>}
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-3 gap-3 bg-green-50 p-4 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit Price *
          </label>
          <input
            type="number"
            name="unitPrice"
            value={formData.unitPrice}
            onChange={handleChange}
            step="0.01"
            className={`input-field ${errors.unitPrice ? 'border-red-500' : ''}`}
            placeholder="0.00"
          />
          {errors.unitPrice && <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier Price
          </label>
          <input
            type="number"
            name="supplierPrice"
            value={formData.supplierPrice}
            onChange={handleChange}
            step="0.01"
            className="input-field"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="input-field"
          >
            <option value="kg">Kilogrammes</option>
            <option value="pieces">Pieces</option>
            <option value="meters">Meters</option>
            <option value="liters">Liters</option>
            <option value="boxes">Boxes</option>
            <option value="pallets">Pallets</option>
          </select>
        </div>
      </div>

      {/* Stock */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Quantity
          </label>
          <input
            type="number"
            name="minQuantity"
            value={formData.minQuantity}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead Time (days)
          </label>
          <input
            type="number"
            name="leadTimeDays"
            value={formData.leadTimeDays}
            onChange={handleChange}
            className="input-field"
            min="1"
          />
        </div>
      </div>

      {/* Status & Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows="2"
          className="input-field"
          placeholder="Article description"
        />
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
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {/* Buttons */}
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
