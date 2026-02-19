'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import SectionSkeleton from './SectionSkeleton';
import { useExportManager } from '../../hooks/useExportManager';

interface LazySectionProps {
  sectionId?: string;
  exportRef: (element: HTMLDivElement | null) => void;
  visible: boolean;
  eager?: boolean;
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

const LazySection: React.FC<LazySectionProps> = ({
  exportRef,
  visible,
  eager = false,
  minHeight = 400,
  className,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(eager);
  const { forceRenderAll } = useExportManager();

  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      exportRef(el);
    },
    [exportRef]
  );

  useEffect(() => {
    if (eager || hasBeenVisible) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, hasBeenVisible]);

  if (!visible) return null;

  const shouldRender = hasBeenVisible || forceRenderAll;

  return (
    <div
      ref={combinedRef}
      className={className}
      style={!shouldRender ? { minHeight } : undefined}
    >
      {shouldRender ? children : <SectionSkeleton minHeight={minHeight} />}
    </div>
  );
};

export default LazySection;
