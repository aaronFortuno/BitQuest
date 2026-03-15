import { getBalance, getParticipantBalance, updateBalance } from './balance-utils';
import type { Participant } from './types';

describe('getBalance', () => {
  it('returns saldo from valid JSON', () => {
    expect(getBalance('{"propietari":"Alice","saldo":25}')).toBe(25);
  });

  it('returns saldo of 0 when saldo is 0', () => {
    expect(getBalance('{"propietari":"Bob","saldo":0}')).toBe(0);
  });

  it('returns default balance for invalid JSON', () => {
    expect(getBalance('not json')).toBe(10);
  });

  it('returns custom default balance for invalid JSON', () => {
    expect(getBalance('not json', 50)).toBe(50);
  });

  it('returns default balance for empty string', () => {
    expect(getBalance('')).toBe(10);
  });

  it('returns default when saldo is missing', () => {
    expect(getBalance('{"propietari":"Alice"}')).toBe(10);
  });

  it('returns saldo when it is negative', () => {
    expect(getBalance('{"saldo":-5}')).toBe(-5);
  });
});

describe('getParticipantBalance', () => {
  const makeParticipant = (coinFile: string): Participant => ({
    id: 'p1',
    name: 'Alice',
    role: 'student',
    isBank: false,
    roomId: 'r1',
    coinFile,
    isActive: true,
  });

  it('returns default balance for null participant', () => {
    expect(getParticipantBalance(null)).toBe(10);
  });

  it('returns default balance for undefined participant', () => {
    expect(getParticipantBalance(undefined)).toBe(10);
  });

  it('returns default balance when coinFile is empty string', () => {
    expect(getParticipantBalance(makeParticipant(''))).toBe(10);
  });

  it('returns saldo from valid participant', () => {
    const p = makeParticipant('{"propietari":"Alice","saldo":42}');
    expect(getParticipantBalance(p)).toBe(42);
  });

  it('returns custom default for null participant', () => {
    expect(getParticipantBalance(null, 99)).toBe(99);
  });
});

describe('updateBalance', () => {
  it('adds positive delta to existing saldo', () => {
    const result = updateBalance('{"propietari":"Alice","saldo":10}', 5);
    const parsed = JSON.parse(result);
    expect(parsed.saldo).toBe(15);
    expect(parsed.propietari).toBe('Alice');
  });

  it('subtracts negative delta from existing saldo', () => {
    const result = updateBalance('{"propietari":"Bob","saldo":20}', -8);
    const parsed = JSON.parse(result);
    expect(parsed.saldo).toBe(12);
  });

  it('treats missing saldo as 0', () => {
    const result = updateBalance('{"propietari":"Carol"}', 7);
    const parsed = JSON.parse(result);
    expect(parsed.saldo).toBe(7);
  });

  it('treats non-numeric saldo as 0', () => {
    const result = updateBalance('{"saldo":"abc"}', 3);
    const parsed = JSON.parse(result);
    expect(parsed.saldo).toBe(3);
  });

  it('returns fallback JSON for invalid input', () => {
    const result = updateBalance('not json', 15);
    const parsed = JSON.parse(result);
    expect(parsed.saldo).toBe(15);
    expect(parsed.propietari).toBe('');
  });

  it('outputs pretty-printed JSON', () => {
    const result = updateBalance('{"saldo":1}', 1);
    expect(result).toContain('\n');
  });
});
