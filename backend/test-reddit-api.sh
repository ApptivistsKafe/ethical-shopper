#!/bin/bash

echo "Testing Reddit Search API Endpoint"
echo "=================================="

# Start the backend server in the background if not already running
if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "Starting backend server..."
    cd "$(dirname "$0")"
    npm run dev &
    SERVER_PID=$!
    echo "Waiting for server to start..."
    sleep 3
else
    echo "Server already running on port 3000"
    SERVER_PID=""
fi

echo ""
echo "Testing basic Reddit search..."
curl -s "http://localhost:3000/reddit-search?q=ethical+shopping" | jq '.'

echo ""
echo "Testing Reddit search with subreddit filter..."
curl -s "http://localhost:3000/reddit-search?q=sustainability&subreddit=BuyItForLife&limit=5" | jq '.'

echo ""
echo "Testing Reddit search with sorting and time filters..."
curl -s "http://localhost:3000/reddit-search?q=green+products&sort=top&t=week&limit=3" | jq '.'

echo ""
echo "Testing error handling (missing query parameter)..."
curl -s "http://localhost:3000/reddit-search" | jq '.'

# Clean up - kill the server if we started it
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    echo "Stopping test server..."
    kill $SERVER_PID 2>/dev/null
fi

echo ""
echo "Reddit API test completed!"