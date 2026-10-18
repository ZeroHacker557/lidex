import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import { ToastProvider } from '../shared/ui';
import { App } from './App';
import { initTelegram } from './telegram';

initTelegram();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
        <BrowserRouter basename="/app">
          <App />
        </BrowserRouter>
      </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
