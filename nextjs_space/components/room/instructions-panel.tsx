'use client';

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface InstructionsPanelProps {
  currentPhase: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionsPanel({ currentPhase, isOpen, onClose }: InstructionsPanelProps) {
  const { t } = useTranslation();

  const renderPhaseInstructions = () => {
    const phaseConfigs: Record<number, { titleKey: string; activityCount: number }> = {
      0: { titleKey: 'phase0', activityCount: 4 },
      1: { titleKey: 'phase1', activityCount: 4 },
      2: { titleKey: 'phase2', activityCount: 4 },
      3: { titleKey: 'phase3', activityCount: 4 },
      4: { titleKey: 'phase4', activityCount: 4 },
      5: { titleKey: 'phase5', activityCount: 4 },
      6: { titleKey: 'phase6', activityCount: 4 },
      7: { titleKey: 'phase7', activityCount: 4 },
      8: { titleKey: 'phase8', activityCount: 3 },
      9: { titleKey: 'phase9', activityCount: 5 },
    };

    const config = phaseConfigs[currentPhase];
    if (!config) {
      return (
        <>
          <h3 className="font-semibold text-gray-800 dark:text-zinc-100 mb-3">Fase {currentPhase}</h3>
          <div className="prose prose-sm max-w-none text-gray-600 dark:text-zinc-400">
            <p>{t('phaseInstructionsComingSoon')}</p>
          </div>
        </>
      );
    }

    const { titleKey, activityCount } = config;
    return (
      <>
        <h3 className="font-semibold text-gray-800 dark:text-zinc-100 mb-3">{t(`${titleKey}InstructionTitle`)}</h3>
        <div className="prose prose-sm max-w-none text-gray-600 dark:text-zinc-400">
          <p>
            {t(`${titleKey}Instruction1`)} {t(`${titleKey}Instruction2`)}
          </p>
          <p className="mt-2">
            <strong className="text-gray-800 dark:text-zinc-200">{t(`${titleKey}Activities`)}</strong>
          </p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {Array.from({ length: activityCount }, (_, i) => (
              <li key={i}>{t(`${titleKey}Activity${i + 1}`)}</li>
            ))}
          </ul>
        </div>
      </>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">{t('instructions')}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
              </button>
            </div>

            <div className="p-4">
              {renderPhaseInstructions()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
