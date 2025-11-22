// src/lib/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Config desde variables de entorno (CRA expone REACT_APP_*)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FB_API_KEY,
  authDomain: process.env.REACT_APP_FB_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FB_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FB_STORAGE_BUCKET, // debe terminar en .appspot.com
  messagingSenderId: process.env.REACT_APP_FB_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FB_APP_ID,
};

// Validaciones útiles en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const missing = Object.entries(firebaseConfig)
    .filter(([_, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error('[Firebase] Faltan variables en .env:', missing.join(', '));
  }
  if (firebaseConfig.storageBucket && !firebaseConfig.storageBucket.endsWith('.appspot.com')) {
    // eslint-disable-next-line no-console
    console.warn('[Firebase] storageBucket debe terminar en .appspot.com. Actual:', firebaseConfig.storageBucket);
  }
}

if (firebaseConfig.storageBucket && !firebaseConfig.storageBucket.endsWith('.appspot.com')) {
  // Aviso útil si alguien pegó el dominio de descarga en vez del bucket
  // Ejemplo correcto: skillswappbd.appspot.com
  // Ejemplo incorrecto: skillswappbd.firebasestorage.app
  // No interrumpe ejecución; solo informa.
  // eslint-disable-next-line no-console
  console.warn('[Firebase] storageBucket debería terminar en .appspot.com. Actual:', firebaseConfig.storageBucket);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export default app;
