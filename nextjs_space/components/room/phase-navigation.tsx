'use client';

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Clock, Lock, Unlock, ArrowRight } from 'lucide-react';
import { Room, PhaseInfo } from '@/lib/types';

interface PhaseNavigationProps {
  room: Room;
  isTeacher: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUnlockPhase: (phase: number) => void;
  onGoToPhase: (phase: number) => void;
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
            className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{t('phases')}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className={`p-3 rounded-xl transition-all ${
                    phase.status === 'current'
                      ? 'bg-amber-50 border-2 border-amber-300'
                      : phase.status === 'completed'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        phase.status === 'current'
                          ? 'bg-amber-500 text-white'
                          : phase.status === 'completed'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-500'
                      }`}>
                        {phase.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                        {phase.status === 'current' && <Clock className="w-4 h-4" />}
                        {phase.status === 'locked' && <Lock className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Fase {phase.id}</p>
                        <p className="text-sm text-gray-600">{phase.name}</p>
                      </div>
                    </div>

                    {isTeacher && phase.status === 'locked' && (
                      <button
                        onClick={() => onUnlockPhase(phase.id)}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors"
                        title={t('unlockPhase')}
                      >
                        <Unlock className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {(phase.status !== 'locked' || isTeacher) && phase.status !== 'current' && (
                    <button
                      onClick={() => onGoToPhase(phase.id)}
                      disabled={phase.status === 'locked' && !isTeacher}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 rounded-lg text-sm text-gray-600 transition-colors disabled:opacity-50"
                    >
                      {isTeacher ? t('forceNavigation') : t('goToPhase')}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
