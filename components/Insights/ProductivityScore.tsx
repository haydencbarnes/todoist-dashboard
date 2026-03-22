/**
 * Productivity Score Component
 * Displays the circular productivity score gauge and key metrics cards
 */

import React, { memo } from 'react';
import { Tooltip } from 'react-tooltip';
import { calculateMostProductiveDay } from '../../utils/calculateMostProductiveDay';
import { calculateMostProductiveTimeOfDay } from '../../utils/calculateMostProductiveTimeOfDay';
import { calculateMostProductiveDayOfWeek } from '../../utils/calculateMostProductiveDayOfWeek';
import { calculateCompletionRates } from '../../utils/calculateCompletionRates';
import { getDayOfWeekName, DayOfWeek } from '../../utils/getDayOfWeekName';
import QuestionMark from '../shared/QuestionMark';
import { CompletedTask } from '../../types';

type MetricCardProps = {
  icon: string;
  title: string;
  value: string;
  subtext?: string;
  tooltipContent: string;
};

const MetricCard: React.FC<MetricCardProps> = memo(
  ({ icon, title, value, subtext, tooltipContent }) => (
    <div
      className="flex flex-col items-center p-4 bg-warm-hover border border-warm-border rounded-2xl cursor-help hover:bg-warm-card transition-colors"
      data-tooltip-id="productivity-tooltip"
      data-tooltip-content={tooltipContent}
    >
      <span className="text-4xl mb-2">{icon}</span>
      <span className="text-sm text-warm-gray">{title}</span>
      <span className="text-lg text-warm-peach font-semibold">{value}</span>
      {subtext && <span className="text-xs text-warm-gray mt-1">{subtext}</span>}
    </div>
  )
);

MetricCard.displayName = 'MetricCard';

type ProductivityScoreProps = {
  completedTasks: CompletedTask[];
  loading?: boolean;
};

const ProductivityScore: React.FC<ProductivityScoreProps> = ({ completedTasks, loading }) => {
  const mostProductiveDay = calculateMostProductiveDay(completedTasks);
  const focusTimeRange = calculateMostProductiveTimeOfDay(completedTasks);
  const mostProductiveDayOfWeek = calculateMostProductiveDayOfWeek(completedTasks);
  const completionRates = calculateCompletionRates(completedTasks);

  // Calculate productivity score (0-100)
  const productivityScore = Math.min(
    100,
    Math.round(
      completionRates.weeklyCompletionRate * 40 +
        completionRates.monthlyCompletionRate * 30 +
        ((mostProductiveDay?.count || 0) > 5 ? 30 : (mostProductiveDay?.count || 0) * 6)
    )
  );

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Outstanding';
    if (score >= 75) return 'Strong';
    if (score >= 50) return 'Building momentum';
    if (score >= 25) return 'Getting started';
    return 'Room to grow';
  };

  return (
    <div className={`flex flex-col md:flex-row gap-6 items-center ${loading ? 'opacity-50' : ''}`}>
      {/* Productivity Score */}
      <div className="text-center">
        <div className={`inline-block relative ${productivityScore > 80 ? 'ring-2 ring-warm-peach/30 ring-offset-4 ring-offset-warm-black rounded-full' : ''}`}>
          <svg className="w-40 sm:w-48 h-40 sm:h-48" viewBox="0 0 100 100">
            <circle
              className="text-warm-border"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="40"
              cx="50"
              cy="50"
            />
            <circle
              className="text-warm-peach transition-all duration-1000 ease-out"
              strokeWidth="8"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="40"
              cx="50"
              cy="50"
              strokeDasharray={`${(2 * Math.PI * 40 * productivityScore) / 100} ${2 * Math.PI * 40}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold">{productivityScore}</span>
            <span className="text-xs text-warm-gray mt-1">{getScoreLabel(productivityScore)}</span>
          </div>
        </div>
        <p className="text-xl mt-2">
          Productivity Score
          <QuestionMark content="Your productivity score is based on your completion rates and task consistency" tooltipId="productivity-tooltip" />
        </p>
      </div>

      {/* Key Metrics */}
      <div className="flex-1 bg-warm-card border border-warm-border p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-white">
          Key Metrics
          <QuestionMark content="Overview of your most productive periods" tooltipId="productivity-tooltip" />
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {mostProductiveDay && (
            <MetricCard
              icon="📅"
              title="Most Productive Day"
              value={mostProductiveDay.date}
              subtext={`${mostProductiveDay.count} tasks`}
              tooltipContent="Your most productive day with the highest task completion"
            />
          )}
          {focusTimeRange && (
            <MetricCard
              icon="🎯"
              title="Focus Mode"
              value={`${focusTimeRange.startTime}-${focusTimeRange.endTime}`}
              subtext={`${focusTimeRange.count} tasks`}
              tooltipContent="Your optimal focus hours based on task completion patterns"
            />
          )}
          {mostProductiveDayOfWeek && (
            <MetricCard
              icon="📊"
              title="Best Day of Week"
              value={getDayOfWeekName(mostProductiveDayOfWeek.dayOfWeek as DayOfWeek)}
              subtext={`${Math.round(mostProductiveDayOfWeek.averageCount)} tasks/day`}
              tooltipContent={`Average of ${Math.round(mostProductiveDayOfWeek.averageCount)} tasks completed on ${getDayOfWeekName(mostProductiveDayOfWeek.dayOfWeek as DayOfWeek)}s over the last 4 weeks`}
            />
          )}
        </div>
      </div>

      <Tooltip id="productivity-tooltip" positionStrategy="fixed" openOnClick={true} className="z-50 max-w-xs text-center" />
    </div>
  );
};

export default memo(ProductivityScore);
