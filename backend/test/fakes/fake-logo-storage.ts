import {
  LogoStorage,
  type StoredLogo,
} from '../../src/modules/businesses/storage/logo-storage';

/** Reemplaza al bucket de S3 en las pruebas: guarda los logos en memoria. */
export class FakeLogoStorage extends LogoStorage {
  readonly enabled = true;
  readonly objects = new Map<string, StoredLogo>();

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  get(key: string): Promise<StoredLogo | null> {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  reset(): void {
    this.objects.clear();
  }
}
