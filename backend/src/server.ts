import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './shared/config.js';
import { toApiError } from './shared/errors.js';
import { logger } from './shared/logging.js';
import { REQUEST_ID_HEADER } from './shared/request-id.js';
import { checkDatabase, disconnectDatabase } from './infrastructure/database/client.js';

function writeJson(response: ServerResponse, status: number, body: unknown, requestId: string): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.end(JSON.stringify(body));
}

function requestIdFrom(request: IncomingMessage): string {
  const supplied = request.headers[REQUEST_ID_HEADER];
  return (Array.isArray(supplied) ? supplied[0] : supplied)?.trim() || randomUUID();
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestId = requestIdFrom(request);
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/v1/health') {
      const databaseUp = await checkDatabase();
      writeJson(
        response,
        databaseUp ? 200 : 503,
        {
          status: databaseUp ? 'ok' : 'degraded',
          service: 'adsgenius-api',
          version: config.appVersion,
          database: databaseUp ? 'up' : 'down',
          requestId,
        },
        requestId,
      );
      return;
    }

    writeJson(
      response,
      404,
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found.',
          requestId,
        },
      },
      requestId,
    );
  } catch (error) {
    const apiError = toApiError(error, requestId);
    logger.error('Request failed', { requestId, error: error instanceof Error ? error.message : String(error) });
    writeJson(response, apiError.status, apiError.body, requestId);
  }
}

const server = createServer((request, response) => {
  void handle(request, response);
});

server.listen(config.port, config.host, async () => {
  const databaseUp = await checkDatabase();
  logger.info('AdsGenius API started', {
    host: config.host,
    port: config.port,
    database: databaseUp ? 'up' : 'down',
  });

  if (!databaseUp && process.env.API_REQUIRE_DATABASE === 'true') {
    logger.error('Database is required but unavailable; shutting down.');
    server.close();
    await disconnectDatabase();
    process.exitCode = 1;
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutdown requested', { signal });
  server.close(async () => {
    await disconnectDatabase();
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
