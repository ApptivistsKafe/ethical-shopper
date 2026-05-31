#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PRAW Search Tool with Performance Timing

This CLI tool allows you to search Reddit and compare performance between:
1. Fetching all comments for top 5 submissions
2. Fetching only top-level comments for top 5 submissions

Usage:
    python search_tool.py
    
Then enter your search query when prompted.
"""

import os
import time
import argparse
import praw
import sys
import json
from dotenv import load_dotenv
from datetime import datetime


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
        raise ValueError("Missing required environment variables: {}".format(', '.join(missing_vars)))
    
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
        reddit = praw.Reddit(
            client_id=config['client_id'],
            client_secret=config['client_secret'],
            user_agent=config['user_agent'],
            username=config['username'],
            password=config['password']
        )
        print("✅ Authenticated as user: {}".format(reddit.user.me()))
    else:
        reddit = praw.Reddit(
            client_id=config['client_id'],
            client_secret=config['client_secret'],
            user_agent=config['user_agent']
        )
        print("✅ Connected in read-only mode")
    
    return reddit


def format_time(seconds):
    """Format time in a human-readable way."""
    if seconds < 1:
        return "{:.1f}ms".format(seconds * 1000)
    else:
        return "{:.2f}s".format(seconds)


def print_separator(title="", char="=", width=80):
    """Print a formatted separator line."""
    if title:
        title = " {} ".format(title)
        padding = (width - len(title)) // 2
        print(char * padding + title + char * (width - padding - len(title)))
    else:
        print(char * width)


def comment_to_json(comment, current_depth=0, max_depth=None, max_replies_per_level=None):
    """Recursively convert a PRAW comment object to a hierarchical JSON structure,
    with optional depth and reply limits."""
    if not hasattr(comment, 'body'):
        return None # Skip MoreComments and other non-comment objects

    comment_data = {
        'body': comment.body,
    }
    
    if max_depth is not None and current_depth >= max_depth:
        return comment_data # Stop recursion at max_depth

    if comment.replies and len(comment.replies) > 0:
        children = []
        replies_to_process = list(comment.replies)
        if max_replies_per_level is not None:
            replies_to_process = replies_to_process[:max_replies_per_level]

        for reply in replies_to_process:
            # Only recurse if current_depth + 1 is within max_depth
            # For the efficient strategy, max_depth=1 means we only get top-level and their direct children.
            # No further recursion for replies of replies.
            if max_depth is None or (current_depth + 1) < max_depth:
                child_data = comment_to_json(reply, current_depth + 1, max_depth, max_replies_per_level)
            else:
                # If max_depth is reached, just get the body of the reply, no further children
                # Add a check for 'body' attribute here as well
                if hasattr(reply, 'body'):
                    child_data = {'body': reply.body}
                else:
                    child_data = None # Skip if it's a MoreComments object
            
            if child_data:
                children.append(child_data)
        if children: # Only add 'children' key if there are actual children
            comment_data['children'] = children
            
    return comment_data


def get_json_size_in_bytes(json_object):
    """Calculate the in-memory size of a JSON object in bytes."""
    # Convert to string representation to get a more accurate size for complex objects
    # This is an approximation as actual in-memory object size can be more complex
    return sys.getsizeof(json.dumps(json_object))


def search_and_fetch_all_comments(reddit, query, limit=5):
    """Search Reddit and fetch ALL comments (recursively) for each submission,
    then convert to hierarchical JSON and measure size/time."""
    print_separator("FETCHING ALL COMMENTS (RECURSIVE)", "=")
    print("🔍 Searching for: '{}' (top {} results)".format(query, limit))
    print()
    
    # Time the search operation
    search_start = time.time()
    submissions = list(reddit.subreddit("all").search(query, limit=limit))
    search_time = time.time() - search_start
    
    print("⏱️  Search completed in {}".format(format_time(search_time)))
    print("📊 Found {} submissions".format(len(submissions)))
    print()
    
    all_comments_data = []
    total_comments_count = 0
    total_fetch_and_process_time = 0
    
    for i, submission in enumerate(submissions, 1):
        print("📄 [{}] {}...".format(i, submission.title[:60]))
        print("    👤 u/{} | 🔺 {} | 💬 {}".format(submission.author, submission.score, submission.num_comments))
        print("    🏷️  r/{}".format(submission.subreddit))
        
        # Time the comment fetching and processing
        fetch_process_start = time.time()
        
        # Replace "MoreComments" objects to get all comments
        submission.comments.replace_more(limit=None)
        
        submission_comments_json = []
        submission_comment_count = 0
        for top_level_comment in submission.comments:
            comment_json = comment_to_json(top_level_comment, max_depth=None, max_replies_per_level=None) # No limits for "all comments"
            if comment_json:
                submission_comments_json.append(comment_json)
                # Recursively count comments
                def count_recursive_comments(comment_node):
                    count = 1
                    if 'children' in comment_node:
                        for child in comment_node['children']:
                            count += count_recursive_comments(child)
                    return count
                submission_comment_count += count_recursive_comments(comment_json)
        
        fetch_process_time = time.time() - fetch_process_start
        total_fetch_and_process_time += fetch_process_time
        total_comments_count += submission_comment_count
        all_comments_data.extend(submission_comments_json)
        
        print("    ⏱️  Fetched and processed {} comments in {}".format(submission_comment_count, format_time(fetch_process_time)))
        print()
    
    json_object_size = get_json_size_in_bytes(all_comments_data)
    
    print_separator()
    print("📊 SUMMARY - ALL COMMENTS (RECURSIVE):")
    print("   Total submissions: {}".format(len(submissions)))
    print("   Total comments fetched: {:,}".format(total_comments_count))
    print("   Total fetch & process time: {}".format(format_time(total_fetch_and_process_time)))
    print("   Average per submission: {}".format(format_time(total_fetch_and_process_time / len(submissions)) if submissions else 'N/A'))
    print("   In-memory JSON size: {:,} bytes".format(json_object_size))
    print_separator()
    print()
    
    return submissions, total_fetch_and_process_time, total_comments_count, json_object_size


def search_and_fetch_top_level_comments(reddit, query, limit=5, top_level_limit=5, reply_limit=3):
    """Search Reddit and fetch only TOP X TOP-LEVEL comments and their TOP Y replies
    for each submission, then convert to hierarchical JSON and measure size/time."""
    print_separator("FETCHING TOP {} TOP-LEVEL COMMENTS & TOP {} REPLIES".format(top_level_limit, reply_limit), "=")
    print("🔍 Searching for: '{}' (top {} results)".format(query, limit))
    print()
    
    # Time the search operation
    search_start = time.time()
    submissions = list(reddit.subreddit("all").search(query, limit=limit))
    search_time = time.time() - search_start
    
    print("⏱️  Search completed in {}".format(format_time(search_time)))
    print("📊 Found {} submissions".format(len(submissions)))
    print()
    
    top_level_comments_data = []
    total_comments_count = 0
    total_fetch_and_process_time = 0
    
    for i, submission in enumerate(submissions, 1):
        print("📄 [{}] {}...".format(i, submission.title[:60]))
        print("    👤 u/{} | 🔺 {} | 💬 {}".format(submission.author, submission.score, submission.num_comments))
        print("    🏷️  r/{}".format(submission.subreddit))
        
        # Time the comment fetching and processing
        fetch_process_start = time.time()
        
        submission_comments_json = []
        submission_comment_count = 0
        # Only get top_level_limit top-level comments
        for j, top_level_comment in enumerate(submission.comments):
            if j >= top_level_limit:
                break
            
            # Skip MoreComments objects
            if isinstance(top_level_comment, praw.models.MoreComments):
                continue

            # For top-level comments, we want to fetch their direct replies up to reply_limit, but no further recursion
            # max_depth=1 means the top-level comment itself (depth 0) and its direct children (depth 1)
            comment_json = comment_to_json(top_level_comment, current_depth=0, max_depth=1, max_replies_per_level=reply_limit)
            if comment_json:
                submission_comments_json.append(comment_json)
                # Recursively count comments (even though we only fetch top-level, the structure might have children)
                def count_recursive_comments(comment_node):
                    count = 1
                    if 'children' in comment_node:
                        for child in comment_node['children']:
                            count += count_recursive_comments(child)
                    return count
                submission_comment_count += count_recursive_comments(comment_json)
        
        fetch_process_time = time.time() - fetch_process_start
        total_fetch_and_process_time += fetch_process_time
        total_comments_count += submission_comment_count
        top_level_comments_data.extend(submission_comments_json)
        
        print("    ⏱️  Fetched and processed {} comments in {}".format(submission_comment_count, format_time(fetch_process_time)))
        print()
    
    json_object_size = get_json_size_in_bytes(top_level_comments_data)
    
    print_separator()
    print("📊 SUMMARY - TOP {} TOP-LEVEL COMMENTS & TOP {} REPLIES:".format(top_level_limit, reply_limit))
    print("   Total submissions: {}".format(len(submissions)))
    print("   Total comments fetched: {:,}".format(total_comments_count))
    print("   Total fetch & process time: {}".format(format_time(total_fetch_and_process_time)))
    print("   Average per submission: {}".format(format_time(total_fetch_and_process_time / len(submissions)) if submissions else 'N/A'))
    print("   In-memory JSON size: {:,} bytes".format(json_object_size))
    print_separator()
    print()
    
    return submissions, total_fetch_and_process_time, total_comments_count, json_object_size


def fetch_comments_by_submission_id(reddit, submission_id, top_level_limit=5, reply_limit=3):
    """Fetch comments for a specific Reddit submission ID,
    including only TOP X TOP-LEVEL comments and their TOP Y replies.
    Converts to hierarchical JSON and includes submission title/description."""
    
    try:
        submission = reddit.submission(id=submission_id)
    except Exception as e:
        print(f"❌ Error fetching submission {submission_id}: {e}", file=sys.stderr)
        return None

    submission_data = {
        'id': submission.id,
        'title': submission.title,
        'description': submission.selftext, # Use selftext for description
        'comments': []
    }

    submission_comment_count = 0
    
    # Only get top_level_limit top-level comments
    for j, top_level_comment in enumerate(submission.comments):
        if j >= top_level_limit:
            break
        
        # Skip MoreComments objects
        if isinstance(top_level_comment, praw.models.MoreComments):
            continue

        # For top-level comments, we want to fetch their direct replies up to reply_limit, but no further recursion
        # max_depth=1 means the top-level comment itself (depth 0) and its direct children (depth 1)
        comment_json = comment_to_json(top_level_comment, current_depth=0, max_depth=1, max_replies_per_level=reply_limit)
        if comment_json:
            submission_data['comments'].append(comment_json)
            # Recursively count comments (even though we only fetch top-level, the structure might have children)
            def count_recursive_comments(comment_node):
                count = 1
                if 'children' in comment_node:
                    for child in comment_node['children']:
                        count += count_recursive_comments(child)
                return count
            submission_comment_count += count_recursive_comments(comment_json)
    
    return submission_data


def compare_performance(all_full_time, all_comments_count, all_json_size,
                        top_level_full_time, top_level_comments_count, top_level_json_size):
    """Compare and display performance metrics."""
    print_separator("PERFORMANCE COMPARISON", "🚀")
    print()
    
    print("📈 TIMING COMPARISON (Fetch & Process):")
    print("   All comments (recursive):                   {}".format(format_time(all_full_time)))
    print("   Top 5 top-level comments & top 3 replies: {}".format(format_time(top_level_full_time)))
    
    if all_full_time > 0:
        speedup = all_full_time / top_level_full_time if top_level_full_time > 0 else float('inf')
        time_saved = all_full_time - top_level_full_time
        print("   Time saved:                                 {} ({:.1f}x faster)".format(format_time(time_saved), speedup))
    
    print()
    print("📊 COMMENT COUNT COMPARISON:")
    print("   All comments (recursive):                   {:,}".format(all_comments_count))
    print("   Top 5 top-level comments & top 3 replies: {:,}".format(top_level_comments_count))
    
    if all_comments_count > 0:
        reduction = ((all_comments_count - top_level_comments_count) / all_comments_count) * 100
        print("   Reduction:                                  {:,} comments ({:.1f}% fewer)".format(all_comments_count - top_level_comments_count, reduction))
    
    print()
    print("📦 IN-MEMORY JSON SIZE COMPARISON:")
    print("   All comments (recursive):                   {:,} bytes".format(all_json_size))
    print("   Top 5 top-level comments & top 3 replies: {:,} bytes".format(top_level_json_size))
    
    if all_json_size > 0:
        size_reduction = ((all_json_size - top_level_json_size) / all_json_size) * 100
        print("   Size Reduction:                             {:,} bytes ({:.1f}% smaller)".format(all_json_size - top_level_json_size, size_reduction))
    
    print()
    print_separator("", "🚀")


def interactive_search(reddit):
    """Interactive search mode."""
    print_separator("REDDIT SEARCH PERFORMANCE TOOL", "🔍")
    print("This tool compares fetching ALL comments (recursive) vs TOP 5 TOP-LEVEL comments & TOP 3 replies")
    print("Enter your search query below (or 'quit' to exit)")
    print_separator("", "🔍")
    print()
    
    while True:
        try:
            query = input("🔍 Enter search query: ").strip()
            
            if query.lower() in ['quit', 'exit', 'q']:
                print("👋 Goodbye!")
                break
                
            if not query:
                print("❌ Please enter a search query")
                continue
            
            print("\n🚀 Starting search for: '{}'".format(query))
            print("⏰ Started at: {}".format(datetime.now().strftime('%H:%M:%S')))
            print()
            
            # Test 1: All comments (recursive)
            _, all_full_time, all_comments_count, all_json_size = search_and_fetch_all_comments(reddit, query)
            
            # Test 2: Top 5 Top-level comments & top 3 replies
            _, top_level_full_time, top_level_comments_count, top_level_json_size = search_and_fetch_top_level_comments(reddit, query, top_level_limit=5, reply_limit=3)
            
            # Compare results
            compare_performance(all_full_time, all_comments_count, all_json_size,
                                top_level_full_time, top_level_comments_count, top_level_json_size)
            
            print("\n" + "="*80 + "\n")
            
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted by user. Goodbye!")
            break
        except Exception as e:
            print("❌ Error during search: {}".format(e))
            print("Please try again with a different query.\n")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Reddit Search Performance Tool")
    parser.add_argument("--query", "-q", help="Search query (if not provided, interactive mode)")
    parser.add_argument("--submission_id", "-s", help="Reddit submission ID to fetch comments for")
    parser.add_argument("--limit", "-l", type=int, default=5, help="Number of submissions to fetch (default: 5)")
    
    args = parser.parse_args()
    
    try:
        # Load configuration
        config = load_environment()
        
        # Create Reddit instance
        reddit = create_reddit_instance(config)
        print()
        
        if args.submission_id:
            # Fetch comments for a specific submission ID
            submission_data = fetch_comments_by_submission_id(reddit, args.submission_id)
            if submission_data:
                print(json.dumps(submission_data, indent=2))
            else:
                print(f"❌ Could not fetch data for submission ID: {args.submission_id}", file=sys.stderr)
        elif args.query:
            # Single query mode
            print("🚀 Running search for: '{}'".format(args.query))
            print()
            
            # Test both methods
            _, all_full_time, all_comments_count, all_json_size = search_and_fetch_all_comments(reddit, args.query, args.limit)
            _, top_level_full_time, top_level_comments_count, top_level_json_size = search_and_fetch_top_level_comments(reddit, args.query, args.limit, top_level_limit=5, reply_limit=3)
            
            # Compare results
            compare_performance(all_full_time, all_comments_count, all_json_size,
                                top_level_full_time, top_level_comments_count, top_level_json_size)
        else:
            # Interactive mode
            interactive_search(reddit)
            
    except ValueError as e:
        print("❌ Configuration error: {}".format(e))
        print("\nMake sure to:")
        print("1. Copy .env.example to .env")
        print("2. Fill in your Reddit API credentials")
        
    except Exception as e:
        print("❌ Unexpected error: {}".format(e))


if __name__ == "__main__":
    main()