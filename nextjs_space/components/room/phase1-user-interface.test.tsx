import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Phase1UserInterface from './phase1-user-interface'
import type { Room, Participant } from '@/lib/types'

function makeRoom(overrides?: Partial<Room>): Room {
  return {
    id: 'room-1',
    code: 'ABC-123',
    currentPhase: 1,
    unlockedPhases: [0, 1],
    isBankDisconnected: false,
    maxTransferAmount: 5,
    difficultyAdjustmentInterval: 10,
    targetBlockTime: 15,
    currentDifficulty: 2,
    halvingInterval: 20,
    currentBlockReward: 50,
    totalBtcEmitted: 0,
    participants: [
      { id: 'p1', name: 'Alice', role: 'student', isBank: false, roomId: 'room-1', coinFile: '{"propietari":"Alice","saldo":10}', isActive: true, votesFor: 0, votesAgainst: 0, voterIds: [] } as Participant,
      { id: 'p2', name: 'Bob', role: 'student', isBank: false, roomId: 'room-1', coinFile: '{"propietari":"Bob","saldo":10}', isActive: true, votesFor: 0, votesAgainst: 0, voterIds: [] } as Participant,
    ],
    transactions: [],
    ...overrides,
  }
}

const participant: Participant = {
  id: 'p1',
  name: 'Alice',
  role: 'student',
  isBank: false,
  roomId: 'room-1',
  coinFile: '{"propietari":"Alice","saldo":10}',
  isActive: true,
  votesFor: 0,
  votesAgainst: 0,
  voterIds: [],
}

vi.mock('@/contexts/room-context', () => ({
  useRoom: () => mockRoomContext,
}))

let mockRoomContext: Record<string, unknown>

function setupMock(roomOverrides?: Partial<Room>) {
  const room = makeRoom(roomOverrides)
  mockRoomContext = {
    room,
    participant,
    participantId: participant.id,
    isTeacher: false,
    sendTransaction: vi.fn(),
    loading: false,
    error: null,
  }
}

describe('Phase1UserInterface', () => {
  it('renders account section with balance', () => {
    setupMock()
    render(<Phase1UserInterface />)
    expect(screen.getByText('myAccount')).toBeInTheDocument()
    expect(screen.getByText('10', { exact: false })).toBeInTheDocument()
  })

  it('renders send transfer section', () => {
    setupMock()
    render(<Phase1UserInterface />)
    expect(screen.getByText('sendTransfer')).toBeInTheDocument()
  })

  it('renders recipient selector with other users', () => {
    setupMock()
    render(<Phase1UserInterface />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders my transactions section', () => {
    setupMock()
    render(<Phase1UserInterface />)
    expect(screen.getByText('myTransactions')).toBeInTheDocument()
  })

  it('shows empty state when no transactions', () => {
    setupMock()
    render(<Phase1UserInterface />)
    expect(screen.getByText(/No tens transaccions/)).toBeInTheDocument()
  })

  it('shows bank unavailable warning when bank is disconnected', () => {
    setupMock({ isBankDisconnected: true })
    render(<Phase1UserInterface />)
    expect(screen.getByText('bankUnavailable')).toBeInTheDocument()
  })
})
