import React, { useState, useMemo } from 'react';
import type { Mention } from '../types';
import { formatDistanceToNow } from 'date-fns';
import Pagination from './common/Pagination';

// Robust HighlightedText component
const HighlightedText: React.FC<{ text: string | undefined; highlight: string }> = ({ text, highlight }) => {
  if (!text || !highlight || !highlight.trim()) {
    return <>{text || ''}</>;
  }
  // Escape special characters in highlight string for regex
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? <mark key={i}>{part}</mark> : part
      )}
    </>
  );
};


const SentimentBadge: React.FC<{ label?: 'positive' | 'neutral' | 'negative', score?: number }> = ({ label, score }) => {
  if (!label) return null;

  let emoji = '😐';
  let textClass = 'sentiment-neutral-text';
  let displayText = 'Neutral';

  if (label === 'positive') {
    emoji = '😊';
    textClass = 'sentiment-positive-text';
    displayText = 'Positive';
  } else if (label === 'negative') {
    emoji = '☹️';
    textClass = 'sentiment-negative-text';
    displayText = 'Negative';
  }
  
  return (
    <span className={`sentiment-inline-badge ${textClass}`}>
      {emoji} {displayText} {score !== undefined ? `(${score.toFixed(2)})` : ''}
    </span>
  );
};

interface MentionsListProps {
  mentions: Mention[];
  searchTerm: string;
}

const ITEMS_PER_PAGE = 10;

const MentionsList: React.FC<MentionsListProps> = ({ mentions, searchTerm }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedMentions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return mentions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [mentions, currentPage]);

  const totalPages = Math.ceil(mentions.length / ITEMS_PER_PAGE);

  if (mentions.length === 0) {
    return (
      <div className="status-message no-results mentions-list-empty">
        No public Reddit mentions found for "<HighlightedText text={searchTerm} highlight={searchTerm} />" in the last 7 days.
        <small>(Based on the current API response limit)</small>
      </div>
    );
  }

  return (
    <div className="mentions-list-container">
      <h2 className="section-title">
        Recent Mentions for "<HighlightedText text={searchTerm} highlight={searchTerm} />"
        <small>
          (Displaying {paginatedMentions.length} of {mentions.length} found)
        </small>
      </h2>
      <ul className="mentions-list-ul">
        {paginatedMentions.map((mention) => {
          let formattedTime = 'Date unavailable';
          try {
            const timestamp = typeof mention.created_utc === 'number' ? mention.created_utc * 1000 : null;
            if (timestamp) {
              const dateObject = new Date(timestamp);
              if (!isNaN(dateObject.getTime())) {
                formattedTime = formatDistanceToNow(dateObject, { addSuffix: true });
              } else {
                formattedTime = 'Invalid date';
              }
            } else {
               formattedTime = 'Invalid timestamp';
            }
          } catch (error) {
            console.error(`Error formatting date for mention ID ${mention.id}:`, error);
            formattedTime = 'Error formatting date';
          }

          return (
            <li key={mention.id} className={`mention-item-card type-${mention.type}`}>
              <div className="mention-item-main-content">
                <h3 className="mention-item-title">
                  <a href={mention.url} target="_blank" rel="noopener noreferrer">
                    <HighlightedText text={mention.title} highlight={searchTerm} />
                  </a>
                </h3>
                {mention.type === 'comment' && mention.text_content && (
                  <p className="mention-item-body">
                     <HighlightedText text={mention.text_content.substring(0, 280) + (mention.text_content.length > 280 ? '…' : '')} highlight={searchTerm} />
                  </p>
                )}
              </div>
              <div className="mention-item-footer">
                <div className="mention-item-meta">
                  <span className="meta-item subreddit-link">
                    <a href={`https://reddit.com/r/${mention.subreddit}`} target="_blank" rel="noopener noreferrer">
                      r/{mention.subreddit}
                    </a>
                  </span>
                  <span className="meta-item">Score: {mention.score}</span>
                  {mention.author && mention.author !== '[deleted]' && (
                    <span className="meta-item">
                      By: <a href={`https://reddit.com/u/${mention.author}`} target="_blank" rel="noopener noreferrer">
                        u/{mention.author}
                      </a>
                    </span>
                  )}
                  {(!mention.author || mention.author === '[deleted]') && <span className="meta-item">By: [deleted]</span>}
                  <span className="meta-item">{formattedTime}</span>
                </div>
                <div className="mention-item-tags">
                  <span className="mention-type-badge">{mention.type}</span>
                  {mention.sentiment_label && (
                    <SentimentBadge label={mention.sentiment_label} score={mention.sentiment_score} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default MentionsList;