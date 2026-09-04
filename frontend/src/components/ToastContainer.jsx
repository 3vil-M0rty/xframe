import React from 'react';
import { XCircle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../context/toastContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-600" />;
      case 'info':
        return <Info size={20} className="text-blue-600" />;
      default:
        return null;
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getBgColor(toast.type)} border rounded-lg p-4 flex items-start gap-3 shadow-lg pointer-events-auto max-w-sm`}
        >
          {getIcon(toast.type)}
          <p className={`text-sm font-medium flex-1 ${getTextColor(toast.type)}`}>
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <XCircle size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
