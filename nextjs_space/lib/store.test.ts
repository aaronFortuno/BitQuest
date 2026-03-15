import { describe, it, expect, beforeEach } from 'vitest'
import { store } from './store'

// Each test gets a fresh room
let roomId: string
let roomCode: string

beforeEach(() => {
  roomCode = `TEST-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
  const state = store.createRoom(roomCode)
  roomId = state.room.id
})

// ============ Room ============

describe('store.room', () => {
  it('creates a room with default values', () => {
    const state = store.getRoom(roomCode)
    expect(state).toBeDefined()
    expect(state!.room.code).toBe(roomCode)
    expect(state!.room.currentPhase).toBe(0)
    expect(state!.room.unlockedPhases).toEqual([0])
  })

  it('retrieves room by id', () => {
    const state = store.getRoomById(roomId)
    expect(state).toBeDefined()
    expect(state!.room.id).toBe(roomId)
  })

  it('getRoomCodeById returns correct code', () => {
    expect(store.getRoomCodeById(roomId)).toBe(roomCode)
  })

  it('updates room fields', () => {
    const updated = store.updateRoom(roomId, { currentPhase: 3 })
    expect(updated).toBeDefined()
    expect(updated!.currentPhase).toBe(3)
  })

  it('deletes a room', () => {
    store.deleteRoom(roomCode)
    expect(store.getRoom(roomCode)).toBeUndefined()
    expect(store.getRoomById(roomId)).toBeUndefined()
  })

  it('returns undefined for non-existent room', () => {
    expect(store.getRoom('NOPE-XXX')).toBeUndefined()
    expect(store.getRoomById('non-existent')).toBeUndefined()
  })
})

// ============ Participant ============

describe('store.participant', () => {
  it('adds a participant to a room', () => {
    const p = store.addParticipant(roomId, { name: 'Alice', role: 'student' })
    expect(p.name).toBe('Alice')
    expect(p.role).toBe('student')
    expect(p.roomId).toBe(roomId)
  })

  it('retrieves participant by id', () => {
    const p = store.addParticipant(roomId, { name: 'Bob' })
    const found = store.getParticipant(p.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Bob')
  })

  it('getParticipantWithRoom returns participant and room state', () => {
    const p = store.addParticipant(roomId, { name: 'Carol' })
    const result = store.getParticipantWithRoom(p.id)
    expect(result).toBeDefined()
    expect(result!.participant.name).toBe('Carol')
    expect(result!.roomState.room.id).toBe(roomId)
  })

  it('updates participant fields', () => {
    const p = store.addParticipant(roomId, { name: 'Dave' })
    const updated = store.updateParticipant(p.id, { publicKey: '17:10403' })
    expect(updated).toBeDefined()
    expect(updated!.publicKey).toBe('17:10403')
  })

  it('lists participants by room', () => {
    store.addParticipant(roomId, { name: 'A' })
    store.addParticipant(roomId, { name: 'B' })
    const list = store.getParticipantsByRoom(roomId)
    expect(list).toHaveLength(2)
  })

  it('defaults balance to 10 in coinFile', () => {
    const p = store.addParticipant(roomId, { name: 'Eve' })
    const coinFile = JSON.parse(p.coinFile)
    expect(coinFile.saldo).toBe(10)
  })

  it('throws for non-existent room', () => {
    expect(() => store.addParticipant('fake-id', { name: 'X' })).toThrow('Room not found')
  })
})

// ============ Transaction ============

describe('store.transaction', () => {
  it('creates a transaction', () => {
    const p1 = store.addParticipant(roomId, { name: 'Alice' })
    const p2 = store.addParticipant(roomId, { name: 'Bob' })
    const tx = store.createTransaction(roomId, {
      senderId: p1.id,
      receiverId: p2.id,
      amount: 5,
    })
    expect(tx.amount).toBe(5)
    expect(tx.status).toBe('approved')
  })

  it('retrieves transaction by id', () => {
    const tx = store.createTransaction(roomId, { amount: 3 })
    const found = store.getTransaction(tx.id)
    expect(found).toBeDefined()
    expect(found!.amount).toBe(3)
  })

  it('updates transaction', () => {
    const tx = store.createTransaction(roomId, { amount: 3 })
    const updated = store.updateTransaction(tx.id, { status: 'rejected', rejectReason: 'fraud' })
    expect(updated!.status).toBe('rejected')
    expect(updated!.rejectReason).toBe('fraud')
  })

  it('lists transactions by room', () => {
    store.createTransaction(roomId, { amount: 1 })
    store.createTransaction(roomId, { amount: 2 })
    const list = store.getTransactionsByRoom(roomId)
    expect(list).toHaveLength(2)
  })

  it('deletes all transactions in a room', () => {
    store.createTransaction(roomId, { amount: 1 })
    store.createTransaction(roomId, { amount: 2 })
    store.deleteTransactionsByRoom(roomId)
    expect(store.getTransactionsByRoom(roomId)).toHaveLength(0)
  })

  it('throws for non-existent room', () => {
    expect(() => store.createTransaction('fake-id', { amount: 1 })).toThrow('Room not found')
  })
})
