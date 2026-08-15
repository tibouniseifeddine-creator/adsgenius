function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.API_HOST ?? '127.0.0.1',
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/adsgenius'),
  appVersion: process.env.APP_VERSION ?? '0.1.0',
  meta: {
    configured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI && process.env.META_GRAPH_API_VERSION && process.env.META_TOKEN_ENCRYPTION_KEY),
    graphVersion: process.env.META_GRAPH_API_VERSION ?? null,
  },
});
