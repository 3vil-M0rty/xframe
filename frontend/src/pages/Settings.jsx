import React, { useState } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    currency: 'EUR',
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Saving settings:', settings);
    alert('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure company settings and preferences</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Settings */}
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Company Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  name="currency"
                  value={settings.currency}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  name="timezone"
                  value={settings.timezone}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Africa/Casablanca">Africa/Casablanca</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Format
                </label>
                <select
                  name="dateFormat"
                  value={settings.dateFormat}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Security</h2>
            <button type="button" className="btn-secondary">
              Change Password
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save size={20} />
              Save Settings
            </button>
            <button type="button" className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
