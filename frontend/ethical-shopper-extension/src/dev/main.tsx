import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Popup } from '../components/Popup';
import { RedditSearch } from '../components/RedditSearch';
import '../styles.scss';
import { getEthicalIconBadge } from '@/components/ProductCard';
import { Box, createTheme, MantineProvider, Tabs } from '@mantine/core';

// For development, we simulate being on a checkout page

const statuses = ['Excellent', 'Good', 'Mixed', 'Concerning', 'Poor'];

const theme = createTheme({
  /** Put your mantine theme override here */
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Tabs defaultValue="extension" orientation="horizontal">
        <Tabs.List>
          <Tabs.Tab value="extension">Extension Demo</Tabs.Tab>
          <Tabs.Tab value="reddit">Reddit Search API</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="extension">
          <Popup isCheckoutForTesting={true} />

          <Box
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '10px',
              marginTop: '20px',
              marginLeft: '20px',
            }}
          >
            {statuses.map((status) => (
              <div key={status}>{getEthicalIconBadge(status)}</div>
            ))}
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="reddit">
          <RedditSearch />
        </Tabs.Panel>
      </Tabs>
    </MantineProvider>
  </React.StrictMode>
);
