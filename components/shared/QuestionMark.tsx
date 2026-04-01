import React, { memo } from 'react';
import { BsQuestionCircle } from 'react-icons/bs';

interface QuestionMarkProps {
  content: string;
  tooltipId?: string;
  className?: string;
  iconClassName?: string;
}

/**
 * QuestionMark component - displays a help icon with tooltip
 * Clickable on mobile for better UX (touch devices can tap to see tooltip)
 */
const QuestionMark: React.FC<QuestionMarkProps> = memo(({
  content,
  tooltipId = 'dashboard-tooltip',
  className = 'ml-2',
  iconClassName = 'w-4 h-4',
}) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center rounded-full text-warm-gray transition-colors hover:text-white cursor-help focus:outline-none focus:ring-2 focus:ring-warm-peach focus:ring-offset-2 focus:ring-offset-warm-black ${className}`.trim()}
    data-tooltip-id={tooltipId}
    data-tooltip-content={content}
    aria-label={content}
  >
    <BsQuestionCircle className={iconClassName} />
  </button>
));

QuestionMark.displayName = 'QuestionMark';

export default QuestionMark;
