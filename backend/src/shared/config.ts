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
});
