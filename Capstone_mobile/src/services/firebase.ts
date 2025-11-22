import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAtbAzhxTjPWPWzsme_yJ-IRzEudqTfG68',
  authDomain: 'skillswappbd.firebaseapp.com',
  projectId: 'skillswappbd',
  storageBucket: 'skillswappbd.firebasestorage.app',
  messagingSenderId: '525655670503',
  appId: '1:525655670503:web:34af60b1ece85c3d76ec42',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth = getAuth(app);
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
