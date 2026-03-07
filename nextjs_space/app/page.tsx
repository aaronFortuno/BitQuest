'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Coins, Users, GraduationCap, ArrowRight, HelpCircle } from 'lucide-react';
import { formatRoomCode, validateRoomCode } from '@/lib/room-utils';
import { apiUrl } from '@/lib/api';
import HelpModal from '@/components/ui/help-modal';
import VersionFooter from '@/components/ui/version-footer';
import LanguageSelector from '@/components/ui/language-selector';
import ThemeToggle from '@/components/ui/theme-toggle';

export default function LandingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherName: name.trim() }),
      });

      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();

      localStorage.setItem('bitquest_participant', JSON.stringify({
        id: data.participantId,
        name: name.trim(),
        role: 'teacher',
        roomCode: data.room?.code,
      }));

      router.push(`/room?code=${data.room?.code}`);
    } catch (err) {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }

    const formattedCode = formatRoomCode(roomCode);
    if (!validateRoomCode(formattedCode)) {
      setError(t('invalidCode'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/rooms/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formattedCode, studentName: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join room');
      }

      const data = await res.json();

      localStorage.setItem('bitquest_participant', JSON.stringify({
        id: data.participantId,
        name: name.trim(),
        role: 'student',
        roomCode: formattedCode,
      }));

      router.push(`/room?code=${formattedCode}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('connectionError');
      setError(errorMessage === 'Room not found' ? t('roomNotFound') : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomCodeChange = (value: string) => {
    const formatted = formatRoomCode(value);
    setRoomCode(formatted);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-zinc-950 dark:to-zinc-900 flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-end items-center gap-2 p-4">
        <ThemeToggle />
        <LanguageSelector />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-amber-500 rounded-2xl shadow-lg mb-4"
            >
              <Coins className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">{t('appName')}</h1>
            <p className="text-gray-600 dark:text-zinc-400 mt-2">{t('subtitle')}</p>
          </div>

        {/* Main Card */}
        <div className="card">
          {mode === 'select' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-center text-gray-600 dark:text-zinc-400 mb-6">{t('welcomeSubtitle')}</p>
              
              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 dark:text-zinc-100">{t('createRoom')}</p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">{t('teacher')}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 dark:text-zinc-100">{t('joinRoom')}</p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">{t('student')}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-violet-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {mode === 'create' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl font-semibold dark:text-zinc-100">{t('createRoom')}</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  {t('enterYourName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="input-field"
                  maxLength={30}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setMode('select'); setError(''); }}
                  className="btn-outline flex-1"
                >
                  {t('back')}
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? t('loading') : t('create')}
                </button>
              </div>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-violet-500" />
                <h2 className="text-xl font-semibold dark:text-zinc-100">{t('joinRoom')}</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  {t('enterYourName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="input-field"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  {t('enterRoomCode')}
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => handleRoomCodeChange(e.target.value)}
                  placeholder={t('roomCodePlaceholder')}
                  className="input-field text-center text-2xl font-mono tracking-widest uppercase"
                  maxLength={7}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setMode('select'); setError(''); }}
                  className="btn-outline flex-1"
                >
                  {t('back')}
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="btn-secondary flex-1"
                >
                  {loading ? t('loading') : t('join')}
                </button>
              </div>
            </motion.div>
          )}
        </div>

          {/* Help Link */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 text-sm"
            >
              <HelpCircle className="w-4 h-4" />
              {t('help')}
            </button>
          </div>

          <VersionFooter />
        </motion.div>
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
