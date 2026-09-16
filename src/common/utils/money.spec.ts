import { calculateTariff } from './money';

describe('calculateTariff', () => {
  it('membulatkan berat ke atas ke kg berikutnya (0,3 kg)', () => {
    const result = calculateTariff({
      weightKg: 0.3,
      minChargeableWeight: 1,
      pricePerKg: 10_000n,
      baseFee: 0n,
    });

    expect(result.chargeableWeight).toBe(1);
    expect(result.weightFee).toBe(10_000n);
    expect(result.total).toBe(10_000n);
  });

  it('membulatkan berat ke atas ke kg berikutnya (2,1 kg)', () => {
    const result = calculateTariff({
      weightKg: 2.1,
      minChargeableWeight: 1,
      pricePerKg: 10_000n,
      baseFee: 0n,
    });

    expect(result.chargeableWeight).toBe(3);
    expect(result.weightFee).toBe(30_000n);
    expect(result.total).toBe(30_000n);
  });

  it('menegakkan berat minimum rute saat berat aktual di bawahnya', () => {
    const result = calculateTariff({
      weightKg: 0.3,
      minChargeableWeight: 5,
      pricePerKg: 10_000n,
      baseFee: 0n,
    });

    expect(result.chargeableWeight).toBe(5);
    expect(result.weightFee).toBe(50_000n);
    expect(result.total).toBe(50_000n);
  });

  it('membulatkan total ke atas ke kelipatan Rp100 berikutnya', () => {
    const result = calculateTariff({
      weightKg: 1,
      minChargeableWeight: 1,
      pricePerKg: 333n,
      baseFee: 0n,
    });

    expect(result.weightFee).toBe(333n);
    expect(result.total).toBe(400n);
  });

  it('tidak mengubah total yang sudah kelipatan Rp100', () => {
    const result = calculateTariff({
      weightKg: 1,
      minChargeableWeight: 1,
      pricePerKg: 10_000n,
      baseFee: 0n,
    });

    expect(result.total).toBe(10_000n);
  });

  it('menyertakan baseFee sebelum pembulatan', () => {
    const result = calculateTariff({
      weightKg: 4,
      minChargeableWeight: 3,
      pricePerKg: 16_000n,
      baseFee: 10_000n,
    });

    // Sama dengan data seed rute Jawa Timur (4 kg).
    expect(result.chargeableWeight).toBe(4);
    expect(result.weightFee).toBe(64_000n);
    expect(result.total).toBe(74_000n);
  });

  it('cocok dengan nilai acuan mock frontend (rute Makassar, 12 kg)', () => {
    const result = calculateTariff({
      weightKg: 12,
      minChargeableWeight: 5,
      pricePerKg: 24_000n,
      baseFee: 15_000n,
    });

    expect(result.chargeableWeight).toBe(12);
    expect(result.weightFee).toBe(288_000n);
    expect(result.total).toBe(303_000n);
  });

  it('cocok dengan nilai acuan mock frontend (rute Manado, 7,5 kg)', () => {
    const result = calculateTariff({
      weightKg: 7.5,
      minChargeableWeight: 5,
      pricePerKg: 31_000n,
      baseFee: 15_000n,
    });

    expect(result.chargeableWeight).toBe(8);
    expect(result.weightFee).toBe(248_000n);
    expect(result.total).toBe(263_000n);
  });
});
