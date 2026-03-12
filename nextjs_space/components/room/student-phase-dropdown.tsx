'use client';

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

interface StudentPhaseDropdownProps {
  currentPhase: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentPhaseDropdown({ currentPhase, isOpen, onClose }: StudentPhaseDropdownProps) {
  const { t } = useTranslation();

  const phaseConfigs: Record<number, { key: string; activityCount: number }> = {
    0: { key: 'phase0Student', activityCount: 4 },
    1: { key: 'phase1Student', activityCount: 4 },
    2: { key: 'phase2Student', activityCount: 4 },
    3: { key: 'phase3Student', activityCount: 4 },
    4: { key: 'phase4Student', activityCount: 4 },
    5: { key: 'phase5Student', activityCount: 4 },
    6: { key: 'phase6Student', activityCount: 4 },
    7: { key: 'phase7Student', activityCount: 4 },
    8: { key: 'phase8Student', activityCount: 3 },
    9: { key: 'phase9Student', activityCount: 5 },
  };

  const config = phaseConfigs[currentPhase];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden bg-blue-50/80 dark:bg-blue-500/5 border-b border-blue-100 dark:border-blue-500/10 backdrop-blur-sm"
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-zinc-300">
              {config ? (
                <>
                  <p className="font-medium text-gray-800 dark:text-zinc-100 mb-2">
                    {t(`${config.key}Title`)}
                  </p>
                  <p className="text-sm mb-2">
                    {t(`${config.key}Desc`)}
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
                    {Array.from({ length: config.activityCount }, (_, i) => (
                      <li key={i}>{t(`${config.key}Activity${i + 1}`)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm">{t('phaseInstructionsComingSoon')}</p>
              )}
            </div>

            <div className="flex justify-center mt-3">
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
              >
                <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
