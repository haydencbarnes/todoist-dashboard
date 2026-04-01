import React from 'react';
import { Tooltip } from 'react-tooltip';

interface AppTooltipProps {
  id: string;
}

const AppTooltip: React.FC<AppTooltipProps> = ({ id }) => (
  <Tooltip
    id={id}
    place="top"
    noArrow={true}
    positionStrategy="fixed"
    openOnClick={true}
    className="z-50 max-w-xs !rounded-xl !border !border-warm-border !bg-warm-card !px-3 !py-2 !text-center !text-sm !leading-relaxed !text-white shadow-xl"
  />
);

export default AppTooltip;
