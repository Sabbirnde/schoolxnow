import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorTelemetryProvider } from './contexts/ErrorTelemetryContext';
import { queryClient } from './lib/query-client';
import './index.css';

// Register service worker for offline capability
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// Add better error handling for root element
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ ERROR: Root element with id 'root' not found in the document!");
  
  // Create a root element if it doesn't exist
  const fallbackRoot = document.createElement("div");
  fallbackRoot.id = "root";
  document.body.appendChild(fallbackRoot);
  
  // Add visible error message to the page
  fallbackRoot.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
      <h2>React Mount Error</h2>
      <p>Could not find the root element to mount the React application.</p>
      <p>This might be caused by:</p>
      <ul>
        <li>Missing or incorrect ID in index.html</li>
        <li>HTML loading issues</li>
        <li>JavaScript loading errors</li>
      </ul>
      <p>Please check the browser console for more details.</p>
    </div>
  `;
  
  // Use the fallback element
  createRoot(fallbackRoot).render(
    <ErrorTelemetryProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorTelemetryProvider>
  );
} else {
  // Normal initialization
  console.log("✅ Found root element, mounting React app...");
  createRoot(rootElement).render(
    <ErrorTelemetryProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorTelemetryProvider>
  );
}

// Log successful initialization
console.log("🚀 React initialization attempted");
