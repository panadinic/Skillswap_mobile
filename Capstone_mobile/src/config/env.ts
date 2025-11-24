import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra ?? {};

function normalizeUrl(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function deriveApiFromPackagerHost(): string | null {
  // Cuando la app se ejecuta via `expo start --lan`, hostUri expone la IP de la red local.
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants.expoConfig as any)?.expoGo?.hostUri ||
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;
  const [host] = hostUri.split(':');
  if (!host || host === 'localhost') return null;
  return `http://${host}:5001`;
}

const apiFromExtra =
  normalizeUrl((extra as Record<string, any>).apiUrl) ||
  normalizeUrl((extra as Record<string, any>).API_URL) ||
  normalizeUrl(process.env.EXPO_PUBLIC_API_URL) ||
  normalizeUrl(deriveApiFromPackagerHost());

export const env = {
  // Default al puerto 5001 donde corre el backend local.
  apiUrl: apiFromExtra ?? 'http://localhost:5001',
};
