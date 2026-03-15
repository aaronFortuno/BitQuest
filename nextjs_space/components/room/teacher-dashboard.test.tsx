import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeacherDashboard from './teacher'
import type { Room, Participant } from '@/lib/types'

function makeRoom(overrides?: Partial<Room>): Room {
  return {
    id: 'room-1',
    code: 'ABC-123',
    currentPhase: 0,
    unlockedPhases: [0],
    isBankDisconnected: false,
    maxTransferAmount: 5,
    difficultyAdjustmentInterval: 10,
    targetBlockTime: 15,
    currentDifficulty: 2,
    halvingInterval: 20,
    currentBlockReward: 50,
    totalBtcEmitted: 0,
    participants: [
      { id: 'teacher-1', name: 'Professor', role: 'teacher', isBank: true, roomId: 'room-1', coinFile: '{"propietari":"Professor","saldo":100}', isActive: true, votesFor: 0, votesAgainst: 0, voterIds: [] } as Participant,
      { id: 'student-1', name: 'Alice', role: 'student', isBank: false, roomId: 'room-1', coinFile: '{"propietari":"Alice","saldo":10}', isActive: true, votesFor: 0, votesAgainst: 0, voterIds: [] } as Participant,
    ],
    transactions: [],
    ...overrides,
  }
}

vi.mock('@/contexts/room-context', () => ({
  useRoom: () => mockRoomContext,
}))

let mockRoomContext: Record<string, unknown>

function setupMock(roomOverrides?: Partial<Room>) {
  const room = makeRoom(roomOverrides)
  mockRoomContext = {
    room,
    participant: room.participants[0],
    participantId: room.participants[0].id,
    isTeacher: true,
    blocks: [],
    messages: [],
    utxos: [],
    utxoTransactions: [],
    mempoolTransactions: [],
    nodeConnections: [],
    miningPools: [],
    poolsEnabled: false,
    difficultyInfo: null,
    halvingInfo: null,
    economicStats: null,
    autoMineSettings: { autoMineInterval: 20, autoMineCapacity: 3 },
    highlightTransaction: vi.fn(),
    approveTransaction: vi.fn(),
    rejectTransaction: vi.fn(),
    forceTransaction: vi.fn(),
    voteOnTransaction: vi.fn(),
    toggleBankDisconnection: vi.fn(),
    updateTransferLimit: vi.fn(),
    sendTransaction: vi.fn(),
    loading: false,
    error: null,
  }
}

describe('TeacherDashboard', () => {
  it('renders at phase 0 showing student activity', () => {
    setupMock()
    render(<TeacherDashboard />)
    expect(screen.getByText('studentActivity')).toBeInTheDocument()
  })

  it('renders student names in the activity table', () => {
    setupMock()
    render(<TeacherDashboard />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders phase 1 controls when currentPhase is 1', () => {
    setupMock({ currentPhase: 1 })
    render(<TeacherDashboard />)
    expect(screen.getByText('bankPanel')).toBeInTheDocument()
    expect(screen.getByText('transactionRegistry')).toBeInTheDocument()
  })
})
