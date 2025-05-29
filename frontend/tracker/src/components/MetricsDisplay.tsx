import React from 'react';
import type { RedditMetrics } from '../types';
import ReactMarkdown from 'react-markdown';

interface MetricsDisplayProps {
  data: RedditMetrics;
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ data }) => {
  const getSentimentClass = (label: RedditMetrics['overall_sentiment_label'] | MentionSentimentLabel) => {
    if (label === 'positive') return 'sentiment-positive';
    if (label === 'negative') return 'sentiment-negative';
    if (label === 'mixed') return 'sentiment-mixed';
    return 'sentiment-neutral'; 
  };

  type MentionSentimentLabel = 'positive' | 'neutral' | 'negative';

  const formatSentimentLabel = (label: RedditMetrics['overall_sentiment_label'] | MentionSentimentLabel | undefined) => {
    if (!label) return '';
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const hasLLMInsights = data.llm_summary || (data.llm_key_themes && data.llm_key_themes.length > 0);

  return (
    <div className={`metrics-display-wrapper ${hasLLMInsights ? 'has-llm-insights' : ''}`}>
      {hasLLMInsights && (
        <section className="llm-insights-section">

          {data.llm_summary && (
            <div className="llm-content-block">
              <h3 className="llm-subtitle">Executive Summary</h3>
              <div className="llm-text"> 
                <ReactMarkdown>{data.llm_summary}</ReactMarkdown>
              </div>
            </div>
          )}
          {data.llm_key_themes && data.llm_key_themes.length > 0 && (
            <div className="llm-content-block">
              <h3 className="llm-subtitle">Key Discussion Themes</h3>
              <ul className="llm-theme-list">
                {data.llm_key_themes.map((theme, index) => (
                  <li key={index}>
                    <ReactMarkdown components={{ p: React.Fragment }}>{theme}</ReactMarkdown>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Section 2: Core Performance Metrics */}
      <section className="core-metrics-section ">
        <h2 className="section-title">Core Mention Metrics</h2>
        <div className="metrics-grid core-metrics-grid">
          <div className="metric-card highlight-metric">
            <div className="label">Total Mentions</div>
            <div className="value">{data.mention_count}</div>
            <small className="label-small">(last 7 days)</small>
          </div>

          <div className="metric-card">
            <div className="label">Average Score</div>
            <div className="value">{data.average_score.toFixed(1)}</div>
            <small className="label-small">(posts & comments)</small>
          </div>

          <div className="metric-card">
            <div className="label">Mention Types</div>
            <div className="value-small-group type-counts">
              <span>Submissions: <strong>{data.mention_type_counts.submission}</strong></span>
              <span>Comments: <strong>{data.mention_type_counts.comment}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Sentiment Analysis */}
      <section className="sentiment-analysis-section ">
        <h2 className="section-title">Sentiment Analysis (VADER)</h2>
        <div className="metrics-grid sentiment-grid">
          <div className="metric-card">
            <div className="label">Avg. Sentiment Score</div>
            <div className={`value ${getSentimentClass(data.overall_sentiment_label)}`}>
              {data.average_sentiment.toFixed(3)}
            </div>
            <div className='sentiment-badge-container'>
              <span className={`sentiment-badge ${getSentimentClass(data.overall_sentiment_label)}`}>
                {formatSentimentLabel(data.overall_sentiment_label)}
              </span>
            </div>
            <small className="label-small">(-1 to +1)</small>
          </div>

          <div className="metric-card">
            <div className="label">Sentiment Distribution</div>
            <div className="value-small-group sentiment-distribution">
              <span className="sentiment-positive">Positive: <strong>{data.sentiment_distribution.positive}</strong></span>
              <span className="sentiment-neutral">Neutral: <strong>{data.sentiment_distribution.neutral}</strong></span>
              <span className="sentiment-negative">Negative: <strong>{data.sentiment_distribution.negative}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Community Insights */}
      <section className="community-insights-section ">
        <h2 className="section-title">Community Hotspots</h2>
        <div className="metrics-grid community-grid">
          <div className="metric-card list-card">
            <h3 className="label card-title-sub">Top Subreddits</h3>
            {data.top_subreddits.length > 0 ? (
              <ul>
                {data.top_subreddits.map(([sub, count]) => (
                  <li key={sub}>r/{sub} <span>({count})</span></li>
                ))}
              </ul>
            ) : (
              <p className="no-data-small">- None found -</p>
            )}
          </div>

          <div className="metric-card list-card">
            <h3 className="label card-title-sub">Top Authors</h3>
            {data.top_authors.length > 0 ? (
              <ul>
                {data.top_authors.map(([author, count]) => (
                  <li key={author}>u/{author} <span>({count})</span></li>
                ))}
              </ul>
            ) : (
              <p className="no-data-small">- None found -</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default MetricsDisplay;