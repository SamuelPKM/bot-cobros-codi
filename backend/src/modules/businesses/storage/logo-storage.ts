import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';

export interface StoredLogo {
  body: Buffer;
  contentType: string;
}

/**
 * Dónde viven los logos de los negocios. En AWS, un bucket privado de S3
 * (LOGO_BUCKET); las pruebas lo reemplazan por uno en memoria.
 */
export abstract class LogoStorage {
  /** false si no hay bucket configurado: la web esconde la opción. */
  abstract readonly enabled: boolean;
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** null si ya no existe. */
  abstract get(key: string): Promise<StoredLogo | null>;
  abstract delete(key: string): Promise<void>;
}

/** S3 con las credenciales del rol de la instancia (nada de llaves en la configuración). */
export class S3LogoStorage extends LogoStorage {
  readonly enabled = true;
  private readonly s3: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    super();
    this.s3 = new S3Client({ region });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredLogo | null> {
    try {
      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await object.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        body: Buffer.from(bytes),
        contentType: object.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

/** Sin LOGO_BUCKET: la API funciona igual, solo sin logos. */
export class DisabledLogoStorage extends LogoStorage {
  readonly enabled = false;

  private unavailable(): never {
    throw new ServiceUnavailableException(
      'Los logos no están configurados en este servidor',
    );
  }

  put(): Promise<void> {
    this.unavailable();
  }

  get(): Promise<StoredLogo | null> {
    return Promise.resolve(null);
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}
