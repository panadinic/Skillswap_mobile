import { env } from '../config/env';
import { getAuthToken, getStoredSession } from './auth';
import { auth } from './firebase';

const API_BASE = env.apiUrl;

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken(true);
  if (!token) throw new Error('Debes iniciar sesion nuevamente.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Error ${response.status}`);
  }
  return data as T;
}

export function createCalendarEventFromSchedule(payload: {
  conversationId: string;
  proposalMessageId: string;
}) {
  return authRequest('/api/calendar/events/from-schedule', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface CalendarEvent {
  id: string;
  conversationId?: string;
  matchId?: string;
  title?: string;
  status?: string;
  partner?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
  eventAt?: string;
  startAt?: any;
  other?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
}

export function getMyCalendar() {
  return authRequest<CalendarEvent[]>('/api/calendar/events', { method: 'GET' }).then(
    async (raw) => {
      const currentUid =
        auth.currentUser?.uid ||
        (await getStoredSession().catch(() => null))?.user?.uid ||
        null;

      const toIso = (value: any) => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().toISOString();
        if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      };

      return (raw || []).map((item: any) => {
        const startIso = toIso(item.startAt || item.eventAt);
        // Determinar partner
        let partner = item.partner || item.other || null;
        if (!partner && (item.userA || item.userB) && currentUid) {
          const a = item.userA;
          const b = item.userB;
          if (a?.uid === currentUid) partner = b || null;
          else if (b?.uid === currentUid) partner = a || null;
        }
        return {
          ...item,
          eventAt: startIso || item.eventAt || null,
          partner,
        };
      });
    }
  );
}

export function cancelCalendarEvent(eventId: string) {
  if (!eventId) throw new Error('Evento invalido');
  return authRequest(`/api/calendar/events/${eventId}/cancel`, { method: 'POST' });
}
