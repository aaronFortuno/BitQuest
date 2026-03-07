export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 2) code += '-';
  }
  return code;
}

export function formatRoomCode(code: string): string {
  const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + '-' + clean.slice(3, 6);
}

export function validateRoomCode(code: string): boolean {
  const pattern = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/i;
  return pattern.test(code);
}

export function createInitialCoinFile(ownerName: string): string {
  return JSON.stringify({
    propietari: ownerName,
    saldo: 10
  }, null, 2);
}
