import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getStoredSession, getAuthToken } from '../services/auth';
import { auth, db } from '../services/firebase';
import { publicationsApi } from '../services/api';
import { getReviewsByPost, Review } from '../services/reviews';
import { env } from '../config/env';
import { getMyCalendar, CalendarEvent } from '../services/calendar';

interface ProfileData {
  uid?: string;
  nombre?: string;
  bio?: string;
  fotoUrl?: string;
  ciudad?: string;
  region?: string;
}

export function useProfile(initialUserId?: string) {
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(initialUserId ?? null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(!initialUserId);
  const [viewerUid, setViewerUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [reviewsByPost, setReviewsByPost] = useState<Record<string, Review[]>>({});
  const [loadingReviews, setLoadingReviews] = useState<string | null>(null);

  useEffect(() => {
    if (initialUserId) {
      setResolvedUserId(initialUserId);
      setInitializing(false);
      return;
    }
    let active = true;
    (async () => {
      setInitializing(true);
      try {
        const session = await getStoredSession();
        if (!active) return;
        const storedUid = session?.user?.uid || auth.currentUser?.uid;
        if (storedUid) {
          setResolvedUserId(storedUid);
          setViewerUid(storedUid);
        } else {
          setError('Debes iniciar sesión para ver el perfil.');
        }
      } catch (err: any) {
        if (active) setError(err?.message || 'No se pudo determinar el usuario.');
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialUserId]);

  useEffect(() => {
    if (viewerUid) return;
    (async () => {
      try {
        const session = await getStoredSession();
        if (session?.user?.uid) setViewerUid(session.user.uid);
      } catch {}
    })();
  }, [viewerUid]);

  const isOwnProfile = useMemo(() => {
    if (!resolvedUserId || !viewerUid) return !initialUserId;
    return resolvedUserId === viewerUid;
  }, [resolvedUserId, viewerUid, initialUserId]);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      if (!resolvedUserId) {
        setError('Debes iniciar sesión para ver el perfil.');
        return;
      }

      const res = await fetch(`${env.apiUrl}/api/users/${resolvedUserId}`);

      // Si no existe el doc y es tu propio perfil, intenta crearlo vía /me
      if (res.status === 404 && isOwnProfile) {
        const token = await getAuthToken();
        if (token) {
          await fetch(`${env.apiUrl}/api/users/me`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          // Reintenta el GET
          const retry = await fetch(`${env.apiUrl}/api/users/${resolvedUserId}`);
          if (!retry.ok) throw new Error(`Error ${retry.status}`);
          const dataRetry = await retry.json();
          setProfile(dataRetry);
          return;
        }
      }

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el perfil.');
    } finally {
      setLoadingProfile(false);
    }
  }, [resolvedUserId, isOwnProfile]);

  const fetchPosts = useCallback(async () => {
    if (!resolvedUserId) return;
    setLoadingPosts(true);
    try {
      const all = await publicationsApi.list();
      const mine = (all || []).filter(
        (p: any) => p.creatorId === resolvedUserId || p.authorUid === resolvedUserId
      );
      setPosts(mine);
    } catch (err) {
      console.warn('[profile] error fetching posts', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [resolvedUserId]);

  const loadReviewsForPost = useCallback(async (postId: string) => {
    if (!postId || loadingReviews === postId) return;
    setLoadingReviews(postId);
    try {
      const data = await getReviewsByPost(postId);
      setReviewsByPost((prev) => ({ ...prev, [postId]: data || [] }));
    } catch (err) {
      console.warn('[profile] no se pudieron cargar reseñas', err);
    } finally {
      setLoadingReviews(null);
    }
  }, [loadingReviews]);

  const fetchCalendar = useCallback(async () => {
    if (!isOwnProfile) return;
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const events = await getMyCalendar();

      // Marcar eventos finalizados si existe al menos un resumen de sesion en la misma conversacion
      const fetchCompletionStatuses = async (items: CalendarEvent[]) => {
        const convos = Array.from(
          new Set(
            (items || [])
              .map((e) => e.conversationId)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (!convos.length) return {} as Record<string, boolean>;

        const map: Record<string, boolean> = {};
        // Firestore admite hasta 10 elementos en un "in"
        for (let i = 0; i < convos.length; i += 10) {
          const chunk = convos.slice(i, i + 10);
          const q = query(collection(db, 'sessionSummaries'), where('conversationId', 'in', chunk));
          const snap = await getDocs(q);
          snap.forEach((doc) => {
            const convoId = (doc.data() as any)?.conversationId;
            if (convoId) map[convoId] = true;
          });
        }
        return map;
      };

      let eventsWithStatus: CalendarEvent[] = events || [];
      try {
        const completionMap = await fetchCompletionStatuses(eventsWithStatus);
        eventsWithStatus = eventsWithStatus.map((ev) => ({
          ...ev,
          status: completionMap[ev.conversationId || ''] ? 'completed' : ev.status,
        }));
      } catch (err) {
        console.warn('[profile] no se pudo marcar eventos finalizados', err);
      }

      setCalendarEvents(eventsWithStatus || []);
    } catch (err: any) {
      setCalendarError(err?.message || 'No se pudieron obtener los eventos.');
    } finally {
      setLoadingCalendar(false);
    }
  }, [isOwnProfile]);

  useEffect(() => {
    if (!initializing) {
      fetchProfile();
      fetchPosts();
      if (isOwnProfile) {
        fetchCalendar();
      }
    }
  }, [fetchProfile, fetchPosts, fetchCalendar, initializing, isOwnProfile]);

  return {
    profile,
    loadingProfile,
    posts,
    loadingPosts,
    initializing,
    calendarEvents,
    loadingCalendar,
    calendarError,
    isOwnProfile,
    error,
    reload: () => {
      fetchProfile();
      fetchPosts();
      if (isOwnProfile) fetchCalendar();
    },
    reviewsByPost,
    loadReviewsForPost,
    loadingReviews,
    viewerUid,
  };
}

