import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

async function authRequest(path: string, options: RequestInit = {}) {
  const token = await getAuthToken(true);
  if (!token) throw new Error('Debes iniciar sesion nuevamente.');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error ${res.status}`);
  }
  return data;
}

export async function markConversationSeen(conversationId: string) {
  if (!conversationId) throw new Error('Conversacion invalida');
  return authRequest(`/api/conversations/${conversationId}/seen`, { method: 'POST' });
}
