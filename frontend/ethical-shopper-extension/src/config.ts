export const config = {
  // Replace these with your actual API keys through environment variables
  // (e.g., using DotenvWebpackPlugin in webpack.config.cjs)
  // or extension settings in production.
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '', // Default to empty string if not set
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Default to empty string if not set
  BACKEND_API_URL: process.env.BACKEND_API_URL || 'http://localhost:3000', // Default backend URL
};
