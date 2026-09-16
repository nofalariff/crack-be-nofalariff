// Kalkulator ongkir — planbackend.md §7.2 / PRD §8.2.
// Nominal uang selalu BigInt agar tidak ada perhitungan floating point (§5.3.5).
// Fungsi murni supaya bisa dipakai ulang oleh modul rates (kalkulator publik)
// dan shipments (snapshot harga saat booking, koreksi berat) tanpa duplikasi.

export interface TariffInput {
  weightKg: number;
  minChargeableWeight: number;
  pricePerKg: bigint;
  baseFee: bigint;
}

export interface TariffResult {
  chargeableWeight: number;
  weightFee: bigint;
  total: bigint;
}

export function calculateTariff(input: TariffInput): TariffResult {
  const roundedWeight = Math.ceil(input.weightKg);
  const chargeableWeight = Math.max(roundedWeight, input.minChargeableWeight);
  const weightFee = BigInt(chargeableWeight) * input.pricePerKg;
  const rawTotal = weightFee + input.baseFee;
  // Bulatkan ke atas ke kelipatan Rp100 berikutnya.
  const total = ((rawTotal + 99n) / 100n) * 100n;

  return { chargeableWeight, weightFee, total };
}
