# download_nltk_data.py
import nltk

try:
    nltk.data.find('sentiment/vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

print("VADER lexicon checked/downloaded.")