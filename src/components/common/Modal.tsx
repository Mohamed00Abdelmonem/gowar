import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-lg',
}) => {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#EAE6E1] overflow-hidden max-h-[88vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAE6E1]">
            <h3 className="text-base sm:text-lg font-bold text-[#1C1917]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6A66] hover:bg-[#FAF9F7] hover:text-[#1C1917] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
