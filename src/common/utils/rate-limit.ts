// Batas rate limit mengikuti planbackend.md §8.3, tetapi dapat ditimpa lewat
// environment variable. Nilai bawaannya adalah nilai production; menjalankan
// rangkaian E2E frontend secara paralel dari satu IP membutuhkan batas yang
// jauh lebih longgar, dan itu konfigurasi, bukan perubahan kode.
//
// Dibaca per request (bukan saat modul dimuat) supaya nilainya pasti terbaca
// setelah berkas .env selesai dimuat.
export const ONE_MINUTE_MS = 60_000;

export function limitFromEnv(envKey: string, fallback: number): () => number {
  return () => {
    const raw = process.env[envKey];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.trunc(parsed)
      : fallback;
  };
}

export const RATE_LIMITS = {
  login: { ttl: ONE_MINUTE_MS, limit: limitFromEnv('RATE_LIMIT_LOGIN', 5) },
  register: {
    ttl: ONE_MINUTE_MS,
    limit: limitFromEnv('RATE_LIMIT_REGISTER', 3),
  },
  rateCalculator: {
    ttl: ONE_MINUTE_MS,
    limit: limitFromEnv('RATE_LIMIT_RATE_CALCULATOR', 30),
  },
} as const;

export const DEFAULT_RATE_LIMIT = limitFromEnv('RATE_LIMIT_DEFAULT', 100);
