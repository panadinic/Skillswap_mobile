import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken(true);
  if (!token) throw new Error('Debes iniciar sesion nuevamente.');

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
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

export interface Review {
  id: string;
  postId: string;
  teacherId?: string;
  studentUid?: string;
  student?: {
    uid?: string;
    nombre?: string;
    fotoUrl?: string | null;
  };
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
}

export function getReviewsByPost(postId: string) {
  if (!postId) throw new Error('postId requerido');
  return authRequest<Review[]>(`/api/reviews/post/${postId}`, { method: 'GET' });
}

export function createReview(payload: { postId: string; rating: number; comment?: string | null }) {
  const { postId, rating } = payload;
  if (!postId) throw new Error('postId requerido');
  if (!rating || rating < 1 || rating > 5) throw new Error('rating debe estar entre 1 y 5');
  return authRequest<Review>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ ...payload }),
  });
}
