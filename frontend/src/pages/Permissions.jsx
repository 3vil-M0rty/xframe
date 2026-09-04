import React from 'react';
import { Plus, Shield } from 'lucide-react';

export default function Permissions() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permissions</h1>
          <p className="text-gray-600 mt-2">Manage user roles and access control</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Permission
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Permission Management</h3>
            <p className="text-blue-800 text-sm mt-1">
              Assign granular permissions to users for different resources and actions.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="text-center py-8 text-gray-500">
          <p>Permission interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
