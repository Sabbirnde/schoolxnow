import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorTelemetryProvider } from './contexts/ErrorTelemetryContext';
import EnvironmentConfigError from './components/EnvironmentConfigError';
import SecureConfig from './lib/secure-config';
import { queryClient } from './lib/query-client';
import './index.css';

const createFallbackRoot = () => {
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
  return fallbackRoot;
};

const getRootElement = () => {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    return rootElement;
  }

  console.error('Root element with id "root" was not found. Creating a fallback root.');
  return createFallbackRoot();
};

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
};

const root = createRoot(getRootElement());
const validation = SecureConfig.validate();

if (!validation.isValid) {
  console.error('Invalid application environment configuration', {
    errors: validation.errors,
    safeInfo: validation.safeInfo,
    mode: import.meta.env.MODE,
  });

  root.render(
    <ThemeProvider>
      <EnvironmentConfigError validation={validation} />
    </ThemeProvider>
  );
} else {
  void import('./App.tsx').then(({ default: App }) => {
    registerServiceWorker();

    root.render(
      <ErrorTelemetryProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorTelemetryProvider>
    );
  });
}
