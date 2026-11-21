import React, { useState } from 'react';
import { createSvgFallback } from '../../utils/visuals';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackText,
}) => {
  const [failed, setFailed] = useState(false);

  const resolvedSrc = failed || !src ? createSvgFallback(fallbackText || alt) : src;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (!failed) setFailed(true);
      }}
      className={className}
    />
  );
};
