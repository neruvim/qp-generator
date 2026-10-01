export function parseCount(input: string): number {
  if (!/^\d+$/.test(input.trim()) || Number(input) < 1)
    throw new Error('Введите положительное целое число участников.');
  const value = Number(input);
  if (!Number.isSafeInteger(value))
    throw new Error('Число слишком велико для точного выбора. Допустимо до 9 007 199 254 740 991.');
  return value;
}

// Exactly 53 random bits. Rejection sampling removes modulo bias.
export function randomBelow(bound: number, sample = random53): number {
  if (!Number.isSafeInteger(bound) || bound < 1) throw new Error('Неверный диапазон выбора.');
  const range = 1n << 53n;
  const divisor = BigInt(bound);
  const limit = range - range % divisor;
  let value: bigint;
  do { value = sample(); } while (value >= limit);
  return Number(value % divisor);
}

function random53(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0] & 0x1fffff) << 32n) | BigInt(words[1]);
}
