import { env } from '../config/env';
import { getAuthToken } from './auth';

const API_BASE = env.apiUrl;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(url, {
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

export interface Publication {
  id: string;
  title?: string;
  content?: string;
  descripcion?: string;
  imageUrl?: string | null;
  authorName?: string;
  authorPhotoURL?: string | null;
  creatorInfo?: {
    nombre?: string;
    fotoUrl?: string | null;
  };
  tags?: string[];
  interestTags?: string[];
  ratingAvg?: number;
  ratingCount?: number;
  fechaCreacion?: string | number | { _seconds?: number; seconds?: number };
  liked?: boolean;
}

export interface CreatePublicationPayload {
  title: string;
  content: string;
  imageUrl?: string | null;
  tags?: string[];
  interestTags?: string[];
  nivel?: string | null;
  modalidad?: string | null;
  ciudad?: string | null;
  region?: string | null;
}

export const publicationsApi = {
  list: (signal?: AbortSignal) =>
    request<Publication[]>('/api/publications', { method: 'GET', signal }),
  search: (query: string, signal?: AbortSignal) =>
    request<Publication[]>(
      `/api/publications/search?q=${encodeURIComponent(query)}`,
      { method: 'GET', signal }
    ),
  create: async (payload: CreatePublicationPayload) => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Debes iniciar sesión para publicar.');
    }
    return request<Publication>('/api/publications', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },
  update: async (publicationId: string, payload: Partial<CreatePublicationPayload>) => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Debes iniciar sesión para editar publicaciones.');
    }
    return request<Publication>(`/api/publications/${publicationId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },
};
