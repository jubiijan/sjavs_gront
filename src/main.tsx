import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, createRoutesFromElements, createBrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { SupabaseProvider } from './contexts/SupabaseContext';

const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={router}>
      <SupabaseProvider>
        <App />
      </SupabaseProvider>
    </BrowserRouter>
  </StrictMode>
);