import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar'; 
import LandingPage from './pages/LandingPage';
import ResultsPage from './pages/ResultsPage';
import { apiClient } from './api';
import type { RedditMetrics } from './types';
import './index.css';

function App() {
  const [metrics, setMetrics] = useState<RedditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedTermDisplay, setSearchedTermDisplay] = useState<string>(""); 

  const navigate = useNavigate();
  const location = useLocation();

  // Define performSearch once and pass it down
  const performSearch = useCallback(async (termToSearch: string) => {
    if (!termToSearch.trim()) {
      setMetrics(null);
      setError(null);
      setSearchedTermDisplay("");
      if (location.pathname !== '/') navigate('/'); 
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
      if (!response.data || response.data.mention_count === 0) {
      }
    } catch (err: any) {
      console.error("API Error:", err);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (err.response) {
        if (err.response.data && err.response.data.error) {
          errorMessage = `API Error: ${err.response.data.error}`;
        } else if (err.response.statusText) {
          errorMessage = `Error: ${err.response.statusText} (Status: ${err.response.status})`;
        }
      } else if (err.request) {
        errorMessage = 'Network Error: No response from server. Please check the backend.';
      } else {
        errorMessage = `An unexpected error occurred: ${err.message}`;
      }
      setError(errorMessage);
      setMetrics(null); 
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location.pathname]); 


  // This search is for the header SearchBar, always navigates to results
  const handleHeaderSearch = (termToSearch: string) => {
    if (termToSearch.trim()) {
      navigate(`/search?term=${encodeURIComponent(termToSearch.trim())}`);
    } else {
        setMetrics(null);
        setError(null);
        setSearchedTermDisplay("");
        navigate('/');
    }
  };
  
  const handleHeaderClearSearch = () => {
    setMetrics(null);
    setError(null);
    setSearchedTermDisplay("");
    navigate('/'); 
  };


  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content"> 
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Reddit Mention Tracker <span className="logo-icon" role="img" aria-label="magnifying glass">📊</span>
          </h1>
          <div className="header-search-bar">
            <SearchBar
              onSearch={handleHeaderSearch}
              onClearSearch={handleHeaderClearSearch}
              isLoading={isLoading && location.pathname.startsWith('/search')} 
            />
          </div>
        </div>
      </header>

      <main className="app-main-content">
        <Routes>
          <Route
            path="/"
            element={<LandingPage onSearch={performSearch} isLoading={isLoading} />}
          />
          <Route
            path="/search"
            element={
              <ResultsPage
                metrics={metrics}
                isLoading={isLoading}
                error={error}
                performSearch={performSearch}
                searchedTermDisplay={searchedTermDisplay}
              />
            }
          />
          <Route path="*" element={<div><h2>Page Not Found</h2><button onClick={() => navigate('/')}>Go Home</button></div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;