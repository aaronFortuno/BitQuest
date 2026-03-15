'use client';

import { useTranslation } from 'react-i18next';
import { useRoom } from '@/contexts/room-context';
import Phase5TeacherPanel from '@/components/room/phase5-teacher-panel';

export default function TeacherPhase5Controls() {
  const { t } = useTranslation();
  const {
    room,
    mempoolTransactions,
    nodeConnections,
    initializeNetwork,
    toggleNodeDisconnection,
    createTeacherTransaction,
    destroyConnection,
    toggleStudentSending,
  } = useRoom();

  if (!room) return null;

  const students = (room.participants ?? []).filter(p => p.role === 'student' && p.isActive);

  return (
    <Phase5TeacherPanel
      room={room}
      students={students}
      mempoolTransactions={mempoolTransactions ?? []}
      nodeConnections={nodeConnections ?? []}
      onInitializeNetwork={initializeNetwork}
      onToggleNodeDisconnection={toggleNodeDisconnection}
      onCreateTeacherTransaction={createTeacherTransaction}
      onDestroyConnection={destroyConnection}
      onToggleStudentSending={toggleStudentSending}
      t={t}
    />
  );
}
