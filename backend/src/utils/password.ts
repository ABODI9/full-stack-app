import crypto from 'crypto';

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function makePasswordSig(plain: string) {
  const pepper = process.env.PASSWORD_PEPPER || '';
  // lowercase لتقليل فروق بسيطة (اختياري)
  return sha256Hex(pepper + plain.toLowerCase());
}

// سياسة بسيطة ومعقولة
export function validatePasswordBasic(pw: string) {
  if (pw.length < 7) return 'Password must be at least 7 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must include letters and numbers';
  }
  return null;
}
