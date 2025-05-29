import os
import praw 
import datetime 
from collections import Counter 
import traceback
import json 

from dotenv import load_dotenv 
from rest_framework.views import APIView 
from rest_framework.response import Response 
from rest_framework import status

from nltk.sentiment.vader import SentimentIntensityAnalyzer 
import nltk 

import google.generativeai as genai

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

# --- Google Gemini Configuration ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ENABLE_GEMINI_ANALYSIS = os.getenv('ENABLE_GEMINI_ANALYSIS', 'false').lower() == 'true'

# Model names can be configured via environment variables for flexibility
GEMINI_SUMMARY_MODEL_NAME = os.getenv('GEMINI_SUMMARY_MODEL_NAME', 'gemini-1.5-flash-latest')
GEMINI_QNA_MODEL_NAME = os.getenv('GEMINI_QNA_MODEL_NAME', 'gemini-1.5-flash-latest')

gemini_summary_model = None
gemini_qna_model = None

if ENABLE_GEMINI_ANALYSIS and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        # Initialize summary model if its name is provided
        if GEMINI_SUMMARY_MODEL_NAME:
            gemini_summary_model = genai.GenerativeModel(GEMINI_SUMMARY_MODEL_NAME)
            print(f"Gemini Summary/Themes analysis enabled with model: {GEMINI_SUMMARY_MODEL_NAME}")
        else:
            print("Gemini Summary/Themes model name not set. This feature will be disabled.")

        # Initialize Q&A model if its name is provided
        if GEMINI_QNA_MODEL_NAME:
            gemini_qna_model = genai.GenerativeModel(GEMINI_QNA_MODEL_NAME)
            print(f"Gemini Q&A analysis enabled with model: {GEMINI_QNA_MODEL_NAME}")
        else:
            print("Gemini Q&A model name not set. This feature will be disabled.")

    except Exception as e:
        print(f"Error configuring Gemini: {e}. Disabling all Gemini analysis.")
        ENABLE_GEMINI_ANALYSIS = False
        gemini_summary_model = None
        gemini_qna_model = None
elif not GEMINI_API_KEY:
    print("Gemini API key not found. Gemini analysis disabled.")
    ENABLE_GEMINI_ANALYSIS = False
else: 
    print("Gemini analysis explicitly disabled by environment variable.")


# --- Constants & Helper Functions ---
POSITIVE_THRESHOLD = 0.05 
NEGATIVE_THRESHOLD = -0.05 

# Max number of mentions to feed into Gemini for generating summary/themes
GEMINI_MAX_INPUT_MENTIONS_FOR_SUMMARY = int(os.getenv('GEMINI_MAX_INPUT_MENTIONS_FOR_SUMMARY', 25)) # Reduced for performance
# Max number of mentions to return in the API response list
API_MENTIONS_LIST_LIMIT = int(os.getenv('API_MENTIONS_LIMIT', 50))

def get_sentiment_label(score: float) -> str:
    """Categorizes a sentiment score into 'positive', 'negative', or 'neutral'."""
    if score > POSITIVE_THRESHOLD:
        return 'positive'
    if score < NEGATIVE_THRESHOLD:
        return 'negative'
    return 'neutral'

def generate_with_gemini(model: genai.GenerativeModel, prompt_text: str, model_name_for_log: str = "Gemini") -> dict:
    """
    Helper function to generate content with a given Gemini model and handle common responses/errors.
    Returns a dictionary: {"text": "...", "error": "..."}
    """
    if not model:
        return {"text": None, "error": f"{model_name_for_log} model is not available or not configured."}

    # Standard generation configuration for Gemini
    generation_config = genai.types.GenerationConfig(
        max_output_tokens=1024,
        temperature=0.3,      
    )
    # Standard safety settings to block harmful content
    safety_settings = [
        {"category": category, "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
        for category in [
            "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"
        ]
    ]

    try:
        print(f"Sending request to {model_name_for_log} (model: {model.model_name})...")
        # Log a truncated version of the prompt for debugging without exposing too much data
        print(f"Prompt (first 500 chars): {prompt_text[:500]}...")

        response = model.generate_content(
            prompt_text,
            generation_config=generation_config,
            safety_settings=safety_settings
        )

        # Process the response
        if response.candidates and response.candidates[0].content.parts:
            generated_text = response.candidates[0].content.parts[0].text.strip()
            print(f"{model_name_for_log} response (first 100 chars): {generated_text[:100]}...")
            return {"text": generated_text, "error": None}
        elif response.prompt_feedback and response.prompt_feedback.block_reason:
            reason = response.prompt_feedback.block_reason
            block_message = f"Content generation blocked by safety filter: {reason}."
            print(f"{model_name_for_log} Error: {block_message}")
            return {"text": None, "error": block_message}
        else:
            # This case might indicate an issue with the response structure not caught above
            print(f"{model_name_for_log} Error: No valid response candidates or parts found. Full feedback: {response.prompt_feedback}")
            return {"text": None, "error": "No valid response from LLM."}

    except Exception as e:
        error_message = f"Error during content generation with {model_name_for_log}: {str(e)}"
        print(error_message)
        traceback.print_exc() 
        return {"text": None, "error": error_message}


class RedditMentionsView(APIView):
    """
    API View to fetch Reddit mentions, calculate metrics, and generate LLM summaries/themes.
    """
    def get(self, request):
        search_term = request.query_params.get('term', None)
        if not search_term or not search_term.strip():
            return Response({"error": "Search term ('term') is required and cannot be empty."},
                            status=status.HTTP_400_BAD_REQUEST)

        if not analyzer: 
            return Response({"error": "Sentiment analyzer (VADER) is not available. Please check server logs."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            # Initialize PRAW (Python Reddit API Wrapper)
            reddit = praw.Reddit(
                client_id=os.getenv('REDDIT_CLIENT_ID'),
                client_secret=os.getenv('REDDIT_CLIENT_SECRET'),
                user_agent=os.getenv('REDDIT_USER_AGENT', 'django:redditmentiontracker:v1.1 (by u/your_reddit_username)'),
            )
            reddit.read_only = True 

            # --- Data Collection & Processing ---
            all_mentions_data = [] 
            total_score_sum = 0
            valid_scores_count = 0 
            subreddit_counts = Counter()
            all_sentiment_scores_list = [] 
            sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
            author_counts = Counter()
            mention_type_counts = {"submission": 0, "comment": 0}
            gemini_summary_input_texts = []

            # Configurable limits from environment variables
            search_limit = int(os.getenv('REDDIT_SEARCH_LIMIT', 25)) 
            comment_replace_limit = int(os.getenv('REDDIT_COMMENT_REPLACE_LIMIT', 5)) 
            top_authors_limit = int(os.getenv('REDDIT_TOP_AUTHORS_LIMIT', 5))

            print(f"Searching Reddit for: \"{search_term}\" with submission limit: {search_limit}")
            
            # Timestamp for filtering mentions from the last 7 days
            seven_days_ago_ts = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).timestamp()
            processed_ids = set() 

            # Search for submissions across all of Reddit
            submissions = reddit.subreddit("all").search(
                query=search_term,
                sort="new",       
                time_filter="week",
                limit=search_limit 
            )

            for submission in submissions:
                # Basic de-duplication and time filtering
                if submission.id in processed_ids or submission.created_utc < seven_days_ago_ts:
                    continue
                
                submission_matched = False
                submission_full_text_for_sentiment = submission.title 
                
                # Check if search term is in submission title
                if search_term.lower() in submission.title.lower():
                    submission_matched = True
                
                # Check if search term is in submission selftext (body of text posts)
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
                    
                    # Add text to corpus for Gemini summary, if limit not reached
                    if len(gemini_summary_input_texts) < GEMINI_MAX_INPUT_MENTIONS_FOR_SUMMARY:
                        gemini_summary_input_texts.append(f"Type: Submission\nTitle: {submission.title}\nBody: {submission.selftext or 'N/A'}\n")

                    # Update aggregate metrics
                    total_score_sum += submission.score
                    valid_scores_count += 1
                    subreddit_counts[submission.subreddit.display_name] += 1
                    all_sentiment_scores_list.append(compound_sentiment)
                    sentiment_distribution[sentiment_label] += 1
                    mention_type_counts["submission"] += 1
                    if submission.author and submission.author.name and submission.author.name != "[deleted]":
                        author_counts[submission.author.name] += 1
                    
                    processed_ids.add(submission.id)

                # Process comments for this submission
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

                        if len(gemini_summary_input_texts) < GEMINI_MAX_INPUT_MENTIONS_FOR_SUMMARY:
                             gemini_summary_input_texts.append(f"Type: Comment on '{submission.title[:50]}...'\nContent: {comment.body[:300]}\n")

                        total_score_sum += comment.score
                        valid_scores_count +=1
                        subreddit_counts[submission.subreddit.display_name] += 1
                        all_sentiment_scores_list.append(compound_sentiment)
                        sentiment_distribution[sentiment_label] += 1
                        mention_type_counts["comment"] += 1
                        if comment.author and comment.author.name and comment.author.name != "[deleted]":
                            author_counts[comment.author.name] += 1
                        
                        processed_ids.add(comment_id_key)
            
            # --- Calculate Final Aggregations ---
            mention_count = len(all_mentions_data)
            average_score = total_score_sum / valid_scores_count if valid_scores_count > 0 else 0.0
            average_sentiment = sum(all_sentiment_scores_list) / len(all_sentiment_scores_list) if all_sentiment_scores_list else 0.0
            
            overall_sentiment_label = get_sentiment_label(average_sentiment)
            if overall_sentiment_label == 'neutral' and \
               mention_count > 0 and sentiment_distribution['positive'] > 0 and sentiment_distribution['negative'] > 0 and \
               abs(sentiment_distribution['positive'] - sentiment_distribution['negative']) < (mention_count * 0.15):
                overall_sentiment_label = 'mixed'

            # Sort all found mentions by creation time (newest first)
            all_mentions_data.sort(key=lambda x: x['created_utc'], reverse=True)
            limited_mentions_list = all_mentions_data[:API_MENTIONS_LIST_LIMIT]

            # --- Gemini LLM Analysis for Summary & Key Themes ---
            llm_summary_text = None
            llm_key_themes_list = None
            llm_analysis_error = None 

            if ENABLE_GEMINI_ANALYSIS and gemini_summary_model and gemini_summary_input_texts:
                corpus_for_gemini = "\n---\n".join(gemini_summary_input_texts)
                MAX_CORPUS_CHARS_FOR_SUMMARY = 25000 
                if len(corpus_for_gemini) > MAX_CORPUS_CHARS_FOR_SUMMARY:
                    print(f"Warning: Corpus for Gemini summary is long ({len(corpus_for_gemini)} chars), truncating.")
                    corpus_for_gemini = corpus_for_gemini[:MAX_CORPUS_CHARS_FOR_SUMMARY]
                
                # Prompt for overall summary
                summary_prompt = f"""
                Analyze the following Reddit mentions related to the search term "{search_term}".
                Provide a concise overall summary (2-4 sentences) covering the general sentiment,
                key topics discussed, and any notable observations.
                Focus on an objective overview based *only* on the provided text.

                Mentions Corpus:
                {corpus_for_gemini}

                Overall Summary:
                """
                summary_result = generate_with_gemini(gemini_summary_model, summary_prompt, "Gemini Summary")
                llm_summary_text = summary_result["text"]
                if summary_result["error"]:
                    llm_analysis_error = summary_result["error"] 
                
                # Prompt for key themes
                themes_prompt = f"""
                Based on the provided Reddit mentions regarding "{search_term}",
                identify and list the top 3-5 recurring themes or topics of discussion.
                For each theme, provide a very brief one-sentence explanation.
                Present the themes as a numbered list (e.g., "1. Theme Name: Brief explanation.").

                Mentions Corpus:
                {corpus_for_gemini}

                Key Themes:
                """
                themes_result = generate_with_gemini(gemini_summary_model, themes_prompt, "Gemini Themes")
                if themes_result["text"]:
                    # Simple parsing for numbered list format
                    llm_key_themes_list = [theme.strip() for theme in themes_result["text"].split('\n') if theme.strip() and theme.strip()[0].isdigit()]
                if themes_result["error"] and not llm_analysis_error: 
                    llm_analysis_error = themes_result["error"]
            elif ENABLE_GEMINI_ANALYSIS and not gemini_summary_input_texts:
                print(f"No relevant mentions found to send to Gemini for summary/themes for '{search_term}'.")


            # --- Prepare Final API Response Data ---
            response_data = {
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
                "llm_summary": llm_summary_text,
                "llm_key_themes": llm_key_themes_list,
                "llm_error": llm_analysis_error 
            }
            return Response(response_data, status=status.HTTP_200_OK)

        except praw.exceptions.PRAWException as e:
            # Handle errors specific to PRAW (Reddit API issues)
            error_msg = f"Reddit API error: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return Response({"error": error_msg}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            # Catch-all for other unexpected server errors
            error_msg = f"An unexpected server error occurred during mentions fetch: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return Response({"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RedditQnAView(APIView):
    """
    API View to handle Question & Answering based on provided mentions context.
    """
    def post(self, request):
        # Check if Q&A feature is enabled and the Q&A model is configured
        if not (ENABLE_GEMINI_ANALYSIS and gemini_qna_model):
            return Response({"error": "Q&A feature is disabled or the Q&A LLM model is not configured."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            data = request.data 
            question = data.get('question')
            search_term = data.get('search_term')
            # context_mentions are simplified mentions cached by the frontend in localStorage
            context_mentions_raw = data.get('context_mentions')

            if not all([question, search_term, context_mentions_raw]):
                return Response({"error": "Missing required fields: 'question', 'search_term', and 'context_mentions'."},
                                status=status.HTTP_400_BAD_REQUEST)
            
            if not isinstance(context_mentions_raw, list):
                 return Response({"error": "'context_mentions' must be a list of mention objects."},
                                 status=status.HTTP_400_BAD_REQUEST)

            # Prepare the context text from the simplified mentions for the LLM prompt
            context_text_parts = []
            for i, m_data in enumerate(context_mentions_raw):
                if isinstance(m_data, dict): 
                    mention_str = f"Mention {i+1} (Type: {m_data.get('type', 'N/A')} - Score: {m_data.get('score', 'N/A')})\n"
                    mention_str += f"Title: {m_data.get('title', 'N/A')}\n"
                    if m_data.get('text'): 
                        mention_str += f"Content Snippet: {m_data['text'][:200]}...\n" 
                    context_text_parts.append(mention_str)
            
            context_text = "\n---\n".join(context_text_parts)
            if not context_text.strip():
                return Response({"error": "The provided 'context_mentions' are empty or could not be processed."},
                                status=status.HTTP_400_BAD_REQUEST)

            # Construct the prompt for Gemini Q&A
            prompt = f"""
            You are an AI assistant. Your task is to answer the "User's Question" based *solely* on the provided "Context Mentions" which are related to the search term "{search_term}".
            Do not use any external knowledge or make assumptions beyond what is in the context.
            If the information to answer the question is not present in the "Context Mentions", you MUST state that clearly (e.g., "I could not find information to answer that in the provided mentions." or "The provided mentions do not contain details about that.").
            Keep your answers concise. If you quote from the mentions, keep the quotes very short and directly relevant.

            Context Mentions:
            ---
            {context_text}
            ---

            User's Question: {question}

            Answer:
            """

            # Call the helper function to generate content with Gemini
            qna_result = generate_with_gemini(gemini_qna_model, prompt, "Gemini Q&A")

            if qna_result["error"]:
                return Response({"answer": None, "error": qna_result["error"]},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR) 
            
            return Response({"answer": qna_result["text"], "error": None}, status=status.HTTP_200_OK)

        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON payload in request body."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            error_msg = f"An unexpected server error occurred during Q&A: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return Response({"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)