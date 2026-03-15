'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCommit } from 'lucide-react';
import changelog from '@/lib/changelog.json';

const VERSION = changelog[0]?.version ?? 'v0.0.0';

type LangChanges = { ca: string[]; es: string[]; en: string[] };

export default function VersionFooter() {
  const { t, i18n } = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);

  const getCurrentLangChanges = (changes: LangChanges) => {
    const lang = i18n.language as keyof LangChanges;
    return changes[lang] || changes.ca;
  };

  return (
    <>
      <footer className="py-4 text-center">
        <button
          onClick={() => setShowChangelog(true)}
          className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        >
          BitQuest {VERSION}
        </button>
      </footer>

      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('changelog')}</h2>
                </div>
                <button
                  onClick={() => setShowChangelog(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
                {changelog.map((release) => (
                  <div key={release.version}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded text-sm font-mono font-medium">
                        {release.version}
                      </span>
                      <span className="text-xs text-gray-400">{release.date}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                      {getCurrentLangChanges(release.changes).map((change, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">&bull;</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
