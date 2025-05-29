import React, { useState } from 'react';
import type { QnAResult, SimplifiedMentionForQA } from '../types';
import ReactMarkdown from 'react-markdown';
import { apiClient } from '../api'; 

interface QnASectionProps {
  currentSearchTerm: string;
  qnaHistory: QnAResult[];
  setQnaHistory: React.Dispatch<React.SetStateAction<QnAResult[]>>;
  getCachedMentionsForQA: (term: string) => SimplifiedMentionForQA[] | null;
}

const QnASection: React.FC<QnASectionProps> = ({
  currentSearchTerm,
  qnaHistory,
  setQnaHistory,
  getCachedMentionsForQA,
}) => {
  const [question, setQuestion] = useState('');

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQuestion = question.trim();
    if (!currentQuestion || !currentSearchTerm) return;

    const tempId = Date.now();
    // Optimistically add question to history with loading state
    setQnaHistory(prev => [
      ...prev,
      { question: currentQuestion, answer: null, error: null, timestamp: tempId, isLoading: true },
    ]);
    setQuestion(''); 

    const cachedMentions = getCachedMentionsForQA(currentSearchTerm);
    if (!cachedMentions || cachedMentions.length === 0) {
      setQnaHistory(prev => prev.map(item =>
        item.timestamp === tempId
          ? { ...item, error: 'No mention context available for Q&A.', isLoading: false }
          : item
      ));
      return;
    }

    try {
      const response = await apiClient.post('/reddit-qna/', {
        question: currentQuestion,
        search_term: currentSearchTerm,
        context_mentions: cachedMentions,
      });
      
      setQnaHistory(prev => prev.map(item =>
        item.timestamp === tempId
          ? { ...item, answer: response.data.answer, error: response.data.error, isLoading: false }
          : item
      ));

    } catch (err: any) {
      let errorMessage = "Q&A request failed.";
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setQnaHistory(prev => prev.map(item =>
        item.timestamp === tempId
          ? { ...item, error: errorMessage, isLoading: false }
          : item
      ));
    }
  };

  const isLoadingAnyQuestion = qnaHistory.some(item => item.isLoading);

  return (
    <div className="qna-section ">
      <h2 className="section-title">
        Ask About These Mentions
      </h2>
    <div className="qna_space">
              <form onSubmit={handleAskQuestion} className="qna-form">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask about "${currentSearchTerm}" mentions... (e.g., What are common complaints?)`}
          rows={3}
          disabled={isLoadingAnyQuestion || !currentSearchTerm}
        />
        <button type="submit" disabled={isLoadingAnyQuestion || !question.trim() || !currentSearchTerm}>
          {isLoadingAnyQuestion ? 'Processing...' : 'Ask AI'}
        </button>
      </form>

      {qnaHistory.length > 0 && (
        <div className="qna-history">
          <h3 className="qna-history-title">Q&A Log</h3>
          {qnaHistory.slice().reverse().map((item) => (
            <div key={item.timestamp} className={`qna-item ${item.isLoading ? 'loading' : ''}`}>
              <p className="qna-question"><strong>You:</strong> {item.question}</p>
              {item.isLoading && <div className="qna-loader"><span></span><span></span><span></span> Thinking...</div>}
              {item.answer && !item.isLoading && (
                <div className="qna-answer">
                  <strong>AI:</strong>
                  <ReactMarkdown
                    components={{ // Ensure p tags from markdown don't add extra margins if not desired
                        p: ({node, ...props}) => <span {...props} />
                    }}
                  >
                    {item.answer}
                  </ReactMarkdown>
                </div>
              )}
              {item.error && !item.isLoading && <p className="qna-error"><strong>Error:</strong> {item.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
      {!currentSearchTerm && (
        <p className="qna-placeholder-text">Search for a term to enable Q&A about its mentions.</p>
      )}
    </div>
  );
};

export default QnASection;