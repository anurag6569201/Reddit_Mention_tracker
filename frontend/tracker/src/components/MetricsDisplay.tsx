import React from 'react';
import type { RedditMetrics } from '../types';

interface MetricsDisplayProps {
  data: RedditMetrics;
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ data }) => {
  const getSentimentClass = (sentiment: number) => {
    if (sentiment > 0.05) return 'sentiment-positive';
    if (sentiment < -0.05) return 'sentiment-negative';
    return 'sentiment-neutral';
  };

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="value">{data.mention_count}</div>
        <div className="label">Total Mentions</div>
        <small className="label">(last 7 days)</small>
      </div>
      <div className="metric-card">
        <div className="value">{data.average_score.toFixed(1)}</div>
        <div className="label">Average Score</div>
      </div>
      <div className="metric-card">
        <div className={`value ${getSentimentClass(data.average_sentiment)}`}>
          {data.average_sentiment.toFixed(2)}
        </div>
        <div className="label">Avg. Sentiment Score <small>(-1 to +1)</small></div>
      </div>
      <div className="metric-card">
        {data.top_subreddits.length > 0 ? (
          <>
            <div className="value" style={{fontSize: '1.5rem', lineHeight:'1.2', marginBottom:'10px'}}>Top Subreddits</div>
            <ul>
              {data.top_subreddits.map(([sub, count]) => (
                <li key={sub}>r/{sub} ({count})</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="value" style={{fontSize: '1.5rem'}}>-</div>
            <div className="label">Top Subreddits</div>
            <small className="label">(None found)</small>
          </>
        )}
      </div>
    </div>
  );
};

export default MetricsDisplay;