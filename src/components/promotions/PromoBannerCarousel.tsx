import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { promotionsApi, resolvePromotionDestination } from '../../services/promotionsService';
import type { Promotion } from '../../types';

const VIEWED_PROMOS_KEY = 'gowar_viewed_promos_session_v1';
const AUTO_SLIDE_MS = 5500;

function getSessionViewedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(VIEWED_PROMOS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function markSessionViewed(id: string): void {
  try {
    const set = getSessionViewedSet();
    set.add(id);
    sessionStorage.setItem(VIEWED_PROMOS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage errors
  }
}

interface PromoBannerCarouselProps {
  latitude?: number;
  longitude?: number;
  areaId?: string;
}

export const PromoBannerCarousel: React.FC<PromoBannerCarouselProps> = ({
  latitude,
  longitude,
  areaId,
}) => {
  const { language, t } = useApp();
  const navigate = useNavigate();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isRtl = language === 'ar';

  useEffect(() => {
    let cancelled = false;
    promotionsApi
      .fetchPublicPromotions({ latitude, longitude, areaId })
      .then((items) => {
        if (!cancelled) {
          setPromotions(items);
          setActiveIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromotions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, areaId]);

  const total = promotions.length;
  const safeIndex = total > 0 ? activeIndex % total : 0;

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-sliding with reduced-motion respect
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = window.setInterval(goNext, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [total, isPaused, goNext]);

  // Track impression only when banner is actually visible in viewport & once per session
  useEffect(() => {
    if (total === 0) return;
    const activePromo = promotions[safeIndex];
    if (!activePromo) return;

    const viewed = getSessionViewedSet();
    if (viewed.has(activePromo.id)) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      markSessionViewed(activePromo.id);
      void promotionsApi.trackView(activePromo.id).catch(() => undefined);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          if (!getSessionViewedSet().has(activePromo.id)) {
            markSessionViewed(activePromo.id);
            void promotionsApi.trackView(activePromo.id).catch(() => undefined);
          }
          observer.disconnect();
        }
      },
      { threshold: 0.45 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [promotions, safeIndex, total]);

  const handleBannerClick = (promo: Promotion) => {
    void promotionsApi.trackClick(promo.id).catch(() => undefined);
    const { href, isExternal } = resolvePromotionDestination(promo);
    if (isExternal) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      navigate(href);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    const delta = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    setIsPaused(false);
    if (Math.abs(delta) < 40) return;
    if (isRtl) {
      if (delta > 0) goNext();
      else goPrev();
    } else {
      if (delta < 0) goNext();
      else goPrev();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isRtl) goNext();
      else goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isRtl) goPrev();
      else goNext();
    }
  };

  if (loading) {
    return (
      <section aria-label={t('العروض الترويجية', 'Promotional Offers')}>
        <div className="w-full aspect-[16/8] sm:aspect-[21/7] min-h-[180px] max-h-[340px] rounded-2xl bg-[#EAE6E1]/60 animate-pulse" />
      </section>
    );
  }

  if (total === 0) {
    return null;
  }

  return (
    <section
      ref={containerRef}
      aria-roledescription="carousel"
      aria-label={t('العروض الترويجية', 'Promotional Offers')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full rounded-2xl overflow-hidden border border-[#EAE6E1] shadow-sm bg-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#1B8E53]"
    >
      {/* Fixed aspect-ratio track prevents layout shift */}
      <div className="relative w-full aspect-[16/8] sm:aspect-[21/7] min-h-[190px] max-h-[340px] overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(${(isRtl ? 1 : -1) * safeIndex * 100}%)`,
          }}
        >
          {promotions.map((promo, idx) => {
            const title = language === 'ar' ? promo.titleAr : promo.titleEn;
            const description =
              language === 'ar' ? promo.descriptionAr : promo.descriptionEn;
            const discountLabel =
              language === 'ar' ? promo.discountLabelAr : promo.discountLabelEn;
            const ctaText = language === 'ar' ? promo.ctaTextAr : promo.ctaTextEn;
            const overlayHex = promo.overlayColor || '#1C1917';
            const isNearActive =
              idx === safeIndex ||
              idx === (safeIndex + 1) % total ||
              idx === (safeIndex - 1 + total) % total;

            return (
              <div
                key={promo.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} / ${total}: ${title}`}
                aria-hidden={idx !== safeIndex}
                className="relative w-full h-full shrink-0 cursor-pointer select-none"
                onClick={() => handleBannerClick(promo)}
              >
                {isNearActive && (
                  <picture>
                    {promo.mobileImage ? (
                      <source
                        media="(max-width: 639px)"
                        srcSet={promo.mobileImage}
                      />
                    ) : null}
                    <img
                      src={promo.image}
                      alt={title}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  </picture>
                )}

                {/* Gradient overlay for high contrast readability */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: isRtl
                      ? `linear-gradient(270deg, ${overlayHex}E8 0%, ${overlayHex}A6 48%, ${overlayHex}26 100%)`
                      : `linear-gradient(90deg, ${overlayHex}E8 0%, ${overlayHex}A6 48%, ${overlayHex}26 100%)`,
                  }}
                />

                <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 py-5 max-w-xl space-y-2 sm:space-y-3 text-white">
                  {discountLabel && (
                    <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#1B8E53] text-white text-[11px] sm:text-xs font-extrabold shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{discountLabel}</span>
                    </span>
                  )}

                  <h2 className="text-lg sm:text-2xl lg:text-3xl font-extrabold leading-tight line-clamp-2 drop-shadow-xs">
                    {title}
                  </h2>

                  {description && (
                    <p className="text-xs sm:text-sm text-white/90 line-clamp-2 leading-relaxed">
                      {description}
                    </p>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBannerClick(promo);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-[#E6F5EC] text-[#1B8E53] text-xs sm:text-sm font-extrabold shadow-sm transition-colors"
                    >
                      <span>{ctaText}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Previous / Next Controls */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label={t('البانر السابق', 'Previous banner')}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white backdrop-blur-xs absolute top-1/2 -translate-y-1/2 start-3 z-20 transition-colors"
          >
            {isRtl ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label={t('البانر التالي', 'Next banner')}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 text-white backdrop-blur-xs absolute top-1/2 -translate-y-1/2 end-3 z-20 transition-colors"
          >
            {isRtl ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* Pagination Indicators */}
          <div
            role="tablist"
            aria-label={t('مؤشرات البانرات', 'Banner pagination')}
            className="absolute bottom-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-xs"
          >
            {promotions.map((promo, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={promo.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? 'true' : undefined}
                  aria-label={t(`عرض البانر ${idx + 1}`, `Show banner ${idx + 1}`)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    active ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
