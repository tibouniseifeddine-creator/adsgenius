export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
}

export interface Storage {
  put(key: string, data: Uint8Array, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export class NotConfiguredStorage implements Storage {
  async put(): Promise<StoredObject> {
    throw new Error('Object storage is not configured.');
  }

  async delete(): Promise<void> {
    throw new Error('Object storage is not configured.');
  }

  async getSignedReadUrl(): Promise<string> {
    throw new Error('Object storage is not configured.');
  }
}
