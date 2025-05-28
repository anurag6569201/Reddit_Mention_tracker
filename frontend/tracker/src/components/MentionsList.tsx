import React, { useState, useMemo } from 'react';
import type { Mention } from '../types';
import { formatDistanceToNow } from 'date-fns';
import Pagination from './common/Pagination';

interface MentionsListProps {
  mentions: Mention[];
  searchTerm: string;
}

const ITEMS_PER_PAGE = 10;

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim() || !text) {
    return <>{text}</>;
  }
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? <mark key={i}>{part}</mark> : part
      )}
    </>
  );
};


const MentionsList: React.FC<MentionsListProps> = ({ mentions, searchTerm }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedMentions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return mentions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [mentions, currentPage]);

  const totalPages = Math.ceil(mentions.length / ITEMS_PER_PAGE);

  if (mentions.length === 0) {
    return (
      <div className="status-message no-results">
        No public Reddit mentions found for "<strong>{searchTerm}</strong>" in the last 7 days.
      </div>
    );
  }

  return (
    <div className="mentions-container">
      <h2>
        Recent Mentions for "<HighlightedText text={searchTerm} highlight={searchTerm} />"
      </h2>
      <ul>
        {paginatedMentions.map((mention) => {
          let formattedTime = 'Date unavailable';
          try {
            const timestamp = typeof mention.created_utc === 'number' ? mention.created_utc * 1000 : null;
            if (timestamp) {
              const dateObject = new Date(timestamp);
              if (!isNaN(dateObject.getTime())) {
                formattedTime = formatDistanceToNow(dateObject, { addSuffix: true });
              } else {
                console.warn(`Invalid date created for mention ID ${mention.id} with UTC: ${mention.created_utc}`);
                formattedTime = 'Invalid date';
              }
            } else {
               console.warn(`Invalid or missing created_utc for mention ID ${mention.id}: ${mention.created_utc}`);
               formattedTime = 'Invalid timestamp';
            }
          } catch (error) {
            console.error(`Error formatting date for mention ID ${mention.id}:`, error);
          }

          return (
            <li key={mention.id} className={`mention-item mention-type-${mention.type}`}>
              <div className="mention-title">
                <a href={mention.url} target="_blank" rel="noopener noreferrer">
                  <HighlightedText text={mention.title} highlight={searchTerm} />
                </a>
              </div>
              {mention.type === 'comment' && mention.text_content && (
                <p className="mention-body">
                  <HighlightedText text={mention.text_content.substring(0, 250) + (mention.text_content.length > 250 ? '...' : '')} highlight={searchTerm} />
                </p>
              )}
              <p className="mention-meta">
                <span>
                  <a href={`https://reddit.com/r/${mention.subreddit}`} target="_blank" rel="noopener noreferrer">
                    r/{mention.subreddit}
                  </a>
                </span>
                <span>• Score: {mention.score}</span>
                {mention.author && mention.author !== '[deleted]' && (
                  <span>
                    • By: <a href={`https://reddit.com/u/${mention.author}`} target="_blank" rel="noopener noreferrer">
                      u/{mention.author}
                    </a>
                  </span>
                )}
                {(!mention.author || mention.author === '[deleted]') && <span>• By: [deleted]</span>}
                <span>• {formattedTime}</span>
                <span className="mention-type-badge">• {mention.type}</span>
              </p>
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