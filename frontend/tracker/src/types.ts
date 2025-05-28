// src/types.ts
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
}

export interface RedditMetrics {
  search_term: string;
  mention_count: number;
  average_score: number;
  top_subreddits: [string, number][]; 
  average_sentiment: number;
  mentions: Mention[];
}