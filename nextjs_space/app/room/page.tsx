'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Participant } from '@/lib/types';
import { RoomProvider, useRoom } from '@/contexts/room-context';
import Header from '@/components/room/header';
import PhaseNavigation from '@/components/room/phase-navigation';
import StudentInterface from '@/components/room/student-interface';
import TeacherDashboard from '@/components/room/teacher';
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
import { Phase7UserInterface } from '@/components/room/phase7-user-interface';
import { Phase8UserInterface } from '@/components/room/phase8-user-interface';
import Phase9UserInterface from '@/components/room/phase9-user-interface';
import LoadingScreen from '@/components/ui/loading-screen';
import VersionFooter from '@/components/ui/version-footer';

export default function RoomPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code') || '';

  const [participantData, setParticipantData] = useState<{
    id: string;
    name: string;
    role: 'teacher' | 'student';
  } | null>(null);
  const [mounted, setMounted] = useState(false);

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

  if (!mounted || !participantData || !code) {
    return <LoadingScreen />;
  }

  return (
    <RoomProvider
      roomCode={code}
      participantId={participantData.id}
      participantRole={participantData.role}
    >
      <RoomContent participantData={participantData} />
    </RoomProvider>
  );
}

function RoomContent({ participantData }: { participantData: { id: string; name: string; role: 'teacher' | 'student' } }) {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    room,
    loading,
    error,
    isTeacher,
    participant: currentParticipant,
    messages,
    utxos,
    utxoTransactions,
    mempoolTransactions,
    nodeConnections,
    blocks,
    difficultyInfo,
    halvingInfo,
    economicStats,
    miningPools,
    poolsEnabled,
    autoMineSettings,
    simulationStats,
    phase9Addresses,
    phase9Utxos,
    phase9MempoolTxs,
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
    initializeNetwork,
    createMempoolTransaction,
    toggleNodeDisconnection,
    fillMempool,
    createTeacherTransaction,
    destroyConnection,
    toggleStudentSending,
    createPendingBlock,
    createGenesisBlock,
    calculateMiningHash,
    submitMinedBlock,
    resetBlockchain,
    toggleMining,
    forceDifficultyAdjustment,
    updateDifficultySettings,
    updateRigSettings,
    batchHashUpdate,
    upgradeRig,
    createPool,
    joinPool,
    leavePool,
    deletePool,
    togglePools,
    selectTransactionsForBlock,
    forceHalving,
    updateHalvingSettings,
    autoMineTick,
    updatePhase8Settings,
    initPhase9,
    resetPhase9,
    fundAllPhase9Nodes,
    generateAddress,
    createPhase9Transaction,
    autoMineTickPhase9,
    updatePhase9Settings,
    updateParticipantCoinFile,
  } = useRoom();

  const [showNavigation, setShowNavigation] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showStudentInstructions, setShowStudentInstructions] = useState(true);
  const [studentViewPhase, setStudentViewPhase] = useState<number | null>(null);
  const prevPhaseRef = useRef<number>(-1);

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

  const currentPhase = room?.currentPhase ?? 0;
  const viewPhase = studentViewPhase ?? currentPhase;

  const handleLeaveRoom = async () => {
    if (participantData?.id) {
      await fetch(apiUrl(`/api/participants/${participantData.id}`), {
        method: 'DELETE',
      });
    }
    localStorage.removeItem('bitquest_participant');
    router.push('/');
  };

  if (loading) {
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

  // Render student interface based on viewed phase
  const renderStudentInterface = () => {
    if (viewPhase === 0) {
      return (
        <StudentInterface />
      );
    }

    if (viewPhase === 1) {
      return (
        <Phase1UserInterface />
      );
    }

    if (viewPhase === 2) {
      return (
        <Phase2UserInterface />
      );
    }

    if (viewPhase === 3) {
      return (
        <div className="space-y-6">
          <Phase3CryptoPanel defaultCollapsed={true} />
          <Phase3UserInterface />
        </div>
      );
    }

    if (viewPhase === 4) {
      return (
        <div className="space-y-6">
          <Phase4UtxoPanel
            defaultCollapsed={true}
          />
          <Phase4UserInterface />
        </div>
      );
    }

    if (viewPhase === 5) {
      return (
        <Phase5UserInterface />
      );
    }

    if (viewPhase === 6) {
      return (
        <Phase6UserInterface />
      );
    }

    if (viewPhase === 7) {
      return (
        <Phase7UserInterface />
      );
    }

    if (viewPhase === 8) {
      return (
        <Phase8UserInterface />
      );
    }

    if (viewPhase === 9) {
      return (
        <Phase9UserInterface />
      );
    }

    return (
      <StudentInterface />
    );
  };

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-zinc-950 flex flex-col">
      <Header
        room={room}
        isTeacher={isTeacher}
        studentBalance={studentBalance}
        currentPhase={currentPhase}
        miningReward={currentParticipant?.totalMiningReward || 0}
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
          <TeacherDashboard />
        ) : (
          renderStudentInterface()
        )}
      </main>

      <VersionFooter />
    </div>
  );
}
