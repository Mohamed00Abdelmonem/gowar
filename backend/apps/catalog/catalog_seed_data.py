"""
Curated Egyptian supermarket product catalog definitions across 19 standard categories.
Used by `seed_catalog_library` and catalog library initialization.
"""

CATALOG_LIBRARY_CATEGORIES = [
    ("dairy-milk", "الألبان والحليب", "Dairy & Milk", "Milk", "#0284C7", "dairy", 1),
    ("cheese-butter", "الأجبان والزبدة", "Cheese & Butter", "Cheese", "#D97706", "dairy", 2),
    ("eggs", "البيض", "Eggs", "Egg", "#B45309", "dairy", 3),
    ("rice-pasta", "الأرز والمكرونة", "Rice & Pasta", "Wheat", "#CA8A04", "groceries", 4),
    ("flour-sugar", "الدقيق والسكر", "Flour & Sugar", "Package", "#A16207", "groceries", 5),
    ("cooking-oil-ghee", "الزيوت والسمن", "Cooking Oil & Ghee", "Droplets", "#EAB308", "groceries", 6),
    ("water-soft-drinks", "المياه والمشروبات الغازية", "Water & Soft Drinks", "CupSoda", "#0EA5E9", "drinks", 7),
    ("juices", "العصائر", "Juices", "Citrus", "#F97316", "drinks", 8),
    ("tea-coffee", "الشاي والقهوة", "Tea & Coffee", "Coffee", "#78350F", "drinks", 9),
    ("biscuits-snacks", "البسكويت والسناكس", "Biscuits & Snacks", "Cookie", "#EA580C", "snacks", 10),
    ("chocolate-sweets", "الشوكولاتة والحلويات", "Chocolate & Sweets", "Candy", "#9333EA", "snacks", 11),
    ("canned-food", "المعلبات", "Canned Food", "Utensils", "#DC2626", "groceries", 12),
    ("frozen-food", "المجمدات", "Frozen Food", "Snowflake", "#06B6D4", "groceries", 13),
    ("bread-bakery", "الخبز والمخبوزات", "Bread & Bakery", "Croissant", "#B45309", "bakery", 14),
    ("cleaning-products", "المنظفات", "Cleaning Products", "Sparkles", "#4F46E5", "cleaning", 15),
    ("personal-care", "العناية الشخصية", "Personal Care", "HeartHandshake", "#EC4899", "cleaning", 16),
    ("household-essentials", "مستلزمات المنزل", "Household Essentials", "Home", "#0D9488", "cleaning", 17),
    ("spices-sauces", "التوابل والصلصات", "Spices & Sauces", "Flame", "#B91C1C", "groceries", 18),
    ("legumes-grains", "البقوليات والحبوب", "Legumes & Grains", "Sprout", "#15803D", "groceries", 19),
]

# (category_slug, slug, name_ar, name_en, brand, package_size, unit_ar, unit_en, barcode)
CATALOG_LIBRARY_ITEMS = [
    # 1. Dairy & Milk
    ("dairy-milk", "juhayna-milk-1l", "حليب جهينة كامل الدسم ١ لتر", "Juhayna Full Cream Milk 1L", "جهينة | Juhayna", "1 L", "عبوة ١ لتر", "1 L Pack", "6221155001011"),
    ("dairy-milk", "almarai-milk-1l", "حليب المراعي ١ لتر", "Almarai Fresh Milk 1L", "المراعي | Almarai", "1 L", "عبوة ١ لتر", "1 L Pack", "6281007001014"),
    ("dairy-milk", "lamar-milk-1l", "حليب لمار كامل الدسم ١ لتر", "Lamar Full Cream Milk 1L", "لمار | Lamar", "1 L", "عبوة ١ لتر", "1 L Pack", "6224001122011"),
    ("dairy-milk", "juhayna-yogurt-105g", "زبادي جهينة طبيعي ١٠٥ جم", "Juhayna Natural Yogurt 105g", "جهينة | Juhayna", "105 g", "كوب ١٠٥ جم", "105g Cup", "6221155002018"),
    # 2. Cheese & Butter
    ("cheese-butter", "domty-white-cheese-500g", "جبنة بيضاء دومتي ٥٠٠ جم", "Domty White Cheese 500g", "دومتي | Domty", "500 g", "عبوة ٥٠٠ جم", "500g Pack", "6223000260015"),
    ("cheese-butter", "obour-land-feta-500g", "جبنة عبور لاند فيتا ٥٠٠ جم", "Obour Land Feta Cheese 500g", "عبور لاند | Obour Land", "500 g", "عبوة ٥٠٠ جم", "500g Pack", "6224000331018"),
    ("cheese-butter", "kiri-triangles-8pcs", "جبنة كيري مثلثات ٨ قطع", "Kiri Cheese Portions 8 pcs", "كيري | Kiri", "120 g", "علبة ٨ قطع", "8 Portions", "3073781000085"),
    ("cheese-butter", "lurpak-butter-200g", "زبدة لورباك غير مملحة ٢٠٠ جم", "Lurpak Unsalted Butter 200g", "لورباك | Lurpak", "200 g", "قالب ٢٠٠ جم", "200g Block", "5740900401013"),
    # 3. Eggs
    ("eggs", "red-eggs-tray-30", "كرتونة بيض أحمر ٣٠ بيضة", "Red Eggs Tray 30 pcs", "مزارع مصرية", "30 pcs", "كرتونة ٣٠ بيضة", "Tray 30 pcs", ""),
    ("eggs", "white-eggs-tray-30", "كرتونة بيض أبيض ٣٠ بيضة", "White Eggs Tray 30 pcs", "مزارع مصرية", "30 pcs", "كرتونة ٣٠ بيضة", "Tray 30 pcs", ""),
    ("eggs", "baladi-eggs-15", "بيض بلدي طازج ١٥ بيضة", "Fresh Baladi Eggs 15 pcs", "مزارع مصرية", "15 pcs", "عبوة ١٥ بيضة", "15 pcs Pack", ""),
    # 4. Rice & Pasta
    ("rice-pasta", "eldoha-rice-1kg", "أرز مصري الضحى ١ كجم", "El Doha Egyptian Rice 1kg", "الضحى | El Doha", "1 kg", "كيس ١ كجم", "1 kg Bag", "6223001360011"),
    ("rice-pasta", "elmaleka-pasta-400g", "مكرونة الملكة قلم ٤٠٠ جم", "El Maleka Penne Pasta 400g", "الملكة | El Maleka", "400 g", "كيس ٤٠٠ جم", "400g Bag", "6223000381017"),
    ("rice-pasta", "regina-spaghetti-400g", "مكرونة ريجينا اسباجتي ٤٠٠ جم", "Regina Spaghetti Pasta 400g", "ريجينا | Regina", "400 g", "كيس ٤٠٠ جم", "400g Bag", "6221031001012"),
    # 5. Flour & Sugar
    ("flour-sugar", "eldoha-flour-1kg", "دقيق الضحى الفاخر ١ كجم", "El Doha All-Purpose Flour 1kg", "الضحى | El Doha", "1 kg", "كيس ١ كجم", "1 kg Bag", "6223001360202"),
    ("flour-sugar", "elosra-sugar-1kg", "سكر أبيض الأسرة ١ كجم", "El Osra White Sugar 1kg", "الأسرة | El Osra", "1 kg", "كيس ١ كجم", "1 kg Bag", "6223001360301"),
    ("flour-sugar", "five-stars-flour-1kg", "دقيق خمس نجوم ١ كجم", "Five Stars Flour 1kg", "خمس نجوم | Five Stars", "1 kg", "كيس ١ كجم", "1 kg Bag", "6224000511014"),
    # 6. Cooking Oil & Ghee
    ("cooking-oil-ghee", "crystal-sunflower-oil-800ml", "زيت ذرة/عباد شمس كريستال ٨٠٠ مل", "Crystal Sunflower Oil 800ml", "كريستال | Crystal", "800 ml", "زجاجة ٨٠٠ مل", "800 ml Bottle", "6221007001015"),
    ("cooking-oil-ghee", "afia-corn-oil-800ml", "زيت ذرة عافية ٨٠٠ مل", "Afia Pure Corn Oil 800ml", "عافية | Afia", "800 ml", "زجاجة ٨٠٠ مل", "800 ml Bottle", "6221007002012"),
    ("cooking-oil-ghee", "rawabi-ghee-700g", "سمن نباتي روابي ٧٠٠ جم", "Rawabi Vegetable Ghee 700g", "روابي | Rawabi", "700 g", "علبة ٧٠٠ جم", "700g Tin", "6221007003019"),
    # 7. Water & Soft Drinks
    ("water-soft-drinks", "dasani-water-1500ml", "مياه معدنية داساني ١.٥ لتر", "Dasani Mineral Water 1.5L", "داساني | Dasani", "1.5 L", "زجاجة ١.٥ لتر", "1.5 L Bottle", "5449000011527"),
    ("water-soft-drinks", "pepsi-can-330ml", "بيبسي كانز ٣٣٠ مل", "Pepsi Cola Can 330ml", "بيبسي | Pepsi", "330 ml", "كانز ٣٣٠ مل", "330 ml Can", "6223001160017"),
    ("water-soft-drinks", "fayrouz-pineapple-330ml", "فيروز أناناس ٣٣٠ مل", "Fayrouz Pineapple 330ml", "فيروز | Fayrouz", "330 ml", "كانز ٣٣٠ مل", "330 ml Can", "6221034001019"),
    # 8. Juices
    ("juices", "juhayna-mango-juice-1l", "عصير جهينة مانجو ١ لتر", "Juhayna Mango Juice 1L", "جهينة | Juhayna", "1 L", "عبوة ١ لتر", "1 L Pack", "6221155004012"),
    ("juices", "juhayna-orange-juice-235ml", "عصير جهينة برتقال ٢٣٥ مل", "Juhayna Orange Juice 235ml", "جهينة | Juhayna", "235 ml", "عبوة ٢٣٥ مل", "235 ml Pack", "6221155004111"),
    ("juices", "lamar-apple-juice-1l", "عصير لمار تفاح ١ لتر", "Lamar Apple Juice 1L", "لمار | Lamar", "1 L", "عبوة ١ لتر", "1 L Pack", "6224001123018"),
    # 9. Tea & Coffee
    ("tea-coffee", "elarosa-tea-250g", "شاي العروسة ناعم ٢٥٠ جم", "El Arosa Black Tea 250g", "العروسة | El Arosa", "250 g", "عبوة ٢٥٠ جم", "250g Pack", "6221011001018"),
    ("tea-coffee", "lipton-yellow-label-100bags", "شاي ليبتون ١٠٠ فتلة", "Lipton Yellow Label 100 Bags", "ليبتون | Lipton", "100 bags", "علبة ١٠٠ فتلة", "100 Tea Bags", "6221007005013"),
    ("tea-coffee", "nescafe-classic-100g", "نسكافيه كلاسيك ١٠٠ جم", "Nescafe Classic Jar 100g", "نسكافيه | Nescafe", "100 g", "برطمان ١٠٠ جم", "100g Jar", "7613035001015"),
    # 10. Biscuits & Snacks
    ("biscuits-snacks", "chipsy-salt-family", "شيبسي بالملح عائلي", "Chipsy Salted Family Pack", "شيبسي | Chipsy", "125 g", "كيس عائلي", "Family Bag", "6223001161014"),
    ("biscuits-snacks", "molto-chocolate-croissant", "مولتو كرواسون بالشوكولاتة", "Molto Chocolate Croissant", "مولتو | Molto", "65 g", "قطعة", "Single Pack", "6223000265010"),
    ("biscuits-snacks", "ulker-tea-biscuit", "بسكويت شاي أولكر ١٢ قطعة", "Ulker Tea Biscuits", "أولكر | Ulker", "175 g", "عبوة", "Pack", "8690504001010"),
    # 11. Chocolate & Sweets
    ("chocolate-sweets", "galaxy-milk-chocolate-90g", "شوكولاتة جالكسي بالحليب ٩٠ جم", "Galaxy Smooth Milk Chocolate 90g", "جالكسي | Galaxy", "90 g", "قالب ٩٠ جم", "90g Bar", "5000159461122"),
    ("chocolate-sweets", "cadbury-dairy-milk-90g", "كادبوري ديري ميلك ٩٠ جم", "Cadbury Dairy Milk 90g", "كادبوري | Cadbury", "90 g", "قالب ٩٠ جم", "90g Bar", "7622210449283"),
    ("chocolate-sweets", "nutella-hazelnut-350g", "نوتيلا كريمة البندق ٣٥٠ جم", "Nutella Hazelnut Spread 350g", "نوتيلا | Nutella", "350 g", "برطمان ٣٥٠ جم", "350g Jar", "8000500037560"),
    # 12. Canned Food
    ("canned-food", "americana-fava-beans-400g", "فول مدمس أمريكانا ٤٠٠ جم", "Americana Fava Beans 400g", "أمريكانا | Americana", "400 g", "علبة ٤٠٠ جم", "400g Can", "6221033001010"),
    ("canned-food", "sunshine-tuna-185g", "تونة صن شاين قطع ١٨٥ جم", "Sunshine Tuna Chunks 185g", "صن شاين | Sunshine", "185 g", "علبة ١٨٥ جم", "185g Can", "6223000111010"),
    ("canned-food", "harvest-tomato-paste-320g", "صلصة طماطم هارفست ٣٢٠ جم", "Harvest Tomato Paste 320g", "هارفست | Harvest", "320 g", "برطمان ٣٢٠ جم", "320g Jar", "6221033002017"),
    # 13. Frozen Food
    ("frozen-food", "farm-frites-fries-1kg", "بطاطس فارم فريتس ١ كجم", "Farm Frites French Fries 1kg", "فارم فريتس | Farm Frites", "1 kg", "كيس ١ كجم", "1 kg Bag", "6223000340014"),
    ("frozen-food", "americana-beef-burger-1kg", "برجر بقري أمريكانا ١ كجم", "Americana Beef Burger 1kg", "أمريكانا | Americana", "1 kg", "عبوة ١ كجم", "1 kg Pack", "6221033004011"),
    ("frozen-food", "basma-molokhia-400g", "ملوخية بسمة مجمدة ٤٠٠ جم", "Basma Frozen Molokhia 400g", "بسمة | Basma", "400 g", "كيس ٤٠٠ جم", "400g Bag", "6221033005018"),
    # 14. Bread & Bakery
    ("bread-bakery", "rich-bake-toast-500g", "توست أبيض ريتش بيك ٥٠٠ جم", "Rich Bake White Toast 500g", "ريتش بيك | Rich Bake", "500 g", "كيس ٥٠٠ جم", "500g Loaf", "6224000111016"),
    ("bread-bakery", "baladi-bread-pack-5", "عيش بلدي طازج ٥ أرغفة", "Fresh Baladi Bread 5 pcs", "مخبز جوار", "5 pcs", "ربطة ٥ أرغفة", "5 Loaves", ""),
    ("bread-bakery", "vino-sandwich-rolls-6", "عيش فينو طازج ٦ قطع", "Fresh Fino Sandwich Rolls 6 pcs", "مخبز جوار", "6 pcs", "كيس ٦ قطع", "6 Rolls", ""),
    # 15. Cleaning Products
    ("cleaning-products", "persil-gel-2l", "برسيل جل أوتوماتيك ٢ لتر", "Persil Power Gel 2L", "برسيل | Persil", "2 L", "عبوة ٢ لتر", "2 L Bottle", "6221007011014"),
    ("cleaning-products", "pril-dishwashing-750ml", "بريل سائل أطباق ٧٥٠ مل", "Pril Dishwashing Liquid 750ml", "بريل | Pril", "750 ml", "زجاجة ٧٥٠ مل", "750 ml Bottle", "6221007012011"),
    ("cleaning-products", "clorox-bleach-950ml", "كلوركس مبيض ملابس ٩٥٠ مل", "Clorox Bleach 950ml", "كلوركس | Clorox", "950 ml", "زجاجة ٩٥٠ مل", "950 ml Bottle", "6221007013018"),
    # 16. Personal Care
    ("personal-care", "lifebuoy-soap-120g", "صابون لايف بوي ١٢٠ جم", "Lifebuoy Total Soap 120g", "لايف بوي | Lifebuoy", "120 g", "قطعة ١٢٠ جم", "120g Bar", "6221007021013"),
    ("personal-care", "signal-toothpaste-120ml", "معجون أسنان سيجنال ١٢٠ مل", "Signal Toothpaste 120ml", "سيجنال | Signal", "120 ml", "عبوة ١٢٠ مل", "120 ml Tube", "6221007022010"),
    ("personal-care", "sunsilk-shampoo-350ml", "شامبو صانسيلك ٣٥٠ مل", "Sunsilk Shampoo 350ml", "صانسيلك | Sunsilk", "350 ml", "زجاجة ٣٥٠ مل", "350 ml Bottle", "6221007023017"),
    # 17. Household Essentials
    ("household-essentials", "fine-tissues-550", "مناديل فاين كلاسيك ٥٥٠ منديل", "Fine Classic Tissues 550 Sheets", "فاين | Fine", "550 sheets", "علبة ٥٥٠ منديل", "550 Sheets Box", "6221007031012"),
    ("household-essentials", "sanita-aluminum-foil", "ورق ألومنيوم سانيتا", "Sanita Aluminum Foil Roll", "سانيتا | Sanita", "1 roll", "رول", "1 Roll", "6221007032019"),
    ("household-essentials", "trash-bags-roll-20", "أكياس قمامة رول ٢٠ كيس", "Heavy Duty Trash Bags 20 pcs", "جوار هوم", "20 pcs", "رول ٢٠ كيس", "20 Bags Roll", ""),
    # 18. Spices & Sauces
    ("spices-sauces", "heinz-ketchup-340g", "كاتشب هاينز ٣٤٠ جم", "Heinz Tomato Ketchup 340g", "هاينز | Heinz", "340 g", "زجاجة ٣٤٠ جم", "340g Bottle", "6221033006015"),
    ("spices-sauces", "maggi-chicken-cubes-8", "مرقة دجاج ماجي ٨ مكعبات", "Maggi Chicken Bouillon 8 Cubes", "ماجي | Maggi", "8 cubes", "علبة ٨ مكعبات", "8 Cubes", "7613035002012"),
    ("spices-sauces", "black-pepper-ground-100g", "فلفل أسود مطحون ١٠٠ جم", "Ground Black Pepper 100g", "الضحى | El Doha", "100 g", "عبوة ١٠٠ جم", "100g Pack", ""),
    # 19. Legumes & Grains
    ("legumes-grains", "eldoha-yellow-lentils-500g", "عدس أصفر الضحى ٥٠٠ جم", "El Doha Yellow Lentils 500g", "الضحى | El Doha", "500 g", "كيس ٥٠٠ جم", "500g Bag", "6223001360400"),
    ("legumes-grains", "eldoha-fava-beans-500g", "فول تدميس الضحى ٥٠٠ جم", "El Doha Dry Fava Beans 500g", "الضحى | El Doha", "500 g", "كيس ٥٠٠ جم", "500g Bag", "6223001360509"),
    ("legumes-grains", "eldoha-chickpeas-500g", "حمص الشام الضحى ٥٠٠ جم", "El Doha Chickpeas 500g", "الضحى | El Doha", "500 g", "كيس ٥٠٠ جم", "500g Bag", "6223001360608"),
]
