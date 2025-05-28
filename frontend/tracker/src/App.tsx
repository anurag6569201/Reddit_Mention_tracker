import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import MetricsDisplay from './components/MetricsDisplay';
import MentionsList from './components/MentionsList';
import Loader from './components/common/Loader';
import ErrorMessage from './components/common/ErrorMessage';
import { apiClient } from './api';
import type { RedditMetrics } from './types';
import './index.css';

function App() {
  const [metrics, setMetrics] = useState<RedditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedTermDisplay, setSearchedTermDisplay] = useState<string>("");

  const handleSearch = async (termToSearch: string) => {
    if (!termToSearch.trim()) {
      setMetrics(null);
      setError(null);
      setSearchedTermDisplay("");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMetrics(null);
    setSearchedTermDisplay(termToSearch); 

    try {
      const response = await apiClient.get<RedditMetrics>('/reddit-mentions/', {
        params: { term: termToSearch },
      });
      setMetrics(response.data);
    } catch (err: any) {
      console.error("API Error:", err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(`API Error: ${err.response.data.error}`);
      } else if (err.response && err.response.statusText) {
        setError(`Error: ${err.response.statusText} (Status: ${err.response.status})`);
      } else if (err.request) {
        setError('Network Error: No response from server. Please check if the backend is running and accessible.');
      } else {
        setError(`An unexpected error occurred: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = () => {
    setMetrics(null);
    setError(null);
    setSearchedTermDisplay("");
  };


  return (
    <div className="app-container">
      <header className="app-header">
        <span style={{fontSize: '3rem'}}>📊</span>
        <h1>Reddit Mention Tracker</h1>
      </header>

      <section className="search-section">
        <SearchBar
          onSearch={handleSearch}
          onClearSearch={handleClearSearch} 
          isLoading={isLoading}
        />
      </section>

      {isLoading && <Loader message={`Searching Reddit for "${searchedTermDisplay}"...`} />}
      {error && <ErrorMessage message={error} />}

      {metrics && !isLoading && !error && (
        <div className={`results-section ${metrics ? 'has-data' : ''}`}>
          <MetricsDisplay data={metrics} />
          <MentionsList mentions={metrics.mentions} searchTerm={metrics.search_term} />
        </div>
      )}

      {!isLoading && !error && !metrics && searchedTermDisplay && (
        <div className="status-message no-results">
          No data to display for "<strong>{searchedTermDisplay}</strong>".
        </div>
      )}
       {!isLoading && !error && !metrics && !searchedTermDisplay && (
        <div className="status-message">
          Enter a term above to search for Reddit mentions.
        </div>
      )}
    </div>
  );
}

export default App;