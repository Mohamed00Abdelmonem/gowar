import React, { useState } from 'react';
import { Edit3, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';

export const MerchantCategoriesPage: React.FC = () => {
  const {
    language,
    t,
    activeMerchant,
    categories,
    products,
    addMerchantCategory,
    updateCategory,
    deleteCategory,
    updateProduct,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [assignCatId, setAssignCatId] = useState<string | null>(null);

  const storeProducts = products.filter((p) => p.merchantId === activeMerchant.id);
  const merchantCategories = categories.filter(
    (c) => c.isGlobal || c.merchantId === activeMerchant.id
  );

  const openCreate = () => {
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setModalOpen(true);
  };

  const openEdit = (catId: string, ar: string, en: string) => {
    setEditingId(catId);
    setNameAr(ar);
    setNameEn(en);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;
    if (editingId) {
      updateCategory(editingId, { nameAr: nameAr.trim(), nameEn: nameEn.trim() || nameAr.trim() });
    } else {
      addMerchantCategory(activeMerchant.id, nameAr.trim(), nameEn.trim());
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('إدارة التصنيفات', 'Categories Management')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('رتب منتجات محلك في أقسام واضحة ليسهل على العميل التسوق', 'Organize your store items into clear categories')}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة تصنيف خاص', 'Add Custom Category')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {merchantCategories.map((cat) => {
          const count = storeProducts.filter((p) => p.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1C1917]">
                      {language === 'ar' ? cat.nameAr : cat.nameEn}
                    </h3>
                    <span className="text-[11px] text-[#6E6A66]">
                      {count} {t('منتجات في محلك', 'products in store')}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cat.isGlobal ? 'bg-[#FAF9F7] text-[#6E6A66]' : 'bg-[#E6F5EC] text-[#1B8E53]'
                  }`}
                >
                  {cat.isGlobal ? t('عام', 'Global') : t('خاص بالمحل', 'Custom')}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#EAE6E1]">
                <button
                  type="button"
                  onClick={() => setAssignCatId(cat.id)}
                  className="text-xs font-bold text-[#1B8E53] hover:underline"
                >
                  {t('تعيين منتجات للقسم', 'Assign Products')}
                </button>

                {!cat.isGlobal && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(cat.id, cat.nameAr, cat.nameEn)}
                      className="p-1.5 rounded-lg border border-[#EAE6E1] text-[#1C1917]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Category Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('تعديل التصنيف', 'Edit Category') : t('إضافة تصنيف جديد', 'New Category')}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('اسم التصنيف بالعربية *', 'Category Name (Arabic) *')}
            </label>
            <input
              type="text"
              required
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={t('مثال: عروض رمضان / مستورد', 'e.g. Imported Snacks')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('الاسم بالإنجليزية (اختياري)', 'English Name (Optional)')}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#1B8E53] text-white text-sm font-bold"
          >
            {t('حفظ', 'Save')}
          </button>
        </form>
      </Modal>

      {/* Assign Products Modal */}
      <Modal
        open={Boolean(assignCatId)}
        onClose={() => setAssignCatId(null)}
        title={t('تعيين منتجات للتصنيف', 'Assign Store Products to Category')}
      >
        {assignCatId && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {storeProducts.map((p) => {
              const assigned = p.categoryId === assignCatId;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]"
                >
                  <span className="text-xs font-bold text-[#1C1917]">
                    {language === 'ar' ? p.nameAr : p.nameEn}
                  </span>
                  <button
                    type="button"
                    disabled={assigned}
                    onClick={() => updateProduct(p.id, { categoryId: assignCatId })}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                      assigned
                        ? 'bg-[#E6F5EC] text-[#1B8E53]'
                        : 'bg-[#1B8E53] text-white hover:bg-[#147242]'
                    }`}
                  >
                    {assigned ? t('مضاف حالياً', 'Assigned') : t('نقل هنا', 'Assign')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};
