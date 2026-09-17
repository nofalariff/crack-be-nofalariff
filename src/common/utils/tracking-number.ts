import { randomInt } from 'node:crypto';

// Nomor resi — planbackend.md §7.1 / PRD §8.1.
// Format LGS-YYMMDD-XXXXX. Himpunan karakter sengaja tanpa 0, 1, I, dan O
// agar tidak ambigu saat resi didikte lewat telepon.
const RESI_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RANDOM_LENGTH = 5;
const TRACKING_PATTERN = /^LGS-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/;
const NORMALIZED_PATTERN =
  /^LGS(\d{6})([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5})$/;

export function generateTrackingNumber(now: Date = new Date()): string {
  const yymmdd = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  let random = '';
  for (let i = 0; i < RANDOM_LENGTH; i += 1) {
    random += RESI_ALPHABET[randomInt(RESI_ALPHABET.length)];
  }

  return `LGS-${yymmdd}-${random}`;
}

export function isTrackingNumber(value: string): boolean {
  return TRACKING_PATTERN.test(value);
}

// Menerima input apa adanya dari pengguna — huruf kecil, tanpa tanda hubung,
// atau dengan spasi — lalu mengembalikannya ke bentuk kanonik bila valid.
// Dipakai agar pencarian resi tidak peduli huruf besar-kecil dan tanda hubung.
export function canonicalizeTrackingNumber(input: string): string | null {
  const normalized = input.trim().toUpperCase().replace(/[\s-]/g, '');
  const match = NORMALIZED_PATTERN.exec(normalized);
  if (!match) return null;

  return `LGS-${match[1]}-${match[2]}`;
}
