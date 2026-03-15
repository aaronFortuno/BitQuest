import type { CoinFile, Participant } from './types';

export function getBalance(coinFileJson: string, defaultBalance = 10): number {
  try {
    const data: CoinFile = JSON.parse(coinFileJson);
    return data?.saldo ?? defaultBalance;
  } catch {
    return defaultBalance;
  }
}

export function getParticipantBalance(participant: Participant | null | undefined, defaultBalance = 10): number {
  if (!participant?.coinFile) return defaultBalance;
  return getBalance(participant.coinFile, defaultBalance);
}

export function updateBalance(coinFile: string, delta: number): string {
  try {
    const data = JSON.parse(coinFile);
    data.saldo = (typeof data.saldo === 'number' ? data.saldo : 0) + delta;
    return JSON.stringify(data, null, 2);
  } catch {
    return JSON.stringify({ propietari: '', saldo: delta }, null, 2);
  }
}
