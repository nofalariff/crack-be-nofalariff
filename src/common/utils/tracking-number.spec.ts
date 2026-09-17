import {
  canonicalizeTrackingNumber,
  generateTrackingNumber,
  isTrackingNumber,
} from './tracking-number';

describe('generateTrackingNumber', () => {
  it('mengikuti format LGS-YYMMDD-XXXXX', () => {
    const resi = generateTrackingNumber(new Date(2026, 8, 18));

    expect(resi).toMatch(/^LGS-260918-[A-Z0-9]{5}$/);
    expect(isTrackingNumber(resi)).toBe(true);
  });

  it('tidak pernah memakai karakter ambigu 0, 1, I, atau O', () => {
    const suffixes = Array.from({ length: 500 }, () =>
      generateTrackingNumber().slice(-5),
    );

    for (const suffix of suffixes) {
      expect(suffix).not.toMatch(/[01IO]/);
    }
  });

  it('menghasilkan nilai yang tidak berurutan dan hampir selalu unik', () => {
    const generated = new Set(
      Array.from({ length: 1000 }, () => generateTrackingNumber()),
    );

    // 32^5 kemungkinan per hari — tabrakan dalam 1000 percobaan sangat kecil,
    // tetapi keunikan sebenarnya tetap dijamin unique constraint di database.
    expect(generated.size).toBeGreaterThan(995);
  });
});

describe('canonicalizeTrackingNumber', () => {
  it('menerima bentuk kanonik apa adanya', () => {
    expect(canonicalizeTrackingNumber('LGS-260901-K7QMR')).toBe(
      'LGS-260901-K7QMR',
    );
  });

  it('mengabaikan huruf besar-kecil dan tanda hubung', () => {
    expect(canonicalizeTrackingNumber('lgs260901k7qmr')).toBe(
      'LGS-260901-K7QMR',
    );
    expect(canonicalizeTrackingNumber('  lgs-260901-k7qmr  ')).toBe(
      'LGS-260901-K7QMR',
    );
  });

  it('menolak masukan yang bukan nomor resi', () => {
    expect(canonicalizeTrackingNumber('bukan-resi')).toBeNull();
    expect(canonicalizeTrackingNumber('LGS-260901-K7QM')).toBeNull();
    // Mengandung karakter di luar himpunan (0 dan I).
    expect(canonicalizeTrackingNumber('LGS-260901-K70MI')).toBeNull();
  });
});
