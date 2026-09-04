import React from 'react';
import { Plus, Briefcase } from 'lucide-react';

export default function Projects() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Track article consumption and project progress</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Planning</h3>
          <div className="text-3xl font-bold text-gray-600 mb-2">0</div>
          <p className="text-sm text-gray-600">Projects in planning stage</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">In Progress</h3>
          <div className="text-3xl font-bold text-gray-600 mb-2">0</div>
          <p className="text-sm text-gray-600">Active projects</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Completed</h3>
          <div className="text-3xl font-bold text-gray-600 mb-2">0</div>
          <p className="text-sm text-gray-600">Finished projects</p>
        </div>
      </div>

      <div className="card">
        <div className="text-center py-8 text-gray-500">
          <Briefcase size={40} className="mx-auto mb-4 opacity-30" />
          <p>Projects interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
