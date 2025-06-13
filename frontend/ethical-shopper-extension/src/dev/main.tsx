import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Popup } from '../components/Popup';
import '../styles.scss';

// For development, we simulate being on a checkout page
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup isCheckoutForTesting={true} />
  </React.StrictMode>
);
