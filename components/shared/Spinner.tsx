import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const;

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => (
  <div
    className={`animate-spin rounded-full border-t-2 border-b-2 border-warm-peach ${sizeMap[size]} ${className ?? ''}`}
    role="status"
    aria-label="Loading"
  />
);

export default Spinner;
