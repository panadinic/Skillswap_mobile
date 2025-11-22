import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra ?? {};

function normalizeUrl(value?: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const apiFromExtra =
  normalizeUrl((extra as Record<string, any>).apiUrl) ||
  normalizeUrl((extra as Record<string, any>).API_URL) ||
  normalizeUrl(process.env.EXPO_PUBLIC_API_URL);

export const env = {
  apiUrl: apiFromExtra ?? 'http://localhost:5000',
};
