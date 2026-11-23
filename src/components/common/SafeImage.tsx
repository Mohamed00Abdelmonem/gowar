import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  const isFallback = failed || !src;
  const resolvedSrc = isFallback ? createSvgFallback(fallbackText || alt) : src;

  return (
    <div className="relative w-full h-full">
      {!loaded && !isFallback && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#EFECE8] animate-pulse"
        />
      )}
      <img
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
        className={`${className} transition-opacity duration-200 ${
          loaded || isFallback ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
