'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Link,
  Trophy,
  Pickaxe,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';
import { BlockchainVisualization } from '@/components/room/blockchain-visualization';
import Phase6BlockchainPanel from '@/components/room/phase6-blockchain-panel';

export default function TeacherPhase6Controls() {
  const { t } = useTranslation();
  const {
    room,
    blocks,
    createGenesisBlock,
    createPendingBlock,
    resetBlockchain,
    toggleMining,
  } = useRoom();

  const students = useMemo(
    () => (room?.participants ?? []).filter(p => p.role === 'student' && p.isActive),
    [room?.participants]
  );

  if (!room) return null;

  return (
    <>
      <Phase6BlockchainPanel participantNames={students.map(s => s.name)} />

      {/* Blockchain Visualization with Genesis Button */}
      <div className="zone-card">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-4 h-4 text-heading" />
          <h2 className="font-semibold text-heading">{t('phase6.blockchain')}</h2>
        </div>
        {blocks.filter(b => b.status === 'mined').length === 0 && !blocks.find(b => b.status === 'pending') ? (
          <div className="text-center py-6">
            <Pickaxe className="w-10 h-10 mx-auto text-muted mb-3" />
            <p className="text-secondary mb-3">{t('phase6.noBlocksYet')}</p>
            <button
              onClick={() => createGenesisBlock?.()}
              disabled={blocks.length > 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Pickaxe className="w-4 h-4" />
              {t('phase6.createGenesis')}
            </button>
          </div>
        ) : (
          <BlockchainVisualization
            blocks={blocks}
            pendingBlock={blocks.find(b => b.status === 'pending')}
            currentParticipantId=""
            difficulty={blocks.find(b => b.status === 'pending')?.difficulty || room.currentDifficulty || 2}
          />
        )}
      </div>

      {/* Network Stats + Miner Ranking (2 columns) */}
      {blocks.filter(b => b.status === 'mined').length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Network Stats */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.networkStats')}</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.currentBlock')}</p>
                <p className="font-bold text-heading text-xl">
                  #{blocks.find(b => b.status === 'pending')?.blockNumber || (blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber)[0]?.blockNumber || 0) + 1}
                </p>
              </div>
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.totalHashAttempts')}</p>
                <p className="font-bold text-heading text-xl">
                  {students.reduce((sum, s) => sum + (s.hashAttempts || 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.activeMiners')}</p>
                <p className="font-bold text-heading text-xl">
                  {students.filter(s => (s.hashAttempts || 0) > 0).length}/{students.length}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Miner Ranking */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.minerRanking')}</h2>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {[...students]
                .sort((a, b) => (b.blocksMinedCount || 0) - (a.blocksMinedCount || 0))
                .map((student, index) => {
                  const blocksCount = student.blocksMinedCount || 0;
                  const reward = student.totalMiningReward || 0;
                  const attempts = student.hashAttempts || 0;
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        blocksCount > 0
                          ? 'bg-amber-50 dark:bg-amber-900/10'
                          : 'bg-surface-alt'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {index === 0 && blocksCount > 0 && (
                          <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-body truncate">{student.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-green-600 dark:text-green-400 font-semibold">{reward} BTC</span>
                        <span className="text-muted">{blocksCount} {t('phase6.blocksShort')} · {attempts} h</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
