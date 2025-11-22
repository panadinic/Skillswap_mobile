import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './firebase';
import { env } from '../config/env';

const API_BASE = env.apiUrl;

async function syncUserWithBackend(user: any, maxRetries = 2) {
  if (!user) throw new Error('Usuario no disponible para sincronización');

  const idToken = await user.getIdToken(true);
  const userData = {
    nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
    email: user.email,
    bio: null,
    fotoUrl: user.photoURL || null,
    ciudad: null,
    region: null,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`No se pudo sincronizar: ${lastError?.message}`);
}

export async function registerUser({
  nombre,
  email,
  password,
}: {
  nombre: string;
  email: string;
  password: string;
}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  if (nombre && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: nombre });
    } catch (error) {
      console.warn('No se pudo actualizar displayName:', error);
    }
  }

  try {
    await syncUserWithBackend(cred.user);
  } catch (error) {
    console.error('Error sincronizando usuario:', error);
  }

  return cred.user;
}
