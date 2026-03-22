import React from 'react';

interface SectionGroupHeaderProps {
  label: string;
}

const SectionGroupHeader: React.FC<SectionGroupHeaderProps> = ({ label }) => (
  <div className="flex items-center gap-4 pt-10 pb-4">
    <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-gray whitespace-nowrap">
      {label}
    </h2>
    <div className="flex-1 h-px bg-warm-border" />
  </div>
);

export default SectionGroupHeader;
