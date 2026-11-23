import React, { useEffect, useRef, useState } from 'react';
import { createSvgFallback } from '../../utils/visuals';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  priority?: boolean;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackText,
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setLoaded(true);
      } else if (src) {
        setFailed(true);
        setLoaded(true);
      }
    } else {
      setLoaded(false);
    }
  }, [src]);

  const isFallback = failed || !src;
  const resolvedSrc = isFallback ? createSvgFallback(fallbackText || alt) : src;

  return (
    <div className={`relative overflow-hidden ${className || 'w-full h-full'}`}>
      {!loaded && !isFallback && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#EFECE8] animate-pulse"
        />
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) setFailed(true);
          setLoaded(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loaded || isFallback ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
