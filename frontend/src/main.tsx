import React from 'react';
import ReactDOM from 'react-dom/client';
import AccountApp from './AccountApp';
import './styles.css';
import './views.css';
import { BRAND } from './config';

document.documentElement.style.setProperty('--deep', BRAND.colors.deepGreen);
document.documentElement.style.setProperty('--green', BRAND.colors.green);
document.documentElement.style.setProperty('--lime', BRAND.colors.lime);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccountApp />
  </React.StrictMode>,
);
