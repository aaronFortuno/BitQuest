import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getBlocks } from '@/lib/actions/blocks/get-blocks';
import { createGenesis } from '@/lib/actions/blocks/create-genesis';
import { createPending } from '@/lib/actions/blocks/create-pending';
import { selectTransactions } from '@/lib/actions/blocks/select-transactions';
import { submitBlock } from '@/lib/actions/blocks/submit-block';
import { calculateHash } from '@/lib/actions/blocks/calculate-hash';
import { reset } from '@/lib/actions/blocks/reset';
import { toggleMining } from '@/lib/actions/blocks/toggle-mining';
import {
  forceAdjustment,
  updateSettings,
  updateRigSettings,
  batchHashUpdate,
  upgradeRig,
  autoMineTick,
  updatePhase8Settings,
} from '@/lib/actions/blocks/difficulty';
import { forceHalving, updateHalvingSettings } from '@/lib/actions/blocks/halving';
import type { ActionResponse } from '@/lib/actions/blocks/mining-utils';

// Action dispatcher map
const actionHandlers: Record<string, (body: Record<string, unknown>) => ActionResponse> = {
  'create-genesis': createGenesis,
  'create-pending': createPending,
  'select-transactions': selectTransactions,
  'submit-block': submitBlock,
  'calculate-hash': calculateHash,
  'reset': reset,
  'toggle-mining': toggleMining,
  'force-adjustment': forceAdjustment,
  'update-settings': updateSettings,
  'update-rig-settings': updateRigSettings,
  'batch-hash-update': batchHashUpdate,
  'upgrade-rig': upgradeRig,
  'auto-mine-tick': autoMineTick,
  'update-phase8-settings': updatePhase8Settings,
  'force-halving': forceHalving,
  'update-halving-settings': updateHalvingSettings,
};

// GET: Fetch all blocks for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const result = getBlocks(roomId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 });
  }
}

// POST: Dispatch to action handlers
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

    const handler = actionHandlers[action];
    if (!handler) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = handler(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Error in blocks API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
