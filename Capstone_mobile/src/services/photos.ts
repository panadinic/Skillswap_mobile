import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { auth, db, storage } from './firebase';

export type UserPhoto = {
  id: string;
  url: string;
  descripcion?: string;
  createdAt?: string;
  uid: string;
};

export async function uploadUserPhoto(localUri: string, descripcion: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesion.');

  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(
    storage,
    `uploads/galery/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  );
  await uploadBytes(fileRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });
  const url = await getDownloadURL(fileRef);

  const docRef = await addDoc(collection(db, 'userPhotos'), {
    uid: user.uid,
    url,
    descripcion: descripcion || '',
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    url,
    descripcion,
    uid: user.uid,
  } as UserPhoto;
}

export async function listUserPhotos(uid: string) {
  const q = query(
    collection(db, 'userPhotos'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      url: data.url,
      descripcion: data.descripcion || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
      uid: data.uid,
    } as UserPhoto;
  });
}
