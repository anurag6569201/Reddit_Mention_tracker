# download_nltk_data.py
import nltk
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except nltk.downloader:
    nltk.download('vader_lexicon')
print("VADER lexicon checked/downloaded.")