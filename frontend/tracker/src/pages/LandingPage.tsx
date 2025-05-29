// src/pages/LandingPage.tsx
import React from 'react';
import SearchBar from '../components/SearchBar';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
  onSearch: (term: string) => void; 
  isLoading: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSearch, isLoading }) => {
  const navigate = useNavigate();

  const handleLandingSearch = (termToSearch: string) => {
    if (termToSearch.trim()) {
      onSearch(termToSearch); 
      navigate(`/search?term=${encodeURIComponent(termToSearch.trim())}`);
    }
  };

  return (
    <div className="landing-page-content">
      <div className="search-section landing-search-section">
        <SearchBar
          onSearch={handleLandingSearch}
          onClearSearch={() => {}} 
          isLoading={isLoading}
          isLandingPage={true} 
        />
      </div>
      <div className="status-message landing-prompt" style={{ opacity: '0.8' }}>
        <h2>Discover Reddit Insights Instantly</h2>
        <p>Enter a company, product, or topic to track mentions and analyze sentiment across Reddit.</p>
      </div>
    </div>
  );
};

export default LandingPage;