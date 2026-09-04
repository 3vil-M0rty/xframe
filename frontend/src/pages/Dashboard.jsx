import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { Users, Package, Briefcase, DollarSign, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getHeaders } = useStore();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/companies/stats`, {
        headers: getHeaders()
      });
      setStats(res.data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your operations.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers || 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={Package}
          label="Active Articles"
          value={stats?.activeArticles || 0}
          color="bg-green-500"
        />
        <StatCard
          icon={Briefcase}
          label="Active Projects"
          value={stats?.activeProjects || 0}
          color="bg-purple-500"
        />
        <StatCard
          icon={DollarSign}
          label="Completed Projects"
          value={stats?.completedProjects || 0}
          color="bg-orange-500"
        />
      </div>

      {/* Alerts */}
      {stats?.lowStockArticles > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">Low Stock Alert</h3>
            <p className="text-yellow-800 text-sm mt-1">
              {stats.lowStockArticles} article(s) are below minimum stock level
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700">
              ➕ Create Article
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700">
              ➕ Create Project
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700">
              👥 Add User
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Database</span>
              <span className="badge badge-success">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cloudinary</span>
              <span className="badge badge-success">Configured</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">API</span>
              <span className="badge badge-success">Running</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <p className="text-gray-600 text-sm">No recent activity</p>
        </div>
      </div>
    </div>
  );
}
