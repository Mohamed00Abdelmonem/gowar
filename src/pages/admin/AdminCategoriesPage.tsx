import React, { useState } from 'react';
import { Edit3, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';

export const AdminCategoriesPage: React.FC = () => {
  const {
    language,
    t,
    categories,
    products,
    addGlobalCategory,
    updateCategory,
    deleteCategory,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [color, setColor] = useState('#D6450D');

  const globalCategories = categories.filter((c) => c.isGlobal);

  const openAdd = () => {
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setColor('#D6450D');
    setModalOpen(true);
  };

  const openEdit = (id: string, ar: string, en: string, clr: string) => {
    setEditingId(id);
    setNameAr(ar);
    setNameEn(en);
    setColor(clr);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;
    if (editingId) {
      updateCategory(editingId, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || nameAr.trim(),
        color,
      });
    } else {
      addGlobalCategory({
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || nameAr.trim(),
        icon: 'ShoppingBasket',
        color,
      });
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('إدارة التصنيفات الرئيسية', 'Global Categories Management')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('الأقسام الأساسية التي تظهر لجميع المتاجر والعملاء على المنصة', 'Platform-wide grocery categories available to all stores')}
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة قسم', 'Add Category')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {globalCategories.map((cat) => {
          const count = products.filter((p) => p.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                >
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1C1917]">
                    {language === 'ar' ? cat.nameAr : cat.nameEn}
                  </div>
                  <div className="text-[11px] text-[#6E6A66]">
                    {count} {t('منتج', 'products')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(cat.id, cat.nameAr, cat.nameEn, cat.color)}
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
            </div>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('تعديل التصنيف', 'Edit Category') : t('إضافة تصنيف جديد', 'Add Category')}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <input
            type="text"
            required
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t('الاسم بالعربية', 'Arabic Name')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          />
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('الاسم بالإنجليزية', 'English Name')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#6E6A66]">{t('لون الأيقونة', 'Accent Color')}</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-8 rounded cursor-pointer"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#D6450D] text-white text-sm font-bold"
          >
            {t('حفظ', 'Save')}
          </button>
        </form>
      </Modal>
    </div>
  );
};
