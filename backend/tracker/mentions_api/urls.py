from django.urls import path
from .views import RedditMentionsView

urlpatterns = [
    path('reddit-mentions/', RedditMentionsView.as_view(), name='reddit-mentions'),
]