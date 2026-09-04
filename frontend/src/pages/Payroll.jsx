import React, { useState } from 'react';
import { Plus, DollarSign } from 'lucide-react';

export default function Payroll() {
  const [month, setMonth] = useState(new Date().toISOString().split('T')[0].slice(0, 7));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-600 mt-2">Manage staff payments and salary calculations</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Create Payroll
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex gap-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-field max-w-xs"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Total Gross</h3>
          <div className="text-2xl font-bold text-gray-600">$0.00</div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Total Net</h3>
          <div className="text-2xl font-bold text-gray-600">$0.00</div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Pending</h3>
          <div className="text-2xl font-bold text-yellow-600">0</div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Paid</h3>
          <div className="text-2xl font-bold text-green-600">0</div>
        </div>
      </div>

      <div className="card">
        <div className="text-center py-8 text-gray-500">
          <DollarSign size={40} className="mx-auto mb-4 opacity-30" />
          <p>Payroll interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
