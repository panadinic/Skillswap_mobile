// src/services/auth.js
import { auth } from "../lib/firebaseClient";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
} from "firebase/auth";
import API_BASE from "../api";
import { toast } from "../utils/toast";

/**
 * Sincroniza el usuario con el backend después de autenticación Firebase
 * @param {Object} user - Usuario de Firebase Auth
 * @param {string} user.uid - UID del usuario
 * @param {string} user.email - Email del usuario
 * @param {string} user.displayName - Nombre del usuario
 * @returns {Promise<Object>} - Respuesta del backend
 */
async function syncUserWithBackend(user, maxRetries = 2) {
    if (!user) {
        throw new Error("Usuario no disponible para sincronización");
    }

    const idToken = await user.getIdToken(true); // Force refresh
    const userData = {
        nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
        email: user.email,
        // Campos opcionales que se pueden enviar
        bio: null,
        fotoUrl: user.photoURL || null,
        ciudad: null,
        region: null
    };

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Sincronizando usuario con backend (intento ${attempt}/${maxRetries})`);

            const response = await fetch(`${API_BASE}/api/users/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Usuario sincronizado exitosamente:', result);
            return result;

        } catch (error) {
            lastError = error;
            console.error(`Error en intento ${attempt}:`, error.message);

            if (attempt < maxRetries) {
                // Esperar un poco antes del siguiente intento
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.error('Falló la sincronización después de todos los intentos');
    throw new Error(`No se pudo sincronizar el usuario: ${lastError.message}`);
}

/** Crear usuario (registro) y devolver user */
export async function registerUser({ nombre, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Actualizar displayName si se proporcionó (API modular)
    if (nombre && cred.user) {
        try {
            await updateProfile(cred.user, { displayName: nombre });
        } catch (error) {
            console.warn('No se pudo actualizar displayName:', error);
        }
    }

    // Sincronizar con backend
    try {
        await syncUserWithBackend(cred.user);
        toast.info('Cuenta creada y sincronizada. Te enviamos un correo para verificarla.');
    } catch (error) {
        console.error('Error sincronizando usuario tras registro:', error);
        toast.error(`Usuario creado pero hubo un problema sincronizando con el servidor: ${error.message}`);
    }

    try {
        await sendEmailVerification(cred.user);
    } catch (verificationError) {
        console.error('No se pudo enviar correo de verificación:', verificationError);
    }

    return cred.user;
}

/** Login */
export async function loginWithPassword(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.reload();

    // Sincronizar con backend
    try {
        await syncUserWithBackend(cred.user);
        toast.success('Login exitoso y usuario sincronizado');
    } catch (error) {
        console.error('Error sincronizando usuario tras login:', error);
        // Mostrar error al usuario
        toast.error(`Login exitoso pero hubo un problema sincronizando con el servidor: ${error.message}`);
    }

    return cred.user;
}

/** Login con Google */
const googleProvider = new GoogleAuthProvider();
export async function loginWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);

    try {
        await syncUserWithBackend(cred.user);
        toast.success('Login con Google exitoso y usuario sincronizado');
    } catch (error) {
        console.error('Error sincronizando usuario tras login con Google:', error);
        toast.error(`Login con Google exitoso pero hubo un problema sincronizando con el servidor: ${error.message}`);
    }

    return cred.user;
}

/** Logout */
export async function logoutUser() {
    await signOut(auth);
}

/** Listener de sesión */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/** Id token del usuario actual */
export async function getIdToken() {
    const u = auth.currentUser;
    if (!u) return null;
    return await u.getIdToken(/* forceRefresh? */ false);
}

/**
 * Función pública para sincronizar manualmente el usuario actual con el backend
 * Útil para casos donde la sincronización automática falló
 */
export async function syncCurrentUser() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No hay usuario autenticado');
    }

    try {
        await syncUserWithBackend(user);
        toast.success('Usuario sincronizado manualmente');
        return true;
    } catch (error) {
        console.error('Error en sincronización manual:', error);
        toast.error(`Error sincronizando usuario: ${error.message}`);
        return false;
    }
}
