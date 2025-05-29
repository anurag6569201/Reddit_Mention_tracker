import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  onClearSearch: () => void;
  isLoading: boolean;
  initialTerm?: string;
  isLandingPage?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onClearSearch,
  isLoading,
  initialTerm = "",
  isLandingPage = false,
}) => {
  const [term, setTerm] = useState(initialTerm);

  useEffect(() => {
    // Sync local term state if initialTerm prop changes (e.g., from URL navigation)
    if (initialTerm !== term && !isLandingPage) { 
        setTerm(initialTerm);
    }
  }, [initialTerm, isLandingPage]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(term.trim());
  };

  const handleClear = () => {
    setTerm(''); 
    onClearSearch();
  };

  return (
    <form onSubmit={handleSubmit} className={`search-bar ${isLandingPage ? 'landing-search' : ''}`}>
      <input
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={isLandingPage ? "e.g., 'Tesla', 'AI ethics', 'your brand'" : "Search or ask about results..."}
        disabled={isLoading}
        aria-label="Search term"
      />
      <button type="submit" disabled={isLoading || !term.trim()}>
        {isLoading ? 'Searching...' : 'Search'}
      </button>
      {term && (
        <button type="button" onClick={handleClear} disabled={isLoading} className="clear-button">
          Clear
        </button>
      )}
    </form>
  );
};

export default SearchBar;