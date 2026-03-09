'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useRoomPolling } from '@/hooks/use-room-polling';
import { Participant, Transaction } from '@/lib/types';
import Header from '@/components/room/header';
import PhaseNavigation from '@/components/room/phase-navigation';
import StudentInterface from '@/components/room/student-interface';
import TeacherDashboard from '@/components/room/teacher-dashboard';
import InstructionsPanel from '@/components/room/instructions-panel';
import StudentPhaseDropdown from '@/components/room/student-phase-dropdown';
import Phase1UserInterface from '@/components/room/phase1-user-interface';
import Phase2UserInterface from '@/components/room/phase2-user-interface';
import Phase3UserInterface from '@/components/room/phase3-user-interface';
import Phase3CryptoPanel from '@/components/room/phase3-crypto-panel';
import Phase4UtxoPanel from '@/components/room/phase4-utxo-panel';
import Phase4UserInterface from '@/components/room/phase4-user-interface';
import Phase5UserInterface from '@/components/room/phase5-user-interface';
import { Phase6UserInterface } from '@/components/room/phase6-user-interface';
import { Phase8UserInterface } from '@/components/room/phase8-user-interface';
import Phase9UserInterface from '@/components/room/phase9-user-interface';
import LoadingScreen from '@/components/ui/loading-screen';
import VersionFooter from '@/components/ui/version-footer';

export default function RoomPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code') || '';

  const [participantData, setParticipantData] = useState<{
    id: string;
    name: string;
    role: 'teacher' | 'student';
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showStudentInstructions, setShowStudentInstructions] = useState(true);
  const [studentViewPhase, setStudentViewPhase] = useState<number | null>(null);
  const prevPhaseRef = useRef<number>(-1);

  useEffect(() => {
    setMounted(true);
    if (!code) {
      router.push('/');
      return;
    }
    const stored = localStorage.getItem('bitquest_participant');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.roomCode === code) {
          setParticipantData(data);
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [code, router]);

  const {
    room,
    messages,
    utxos,
    utxoTransactions,
    // Phase 5
    mempoolTransactions,
    nodeConnections,
    loading,
    error,
    sendTransaction,
    updateCoinFile,
    highlightTransaction,
    updatePhase,
    resetPhase,
    approveTransaction,
    rejectTransaction,
    toggleBankDisconnection,
    updateTransferLimit,
    voteOnTransaction,
    forceTransaction,
    generateKeys,
    broadcastPublicKey,
    sendSignedMessage,
    initializeUtxos,
    teacherSendUtxo,
    sendUtxoTransaction,
    // Phase 5
    initializeNetwork,
    createMempoolTransaction,
    toggleNodeDisconnection,
    fillMempool,
    // Phase 6, 7 & 8
    blocks,
    difficultyInfo,
    halvingInfo,
    economicStats,
    createPendingBlock,
    calculateMiningHash,
    submitMinedBlock,
    resetBlockchain,
    toggleMining,
    forceDifficultyAdjustment,
    updateDifficultySettings,
    // Phase 8
    selectTransactionsForBlock,
    forceHalving,
    updateHalvingSettings,
    // Phase 9
    simulationStats,
    startSimulation,
    resetSimulation,
    updateSimulationRole,
    launchChallenge,
    endChallenge,
    createSimulationTransaction,
    mineSimulationBlock,
    fillSimulationMempool,
    accelerateHalvings,
    updateParticipantCoinFile,
    refetch,
  } = useRoomPolling({
    roomId: code || null,
    participantId: participantData?.id ?? null,
    enabled: mounted && !!participantData && !!code,
  });

  // Auto-open student instructions when phase changes
  const roomPhase = room?.currentPhase ?? 0;
  useEffect(() => {
    if (prevPhaseRef.current === -1) {
      prevPhaseRef.current = roomPhase;
      return;
    }
    if (roomPhase !== prevPhaseRef.current) {
      prevPhaseRef.current = roomPhase;
      setShowStudentInstructions(true);
      // Auto-navigate student to the new phase set by teacher
      setStudentViewPhase(null);
    }
  }, [roomPhase]);

  const handleLeaveRoom = async () => {
    if (participantData?.id) {
      await fetch(apiUrl(`/api/participants/${participantData.id}`), {
        method: 'DELETE',
      });
    }
    localStorage.removeItem('bitquest_participant');
    router.push('/');
  };

  if (!mounted || loading) {
    return <LoadingScreen />;
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-amber-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || t('roomNotFound')}</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  const currentParticipant = room.participants?.find(
    (p: Participant) => p.id === participantData?.id
  );
  const isTeacher = participantData?.role === 'teacher';
  const currentPhase = room.currentPhase ?? 0;

  // Parse student balance from coin file
  const studentBalance = (() => {
    if (isTeacher || !currentParticipant?.coinFile) return null;
    try {
      const coinFile = JSON.parse(currentParticipant.coinFile);
      return coinFile?.saldo ?? 10;
    } catch {
      return 10;
    }
  })();

  // The phase the student is viewing (defaults to teacher's current phase)
  const viewPhase = studentViewPhase ?? currentPhase;

  // Render student interface based on viewed phase
  const renderStudentInterface = () => {
    if (viewPhase === 0) {
      return (
        <StudentInterface
          room={room}
          participant={currentParticipant ?? null}
          onSendTransaction={(receiverId, amount) => sendTransaction(receiverId, amount, 0)}
          onUpdateCoinFile={updateCoinFile}
        />
      );
    }

    if (viewPhase === 1) {
      return (
        <Phase1UserInterface
          room={room}
          participant={currentParticipant ?? null}
          onRequestTransaction={(receiverId, amount) => sendTransaction(receiverId, amount, 1)}
        />
      );
    }

    if (viewPhase === 2) {
      return (
        <Phase2UserInterface
          room={room}
          participant={currentParticipant!}
          onProposeTransaction={async (senderId, receiverId, amount, proposedById) => {
            await sendTransaction(receiverId, amount, 2, senderId, proposedById);
          }}
          onVote={voteOnTransaction}
        />
      );
    }

    if (viewPhase === 3) {
      return (
        <div className="space-y-6">
          <Phase3CryptoPanel defaultCollapsed={true} />
          <Phase3UserInterface
            room={room}
            participant={currentParticipant!}
            messages={messages}
            onGenerateKeys={() => {
              const result = generateKeys();
              if (!result) throw new Error('Failed to generate keys');
              return result;
            }}
            onBroadcastKey={broadcastPublicKey}
            onSendMessage={async (content, messageHash, signature) => {
              const result = await sendSignedMessage(content, messageHash, signature);
              if (!result) throw new Error('Failed to send message');
            }}
          />
        </div>
      );
    }

    if (viewPhase === 4) {
      return (
        <div className="space-y-6">
          <Phase4UtxoPanel
            participant={currentParticipant!}
            room={room}
            utxos={utxos}
            utxoTransactions={utxoTransactions}
            defaultCollapsed={true}
          />
          <Phase4UserInterface
            room={room}
            participant={currentParticipant!}
            utxos={utxos}
            utxoTransactions={utxoTransactions}
            onSendTransaction={sendUtxoTransaction}
          />
        </div>
      );
    }

    if (viewPhase === 5) {
      return (
        <Phase5UserInterface
          room={room}
          participant={currentParticipant!}
          mempoolTransactions={mempoolTransactions}
          nodeConnections={nodeConnections}
          onCreateTransaction={createMempoolTransaction}
          onInitializeNetwork={initializeNetwork}
        />
      );
    }

    if (viewPhase === 6 || viewPhase === 7) {
      return (
        <Phase6UserInterface
          room={room}
          participant={currentParticipant!}
          blocks={blocks}
          difficultyInfo={difficultyInfo}
          onCreatePendingBlock={createPendingBlock}
          onCalculateHash={calculateMiningHash}
          onSubmitBlock={submitMinedBlock}
        />
      );
    }

    if (viewPhase === 8) {
      return (
        <Phase8UserInterface
          room={room}
          participant={currentParticipant!}
          blocks={blocks}
          mempoolTransactions={mempoolTransactions}
          difficultyInfo={difficultyInfo}
          halvingInfo={halvingInfo}
          economicStats={economicStats}
          onCreatePendingBlock={createPendingBlock}
          onCalculateHash={calculateMiningHash}
          onSubmitBlock={submitMinedBlock}
          onSelectTransactions={selectTransactionsForBlock}
          onCreateTransaction={createMempoolTransaction}
        />
      );
    }

    if (viewPhase === 9) {
      return (
        <Phase9UserInterface
          room={room}
          participant={currentParticipant!}
          blocks={blocks}
          mempoolTransactions={mempoolTransactions}
          simulationStats={simulationStats}
          onUpdateRole={updateSimulationRole}
          onCreateTransaction={createSimulationTransaction}
          onMineBlock={mineSimulationBlock}
        />
      );
    }

    return (
      <StudentInterface
        room={room}
        participant={currentParticipant ?? null}
        onSendTransaction={(receiverId, amount) => sendTransaction(receiverId, amount, currentPhase)}
        onUpdateCoinFile={updateCoinFile}
      />
    );
  };

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-zinc-950 flex flex-col">
      <Header
        room={room}
        isTeacher={isTeacher}
        studentBalance={studentBalance}
        onLeave={handleLeaveRoom}
        onToggleNavigation={() => setShowNavigation(!showNavigation)}
        onToggleInstructions={isTeacher
          ? () => setShowInstructions(!showInstructions)
          : () => setShowStudentInstructions(!showStudentInstructions)
        }
        onResetPhase={isTeacher ? async () => { await resetPhase(); } : undefined}
        onAdvancePhase={isTeacher ? () => {
          const nextPhase = (room.currentPhase ?? 0) + 1;
          console.log('[advancePhase] current:', room.currentPhase, 'next:', nextPhase);
          if (nextPhase <= 9) updatePhase(nextPhase, nextPhase);
        } : undefined}
      />

      <PhaseNavigation
        room={room}
        isTeacher={isTeacher}
        isOpen={showNavigation}
        onClose={() => setShowNavigation(false)}
        onUnlockPhase={(phase) => updatePhase(undefined, phase)}
        onGoToPhase={(phase) => updatePhase(phase)}
        onStudentViewPhase={!isTeacher ? (phase) => {
          setStudentViewPhase(phase === currentPhase ? null : phase);
        } : undefined}
        studentViewPhase={viewPhase}
      />

      <InstructionsPanel
        currentPhase={room.currentPhase ?? 0}
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />

      {!isTeacher && (
        <StudentPhaseDropdown
          currentPhase={viewPhase}
          isOpen={showStudentInstructions}
          onClose={() => setShowStudentInstructions(false)}
        />
      )}

      {/* "Back to current phase" banner when student is viewing a past phase */}
      {!isTeacher && studentViewPhase !== null && (
        <div className="max-w-7xl mx-auto px-4 pt-3 w-full">
          <button
            onClick={() => setStudentViewPhase(null)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
          >
            ← {t('backToCurrentPhase')} ({t(`phase${currentPhase}`)})
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        {isTeacher ? (
          <TeacherDashboard
            room={room}
            messages={messages}
            utxos={utxos}
            utxoTransactions={utxoTransactions}
            mempoolTransactions={mempoolTransactions}
            nodeConnections={nodeConnections}
            blocks={blocks}
            difficultyInfo={difficultyInfo}
            halvingInfo={halvingInfo}
            economicStats={economicStats}
            onHighlightTransaction={highlightTransaction}
            onToggleBankDisconnection={toggleBankDisconnection}
            onUpdateTransferLimit={updateTransferLimit}
            onApproveTransaction={approveTransaction}
            onRejectTransaction={rejectTransaction}
            onForceTransaction={forceTransaction}
            onVote={voteOnTransaction}
            participant={currentParticipant}
            onGenerateKeys={() => {
              const result = generateKeys();
              if (!result) throw new Error('Failed to generate keys');
              return result;
            }}
            onBroadcastKey={broadcastPublicKey}
            onSendSignedMessage={async (content, messageHash, signature) => {
              const result = await sendSignedMessage(content, messageHash, signature);
              if (!result) throw new Error('Failed to send message');
            }}
            onToggleNodeDisconnection={toggleNodeDisconnection}
            onFillMempool={fillMempool}
            onInitializeNetwork={initializeNetwork}
            onCreatePendingBlock={createPendingBlock}
            onResetBlockchain={resetBlockchain}
            onToggleMining={toggleMining}
            onForceDifficultyAdjustment={forceDifficultyAdjustment}
            onUpdateDifficultySettings={updateDifficultySettings}
            onForceHalving={forceHalving}
            onUpdateHalvingSettings={updateHalvingSettings}
            // Phase 9
            simulationStats={simulationStats}
            onStartSimulation={startSimulation}
            onResetSimulation={resetSimulation}
            onLaunchChallenge={launchChallenge}
            onEndChallenge={endChallenge}
            onFillSimulationMempool={fillSimulationMempool}
            onAccelerateHalvings={accelerateHalvings}
            onUpdateParticipantBalance={updateParticipantCoinFile}
            onTeacherSendUtxo={teacherSendUtxo}
            onProposeTransaction={async (senderId, receiverId, amount, proposedById) => {
              await sendTransaction(receiverId, amount, 2, senderId, proposedById);
            }}
          />
        ) : (
          renderStudentInterface()
        )}
      </main>

      <VersionFooter />
    </div>
  );
}
