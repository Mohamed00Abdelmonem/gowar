import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PRODUCT_IMAGES } from '../../utils/visuals';
import { ProductImagePicker } from '../../components/merchant/ProductImagePicker';
import { ProductImportBar } from '../../components/merchant/ProductImportBar';
import { buildImportedFormPatch } from '../../services/catalogLibraryHelpers';
import type { CatalogLibraryItemPayload, ImportedProductPayload } from '../../services/gowarApi';

export const MerchantProductFormPage: React.FC = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { language, t, activeMerchant, products, categories, addProduct, updateProduct, showToast } =
    useApp();

  const existing = productId ? products.find((p) => p.id === productId) : undefined;

  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  const [descriptionAr, setDescriptionAr] = useState(existing?.descriptionAr ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(existing?.price ? String(existing.price) : '');
  const [oldPrice, setOldPrice] = useState(existing?.oldPrice ? String(existing.oldPrice) : '');
  const [stock, setStock] = useState(existing ? String(existing.stock) : '20');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [barcode, setBarcode] = useState(existing?.barcode ?? '');
  const [unitAr, setUnitAr] = useState(existing?.unitAr ?? '١ قطعة');
  const [image, setImage] = useState(existing?.image ?? PRODUCT_IMAGES.milk);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAttribution, setImageAttribution] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(existing?.isAvailable ?? true);

  const handleApplyImported = (imported: ImportedProductPayload) => {
    const patch = buildImportedFormPatch(imported, categoryId || categories[0]?.id || '');
    if (patch.nameAr) setNameAr(patch.nameAr);
    if (patch.nameEn) setNameEn(patch.nameEn);
    if (patch.descriptionAr && !descriptionAr) setDescriptionAr(patch.descriptionAr);
    if (patch.unitAr) setUnitAr(patch.unitAr);
    if (patch.barcode) setBarcode(patch.barcode);
    if (patch.categoryId && categories.some((c) => c.id === patch.categoryId)) {
      setCategoryId(patch.categoryId);
    }
    if (patch.image) {
      setImageFile(null);
      setImage(patch.image);
      setImageAttribution(imported.attribution || '');
    }
  };

  const handleSelectLibraryItem = (item: CatalogLibraryItemPayload) => {
    if (!nameAr.trim()) setNameAr(item.name);
    if (!nameEn.trim()) setNameEn(item.name_en);
    if (!barcode.trim() && item.barcode) setBarcode(item.barcode);
    if (item.default_unit && unitAr === '١ قطعة') setUnitAr(item.default_unit);
    if (item.default_store_category && categories.some((c) => c.id === item.default_store_category)) {
      setCategoryId(item.default_store_category);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(price);
    const numericOldPrice = oldPrice ? Number(oldPrice) : undefined;
    const numericStock = Math.max(0, Number(stock) || 0);

    if (!nameAr.trim() || !numericPrice || numericPrice <= 0) {
      showToast(t('برجاء إدخال اسم المنتج والسعر الصحيح', 'Please enter product name and valid price'), 'error');
      return;
    }

    const payload = {
      merchantId: activeMerchant.id,
      categoryId,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      descriptionAr: descriptionAr.trim() || nameAr.trim(),
      descriptionEn: descriptionAr.trim() || nameEn.trim() || nameAr.trim(),
      image,
      imageFile,
      price: numericPrice,
      oldPrice: numericOldPrice,
      stock: numericStock,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      unitAr: unitAr.trim() || 'قطعة',
      unitEn: unitAr.trim() || 'Unit',
      isAvailable,
      isOffer: Boolean(numericOldPrice && numericOldPrice > numericPrice),
    };

    try {
      if (existing) {
        await updateProduct(existing.id, payload);
      } else {
        await addProduct(payload);
      }
      navigate('/merchant/products');
    } catch {
      // Error toast already raised by AppContext
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/merchant/products"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1B8E53] hover:underline mb-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{t('العودة للمنتجات', 'Back to Products')}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {existing ? t('تعديل المنتج', 'Edit Product') : t('إضافة منتج جديد', 'Add New Product')}
          </h1>
        </div>
      </div>

      {!existing && <ProductImportBar onApplyImportedProduct={handleApplyImported} />}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#EAE6E1] p-5 sm:p-7 space-y-6 shadow-2xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Smart Image Library, Upload & Online Search */}
          <div className="md:col-span-5 space-y-2">
            <ProductImagePicker
              selectedImage={image}
              productNameHint={nameEn || nameAr}
              onSelectImageUrl={(url, attr) => {
                setImage(url);
                setImageAttribution(attr || '');
              }}
              onSelectLibraryItem={handleSelectLibraryItem}
              onLocalFileSelected={setImageFile}
            />
            {imageAttribution && (
              <p className="text-[10px] text-[#6E6A66] text-center">{imageAttribution}</p>
            )}
          </div>

          {/* Fields */}
          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('اسم المنتج بالعربية *', 'Product Name (Arabic) *')}
                </label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={t('مثال: لبن جهينة ١ لتر', 'e.g. Juhayna Milk 1L')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('اسم المنتج بالإنجليزية (اختياري)', 'Product Name (English - Optional)')}
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Juhayna Milk 1L"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                {t('وصف المنتج', 'Description')}
              </label>
              <textarea
                rows={2}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder={t('اكتب وصفاً مختصراً للمنتج...', 'Brief product description...')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('التصنيف', 'Category')}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {language === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('الوحدة / الوزن', 'Unit / Size')}
                </label>
                <input
                  type="text"
                  value={unitAr}
                  onChange={(e) => setUnitAr(e.target.value)}
                  placeholder={t('مثال: ١ كجم / ٥٠٠ جم', 'e.g. 1 kg / 500g')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('سعر البيع (ج.م) *', 'Price (EGP) *')}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('السعر قبل الخصم', 'Old Price')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('الكمية بالمخزون', 'Stock Qty')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('كود SKU (اختياري)', 'SKU (Optional)')}
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                {t('الباركود (اختياري)', 'Barcode (Optional)')}
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="6221155001011"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                dir="ltr"
              />
            </div>

            <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#1B8E53]"
              />
              <span className="text-sm font-bold text-[#1C1917]">
                {t('المنتج متاح للعرض والطلب للعملاء', 'Available for customers to order')}
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#EAE6E1]">
          <Link
            to="/merchant/products"
            className="px-5 py-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
          >
            {t('إلغاء', 'Cancel')}
          </Link>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold"
          >
            <Save className="w-4 h-4" />
            <span>{existing ? t('حفظ التعديلات', 'Save Changes') : t('إضافة المنتج', 'Save Product')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
