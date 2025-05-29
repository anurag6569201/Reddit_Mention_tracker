// src/pages/ResultsPage.tsx
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MetricsDisplay from '../components/MetricsDisplay';
import MentionsList from '../components/MentionsList';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import QnASection from '../components/QnASection';
import type { RedditMetrics, QnAResult, SimplifiedMentionForQA } from '../types';

interface ResultsPageProps {
  metrics: RedditMetrics | null;
  isLoading: boolean; // Main search loading
  error: string | null; // Main search error
  performSearch: (term: string) => Promise<void>;
  searchedTermDisplay: string;
  qnaHistory: QnAResult[];
  setQnaHistory: React.Dispatch<React.SetStateAction<QnAResult[]>>;
  getCachedMentionsForQA: (term: string) => SimplifiedMentionForQA[] | null;
}

const ResultsPage: React.FC<ResultsPageProps> = ({
  metrics,
  isLoading,
  error,
  performSearch,
  searchedTermDisplay,
  qnaHistory,
  setQnaHistory,
  getCachedMentionsForQA,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const termFromUrl = searchParams.get('term');

  useEffect(() => {
    if (termFromUrl && (termFromUrl !== searchedTermDisplay || (!metrics && !isLoading && !error))) {
      performSearch(termFromUrl);
    } else if (!termFromUrl && !isLoading && !metrics && !error) {
      navigate('/');
    }
  }, [termFromUrl, performSearch, searchedTermDisplay, metrics, isLoading, error, navigate]);

  if (isLoading) {
    return <Loader message={`Loading results for "${termFromUrl || searchedTermDisplay}"...`} />;
  }

  if (error && !metrics) { 
    return <ErrorMessage message={error} />;
  }
  
  // Handle case where search was successful but no mentions found, or LLM summary had an error
  if (termFromUrl && !metrics?.mentions?.length && !isLoading) {
     let message = `No public Reddit mentions found for "${termFromUrl}".`;
     if (metrics?.llm_error) { 
         message += ` LLM analysis error: ${metrics.llm_error}`;
     } else if (error) { 
        message = error;
     }
    return (
      <div className="results-content has-data"> 
        {metrics && <MetricsDisplay data={metrics} />} 
        <div className="status-message no-results">{message}</div>
        {metrics?.search_term && (
             <QnASection
                currentSearchTerm={metrics.search_term}
                qnaHistory={qnaHistory}
                setQnaHistory={setQnaHistory}
                getCachedMentionsForQA={getCachedMentionsForQA}
            />
        )}
      </div>
    );
  }

  if (!metrics) { 
    return <div className="status-message">Please initiate a search.</div>;
  }

  return (
    <div className={`results-content has-data`}>
      <MetricsDisplay data={metrics} />
      {metrics.search_term && ( 
        <QnASection
          currentSearchTerm={metrics.search_term}
          qnaHistory={qnaHistory}
          setQnaHistory={setQnaHistory}
          getCachedMentionsForQA={getCachedMentionsForQA}
        />
      )}
      <MentionsList mentions={metrics.mentions} searchTerm={metrics.search_term} />
    </div>
  );
};

export default ResultsPage;