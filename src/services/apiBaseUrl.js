// Resolves the backend API base URL for all axios instances.
// In production builds, VITE_API_URL must be set — silently guessing a
// port would fail confusingly instead of loudly. In dev, falling back to
// the current hostname on :5000 (the backend's default port) keeps
// `npm run dev` working without extra setup.
const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL;

  if (configured) return configured;

  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:5000/api`;
  }

  throw new Error(
    "VITE_API_URL is not set. Configure it in your environment before building for production."
  );
};

export default resolveApiBaseUrl();
