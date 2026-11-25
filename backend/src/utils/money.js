export function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  return Math.round((n + Number.EPSILON) * 100);
}
export function fromCents(cents = 0) { return Number(cents) / 100; }
