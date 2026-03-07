'use client';

import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl shadow-lg mb-4"
        >
          <Coins className="w-8 h-8 text-white" />
        </motion.div>
        <p className="text-gray-600">{t('loading')}</p>
      </motion.div>
    </div>
  );
}
