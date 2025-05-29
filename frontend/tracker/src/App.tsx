// src/App.tsx
import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import LandingPage from './pages/LandingPage';
import ResultsPage from './pages/ResultsPage';
import { apiClient } from './api';
import type { RedditMetrics, Mention, QnAResult, SimplifiedMentionForQA } from './types';
import './index.css';

const LOCALSTORAGE_MENTIONS_KEY_PREFIX = 'redditMentionsCache_';
const MAX_MENTIONS_FOR_QA_CONTEXT = 30;
const MAX_CHARS_PER_MENTION_FOR_QA = 250; // Max chars from text_content

function App() {
  const [metrics, setMetrics] = useState<RedditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For main search
  const [error, setError] = useState<string | null>(null); // For main search
  const [searchedTermDisplay, setSearchedTermDisplay] = useState<string>("");
  const [qnaHistory, setQnaHistory] = useState<QnAResult[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const cacheMentionsForQA = useCallback((term: string, mentions: Mention[]) => {
    if (!term || !mentions || mentions.length === 0) return;
    const simplifiedMentions: SimplifiedMentionForQA[] = mentions
      .slice(0, MAX_MENTIONS_FOR_QA_CONTEXT)
      .map(m => ({
        type: m.type,
        title: m.title.substring(0, 150), // Shorter title in cache
        text: m.text_content ? m.text_content.substring(0, MAX_CHARS_PER_MENTION_FOR_QA) : null,
        score: m.score,
      }));
    try {
      // Clear old cache entries to save space
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(LOCALSTORAGE_MENTIONS_KEY_PREFIX) && key !== `${LOCALSTORAGE_MENTIONS_KEY_PREFIX}${term}`) {
          localStorage.removeItem(key);
        }
      });
      localStorage.setItem(`${LOCALSTORAGE_MENTIONS_KEY_PREFIX}${term}`, JSON.stringify(simplifiedMentions));
    } catch (e) {
      console.error("Error caching mentions for Q&A:", e);
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        clearAllMentionsCache(); // Clear all if quota is hit
      }
    }
  }, []);

  const getCachedMentionsForQA = useCallback((term: string): SimplifiedMentionForQA[] | null => {
    if (!term) return null;
    const cached = localStorage.getItem(`${LOCALSTORAGE_MENTIONS_KEY_PREFIX}${term}`);
    try {
      return cached ? JSON.parse(cached) : null;
    } catch (e) { return null; }
  }, []);

  const clearAllMentionsCache = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(LOCALSTORAGE_MENTIONS_KEY_PREFIX)) localStorage.removeItem(key);
    });
  };

  const performSearch = useCallback(async (termToSearch: string) => {
    const trimmedTerm = termToSearch.trim();
    if (!trimmedTerm) {
      setMetrics(null); setError(null); setSearchedTermDisplay("");
      setQnaHistory([]); clearAllMentionsCache();
      if (location.pathname !== '/') navigate('/');
      return;
    }
    setIsLoading(true); setError(null); setMetrics(null);
    setSearchedTermDisplay(trimmedTerm);
    setQnaHistory([]); // Reset Q&A for new search

    try {
      const response = await apiClient.get<RedditMetrics>('/reddit-mentions/', { params: { term: trimmedTerm } });
      setMetrics(response.data);
      if (response.data?.mentions) {
        cacheMentionsForQA(trimmedTerm, response.data.mentions);
      }
      if (response.data?.llm_error) { // Display LLM error from summary/themes if present
        setError(prevError => prevError ? `${prevError}\nLLM Insight Error: ${response.data.llm_error}` : `LLM Insight Error: ${response.data.llm_error}`);
      }
    } catch (err: any) {
      let errorMessage = "Search failed. Please try again.";
      if (err.response) {
        errorMessage = err.response.data?.error || `Error: ${err.response.statusText} (${err.response.status})`;
      } else if (err.request) {
        errorMessage = 'Network Error: No response from server.';
      } else {
        errorMessage = `Client Error: ${err.message}`;
      }
      setError(errorMessage); setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location.pathname, cacheMentionsForQA]);

  const handleHeaderSearch = (termToSearch: string) => {
    const trimmedTerm = termToSearch.trim();
    if (trimmedTerm) {
      navigate(`/search?term=${encodeURIComponent(trimmedTerm)}`);
    } else {
      setMetrics(null); setError(null); setSearchedTermDisplay("");
      setQnaHistory([]); clearAllMentionsCache();
      navigate('/');
    }
  };

  const handleHeaderClearSearch = () => {
    setMetrics(null); setError(null); setSearchedTermDisplay("");
    setQnaHistory([]); clearAllMentionsCache();
    navigate('/');
  };

  useEffect(() => { 
    if (!metrics) setQnaHistory([]);
  }, [metrics]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            Reddit Mention Tracker
          </h1>
          <div className="header-search-bar">
            <SearchBar
              onSearch={handleHeaderSearch}
              onClearSearch={handleHeaderClearSearch}
              isLoading={isLoading && location.pathname.startsWith('/search')}
              initialTerm={location.pathname.startsWith('/search') ? searchedTermDisplay : ""}
            />
          </div>
        </div>
      </header>
      <main className="app-main-content">
        <Routes>
          <Route path="/" element={<LandingPage onSearch={performSearch} isLoading={isLoading} />} />
          <Route
            path="/search"
            element={
              <ResultsPage
                metrics={metrics}
                isLoading={isLoading}
                error={error}
                performSearch={performSearch}
                searchedTermDisplay={searchedTermDisplay}
                qnaHistory={qnaHistory}
                setQnaHistory={setQnaHistory}
                getCachedMentionsForQA={getCachedMentionsForQA}
              />
            }
          />
          <Route path="*" element={<div className="status-message"><h2>404 - Page Not Found</h2><button onClick={() => navigate('/')}>Go Home</button></div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;