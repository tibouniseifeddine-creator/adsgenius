import backendApp from '../backend/src/server.ts';

// Vercel entrypoint: expose the Express API under the same origin as the Vite frontend.
// backend/src/server.ts exports a default Express app so this import remains compatible
// with the backend's CommonJS TypeScript configuration under Vercel's ESM loader.
export default backendApp;
