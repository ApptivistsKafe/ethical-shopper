# Ethical Shopper Browser Extension

A browser extension that detects when you're on a checkout page and suggests ethical alternatives.

## Features

- Automatic checkout page detection across major e-commerce sites
- Smart detection using URL patterns and DOM analysis
- Popup interface showing ethical alternatives
- Support for Chrome, Firefox, and Safari

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` directory

## Build

To build the extension:

```bash
npm run build
```

This will create a production build in the `dist` directory.

## Testing

Run the test suite:

```bash
npm test
```

This will run the Vitest test suite, including:
- Unit tests for checkout detection
- Component tests for the popup interface

## Extension Structure

```
ethical-shopper-extension/
├── public/
│   └── manifest.json
├── src/
│   ├── components/
│   │   └── Popup.tsx
│   ├── services/
│   │   └── checkoutDetector.ts
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.tsx
│   └── styles.scss
└── test/
    └── services/
        └── checkoutDetector.test.ts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.