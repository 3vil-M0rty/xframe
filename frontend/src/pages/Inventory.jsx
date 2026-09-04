import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useStore } from '../store';
import { useToast } from '../context/toastContext';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconPackage, IconSend } from '../components/Icons';
import Modal from '../components/Modal';
import ArticleForm from '../components/ArticleForm';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Inventory() {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('articles');
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const { getHeaders, token } = useStore();
  const { addToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [articlesRes, categoriesRes, subCategoriesRes, suppliersRes] = await Promise.all([
        axios.get(`${API_URL}/inventory/articles`, { headers: getHeaders() }),
        axios.get(`${API_URL}/inventory/categories`, { headers: getHeaders() }),
        axios.get(`${API_URL}/inventory/subcategories`, { headers: getHeaders() }),
        axios.get(`${API_URL}/suppliers`, { headers: getHeaders() })
      ]);
      
      setArticles(articlesRes.data.articles || []);
      setCategories(categoriesRes.data.categories || []);
      setSubCategories(subCategoriesRes.data.subCategories || []);
      setSuppliers(suppliersRes.data.suppliers || []);
    } catch (err) {
      addToast(t('errors.somethingWentWrong'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (selectedArticle) {
        await axios.put(
          `${API_URL}/inventory/articles/${selectedArticle._id}`,
          formData,
          { headers: getHeaders() }
        );
      } else {
        await axios.post(
          `${API_URL}/inventory/articles`,
          formData,
          { headers: getHeaders() }
        );
      }
      await fetchData();
      setIsModalOpen(false);
      setSelectedArticle(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (articleId) => {
    if (window.confirm(t('common.confirmDelete'))) {
      try {
        await axios.delete(
          `${API_URL}/inventory/articles/${articleId}`,
          { headers: getHeaders() }
        );
        addToast('Article deleted successfully', 'success');
        await fetchData();
      } catch (err) {
        addToast(t('errors.somethingWentWrong'), 'error');
      }
    }
  };

  const getArticleName = (article) => {
    return article.names?.[i18n.language] || article.names?.en || 'Unknown';
  };

  const filteredArticles = articles.filter(article =>
    getArticleName(article).toLowerCase().includes(search.toLowerCase()) ||
    article.sku?.toLowerCase().includes(search.toLowerCase()) ||
    article.internalReference?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-center py-8">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('inventory.title')}</h1>
          <p className="text-gray-600 mt-2">{t('inventory.subtitle')}</p>
        </div>
        <button
          onClick={() => { setSelectedArticle(null); setIsModalOpen(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <IconPlus size={20} />
          Add Article
        </button>
      </div>

      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('articles')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'articles'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent'
          }`}
        >
          Articles
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'suppliers'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent'
          }`}
        >
          Suppliers
        </button>
      </div>

      {activeTab === 'articles' && (
        <>
          <div className="relative">
            <IconSearch className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name (EN | FR | AR)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Internal Ref</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredArticles.map(article => (
                  <tr key={article._id} className="table-row-hover">
                    <td className="px-6 py-4 text-sm font-medium">
                      <p>{article.names?.en}</p>
                      <p className="text-xs text-gray-500">{article.names?.fr}</p>
                      <p className="text-xs text-gray-500">{article.names?.ar}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{article.internalReference}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{article.supplier?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-green-600 font-medium">{article.unitPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={article.quantity <= article.minQuantity ? 'text-red-600 font-bold' : ''}>
                        {article.quantity} {article.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedArticle(article); setIsModalOpen(true); }}
                          className="p-1 hover:bg-gray-100 rounded transition"
                          title="Edit"
                        >
                          <IconEdit size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(article._id)}
                          className="p-1 hover:bg-gray-100 rounded transition"
                          title="Delete"
                        >
                          <IconTrash size={16} className="text-red-600" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition"
                          title="Order"
                        >
                          <IconSend size={16} className="text-purple-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredArticles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <IconPackage className="mx-auto mb-2 opacity-30" size={40} />
                <p>No articles found</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'suppliers' && (
        <div className="card">
          <p className="text-gray-700 mb-4">Go to <a href="/suppliers" className="text-blue-600 hover:underline">Suppliers page</a> to manage</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map(sup => (
              <div key={sup._id} className="border p-4 rounded-lg">
                <h4 className="font-semibold">{sup.name}</h4>
                <p className="text-sm text-gray-600">{sup.email}</p>
                <p className="text-sm text-gray-600">{sup.phone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedArticle(null); }}
        title={selectedArticle ? 'Update Article' : 'Create Article'}
        size="lg"
      >
        <ArticleForm
          article={selectedArticle}
          categories={categories}
          subCategories={subCategories}
          suppliers={suppliers}
          onSubmit={handleSubmit}
          onCancel={() => { setIsModalOpen(false); setSelectedArticle(null); }}
          token={token}
        />
      </Modal>
    </div>
  );
}
