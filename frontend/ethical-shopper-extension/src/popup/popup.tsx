import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Popup } from '../components/Popup';
import '../styles.scss';
import { getEthicalIconBadge } from '@/components/ProductCard';

const statuses = ['Excellent', 'Good', 'Mixed', 'Concerning', 'Poor'];
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
    {statuses.map((status) => (
      <div key={status}>{getEthicalIconBadge(status)}</div>
    ))}
  </React.StrictMode>
);
