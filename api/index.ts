import { app } from '../backend/src/server.ts';

// Vercel entrypoint: expose the Express API under the same origin as the Vite frontend.
// The explicit .ts extension is required because the deployed @vercel/node bundle
// otherwise preserves the ESM import and Node cannot resolve backend/src/server at runtime.
export default app;
