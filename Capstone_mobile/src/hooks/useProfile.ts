import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredSession } from '../services/auth';
import { auth } from '../services/firebase';
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
    if (!resolvedUserId) return;
    setLoadingProfile(true);
    try {
      const res = await fetch(`${env.apiUrl}/api/users/${resolvedUserId}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el perfil.');
    } finally {
      setLoadingProfile(false);
    }
  }, [resolvedUserId]);

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
      setCalendarEvents(events || []);
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

