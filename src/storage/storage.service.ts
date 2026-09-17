import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
}

// Abstraksi penyimpanan berkas — kode domain tidak tahu berkas disimpan di
// mana (planbackend.md §2.2). Driver `local` dulu; driver `s3` menyusul tanpa
// mengubah pemanggilnya.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(this.config.getOrThrow<string>('STORAGE_PATH'));
  }

  async onModuleInit(): Promise<void> {
    const driver = this.config.getOrThrow<string>('STORAGE_DRIVER');
    if (driver !== 'local') {
      throw new Error(`STORAGE_DRIVER "${driver}" belum didukung.`);
    }
    await mkdir(this.root, { recursive: true });
    this.logger.log(`Penyimpanan berkas lokal siap di ${this.root}`);
  }

  // Nama berkas selalu di-generate acak; nama asli tidak pernah dipakai di
  // sistem berkas agar tidak bisa dipakai untuk path traversal (§8.3).
  async save(
    buffer: Buffer,
    options: { originalName: string; folder: string },
  ): Promise<StoredFile> {
    const extension = extname(options.originalName).toLowerCase().slice(0, 10);
    const storageKey = `${options.folder}/${randomUUID()}${extension}`;
    const target = this.absolutePathOf(storageKey);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);

    return { storageKey, sizeBytes: buffer.byteLength };
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.absolutePathOf(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.absolutePathOf(storageKey)).catch(() => undefined);
  }

  private absolutePathOf(storageKey: string): string {
    const target = resolve(join(this.root, storageKey));
    if (!target.startsWith(this.root)) {
      throw new Error('Kunci penyimpanan tidak valid.');
    }
    return target;
  }
}
