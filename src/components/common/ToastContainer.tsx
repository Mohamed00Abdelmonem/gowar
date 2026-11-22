import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-[#1B8E53] shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
  };

  const borderMap = {
    success: 'border-[#C2E7D2] bg-white',
    error: 'border-rose-200 bg-rose-50/95',
    warning: 'border-amber-200 bg-amber-50/95',
    info: 'border-sky-200 bg-sky-50/95',
  };

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[70] flex flex-col gap-2 sm:w-88 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium text-[#1C1917] ${borderMap[toast.type]}`}
        >
          {iconMap[toast.type]}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-[#6E6A66] hover:text-[#1C1917]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
