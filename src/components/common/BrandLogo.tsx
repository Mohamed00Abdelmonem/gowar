import React from 'react';
import { useApp } from '../../context/AppContext';
import gowarIcon from '../../assets/gowar-icon.png';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'dark', compact = false }) => {
  const { t } = useApp();

  if (compact) {
    return (
      <img
        src={gowarIcon}
        alt="Gowar"
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain select-none shrink-0"
      />
    );
  }

  if (variant === 'light') {
    return (
      <div className="inline-flex items-center gap-2.5 select-none">
        <div className="w-10 h-10 rounded-xl bg-white/95 p-1 shadow-xs flex items-center justify-center shrink-0">
          <img
            src={gowarIcon}
            alt="Gowar"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight text-white">
            {t('جوار', 'Gowar')}
          </div>
          <p className="text-[11px] text-orange-100 hidden sm:block">
            {t('كل اللي تحتاجه من المحلات اللي حواليك', 'Everything from stores around you')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <img
        src={gowarIcon}
        alt="Gowar"
        className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
      />
      <div className="leading-none">
        <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1C1917]">
          {t('جوار', 'Gowar')}
        </span>
      </div>
    </div>
  );
};
