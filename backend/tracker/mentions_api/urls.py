from django.urls import path
from .views import RedditMentionsView, RedditQnAView 

urlpatterns = [
    path('reddit-mentions/', RedditMentionsView.as_view(), name='reddit-mentions'),
    path('reddit-qna/', RedditQnAView.as_view(), name='reddit-qna'), 
]