import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HoverCard, MantineProvider } from '@mantine/core';
// Import Mantine CSS as raw string
import mantineCSSRaw from '@mantine/core/styles.css';

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

      // Use imported Mantine CSS and modify it for Shadow DOM
      const modifiedCSS = mantineCSSRaw.replace(
        /:root\s*{/g,
        ':host, .shadow-container, .mantine-portal-container {'
      );
      mantineStyleElement.textContent = modifiedCSS;
      shadowRoot.appendChild(mantineStyleElement);

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
