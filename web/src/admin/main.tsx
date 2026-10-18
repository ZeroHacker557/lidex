import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import { ToastProvider } from '../shared/ui';
import { AdminApp } from './App';

try {
  const theme = localStorage.getItem('lx_theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch {
  /* storage yopiq */
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
        <BrowserRouter basename="/admin">
          <AdminApp />
        </BrowserRouter>
      </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
