import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';

const TOKEN_KEY = 'capstone_mobile_token';
const USER_KEY = 'capstone_mobile_user';

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const token = await credential.user.getIdToken(true);
  const user = {
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: credential.user.displayName,
    photoURL: credential.user.photoURL,
  };
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
  return { token, user };
}

export async function logout() {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    await AsyncStorage.clear();
    await signOut(auth);
  } catch (err) {
    console.warn('[auth] Error en logout', err);
    await AsyncStorage.clear();
  }
}

export async function sendResetPasswordEmail(email: string) {
  const trimmed = email?.trim();
  if (!trimmed) throw new Error('Ingresa un correo válido');
  await sendPasswordResetEmail(auth, trimmed);
  return true;
}

export async function getStoredSession() {
  const [[, token], [, cachedUser]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  if (!token) return null;
  try {
    return { token, user: cachedUser ? JSON.parse(cachedUser) : null };
  } catch {
    return { token, user: null };
  }
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const current = auth.currentUser;
  if (current) {
    try {
      return await current.getIdToken(forceRefresh);
    } catch {}
  }
  const session = await getStoredSession();
  return session?.token ?? null;
}
