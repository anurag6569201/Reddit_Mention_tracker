import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
  onClearSearch: () => void; 
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onClearSearch, isLoading }) => {
  const [term, setTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(term.trim());
  };

  const handleClear = () => {
    setTerm('');
    onClearSearch();
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <input
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Enter company or person name"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading || !term.trim()}>
        {isLoading ? 'Searching...' : 'Search Reddit'}
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