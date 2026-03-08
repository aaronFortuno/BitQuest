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
    sendSignedMessage,
    verifyMessage,
    sendFakeMessage,
    initializeUtxos,
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

  // Render student interface based on current phase
  const renderStudentInterface = () => {
    if (currentPhase === 0) {
      return (
        <StudentInterface
          room={room}
          participant={currentParticipant ?? null}
          onSendTransaction={(receiverId, amount) => sendTransaction(receiverId, amount, 0)}
          onUpdateCoinFile={updateCoinFile}
        />
      );
    }

    if (currentPhase === 1) {
      return (
        <Phase1UserInterface
          room={room}
          participant={currentParticipant ?? null}
          onRequestTransaction={(receiverId, amount) => sendTransaction(receiverId, amount, 1)}
        />
      );
    }

    if (currentPhase === 2) {
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

    if (currentPhase === 3) {
      return (
        <Phase3UserInterface
          room={room}
          participant={currentParticipant!}
          messages={messages}
          onGenerateKeys={async () => {
            const result = await generateKeys();
            if (result) {
              return result;
            }
            throw new Error('Failed to generate keys');
          }}
          onSendMessage={async (content) => {
            const result = await sendSignedMessage(content);
            if (!result) {
              throw new Error('Failed to send message');
            }
          }}
          onVerifyMessage={verifyMessage}
        />
      );
    }

    if (currentPhase === 4) {
      return (
        <Phase4UserInterface
          room={room}
          participant={currentParticipant!}
          utxos={utxos}
          utxoTransactions={utxoTransactions}
          onInitializeUtxos={initializeUtxos}
          onSendTransaction={sendUtxoTransaction}
        />
      );
    }

    if (currentPhase === 5) {
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

    if (currentPhase === 6 || currentPhase === 7) {
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

    if (currentPhase === 8) {
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

    if (currentPhase === 9) {
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
      />

      <InstructionsPanel
        currentPhase={room.currentPhase ?? 0}
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />

      {!isTeacher && (
        <StudentPhaseDropdown
          currentPhase={currentPhase}
          isOpen={showStudentInstructions}
          onClose={() => setShowStudentInstructions(false)}
        />
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
            onSendFakeMessage={sendFakeMessage}
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
          />
        ) : (
          renderStudentInterface()
        )}
      </main>

      <VersionFooter />
    </div>
  );
}
