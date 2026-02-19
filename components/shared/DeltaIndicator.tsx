import React from 'react';

interface DeltaIndicatorProps {
  current: number;
  previous: number;
  size?: 'sm' | 'md';
  label?: string;
}

const DeltaIndicator: React.FC<DeltaIndicatorProps> = ({
  current,
  previous,
  size = 'sm',
  label,
}) => {
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const percentChange = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : current > 0 ? 100 : 0;

  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  const colorClass = isNeutral
    ? 'text-warm-gray bg-warm-gray/10'
    : isPositive
      ? 'text-warm-sage bg-warm-sage/10'
      : 'text-warm-peach bg-warm-peach/10';

  const arrow = isNeutral ? '' : isPositive ? '\u2191' : '\u2193';

  const sizeClass = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-sm px-2 py-1';

  const tooltipText = label
    ? `${label}: ${current} vs ${previous} (previous period)`
    : `${current} vs ${previous} (previous period)`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-medium ${colorClass} ${sizeClass}`}
      title={tooltipText}
    >
      {arrow} {Math.abs(percentChange)}%
    </span>
  );
};

export default DeltaIndicator;
