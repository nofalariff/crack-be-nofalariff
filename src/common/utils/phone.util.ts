// Menormalkan nomor HP Indonesia ke format +62xxxxxxxxxx.
// Menerima awalan +62, 62, atau 0; mengembalikan null bila tidak valid.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let national: string;

  if (digits.startsWith('+62')) national = digits.slice(3);
  else if (digits.startsWith('62')) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else return null;

  if (!/^\d+$/.test(national)) return null;
  if (national.length < 7 || national.length > 13) return null;

  return `+62${national}`;
}
