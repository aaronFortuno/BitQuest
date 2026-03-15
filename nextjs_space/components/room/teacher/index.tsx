'use client';

import { useRoom } from '@/contexts/room-context';
import TeacherPhase0Controls from './teacher-phase0-controls';
import TeacherPhase1Controls from './teacher-phase1-controls';
import TeacherPhase2Controls from './teacher-phase2-controls';
import TeacherPhase3Controls from './teacher-phase3-controls';
import TeacherPhase4Controls from './teacher-phase4-controls';
import TeacherPhase5Controls from './teacher-phase5-controls';
import TeacherPhase6Controls from './teacher-phase6-controls';
import TeacherPhase7Controls from './teacher-phase7-controls';
import TeacherPhase8Controls from './teacher-phase8-controls';
import TeacherPhase9Controls from './teacher-phase9-controls';

export default function TeacherDashboard() {
  const { room } = useRoom();
  const currentPhase = room?.currentPhase ?? 0;

  return (
    <div className="space-y-6">
      {currentPhase === 0 && <TeacherPhase0Controls />}
      {currentPhase === 1 && <TeacherPhase1Controls />}
      {currentPhase === 2 && <TeacherPhase2Controls />}
      {currentPhase === 3 && <TeacherPhase3Controls />}
      {currentPhase === 4 && <TeacherPhase4Controls />}
      {currentPhase === 5 && <TeacherPhase5Controls />}
      {currentPhase === 6 && <TeacherPhase6Controls />}
      {currentPhase === 7 && <TeacherPhase7Controls />}
      {currentPhase === 8 && <TeacherPhase8Controls />}
      {currentPhase === 9 && <TeacherPhase9Controls />}
    </div>
  );
}
