import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

const POOL_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const pools = store.getMiningPoolsByRoom(roomId);

    const poolsWithDetails = pools.map(pool => {
      const members = pool.memberIds
        .map(id => store.getParticipant(id))
        .filter(Boolean)
        .map(p => ({
          id: p!.id,
          name: p!.name,
          activeRigs: p!.activeRigs,
          rigSpeed: p!.rigSpeed,
          hashrate: (p!.activeRigs ?? 0) * (p!.rigSpeed || 4),
        }));

      const totalHashrate = members.reduce((sum, m) => sum + m.hashrate, 0);

      return {
        id: pool.id,
        roomId: pool.roomId,
        name: pool.name,
        creatorId: pool.creatorId,
        memberIds: pool.memberIds,
        members,
        colorHex: pool.colorHex,
        totalHashrate,
        createdAt: pool.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      pools: poolsWithDetails,
      poolsEnabled: state.room.poolsEnabled,
    });
  } catch (error) {
    console.error('Error fetching pools:', error);
    return NextResponse.json({ error: 'Failed to fetch pools' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomId } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const roomCode = store.getRoomCodeById(roomId);

    if (action === 'toggle-pools') {
      const { enabled } = body;
      store.updateRoom(roomId, { poolsEnabled: !!enabled });

      // If disabling, dissolve all pools
      if (!enabled) {
        store.deleteAllMiningPools(roomId);
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, poolsEnabled: !!enabled });
    }

    if (action === 'create-pool') {
      const { name, creatorId } = body;

      if (!name || !creatorId) {
        return NextResponse.json({ error: 'name and creatorId are required' }, { status: 400 });
      }

      if (!state.room.poolsEnabled) {
        return NextResponse.json({ error: 'Pools are not enabled' }, { status: 400 });
      }

      // Check if creator is already in a pool
      const creator = store.getParticipant(creatorId);
      if (!creator) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
      if (creator.poolId) {
        return NextResponse.json({ error: 'Already in a pool' }, { status: 400 });
      }

      // Pick a color
      const existingPools = store.getMiningPoolsByRoom(roomId);
      const usedColors = existingPools.map(p => p.colorHex);
      const availableColor = POOL_COLORS.find(c => !usedColors.includes(c)) || POOL_COLORS[existingPools.length % POOL_COLORS.length];

      const pool = store.createMiningPool(roomId, {
        name,
        creatorId,
        colorHex: availableColor,
      });

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, pool });
    }

    if (action === 'join-pool') {
      const { poolId, participantId } = body;

      if (!poolId || !participantId) {
        return NextResponse.json({ error: 'poolId and participantId are required' }, { status: 400 });
      }

      const participant = store.getParticipant(participantId);
      if (!participant) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
      if (participant.poolId) {
        return NextResponse.json({ error: 'Already in a pool' }, { status: 400 });
      }

      const pool = store.joinMiningPool(poolId, participantId);
      if (!pool) {
        return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, pool });
    }

    if (action === 'leave-pool') {
      const { poolId, participantId } = body;

      if (!poolId || !participantId) {
        return NextResponse.json({ error: 'poolId and participantId are required' }, { status: 400 });
      }

      const result = store.leaveMiningPool(poolId, participantId);
      if (!result) {
        return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete-pool') {
      const { poolId } = body;

      if (!poolId) {
        return NextResponse.json({ error: 'poolId is required' }, { status: 400 });
      }

      const result = store.deleteMiningPool(poolId);
      if (!result) {
        return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in pools API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
