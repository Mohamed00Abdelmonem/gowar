// Curated grocery & storefront photography with crisp SVG data-URI fallback
// so no broken image icons ever appear even under restricted network environments.

export function createSvgFallback(title: string, bgHex = '#E6F5EC', accentHex = '#1B8E53'): string {
  const safeText = title.slice(0, 18).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgHex}"/>
        <stop offset="100%" stop-color="#FFFFFF"/>
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <circle cx="200" cy="128" r="54" fill="${accentHex}" fill-opacity="0.12"/>
    <rect x="166" y="96" width="68" height="64" rx="14" fill="${accentHex}" fill-opacity="0.18"/>
    <path d="M180 124h40l-5 24h-30l-5-24zm10-12a10 10 0 0 1 20 0" stroke="${accentHex}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="200" y="218" font-family="Cairo, Inter, sans-serif" font-size="18" font-weight="700" text-anchor="middle" fill="#1C1917">${safeText}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const PRODUCT_IMAGES = {
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
  cheese: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
  eggs: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  flour: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
  sugar: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
  pasta: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=600&q=80',
  sauce: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&q=80',
  beans: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=600&q=80',
  tuna: 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=600&q=80',
  honey: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
  soda: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
  juice: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80',
  chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
  biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80',
  chocolate: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
  nuts: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80',
  detergent: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
  dishsoap: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
  croissant: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  tomatoes: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
  potatoes: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
  cucumbers: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=600&q=80',
  oranges: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80',
  apples: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
  bananas: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
  tea: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=600&q=80',
  coffee: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
  tissues: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=600&q=80',
  yogurt: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
  foil: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
};

export const STORE_COVERS = {
  albaraka: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80',
  elnour: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80',
  amahmed: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1000&q=80',
  almadina: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=1000&q=80',
  alsaada: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=1000&q=80',
  elekhlas: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=1000&q=80',
  alrahma: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=1000&q=80',
  alzahraa: 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1000&q=80',
  eldokki: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?auto=format&fit=crop&w=1000&q=80',
  mohandessin: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1000&q=80',
  tagamoa: 'https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1000&q=80',
};
