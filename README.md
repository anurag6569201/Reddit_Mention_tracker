# Reddit Mention Tracker & Analyzer

Uncover Reddit's pulse instantly. This application allows you to track mentions of any term on Reddit, analyze sentiment, view aggregated metrics, and leverage Google's Gemini AI for summaries, key themes, and contextual Q&A.

**Live Demo:** [https://reddit-mention-tracker.vercel.app/]
**Video Walkthrough:** [https://youtu.be/JuObTRygk4w]

## Features

* **Reddit Search:** Fetches recent (last 7 days) public submissions and comments mentioning your search term.
* **Comprehensive Metrics:**
  * Total mention count
  * Average Reddit score
  * Top subreddits & authors
  * Sentiment analysis (VADER): average score, overall label (positive/negative/neutral/mixed), distribution
  * Submission vs. comment breakdown
* **AI-Powered Insights :**
  * Executive Summary of mentions
  * Key Discussion Themes
  * Contextual Q&A based on retrieved mentions
* **Detailed Mentions List:** Browse individual mentions with links, scores, sentiment, and author details (paginated).
* **Search Term Highlighting:** Your search term is highlighted in titles and content.

## Architecture Overview

The application follows a client-server architecture:

* **Frontend (Client):**

  * **Framework:** React with TypeScript
  * **Key Libraries:** Axios (API calls), React Router (navigation), `date-fns` (date formatting), `react-markdown` (rendering AI output), `framer-motion` (animations).
  * **Responsibilities:** User interface, handling user input, making API requests to the backend, displaying results, caching simplified mention data in `localStorage` for Q&A context.
  * **Location:** `frontend/tracker` directory.
* **Backend (Server):**

  * **Framework:** Django (Python)
  * **Key Libraries:** Django REST framework (APIs), PRAW (Reddit API interaction), NLTK (VADER for sentiment analysis), `python-dotenv` (environment variables), `google-generativeai` (Gemini API).
  * **Responsibilities:** Exposing REST APIs, fetching data from Reddit, performing sentiment analysis, interacting with Google Gemini (if configured), aggregating metrics.
  * **Location:** `backend/tracker` directory.
* **External Services:**

  * **Reddit API:** For fetching mentions.
  * **Google Gemini API :** For AI-powered summaries, themes, and Q&A.

**Data Flow:**

1. User searches on React frontend.
2. React calls Django API (`/api/reddit-mentions/`).
3. Django uses PRAW (Reddit) & NLTK (sentiment) and also calls Gemini for summary/themes.
4. Django returns JSON data to React.
5. React displays data & caches simplified mentions.
6. For Q&A: React sends question & cached mentions to Django API (`/api/reddit-qna/`).
7. Django calls Gemini for an answer, returns it to React.

## Setup & Installation

### Prerequisites

* Python 3.12+ and Pip
* Node.js (v16+) and npm (or yarn)
* Git
* A Reddit API Application:
  * Go to [Reddit Apps](https://www.reddit.com/prefs/apps)
  * Click "are you a developer? create an app..."
  * Fill in the details (name, choose "script" type, redirect uri e.g., `http://localhost:8000`).
  * Note your **Client ID** (under personal use script) and **Client Secret**.
* A Google Gemini API Key :
  * Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
  * Create an API key.

### Backend Setup (Django)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/anurag6569201/Reddit_Mention_tracker.git
   cd backend/
   ```
2. **Create and activate a virtual environment:**

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. **Install Python dependencies:**

   ```bash
   cd backend/tracker/
   pip install -r requirements.txt
   ```
4. **Set up environment variables:**
   Create a `.env` file in your backend project root (e.g., `backend/.env`) with the following:

   ```env
   REDDIT_CLIENT_ID=rOVN-sdfsfsd...
   REDDIT_CLIENT_SECRET=sdkfbsd...
   REDDIT_USER_AGENT='sdf...' 

   ENABLE_GEMINI_ANALYSIS=true  
   GEMINI_API_KEY=sdfsdUs
   GEMINI_MODEL_NAME=gemini-2.0-flash 
   GEMINI_MAX_INPUT_MENTIONS=25 

   # Other Backend settings (if any)
   REDDIT_SEARCH_LIMIT=30
   REDDIT_COMMENT_REPLACE_LIMIT=30
   REDDIT_TOP_AUTHORS_LIMIT=5
   API_MENTIONS_LIMIT=50 
   ```
5. **Download NLTK VADER Lexicon (if not already present globally):**
   Run the Django development server once. If VADER lexicon is missing, the console output from `views.py` will guide you, or you can run a Python Script:

   ```bash
   python download_nltk_data.py
   ```
6. **Apply Django migrations:**

   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```
7. **Run the Django development server:**

   ```bash
   python manage.py runserver
   ```

   The backend API will typically be available at `http://127.0.0.1:8000/api/`.

### Frontend Setup (React)

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend/tracker
   ```
2. **Install Node.js dependencies:**

   ```bash
   npm install
   ```
3. **Configure API Base URL:**
   The frontend `.env` file has `API_BASE_URL` set to `http://127.0.0.1:8000/api`. Adjust this if your backend runs on a different port or domain.
4. **Start the React development server:**

   ```bash
   npm start
   ```

   The frontend application will typically be available at `http://localhost:5173`.

## Usage

1. Ensure both backend and frontend development servers are running.
2. Open your browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
3. You will see the **Landing Page**.
4. Enter a search term (e.g., "Tesla", "AI ethics", "your brand") into the search bar and click "Search" or press Enter.
5. The application will fetch and analyze mentions, displaying:
   * **AI-generated Summary & Themes** .
   * **Core Metrics** (total mentions, average score, etc.).
   * **Sentiment Analysis** details.
   * **Community Hotspots** (top subreddits and authors).
   * A **paginated list of individual mentions**.
6. **Q&A :**
   * Scroll down to the "Ask About These Mentions" section.
   * Type a question related to the mentions retrieved for your current search term (e.g., "What are common complaints?").
   * Click "Ask AI". The AI will attempt to answer based *only* on the context of the displayed mentions.
   * The Q&A history will be logged below the input form.
7. Use the search bar in the header to perform new searches or clear the current search.

## Environment Variables

Key environment variables are managed in the `backend/.env` file:

* `REDDIT_CLIENT_ID`: Your Reddit application's client ID.
* `REDDIT_CLIENT_SECRET`: Your Reddit application's client secret.
* `REDDIT_USER_AGENT`: A descriptive user agent for Reddit API requests.
* `ENABLE_GEMINI_ANALYSIS`: `true` or `false` to enable/disable all Gemini AI features.
* `GEMINI_API_KEY`: Your Google Gemini API key .
* `GEMINI_SUMMARY_MODEL_NAME`: Specific Gemini model for summary/themes (default: `gemini-1.5-flash-latest`).
* `GEMINI_QNA_MODEL_NAME`: Specific Gemini model for Q&A (default: `gemini-1.5-flash-latest`).
* `REDDIT_SEARCH_LIMIT`: Max submissions to fetch from Reddit (default: `25`).
* `GEMINI_MAX_INPUT_MENTIONS_FOR_SUMMARY`: Max mentions to feed Gemini for summary (default: `25`).
* `API_MENTIONS_LIMIT`: Max mentions to return in the API response list (default: `50`).

## Contributing

Contributions are welcome! Please feel free to fork the repository, make changes, and submit a pull request.
For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the [MIT License](LICENSE.txt). (Create a LICENSE.txt file with the MIT license text if you choose this).

## Acknowledgements

* [PRAW (Python Reddit API Wrapper)](https://praw.readthedocs.io/)
* [NLTK (Natural Language Toolkit)](https://www.nltk.org/)
* [Google Gemini](https://ai.google.dev/models/gemini)
* [React](https://reactjs.org/)
* [Django](https://www.djangoproject.com/)
