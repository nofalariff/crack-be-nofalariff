import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
}

type StorageDriver = 'local' | 's3';

// Abstraksi penyimpanan berkas — kode domain tidak tahu berkas disimpan di
// mana (planbackend.md §2.2). Driver `local` untuk development/E2E; driver
// `s3` untuk production (Supabase Storage lewat protokol S3), karena disk
// server di hosting cloud tidak permanen.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly root: string;
  private readonly bucket?: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.getOrThrow<StorageDriver>('STORAGE_DRIVER');
    this.root = resolve(this.config.getOrThrow<string>('STORAGE_PATH'));

    if (this.driver === 's3') {
      this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET');
      this.s3 = new S3Client({
        endpoint: this.config.getOrThrow<string>('STORAGE_ENDPOINT'),
        region: this.config.getOrThrow<string>('STORAGE_REGION'),
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('STORAGE_KEY'),
          secretAccessKey: this.config.getOrThrow<string>('STORAGE_SECRET'),
        },
        forcePathStyle: true,
      });
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.driver === 's3') {
      this.logger.log(`Penyimpanan berkas S3 siap di bucket ${this.bucket}`);
      return;
    }
    await mkdir(this.root, { recursive: true });
    this.logger.log(`Penyimpanan berkas lokal siap di ${this.root}`);
  }

  // Nama berkas selalu di-generate acak; nama asli tidak pernah dipakai di
  // sistem berkas agar tidak bisa dipakai untuk path traversal (§8.3).
  async save(
    buffer: Buffer,
    options: { originalName: string; folder: string; mimeType?: string },
  ): Promise<StoredFile> {
    const extension = extname(options.originalName).toLowerCase().slice(0, 10);
    const storageKey = `${options.folder}/${randomUUID()}${extension}`;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: options.mimeType,
        }),
      );
    } else {
      const target = this.absolutePathOf(storageKey);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
    }

    return { storageKey, sizeBytes: buffer.byteLength };
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    if (this.s3) {
      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      if (!(object.Body instanceof Readable)) {
        throw new Error(`Berkas ${storageKey} tidak dapat dibaca.`);
      }
      return object.Body;
    }
    return createReadStream(this.absolutePathOf(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    if (this.s3) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
        .catch(() => undefined);
      return;
    }
    await unlink(this.absolutePathOf(storageKey)).catch(() => undefined);
  }

  private absolutePathOf(storageKey: string): string {
    const target = resolve(join(this.root, storageKey));
    if (!target.startsWith(this.root + sep)) {
      throw new Error('Kunci penyimpanan tidak valid.');
    }
    return target;
  }
}
