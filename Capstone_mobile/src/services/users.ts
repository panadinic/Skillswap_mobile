import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken(true);
  if (!token) throw new Error('Debes iniciar sesion.');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error ${res.status}`);
  }
  return data as T;
}

export interface ProfileInput {
  nombre?: string | null;
  bio?: string | null;
  fotoUrl?: string | null;
  ciudad?: string | null;
  region?: string | null;
}

export function updateMyProfile(payload: ProfileInput) {
  return authRequest('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
