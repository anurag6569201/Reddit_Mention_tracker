// src/pages/ResultsPage.tsx
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MetricsDisplay from '../components/MetricsDisplay';
import MentionsList from '../components/MentionsList';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import type { RedditMetrics } from '../types';

interface ResultsPageProps {
  metrics: RedditMetrics | null;
  isLoading: boolean;
  error: string | null;
  performSearch: (term: string) => Promise<void>; 
  searchedTermDisplay: string;
}

const ResultsPage: React.FC<ResultsPageProps> = ({
  metrics,
  isLoading,
  error,
  performSearch,
  searchedTermDisplay,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const termFromUrl = searchParams.get('term');

  useEffect(() => {
    if (termFromUrl && termFromUrl !== searchedTermDisplay) {
      performSearch(termFromUrl);
    } else if (!termFromUrl && !isLoading && !metrics && !error) {
      navigate('/'); // Redirect to landing
    }
  }, [termFromUrl, performSearch, searchedTermDisplay, metrics, isLoading, error, navigate]);


  if (isLoading) {
    return <Loader message={`Searching Reddit for "${termFromUrl || searchedTermDisplay}"...`} />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!metrics && termFromUrl) {
     // A dedicated "No results found" component could be better here.
     return (
          <div className="status-message no-results">
             No data found for "<strong>{termFromUrl}</strong>", or still loading initial results.
         </div>
     );
  }
 
  if (!metrics) {
     // Should be redirected to landing by useEffect, but as a fallback:
     return <div className="status-message">Please initiate a search from the landing page.</div>;
  }


  return (
    <div className={`results-content ${metrics ? 'has-data' : ''}`}>
      <MetricsDisplay data={metrics} />
      <MentionsList mentions={metrics.mentions} searchTerm={metrics.search_term} />
    </div>
  );
};

export default ResultsPage;