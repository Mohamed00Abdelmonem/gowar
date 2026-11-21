import React, { useMemo, useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';

export const MerchantInventoryPage: React.FC = () => {
  const { language, t, activeMerchant, products, quickUpdateStock, inventoryMovements } = useApp();
  const [filter, setFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');

  const storeProducts = useMemo(
    () => products.filter((p) => p.merchantId === activeMerchant.id),
    [products, activeMerchant.id]
  );

  const lowCount = storeProducts.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outCount = storeProducts.filter((p) => p.stock === 0).length;

  const filtered = useMemo(() => {
    return storeProducts.filter((p) => {
      if (filter === 'available') return p.stock > 5;
      if (filter === 'low') return p.stock > 0 && p.stock <= 5;
      if (filter === 'out') return p.stock === 0;
      return true;
    });
  }, [storeProducts, filter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('إدارة المخزون السريعة', 'Quick Inventory Management')}
        </h1>
        <p className="text-xs text-[#6E6A66]">
          {t(
            'حدّث كميات المخزون مباشرة بدون الحاجة لفتح صفحة تعديل كل منتج',
            'Adjust product stock levels inline without opening full product editors'
          )}
        </p>
      </div>

      {(lowCount > 0 || outCount > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            {t(
              `تنبيه: يوجد ${lowCount} منتجات أوشكت على النفاد، و ${outCount} منتجات نفدت من المخزون.`,
              `Alert: ${lowCount} products are running low and ${outCount} are out of stock.`
            )}
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: t('الكل', 'All'), count: storeProducts.length },
          {
            id: 'available',
            label: t('متوفر بكمية جيدة', 'Healthy Stock'),
            count: storeProducts.filter((p) => p.stock > 5).length,
          },
          { id: 'low', label: t('مخزون منخفض', 'Low Stock'), count: lowCount },
          { id: 'out', label: t('نفد المخزون', 'Out of Stock'), count: outCount },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              filter === tab.id
                ? 'bg-[#D6450D] text-white border-[#D6450D]'
                : 'bg-white text-[#1C1917] border-[#EAE6E1]'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] divide-y divide-[#EAE6E1] shadow-2xs">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <SafeImage
                src={product.image}
                alt={product.nameAr}
                className="w-12 h-12 rounded-xl object-cover bg-[#FAF9F7] shrink-0"
              />
              <div>
                <h3 className="text-sm font-bold text-[#1C1917]">
                  {language === 'ar' ? product.nameAr : product.nameEn}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      product.stock === 0
                        ? 'bg-rose-50 text-rose-700'
                        : product.stock <= 5
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-[#FFF2EB] text-[#D6450D]'
                    }`}
                  >
                    {product.stock === 0
                      ? t('نفد من المخزون', 'Out of stock')
                      : product.stock <= 5
                        ? t('كمية منخفضة', 'Low stock')
                        : t('متوفر', 'In stock')}
                  </span>
                  {product.sku && <span className="text-[#6E6A66]">SKU: {product.sku}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => quickUpdateStock(product.id, product.stock - 1)}
                className="w-9 h-9 rounded-xl border border-[#EAE6E1] bg-[#FAF9F7] hover:bg-[#FFF2EB] flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="0"
                value={product.stock}
                onChange={(e) => quickUpdateStock(product.id, Number(e.target.value) || 0)}
                className="w-20 text-center py-2 rounded-xl border border-[#EAE6E1] text-sm font-extrabold text-[#1C1917]"
              />
              <button
                type="button"
                onClick={() => quickUpdateStock(product.id, product.stock + 1)}
                className="w-9 h-9 rounded-xl border border-[#EAE6E1] bg-[#FAF9F7] hover:bg-[#FFF2EB] flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => quickUpdateStock(product.id, product.stock + 10)}
                className="px-3 py-2 rounded-xl bg-[#FFF2EB] text-[#D6450D] text-xs font-bold hover:bg-[#FDE2D2]"
              >
                +10
              </button>
            </div>
          </div>
        ))}
      </div>

      {inventoryMovements.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-[#EAE6E1]">
            <h2 className="text-sm font-extrabold text-[#1C1917]">
              {t('سجل حركات المخزون', 'Inventory Movement Log')} ({inventoryMovements.length})
            </h2>
          </div>
          <div className="divide-y divide-[#EAE6E1] text-xs max-h-80 overflow-y-auto">
            {inventoryMovements.map((mv) => (
              <div key={mv.id} className="px-5 py-3 flex items-center justify-between gap-2">
                <div>
                  <strong className="text-[#1C1917]">{mv.product_name}</strong>
                  <span className="text-[#6E6A66] block text-[11px]">{mv.note || mv.movement_type}</span>
                </div>
                <div className="text-end font-bold">
                  <span className={mv.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {mv.quantity >= 0 ? `+${mv.quantity}` : mv.quantity}
                  </span>
                  <span className="block text-[10px] text-[#6E6A66]">
                    {mv.previous_quantity} ← {mv.new_quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
