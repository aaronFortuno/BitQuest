'use client';

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Clock, Lock, LogIn } from 'lucide-react';
import { Room, PhaseInfo } from '@/lib/types';

interface PhaseNavigationProps {
  room: Room;
  isTeacher: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUnlockPhase: (phase: number) => void;
  onGoToPhase: (phase: number) => void;
  onStudentViewPhase?: (phase: number) => void;
  studentViewPhase?: number;
}

const PHASE_NAMES = [
  'phase0', 'phase1', 'phase2', 'phase3', 'phase4',
  'phase5', 'phase6', 'phase7', 'phase8', 'phase9'
];

export default function PhaseNavigation({
  room,
  isTeacher,
  isOpen,
  onClose,
  onUnlockPhase,
  onGoToPhase,
  onStudentViewPhase,
  studentViewPhase,
}: PhaseNavigationProps) {
  const { t } = useTranslation();

  const getPhaseStatus = (phaseNum: number): 'completed' | 'current' | 'locked' => {
    const currentPhase = room?.currentPhase ?? 0;
    const unlockedPhases = room?.unlockedPhases ?? [0];

    if (phaseNum < currentPhase) return 'completed';
    if (phaseNum === currentPhase) return 'current';
    if (unlockedPhases.includes(phaseNum)) return 'completed';
    return 'locked';
  };

  const phases: PhaseInfo[] = PHASE_NAMES.map((name, index) => ({
    id: index,
    name: t(name),
    status: getPhaseStatus(index),
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">{t('phases')}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
              </button>
            </div>

            <div className="p-3 space-y-1">
              {phases.map((phase) => {
                const isCurrent = phase.status === 'current';
                const isCompleted = phase.status === 'completed';
                const isLocked = phase.status === 'locked';

                return (
                  <div
                    key={phase.id}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30'
                        : isCompleted
                        ? 'bg-green-50/50 dark:bg-green-500/5 border border-transparent'
                        : 'bg-gray-50 dark:bg-zinc-800/50 border border-transparent'
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isCurrent
                        ? 'bg-amber-500 text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 dark:bg-zinc-600 text-gray-500 dark:text-zinc-400'
                    }`}>
                      {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5" />}
                      {isLocked && <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Phase name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-amber-800 dark:text-amber-400' :
                        isCompleted ? 'text-gray-700 dark:text-zinc-300' :
                        'text-gray-400 dark:text-zinc-500'
                      }`}>
                        {phase.id}. {phase.name}
                      </p>
                    </div>

                    {/* Action button (teacher): go-to / unlock */}
                    {isTeacher && !isCurrent && (
                      <button
                        onClick={() => {
                          if (isLocked) {
                            onUnlockPhase(phase.id);
                          }
                          onGoToPhase(phase.id);
                          onClose();
                        }}
                        className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0 group"
                        title={isLocked ? t('unlockPhase') : t('goToPhase')}
                      >
                        <LogIn className={`w-4 h-4 transition-colors ${
                          isLocked
                            ? 'text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300'
                            : 'text-gray-400 dark:text-zinc-500 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                        }`} />
                      </button>
                    )}

                    {/* Action button (student): navigate to previous phases */}
                    {!isTeacher && onStudentViewPhase && (isCompleted || isCurrent) && (
                      <button
                        onClick={() => {
                          onStudentViewPhase(phase.id);
                          onClose();
                        }}
                        className={`p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0 group ${
                          studentViewPhase === phase.id ? 'bg-amber-100 dark:bg-amber-500/20' : ''
                        }`}
                        title={t('goToPhase')}
                      >
                        <LogIn className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
