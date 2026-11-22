import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="bg-white border border-[#EAE6E1] rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center">
      <div className="w-14 h-14 rounded-2xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-[#1C1917] mb-1.5">{title}</h3>
      <p className="text-sm text-[#6E6A66] max-w-md mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  );
};
