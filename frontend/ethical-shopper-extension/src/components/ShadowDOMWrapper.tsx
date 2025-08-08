import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HoverCard, MantineProvider } from '@mantine/core';

interface ShadowDOMWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const ShadowDOMWrapper: React.FC<ShadowDOMWrapperProps> = ({
  children,
  className = '',
  style = {},
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const reactRootRef = useRef<Root | null>(null);
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const [shadowReady, setShadowReady] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;

    // Create shadow root
    const shadowRoot = hostRef.current.attachShadow({ mode: 'open' });
    shadowRootRef.current = shadowRoot;

    // Create a container div inside shadow DOM
    const shadowContainer = document.createElement('div');
    shadowContainer.className = 'shadow-container';
    shadowRoot.appendChild(shadowContainer);

    // Create a portal container for Mantine portals (tooltips, modals, etc.)
    const portalContainer = document.createElement('div');
    portalContainer.id = 'mantine-portal-container';
    portalContainer.className = 'mantine-portal-container';
    shadowRoot.appendChild(portalContainer);
    portalContainerRef.current = portalContainer;

    // Inject styles into shadow DOM
    const injectStyles = () => {
      // Create style element for Mantine core styles
      const mantineStyleElement = document.createElement('style');

      // We'll fetch Mantine CSS from CDN as a fallback approach
      fetch('https://unpkg.com/@mantine/core@8.0.2/styles.css')
        .then((response) => response.text())
        .then((css) => {
          // Modify CSS to apply to portal container as well
          const modifiedCSS = css.replace(
            /:root\s*{/g,
            ':host, .shadow-container, .mantine-portal-container {'
          );
          mantineStyleElement.textContent = modifiedCSS;
          shadowRoot.appendChild(mantineStyleElement);
        })
        .catch(() => {
          // If CDN fails, inject minimal Mantine-like styles
          mantineStyleElement.textContent = `
            /* Minimal Mantine-like styles */
            :host, .shadow-container, .mantine-portal-container {
              --mantine-color-white: #fff;
              --mantine-color-black: #000;
              --mantine-color-gray-0: #f8f9fa;
              --mantine-color-gray-1: #f1f3f4;
              --mantine-color-gray-2: #e9ecef;
              --mantine-color-gray-3: #dee2e6;
              --mantine-color-gray-4: #ced4da;
              --mantine-color-gray-5: #adb5bd;
              --mantine-color-gray-6: #868e96;
              --mantine-color-gray-7: #495057;
              --mantine-color-gray-8: #343a40;
              --mantine-color-gray-9: #212529;
              --mantine-spacing-xs: 0.625rem;
              --mantine-spacing-sm: 0.875rem;
              --mantine-spacing-md: 1rem;
              --mantine-spacing-lg: 1.25rem;
              --mantine-spacing-xl: 1.5rem;
              --mantine-radius-xs: 0.125rem;
              --mantine-radius-sm: 0.25rem;
              --mantine-radius-md: 0.5rem;
              --mantine-radius-lg: 1rem;
              --mantine-radius-xl: 2rem;
            }
          `;
          shadowRoot.appendChild(mantineStyleElement);
        });

      // Create style element for our custom styles
      const customStyleElement = document.createElement('style');
      customStyleElement.textContent = `
        /* Shadow DOM container reset */
        .shadow-container {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #333;
        }
        
        .shadow-container * {
          box-sizing: border-box;
        }

        /* Portal container styling - inherit from shadow container */
        .mantine-portal-container {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #333;
          position: relative;
          z-index: 9999;
        }
        
        .mantine-portal-container * {
          box-sizing: border-box;
        }
        
        /* Popup styles */
        .popup {
          max-width: 450px;
          max-height: 600px;
          overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 16px;
          color: #333333;
          background-color: white;
          border: 1px solid black;
        }

        .popup .dismiss-button {
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 2px 5px;
          color: #aaa;
        }

        .popup .dismiss-button:hover {
          color: #333;
        }

        .popup h2 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
        }

        .popup p {
          margin: 0 0 4px;
          font-size: 14px;
          line-height: 1.5;
        }

        .popup .primary-button {
          background-color: #4caf50;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          transition: background-color 0.2s;
        }

        .popup .primary-button:hover {
          background-color: #45a049;
        }

        .popup .primary-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .popup .secondary-button {
          background-color: #6c757d;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          width: auto;
          transition: background-color 0.2s;
        }

        .popup .secondary-button:hover {
          background-color: #5a6268;
        }

        .popup .spinner {
          text-align: center;
          padding: 1rem;
          color: #666;
          font-style: italic;
          margin-top: 0.5rem;
        }

        .popup .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.5rem;
          padding: 0.75rem;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          text-align: left;
        }

        .popup .checkout-detected {
          text-align: center;
        }

        .popup .checkout-detected h2 {
          color: #4caf50;
        }

        .popup .step-section {
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          background-color: #fdfdfd;
        }

        .popup .step-section h3 {
          font-size: 1.1em;
          margin: 0 0 1rem;
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 0.5rem;
        }
      `;
      shadowRoot.appendChild(customStyleElement);

      setShadowReady(true);
    };

    injectStyles();

    // Create React root inside shadow DOM
    reactRootRef.current = createRoot(shadowContainer);

    return () => {
      // Cleanup
      if (reactRootRef.current) {
        reactRootRef.current.unmount();
        reactRootRef.current = null;
      }
      shadowRootRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      shadowReady &&
      reactRootRef.current &&
      shadowRootRef.current &&
      portalContainerRef.current
    ) {
      // Render children into shadow DOM with MantineProvider configured for Shadow DOM
      reactRootRef.current.render(
        <MantineProvider
          cssVariablesSelector=":host"
          getRootElement={() => portalContainerRef.current!}
          theme={{
            // Configure theme for Shadow DOM
            components: {
              Portal: {
                defaultProps: {
                  target: portalContainerRef.current,
                },
              },
            },
            other: {
              shadowRoot: shadowRootRef.current,
            },
          }}
        >
          <div className="shadow-container">{children}</div>
        </MantineProvider>
      );
    }
  }, [children, shadowReady]);

  return <div ref={hostRef} className={className} style={style} />;
};

export default ShadowDOMWrapper;
