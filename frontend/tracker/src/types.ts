export interface Mention {
  id: string;
  type: 'submission' | 'comment';
  title: string;
  text_content?: string;
  url: string;
  subreddit: string;
  score: number;
  created_utc: number;
  author: string | null;
  sentiment_score?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
}

export interface RedditMetrics {
  search_term: string;
  mention_count: number;
  average_score: number;
  top_subreddits: [string, number][];
  average_sentiment: number;
  overall_sentiment_label: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  top_authors: [string, number][];
  mention_type_counts: {
    submission: number;
    comment: number;
  };
  mentions: Mention[];
  llm_summary?: string | null;        
  llm_key_themes?: string[] | null; 
}