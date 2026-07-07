export const backendProvider = import.meta.env.VITE_BACKEND_PROVIDER || 'php';

export const isPhpBackend = backendProvider === 'php';
