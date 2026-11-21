import React from 'react';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';

export const CartConflictModal: React.FC = () => {
  const {
    pendingCartConflict,
    cancelReplaceCart,
    confirmReplaceCart,
    merchants,
    language,
    t,
  } = useApp();

  if (!pendingCartConflict) return null;

  const currentStore = merchants.find((m) => m.id === pendingCartConflict.currentMerchantId);
  const newStore = merchants.find((m) => m.id === pendingCartConflict.newMerchantId);

  return (
    <Modal
      open={Boolean(pendingCartConflict)}
      onClose={cancelReplaceCart}
      title={t('سلتك فيها طلب من محل تاني', 'Start a new cart?')}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-[#1C1917] leading-relaxed">
            {t(
              'سلتك فيها منتجات من محل تاني. لو كملت، هنبدأ سلة جديدة من المحل ده.',
              'Your cart contains products from another store. If you continue, we will start a new cart from this store.'
            )}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl p-3.5">
          <div>
            <span className="text-[#6E6A66] block">{t('المحل الحالي', 'Current Store')}</span>
            <span className="font-bold text-[#1C1917] text-sm">
              {currentStore ? (language === 'ar' ? currentStore.nameAr : currentStore.nameEn) : ''}
            </span>
          </div>
          <ShoppingBag className="w-4 h-4 text-[#6E6A66]" />
          <div className="text-end">
            <span className="text-[#6E6A66] block">{t('المحل الجديد', 'New Store')}</span>
            <span className="font-bold text-[#D6450D] text-sm">
              {newStore ? (language === 'ar' ? newStore.nameAr : newStore.nameEn) : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={cancelReplaceCart}
            className="flex-1 py-3 px-4 rounded-xl border border-[#EAE6E1] bg-white text-[#1C1917] text-sm font-bold hover:bg-[#FAF9F7] transition-colors"
          >
            {t('خليك في السلة الحالية', 'Keep current cart')}
          </button>
          <button
            type="button"
            onClick={confirmReplaceCart}
            className="flex-1 py-3 px-4 rounded-xl bg-[#D6450D] text-white text-sm font-bold hover:bg-[#B33808] transition-colors"
          >
            {t('ابدأ سلة جديدة', 'Start a new cart')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
