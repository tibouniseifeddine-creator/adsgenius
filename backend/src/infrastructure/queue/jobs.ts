import { randomUUID } from 'node:crypto';

export type JobHandler<TPayload> = (payload: TPayload) => Promise<void>;

export interface JobRef {
  id: string;
  type: string;
}

export interface JobQueue {
  enqueue<TPayload>(type: string, payload: TPayload, handler: JobHandler<TPayload>): Promise<JobRef>;
}

export class InMemoryJobQueue implements JobQueue {
  async enqueue<TPayload>(type: string, payload: TPayload, handler: JobHandler<TPayload>): Promise<JobRef> {
    const id = randomUUID();
    queueMicrotask(() => {
      void handler(payload);
    });
    return { id, type };
  }
}
