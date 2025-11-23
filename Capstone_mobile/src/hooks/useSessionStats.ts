import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/src/services/firebase';

export interface SessionStats {
  totalSessions: number;
  averageRating: number;
  totalMinutes: number;
  averageDifficulty: number;
  asTeacher: number;
  asStudent: number;
}

export function useSessionStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<SessionStats>({
    totalSessions: 0,
    averageRating: 0,
    totalMinutes: 0,
    averageDifficulty: 0,
    asTeacher: 0,
    asStudent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[STATS] Hook ejecutándose con userId:', userId);
    
    // Resetear estado cuando cambia el userId
    setStats({
      totalSessions: 0,
      averageRating: 0,
      totalMinutes: 0,
      averageDifficulty: 0,
      asTeacher: 0,
      asStudent: 0,
    });
    
    if (!userId) {
      console.log('[STATS] No hay userId, saliendo');
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoading(true);
        console.log('[STATS] Buscando sesiones para userId:', userId);

        // Obtener sesiones como maestro
        const teacherQuery = query(
          collection(db, 'sessionSummaries'),
          where('teacher', '==', userId)
        );
        const teacherSnap = await getDocs(teacherQuery);
        console.log('[STATS] Sesiones como maestro:', teacherSnap.size);

        // Obtener sesiones como estudiante
        const studentQuery = query(
          collection(db, 'sessionSummaries'),
          where('student', '==', userId)
        );
        const studentSnap = await getDocs(studentQuery);
        console.log('[STATS] Sesiones como estudiante:', studentSnap.size);

        if (!active) return;

        // Solo usar sesiones donde fui maestro (otros me evaluaron)
        const teacherSessions = teacherSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[STATS] Sesiones como maestro:', teacherSessions.length);
        console.log('[STATS] Sesiones:', teacherSessions.map(s => ({ teacher: s.teacher, student: s.student, rating: s.rating })));

        if (teacherSessions.length === 0) {
          setStats({
            totalSessions: 0,
            averageRating: 0,
            totalMinutes: 0,
            averageDifficulty: 0,
            asTeacher: 0,
            asStudent: 0,
          });
          return;
        }

        let totalRating = 0;
        let totalMinutes = 0;
        let totalDifficulty = 0;
        let ratingCount = 0;
        let difficultyCount = 0;

        teacherSessions.forEach((session: any) => {
          if (session.rating && session.rating > 0) {
            totalRating += session.rating;
            ratingCount++;
          }
          if (session.duracionMinutos) {
            totalMinutes += session.duracionMinutos;
          }
          if (session.dificultad && session.dificultad > 0) {
            totalDifficulty += session.dificultad;
            difficultyCount++;
          }
        });

        setStats({
          totalSessions: teacherSessions.length,
          averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
          totalMinutes,
          averageDifficulty: difficultyCount > 0 ? totalDifficulty / difficultyCount : 0,
          asTeacher: teacherSnap.size,
          asStudent: studentSnap.size,
        });
      } catch (err) {
        console.error('[STATS] Error completo:', err);
        console.error('[STATS] Error message:', err?.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  return { stats, loading };
}
