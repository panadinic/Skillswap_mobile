import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

export type NotificationType = 'match' | 'meeting_request' | string;

export interface NotificationItem {
  id: string;
  userId?: string;
  type?: NotificationType;
  title?: string;
  message?: string;
  read?: boolean;
  createdAt?: string | null;
  readAt?: string | null;
  conversationId?: string;
  proposalMessageId?: string;
  eventAt?: string | null;
  matchId?: string | null;
  otherUser?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken(true);
  if (!token) {
    throw new Error('Debes iniciar sesion nuevamente.');
  }

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

export function createMeetingRequestNotification(payload: {
  conversationId: string;
  proposalMessageId: string;
}) {
  return authRequest('/api/notifications/meeting-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function respondMeetingRequest(payload: {
  conversationId: string;
  proposalMessageId: string;
  status: 'accepted' | 'rejected';
  notificationId?: string;
}) {
  return authRequest('/api/notifications/meeting-request/respond', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyNotifications() {
  return authRequest<{ items: NotificationItem[]; nextCursor: number | null }>(
    '/api/notifications',
    { method: 'GET' }
  );
}

export function markNotificationRead(notificationId: string) {
  if (!notificationId) {
    throw new Error('Notificacion invalida');
  }
  return authRequest<{ updated: boolean | number }>(
    `/api/notifications/${notificationId}/read`,
    { method: 'POST' }
  );
}

export function markAllNotificationsRead() {
  return authRequest<{ updated: number }>('/api/notifications/mark-all/read', {
    method: 'POST',
  });
}
