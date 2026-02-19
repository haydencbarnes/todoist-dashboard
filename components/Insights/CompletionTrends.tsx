/**
 * Completion Trends Component
 * Displays Daily, Weekly, and Monthly task completion trends with charts
 */

import React, { memo, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { BsQuestionCircle } from 'react-icons/bs';
import { HiArrowsRightLeft } from 'react-icons/hi2';
import { calculateTaskAverages } from '../../utils/calculateTaskAverages';
import TrendChart from '../TrendChart';
import DeltaIndicator from '../shared/DeltaIndicator';
import { CompletedTask } from '../../types';

type QuestionMarkProps = {
  content: string;
};

const QuestionMark: React.FC<QuestionMarkProps> = memo(({ content }) => (
  <BsQuestionCircle
    className="inline-block ml-2 text-warm-gray hover:text-white cursor-help"
    data-tooltip-id="trends-tooltip"
    data-tooltip-content={content}
  />
));

QuestionMark.displayName = 'QuestionMark';

type CompletionTrendsProps = {
  completedTasks: CompletedTask[];
  loading?: boolean;
  comparisonTasks?: CompletedTask[] | undefined;
};

const CompletionTrends: React.FC<CompletionTrendsProps> = ({ completedTasks, loading, comparisonTasks }) => {
  const [showComparison, setShowComparison] = useState(false);
  const hasComparisonData = comparisonTasks && comparisonTasks.length > 0;
  const taskAverages = calculateTaskAverages(completedTasks);
  const comparisonAverages = showComparison && comparisonTasks ? calculateTaskAverages(comparisonTasks) : null;

  return (
    <div className={`bg-warm-card border border-warm-border p-2 md:p-6 rounded-2xl ${loading ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold flex items-center text-white">
          Task Completion Trends
          <QuestionMark content="Historical trends of your task completion patterns" />
        </h3>
        {hasComparisonData && (
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`p-1.5 rounded-lg border transition-all ${
              showComparison
                ? 'bg-warm-blue/15 border-warm-blue text-warm-blue'
                : 'border-warm-border text-warm-gray hover:text-white hover:border-warm-gray'
            }`}
            title="Compare with previous period"
          >
            <HiArrowsRightLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Daily Trend */}
        <div>
          {loading || !taskAverages?.last24Hours ? (
            <div className="flex items-center justify-center h-[240px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-warm-peach"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-warm-gray">Daily</span>
                <div className="flex items-center">
                  <span className="text-warm-peach font-semibold mr-3">
                    {taskAverages.last24Hours.average} avg
                  </span>
                  {comparisonAverages?.last24Hours && (
                    <DeltaIndicator
                      current={taskAverages.last24Hours.average}
                      previous={comparisonAverages.last24Hours.average}
                      size="sm"
                      label="Daily avg vs previous period"
                    />
                  )}
                  <span
                    className={`text-sm px-2 py-1 rounded cursor-help ${
                      taskAverages.last24Hours.percentChange >= 0
                        ? 'text-warm-sage bg-warm-sage/10'
                        : 'text-warm-peach bg-warm-peach/10'
                    }`}
                    data-tooltip-id="trends-tooltip"
                    data-tooltip-content={`${Math.abs(taskAverages.last24Hours.percentChange)}% ${
                      taskAverages.last24Hours.percentChange >= 0 ? 'above' : 'below'
                    } your daily average (comparing last 24 hours to 4-week average)`}
                  >
                    {taskAverages.last24Hours.percentChange >= 0 ? '↑' : '↓'}{' '}
                    {Math.abs(taskAverages.last24Hours.percentChange)}%
                  </span>
                </div>
              </div>
              <TrendChart
                data={taskAverages.last24Hours.history.data}
                labels={taskAverages.last24Hours.history.labels}
                height={180}
                comparisonData={comparisonAverages?.last24Hours?.history.data}
              />
            </>
          )}
        </div>

        {/* Weekly Trend */}
        <div>
          {loading || !taskAverages?.last7Days ? (
            <div className="flex items-center justify-center h-[240px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-warm-peach"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-warm-gray">Weekly</span>
                <div className="flex items-center">
                  <span className="text-warm-peach font-semibold mr-3">
                    {taskAverages.last7Days.average} avg
                  </span>
                  {comparisonAverages?.last7Days && (
                    <DeltaIndicator
                      current={taskAverages.last7Days.average}
                      previous={comparisonAverages.last7Days.average}
                      size="sm"
                      label="Weekly avg vs previous period"
                    />
                  )}
                  <span
                    className={`text-sm px-2 py-1 rounded cursor-help ${
                      taskAverages.last7Days.percentChange >= 0
                        ? 'text-warm-sage bg-warm-sage/10'
                        : 'text-warm-peach bg-warm-peach/10'
                    }`}
                    data-tooltip-id="trends-tooltip"
                    data-tooltip-content={`${Math.abs(taskAverages.last7Days.percentChange)}% ${
                      taskAverages.last7Days.percentChange >= 0 ? 'above' : 'below'
                    } your weekly average (comparing last 7 days to 12-week average)`}
                  >
                    {taskAverages.last7Days.percentChange >= 0 ? '↑' : '↓'}{' '}
                    {Math.abs(taskAverages.last7Days.percentChange)}%
                  </span>
                </div>
              </div>
              <TrendChart
                data={taskAverages.last7Days.history.data}
                labels={taskAverages.last7Days.history.labels}
                height={180}
                comparisonData={comparisonAverages?.last7Days?.history.data}
              />
            </>
          )}
        </div>

        {/* Monthly Trend */}
        <div>
          {loading || !taskAverages?.last30Days ? (
            <div className="flex items-center justify-center h-[240px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-warm-peach"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-warm-gray">Monthly</span>
                <div className="flex items-center">
                  <span className="text-warm-peach font-semibold mr-3">
                    {taskAverages.last30Days.average} avg
                  </span>
                  {comparisonAverages?.last30Days && (
                    <DeltaIndicator
                      current={taskAverages.last30Days.average}
                      previous={comparisonAverages.last30Days.average}
                      size="sm"
                      label="Monthly avg vs previous period"
                    />
                  )}
                  <span
                    className={`text-sm px-2 py-1 rounded cursor-help ${
                      taskAverages.last30Days.percentChange >= 0
                        ? 'text-warm-sage bg-warm-sage/10'
                        : 'text-warm-peach bg-warm-peach/10'
                    }`}
                    data-tooltip-id="trends-tooltip"
                    data-tooltip-content={`${Math.abs(taskAverages.last30Days.percentChange)}% ${
                      taskAverages.last30Days.percentChange >= 0 ? 'above' : 'below'
                    } your monthly average (comparing last 30 days to 12-month average)`}
                  >
                    {taskAverages.last30Days.percentChange >= 0 ? '↑' : '↓'}{' '}
                    {Math.abs(taskAverages.last30Days.percentChange)}%
                  </span>
                </div>
              </div>
              <TrendChart
                data={taskAverages.last30Days.history.data}
                labels={taskAverages.last30Days.history.labels}
                height={180}
                comparisonData={comparisonAverages?.last30Days?.history.data}
              />
            </>
          )}
        </div>
      </div>

      <Tooltip id="trends-tooltip" positionStrategy="fixed" openOnClick={true} className="z-50 max-w-xs text-center" />
    </div>
  );
};

export default memo(CompletionTrends);
