import axios, { AxiosError } from 'axios';

// EXPO_PUBLIC_ prefix is required for Expo to expose env vars to the bundle.
// Set EXPO_PUBLIC_API_URL in .env for local dev or in Vercel dashboard for prod.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Normalise every error into a human-readable string before it reaches screens
apiClient.interceptors.response.use(
  res => res,
  (err: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    if (!err.response) {
      return Promise.reject(new Error(
        'Cannot reach the server. Make sure the backend is running.'
      ));
    }
    const status = err.response.status;
    const detail = err.response.data?.detail;

    if (typeof detail === 'string') return Promise.reject(new Error(detail));
    if (Array.isArray(detail))
      return Promise.reject(new Error(detail.map(d => d.msg).join(', ')));
    if (status === 404) return Promise.reject(new Error('Resource not found (404).'));
    if (status === 422) return Promise.reject(new Error('Validation error — check the request data.'));
    if (status >= 500)  return Promise.reject(new Error(`Server error (${status}). Try again shortly.`));
    return Promise.reject(new Error(`Request failed with status ${status}.`));
  }
);

export default apiClient;
