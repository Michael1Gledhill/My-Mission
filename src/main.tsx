import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './components/App';
import './styles.css';

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <BrowserRouter basename={(import.meta as any).env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
