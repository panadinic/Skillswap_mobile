import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken(true);
  if (!token) {
    throw new Error('Debes iniciar sesion nuevamente.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
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
    const message =
      (data && (data.error || data.message)) ||
      `Error ${response.status} al llamar ${path}`;
    throw new Error(message);
  }

  return data as T;
}

export async function getMyLikes(): Promise<string[]> {
  return authRequest<string[]>('/api/interactions/likes', { method: 'GET' });
}

export async function sendLike(publicationId: string) {
  return authRequest<{ liked: boolean; matched?: boolean; matchId?: string }>(
    '/api/interactions/like',
    {
      method: 'POST',
      body: JSON.stringify({ publicationId }),
    }
  );
}

export interface MatchSummary {
  id: string;
  users?: string[];
  userA?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
  userB?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
  other?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
  lastMessageAt?: string | null;
  lastSeenBy?: Record<string, string | null>;
  createdAt?: any;
}

export async function getMatches(): Promise<MatchSummary[]> {
  return authRequest<MatchSummary[]>('/api/interactions/matches', { method: 'GET' });
}
