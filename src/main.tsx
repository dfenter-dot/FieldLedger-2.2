import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './routes/AppRouter';
import './styles/index.css';
import './styles/theme-light.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);

