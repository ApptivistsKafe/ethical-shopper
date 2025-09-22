#!/usr/bin/env python3
"""
PRAW Testing Script

This script demonstrates basic PRAW functionality for testing the Reddit API.
It includes examples of:
- Connecting to Reddit
- Fetching subreddit information
- Reading posts from a subreddit
- Getting user information

Make sure to set up your .env file with the required credentials before running.
"""

import os
import praw
from dotenv import load_dotenv


def load_environment():
    """Load environment variables from .env file."""
    load_dotenv()
    
    required_vars = [
        'REDDIT_CLIENT_ID',
        'REDDIT_CLIENT_SECRET',
        'REDDIT_USER_AGENT'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return {
        'client_id': os.getenv('REDDIT_CLIENT_ID'),
        'client_secret': os.getenv('REDDIT_CLIENT_SECRET'),
        'user_agent': os.getenv('REDDIT_USER_AGENT'),
        'username': os.getenv('REDDIT_USERNAME'),
        'password': os.getenv('REDDIT_PASSWORD')
    }


def create_reddit_instance(config):
    """Create and return a PRAW Reddit instance."""
    if config['username'] and config['password']:
        # Script application with user authentication
        reddit = praw.Reddit(
            client_id=config['client_id'],
            client_secret=config['client_secret'],
            user_agent=config['user_agent'],
            username=config['username'],
            password=config['password']
        )
        print(f"✅ Authenticated as user: {reddit.user.me()}")
    else:
        # Read-only mode
        reddit = praw.Reddit(
            client_id=config['client_id'],
            client_secret=config['client_secret'],
            user_agent=config['user_agent']
        )
        print("✅ Connected in read-only mode")
    
    return reddit


def test_subreddit_access(reddit, subreddit_name="python"):
    """Test basic subreddit access and information retrieval."""
    print(f"\n🔍 Testing subreddit access: r/{subreddit_name}")
    
    try:
        subreddit = reddit.subreddit(subreddit_name)
        print(f"   Subreddit: {subreddit.display_name}")
        print(f"   Subscribers: {subreddit.subscribers:,}")
        print(f"   Description: {subreddit.public_description[:100]}...")
        return subreddit
    except Exception as e:
        print(f"   ❌ Error accessing subreddit: {e}")
        return None


def test_hot_posts(subreddit, limit=5):
    """Test fetching hot posts from a subreddit."""
    print(f"\n🔥 Fetching top {limit} hot posts from r/{subreddit.display_name}")
    
    try:
        for i, post in enumerate(subreddit.hot(limit=limit), 1):
            print(f"   {i}. {post.title[:60]}...")
            print(f"      Score: {post.score} | Comments: {post.num_comments}")
            print(f"      URL: {post.url}")
            print()
    except Exception as e:
        print(f"   ❌ Error fetching posts: {e}")


def test_user_info(reddit, username=None):
    """Test user information retrieval."""
    if not username:
        try:
            # Try to get current authenticated user
            user = reddit.user.me()
            if user:
                username = user.name
            else:
                print("\n👤 No authenticated user, skipping user info test")
                return
        except:
            print("\n👤 No authenticated user, skipping user info test")
            return
    
    print(f"\n👤 Testing user info for: u/{username}")
    
    try:
        user = reddit.redditor(username)
        print(f"   Username: {user.name}")
        print(f"   Comment Karma: {user.comment_karma:,}")
        print(f"   Link Karma: {user.link_karma:,}")
        print(f"   Account Created: {user.created_utc}")
    except Exception as e:
        print(f"   ❌ Error fetching user info: {e}")


def main():
    """Main function to run PRAW tests."""
    print("🚀 Starting PRAW Testing Script")
    print("=" * 50)
    
    try:
        # Load configuration
        config = load_environment()
        
        # Create Reddit instance
        reddit = create_reddit_instance(config)
        
        # Test subreddit access
        subreddit = test_subreddit_access(reddit, "python")
        
        if subreddit:
            # Test fetching posts
            test_hot_posts(subreddit, limit=3)
        
        # Test user information
        test_user_info(reddit)
        
        print("\n✅ PRAW testing completed successfully!")
        
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        print("\nMake sure to:")
        print("1. Copy .env.example to .env")
        print("2. Fill in your Reddit API credentials")
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")


if __name__ == "__main__":
    main()