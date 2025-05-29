import os
import praw
import datetime
from collections import Counter
from dotenv import load_dotenv
import traceback # For detailed error logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from nltk.sentiment.vader import SentimentIntensityAnalyzer
import nltk

# --- Gemini Integration ---
import google.generativeai as genai


load_dotenv()

# --- Gemini Configuration ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ENABLE_GEMINI_ANALYSIS = os.getenv('ENABLE_GEMINI_ANALYSIS', 'false').lower() == 'true'
GEMINI_MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'gemini-1.5-flash-latest') 
GEMINI_MAX_INPUT_MENTIONS = int(os.getenv('GEMINI_MAX_INPUT_MENTIONS', 30)) 

if ENABLE_GEMINI_ANALYSIS and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        print(f"Gemini analysis enabled with model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        print(f"Error configuring Gemini: {e}. Disabling Gemini analysis.")
        ENABLE_GEMINI_ANALYSIS = False
        gemini_model = None
else:
    print("Gemini analysis disabled (API key missing or feature flag off).")
    gemini_model = None



# Sentiment Thresholds
POSITIVE_THRESHOLD = 0.05
NEGATIVE_THRESHOLD = -0.05

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

def get_sentiment_label(score):
    if score > POSITIVE_THRESHOLD:
        return 'positive'
    elif score < NEGATIVE_THRESHOLD:
        return 'negative'
    else:
        return 'neutral'

# --- Gemini Helper Function ---
def get_gemini_analysis(text_corpus, search_term):
    if not ENABLE_GEMINI_ANALYSIS or not gemini_model:
        return {"summary": None, "key_themes": None}

    results = {"summary": None, "key_themes": None}
    generation_config = genai.types.GenerationConfig(
        max_output_tokens=1024,
        temperature=0.3,
    )
    safety_settings=[ 
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]


    # 1. Generate Overall Summary
    summary_prompt = f"""
    Analyze the following Reddit mentions related to "{search_term}".
    Provide a concise overall summary (2-4 sentences) of the general sentiment,
    key topics discussed, and any notable observations.
    Focus on an objective overview based *only* on the provided text.

    Mentions:
    {text_corpus}

    Overall Summary:
    """
    try:
        print(f"Sending summary request to Gemini for '{search_term}'...")
        summary_response = gemini_model.generate_content(
            summary_prompt,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        if summary_response.candidates and summary_response.candidates[0].content.parts:
            results["summary"] = summary_response.candidates[0].content.parts[0].text.strip()
            print(f"Gemini Summary for '{search_term}': {results['summary'][:100]}...")
        else:
            print(f"Gemini summary response was empty or malformed for '{search_term}'. Reason: {summary_response.prompt_feedback}")
    except Exception as e:
        print(f"Error calling Gemini for summary: {e}")
        traceback.print_exc()
        results["summary"] = "Error generating summary."

    # 2. Extract Key Themes
    themes_prompt = f"""
    Analyze the following Reddit mentions regarding "{search_term}".
    Identify and list the top 3-5 recurring themes or topics of discussion.
    For each theme, provide a brief one-sentence explanation.
    Present the themes as a numbered list. Example:
    1. Theme Name: Brief explanation.
    2. Another Theme: Explanation.

    Mentions:
    {text_corpus}

    Key Themes:
    """
    try:
        print(f"Sending key themes request to Gemini for '{search_term}'...")
        themes_response = gemini_model.generate_content(
            themes_prompt,
            generation_config=generation_config,
            safety_settings=safety_settings
            )
        if themes_response.candidates and themes_response.candidates[0].content.parts:
            raw_themes_text = themes_response.candidates[0].content.parts[0].text.strip()
            themes_list = [theme.strip() for theme in raw_themes_text.split('\n') if theme.strip()]
            results["key_themes"] = themes_list
            print(f"Gemini Key Themes for '{search_term}': {results['key_themes']}")
        else:
            print(f"Gemini themes response was empty or malformed for '{search_term}'. Reason: {themes_response.prompt_feedback}")

    except Exception as e:
        print(f"Error calling Gemini for key themes: {e}")
        traceback.print_exc()
        results["key_themes"] = ["Error generating key themes."]

    return results

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
                {"error": "Sentiment analyzer (VADER) is not available. Please check server logs."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            reddit = praw.Reddit(
                client_id=os.getenv('REDDIT_CLIENT_ID'),
                client_secret=os.getenv('REDDIT_CLIENT_SECRET'),
                user_agent=os.getenv('REDDIT_USER_AGENT', 'django:myredditapp:v1.0 (by /u/yourusername)'),
            )
            reddit.read_only = True

            all_mentions_data = []
            total_score_sum = 0
            valid_scores_count = 0
            subreddit_counts = Counter()
            all_sentiment_scores_list = []
            sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
            author_counts = Counter()
            mention_type_counts = {"submission": 0, "comment": 0}

            search_limit = int(os.getenv('REDDIT_SEARCH_LIMIT', 30))
            comment_replace_limit = int(os.getenv('REDDIT_COMMENT_REPLACE_LIMIT', 10))
            top_authors_limit = int(os.getenv('REDDIT_TOP_AUTHORS_LIMIT', 5))
            
            print(f"Searching Reddit for: \"{search_term}\" with submission limit: {search_limit}")

            submissions = reddit.subreddit("all").search(
                query=search_term,
                sort="new",
                time_filter="week",
                limit=search_limit
            )

            seven_days_ago_ts = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).timestamp()
            processed_ids = set()
            
            # --- Prepare text corpus for Gemini ---
            gemini_input_texts = []

            for submission in submissions:
                if submission.id in processed_ids or submission.created_utc < seven_days_ago_ts:
                    continue

                submission_matched = False
                submission_full_text_for_sentiment = submission.title
                
                if search_term.lower() in submission.title.lower():
                    submission_matched = True
                
                if submission.selftext and search_term.lower() in submission.selftext.lower():
                    submission_matched = True
                    submission_full_text_for_sentiment += " " + submission.selftext

                if submission_matched:
                    vs = analyzer.polarity_scores(submission_full_text_for_sentiment)
                    compound_sentiment = vs['compound']
                    sentiment_label = get_sentiment_label(compound_sentiment)

                    mention_item = {
                        'id': submission.id,
                        'type': 'submission',
                        'title': submission.title,
                        'text_content': submission.selftext if submission.selftext else None,
                        'url': f"https://reddit.com{submission.permalink}",
                        'subreddit': submission.subreddit.display_name,
                        'score': submission.score,
                        'created_utc': submission.created_utc,
                        'author': submission.author.name if submission.author else None,
                        'sentiment_score': round(compound_sentiment, 3),
                        'sentiment_label': sentiment_label
                    }
                    all_mentions_data.append(mention_item)
                    
                    if len(gemini_input_texts) < GEMINI_MAX_INPUT_MENTIONS:
                        gemini_input_texts.append(f"Submission Title: {submission.title}\nBody: {submission.selftext or 'N/A'}\n")

                    total_score_sum += submission.score
                    valid_scores_count += 1
                    subreddit_counts[submission.subreddit.display_name] += 1
                    all_sentiment_scores_list.append(compound_sentiment)
                    sentiment_distribution[sentiment_label] += 1
                    mention_type_counts["submission"] += 1
                    
                    if submission.author and submission.author.name and submission.author.name != "[deleted]":
                        author_counts[submission.author.name] += 1
                    
                    processed_ids.add(submission.id)

                submission.comments.replace_more(limit=comment_replace_limit)
                for comment in submission.comments.list():
                    comment_id_key = f"c_{comment.id}"
                    if comment_id_key in processed_ids or comment.created_utc < seven_days_ago_ts:
                        continue

                    if search_term.lower() in comment.body.lower():
                        vs = analyzer.polarity_scores(comment.body)
                        compound_sentiment = vs['compound']
                        sentiment_label = get_sentiment_label(compound_sentiment)

                        mention_item = {
                            'id': comment_id_key,
                            'type': 'comment',
                            'title': f"Comment in: {submission.title[:100]}{'...' if len(submission.title)>100 else ''}",
                            'text_content': comment.body,
                            'url': f"https://reddit.com{comment.permalink}",
                            'subreddit': comment.subreddit.display_name,
                            'score': comment.score,
                            'created_utc': comment.created_utc,
                            'author': comment.author.name if comment.author else None,
                            'sentiment_score': round(compound_sentiment, 3),
                            'sentiment_label': sentiment_label
                        }
                        all_mentions_data.append(mention_item)

                        if len(gemini_input_texts) < GEMINI_MAX_INPUT_MENTIONS:
                             gemini_input_texts.append(f"Comment on '{submission.title[:50]}...': {comment.body[:300]}\n")


                        total_score_sum += comment.score
                        valid_scores_count +=1
                        subreddit_counts[submission.subreddit.display_name] += 1
                        all_sentiment_scores_list.append(compound_sentiment)
                        sentiment_distribution[sentiment_label] += 1
                        mention_type_counts["comment"] += 1

                        if comment.author and comment.author.name and comment.author.name != "[deleted]":
                            author_counts[comment.author.name] += 1
                        
                        processed_ids.add(comment_id_key)
            
            mention_count = len(all_mentions_data)
            average_score = total_score_sum / valid_scores_count if valid_scores_count > 0 else 0
            average_sentiment = sum(all_sentiment_scores_list) / len(all_sentiment_scores_list) if all_sentiment_scores_list else 0
            
            overall_sentiment_label = get_sentiment_label(average_sentiment)
            if overall_sentiment_label == 'neutral' and \
               sentiment_distribution['positive'] > 0 and \
               sentiment_distribution['negative'] > 0 and \
               abs(sentiment_distribution['positive'] - sentiment_distribution['negative']) < (mention_count * 0.1):
                overall_sentiment_label = 'mixed'

            all_mentions_data.sort(key=lambda x: x['created_utc'], reverse=True)
            
            API_MENTIONS_LIST_LIMIT = int(os.getenv('API_MENTIONS_LIMIT', 50))
            limited_mentions_list = all_mentions_data[:API_MENTIONS_LIST_LIMIT]

            # --- Call Gemini ---
            llm_analysis_results = {"summary": None, "key_themes": None}
            if ENABLE_GEMINI_ANALYSIS and gemini_model and gemini_input_texts:
                corpus_for_gemini = "\n---\n".join(gemini_input_texts)
                MAX_CORPUS_CHARS = 20000
                if len(corpus_for_gemini) > MAX_CORPUS_CHARS:
                    print(f"Warning: Corpus for Gemini is long ({len(corpus_for_gemini)} chars), truncating to {MAX_CORPUS_CHARS}.")
                    corpus_for_gemini = corpus_for_gemini[:MAX_CORPUS_CHARS]
                
                llm_analysis_results = get_gemini_analysis(corpus_for_gemini, search_term)
            elif ENABLE_GEMINI_ANALYSIS and not gemini_input_texts:
                print(f"No relevant mentions found to send to Gemini for '{search_term}'.")

            return Response({
                "search_term": search_term,
                "mention_count": mention_count,
                "average_score": round(average_score, 2),
                "top_subreddits": subreddit_counts.most_common(5),
                "average_sentiment": round(average_sentiment, 3),
                "overall_sentiment_label": overall_sentiment_label,
                "sentiment_distribution": sentiment_distribution,
                "top_authors": author_counts.most_common(top_authors_limit),
                "mention_type_counts": mention_type_counts,
                "mentions": limited_mentions_list,
                "llm_summary": llm_analysis_results.get("summary"),
                "llm_key_themes": llm_analysis_results.get("key_themes")
            }, status=status.HTTP_200_OK)

        except praw.exceptions.PRAWException as e:
            print(f"PRAW Error: {e}")
            traceback.print_exc()
            return Response({"error": f"Reddit API error: {str(e)}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except nltk.downloader.DownloadError as e:
            print(f"NLTK Download Error: {e}")
            traceback.print_exc()
            return Response({"error": f"NLTK resource error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except genai.types.BlockedPromptException as e: 
            print(f"Gemini Error: Prompt blocked. {e}")
            traceback.print_exc()
            # Return other data but indicate LLM part failed
            return Response({
                "search_term": search_term, "mention_count": mention_count, 
                "mentions": limited_mentions_list,
                "llm_summary": "Content generation blocked by safety filters.",
                "llm_key_themes": ["Content generation for themes blocked by safety filters."]
            }, status=status.HTTP_200_OK) 
        except Exception as e:
            print(f"General Error in RedditMentionsView: {e}")
            traceback.print_exc()
            return Response({"error": f"An unexpected server error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)