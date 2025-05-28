import os
import praw
import datetime
from collections import Counter
from dotenv import load_dotenv

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from nltk.sentiment.vader import SentimentIntensityAnalyzer
import nltk 

load_dotenv()

try:
    analyzer = SentimentIntensityAnalyzer()
except LookupError:
    print("NLTK VADER lexicon not found. Downloading...")
    try:
        nltk.download('vader_lexicon')
        analyzer = SentimentIntensityAnalyzer()
        print("VADER lexicon downloaded successfully.")
    except Exception as e:
        print(f"Failed to download VADER lexicon: {e}")
        analyzer = None

class RedditMentionsView(APIView):
    def get(self, request):
        search_term = request.query_params.get('term', None)
        if not search_term or not search_term.strip():
            return Response(
                {"error": "Search term ('term') is required and cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not analyzer:
            return Response(
                {"error": "Sentiment analyzer is not available. Please check server logs."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            reddit = praw.Reddit(
                client_id=os.getenv('REDDIT_CLIENT_ID'),
                client_secret=os.getenv('REDDIT_CLIENT_SECRET'),
                user_agent=os.getenv('REDDIT_USER_AGENT', 'django:myredditapp:v1.0 (by /u/yourusername)'),
            )
            reddit.read_only = True

            mentions_data = []
            total_score_sum = 0 
            valid_scores_count = 0
            subreddit_counts = Counter()
            sentiment_scores = []
            
            # Fetching comments for many posts can be slow.
            search_limit = int(os.getenv('REDDIT_SEARCH_LIMIT', 25))

            print(f"Searching Reddit for: \"{search_term}\" with submission limit: {search_limit}")
            
            # time_filter='week' handles the "last seven days"
            submissions = reddit.subreddit("all").search(
                query=search_term,
                sort="new",
                time_filter="week",
                limit=search_limit 
            )

            seven_days_ago_ts = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).timestamp()
            processed_ids = set() 

            for submission in submissions:
                if submission.id in processed_ids:
                    continue
                
                # Double check the timestamp, though time_filter='week' should handle it
                if submission.created_utc < seven_days_ago_ts:
                    continue

                submission_matched = False
                submission_text_for_sentiment = submission.title
                
                # Check title
                if search_term.lower() in submission.title.lower():
                    submission_matched = True
                
                # Check selftext (body of text posts)
                if submission.selftext and search_term.lower() in submission.selftext.lower():
                    submission_matched = True
                    submission_text_for_sentiment += " " + submission.selftext

                if submission_matched:
                    mentions_data.append({
                        'id': submission.id,
                        'type': 'submission',
                        'title': submission.title,
                        'text_content': submission.selftext if submission.selftext else None,
                        'url': f"https://reddit.com{submission.permalink}",
                        'subreddit': submission.subreddit.display_name,
                        'score': submission.score,
                        'created_utc': submission.created_utc,
                        'author': submission.author.name if submission.author else None
                    })
                    total_score_sum += submission.score
                    valid_scores_count += 1
                    subreddit_counts[submission.subreddit.display_name] += 1
                    
                    vs = analyzer.polarity_scores(submission_text_for_sentiment)
                    sentiment_scores.append(vs['compound'])
                    processed_ids.add(submission.id)

                # Using limit=10 for replace_more as a balance.
                submission.comments.replace_more(limit=10) 
                for comment in submission.comments.list():
                    if comment.id in processed_ids or f"c_{comment.id}" in processed_ids:
                        continue
                    if comment.created_utc < seven_days_ago_ts:
                        continue

                    if search_term.lower() in comment.body.lower():
                        mentions_data.append({
                            'id': f"c_{comment.id}", 
                            'type': 'comment',
                            'title': f"Comment in: {submission.title[:100]}{'...' if len(submission.title)>100 else ''}",
                            'text_content': comment.body,
                            'url': f"https://reddit.com{comment.permalink}",
                            'subreddit': comment.subreddit.display_name,
                            'score': comment.score,
                            'created_utc': comment.created_utc,
                            'author': comment.author.name if comment.author else None
                        })
                        total_score_sum += comment.score
                        valid_scores_count +=1
                        subreddit_counts[submission.subreddit.display_name] += 1 
                        
                        vs = analyzer.polarity_scores(comment.body)
                        sentiment_scores.append(vs['compound'])
                        processed_ids.add(f"c_{comment.id}")


            mention_count = len(mentions_data)
            average_score = total_score_sum / valid_scores_count if valid_scores_count > 0 else 0
            average_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            
            # Sort mentions by creation time, newest first
            mentions_data.sort(key=lambda x: x['created_utc'], reverse=True)

            # Consider if this limit should be configurable too
            API_MENTIONS_LIMIT = 50 

            return Response({
                "search_term": search_term,
                "mention_count": mention_count, 
                "average_score": round(average_score, 2),
                "top_subreddits": subreddit_counts.most_common(5),
                "average_sentiment": round(average_sentiment, 2),
                "mentions": mentions_data[:API_MENTIONS_LIMIT] 
            }, status=status.HTTP_200_OK)

        except praw.exceptions.PRAWException as e:
            print(f"PRAW Error: {e}")
            return Response({"error": f"Reddit API error: {str(e)}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except nltk.downloader.DownloadError as e: 
            print(f"NLTK Download Error: {e}")
            return Response({"error": f"NLTK resource error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            import traceback
            print(f"General Error: {e}")
            traceback.print_exc()
            return Response({"error": f"An unexpected server error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)