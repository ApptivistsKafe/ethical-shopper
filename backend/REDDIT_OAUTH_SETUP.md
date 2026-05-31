# Reddit OAuth Setup Guide

## Overview

This application uses Reddit's OAuth API via the `snoowrap` library to fetch Reddit posts and comments without being blocked by Reddit's anti-scraping measures. This guide walks you through setting up Reddit OAuth credentials.

## Why Reddit OAuth?

Reddit actively blocks HTTP scraping requests with messages like "whoa there, pardner!" To access Reddit content reliably, we use authenticated OAuth requests which:

- ✅ Avoid Reddit's anti-bot blocking mechanisms
- ✅ Provide higher rate limits
- ✅ Allow access to full comment trees
- ✅ Are officially supported by Reddit

## Step 1: Create a Reddit Account

If you don't have one already, create a Reddit account at https://www.reddit.com/register

## Step 2: Create a Reddit Application

1. Go to https://www.reddit.com/prefs/apps
2. Click **"Create App"** or **"Create Another App"**
3. Fill out the form:
   - **App name**: `EthicalShopper` (or any name you prefer)
   - **App type**: Select **"script"** (this is important!)
   - **Description**: `Ethical shopping assistant that analyzes Reddit discussions`
   - **About URL**: Leave blank or use your website
   - **Redirect URI**: Use `http://localhost:8080` (required but not used for script apps)
4. Click **"Create app"**

## Step 3: Get Your Credentials

After creating the app, you'll see:

```
EthicalShopper
personal use script
<YOUR_CLIENT_SECRET>
```

- **Client ID**: The string directly under your app name (looks like: `aBcDeFgHiJkLmN`)
- **Client Secret**: The longer string below that (looks like: `xXxXxXxXxXxXxXxXxXxXxXxXxXx`)

## Step 4: Configure Environment Variables

1. Copy `backend/.env.example` to `backend/.env`:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and fill in your Reddit credentials:

   ```env
   # Reddit API OAuth Credentials
   REDDIT_CLIENT_ID=your_actual_client_id_here
   REDDIT_CLIENT_SECRET=your_actual_client_secret_here
   REDDIT_USERNAME=your_reddit_username
   REDDIT_PASSWORD=your_reddit_password
   REDDIT_USER_AGENT=EthicalShopper:v1.0.0 (by /u/YourUsername)
   ```

   **Important Notes:**

   - Replace `YourUsername` in the user agent with your actual Reddit username
   - Use your actual Reddit login credentials (username and password)
   - Keep these credentials secure and never commit them to version control

## Step 5: Test the Setup

1. Restart the backend server:

   ```bash
   cd backend
   npm start
   ```

2. You should see: `"Reddit OAuth client initialized successfully"`

3. Test with a Reddit search:

   ```bash
   curl "http://localhost:3000/google-search?q=sustainable%20fashion%20brands%20site:reddit.com"
   ```

4. The AI summary should now include actual Reddit content instead of "Reddit content is blocked"

## Troubleshooting

### "Reddit OAuth credentials not provided" Message

- Check that all environment variables are set in your `.env` file
- Restart the server after updating `.env`

### "Failed to initialize Reddit OAuth client" Error

- Verify your client ID and secret are correct
- Ensure you selected "script" as the app type
- Check that your username and password are correct

### Still Getting Blocked Content

- Verify the OAuth client initialized successfully in the server logs
- Check that the Reddit post URLs are being processed by the OAuth function
- Monitor server logs for any OAuth-specific error messages

## Rate Limiting

- Reddit's OAuth API has generous rate limits for personal use scripts
- The application automatically handles rate limiting with delays between requests
- For production use, consider implementing additional caching strategies

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables or secure secret management in production
- Consider creating a dedicated Reddit account for this application
- Regularly rotate your credentials if needed

## Need Help?

If you encounter issues:

1. Check the server console logs for specific error messages
2. Verify all credentials are correctly entered
3. Ensure you're using a "script" type Reddit application
4. Try creating a new Reddit application if credentials seem incorrect
