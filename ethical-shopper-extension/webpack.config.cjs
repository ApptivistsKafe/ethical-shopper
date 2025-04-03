const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const DotenvWebpackPlugin = require('dotenv-webpack');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'cheap-module-source-map', // Source maps for dev
  entry: {
    // Production entries
    popup: './src/popup/popup.tsx',
    content: './src/content/content.ts',
    background: './src/background/background.ts',
    // Development entry (only used by dev server)
    dev: './src/dev/main.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true, // Clean the dist folder before each build
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader', // Injects styles into DOM
          'css-loader',   // Translates CSS into CommonJS
          'sass-loader',  // Compiles Sass to CSS
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    // Handles .env file
    new DotenvWebpackPlugin(),

    // Copies manifest.json and static assets
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'public/assets', to: 'assets' }, // Copy icons
      ],
    }),

    // Generates popup.html from template and injects popup.js
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'], // Only include the popup entry script
      inject: 'body', // Inject script tag into the body
    }),

    // Generates index.html for development server
    !isProduction && new HtmlWebpackPlugin({
      template: './src/dev/index.html',
      filename: 'index.html',
      chunks: ['dev'], // Only include the dev entry script
      inject: 'body',
    }),
  ].filter(Boolean), // Filter out falsy values (like the dev index.html plugin in production)

  // Webpack Dev Server configuration
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'), // Serve files from dist
    },
    compress: true,
    port: 3000, // Or another port if 3000 is taken
    hot: true, // Enable Hot Module Replacement
    open: true, // Open browser automatically
    // Serve index.html for the dev entry point
    historyApiFallback: {
        index: 'index.html'
    },
    // Dev server should only serve the 'dev' bundle related files
    devMiddleware: {
        writeToDisk: true, // Write files to disk so index.html can be served
    }
  },

  // Optimization settings (optional, can be refined)
  optimization: {
    minimize: isProduction, // Minimize code in production
  },

  // Disable performance hints for now (can be noisy for extensions)
  performance: {
    hints: false,
  },
};