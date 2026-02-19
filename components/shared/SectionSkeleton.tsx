import React from 'react';

interface SectionSkeletonProps {
  minHeight?: number;
}

const SectionSkeleton: React.FC<SectionSkeletonProps> = ({ minHeight = 400 }) => (
  <div
    className="bg-warm-card border border-warm-border rounded-2xl p-6 animate-pulse"
    style={{ minHeight }}
  >
    {/* Title bar */}
    <div className="h-6 w-48 bg-warm-border/50 rounded mb-6" />
    {/* Content bars */}
    <div className="space-y-4">
      <div className="h-4 w-full bg-warm-border/30 rounded" />
      <div className="h-4 w-3/4 bg-warm-border/30 rounded" />
      <div className="h-4 w-5/6 bg-warm-border/30 rounded" />
    </div>
  </div>
);

export default SectionSkeleton;
