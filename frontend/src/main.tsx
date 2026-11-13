import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import AccountApp from './AccountApp';
import ReadOnlyPreview from './ReadOnlyPreview';
import './styles.css';
import './views.css';
import { BRAND } from './config';

document.documentElement.style.setProperty('--deep', BRAND.colors.deepGreen);
document.documentElement.style.setProperty('--green', BRAND.colors.green);
document.documentElement.style.setProperty('--lime', BRAND.colors.lime);

function RootApp() {
  const navigate = useNavigate();
  return <Routes>
    <Route path="/demo" element={<ReadOnlyPreview onClose={() => navigate('/')} />} />
    <Route path="*" element={<AccountApp />} />
  </Routes>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootApp />
    </BrowserRouter>
  </React.StrictMode>,
);
