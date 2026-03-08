'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, Coins, Users, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-heading">{t('help')}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-heading">Què és BitQuest?</p>
                  <p className="text-sm text-secondary">Un simulador educatiu per aprendre com funciona Bitcoin de forma pràctica i progressiva.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
                <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-heading">Com començar?</p>
                  <p className="text-sm text-secondary">El professor crea una sala i comparteix el codi amb els participants per unir-se.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-500/10 rounded-xl">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-heading">Fases progressives</p>
                  <p className="text-sm text-secondary">Començareu pel problema del doble pagament i anireu descobrint les solucions pas a pas.</p>
                </div>
              </div>

              <p className="text-xs text-faint text-center pt-2">
                Dissenyat per a estudiants de cicle superior de primària fins a batxillerat.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
