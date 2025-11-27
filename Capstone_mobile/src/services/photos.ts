import { deleteObject, getDownloadURL, getMetadata, listAll, ref, refFromURL, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';

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
  const nowIso = new Date().toISOString();

  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(
    storage,
    `uploads/galery/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  );
  await uploadBytes(fileRef, blob, {
    contentType: blob.type || 'image/jpeg',
    customMetadata: {
      descripcion: descripcion || '',
      createdAt: nowIso,
    },
  });
  const url = await getDownloadURL(fileRef);

  return {
    id: fileRef.name,
    url,
    descripcion,
    createdAt: nowIso,
    uid: user.uid,
  } as UserPhoto;
}

export async function deleteUserPhoto(photo: UserPhoto) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesion.');
  if (photo.uid !== user.uid) throw new Error('Solo puedes borrar tus propias fotos.');
  const fileRef = refFromURL(photo.url);
  await deleteObject(fileRef);
  return true;
}

export async function listUserPhotos(uid: string) {
  const loadFolder = async (path: string) => {
    try {
      const folderRef = ref(storage, path);
      const listing = await listAll(folderRef);
      const items = await Promise.all(
        listing.items.map(async (itemRef) => {
          const [url, meta] = await Promise.all([getDownloadURL(itemRef), getMetadata(itemRef)]);
          const createdAt =
            meta.customMetadata?.createdAt ||
            meta.timeCreated ||
            meta.updated ||
            new Date().toISOString();
          return {
            id: itemRef.name,
            url,
            descripcion: meta.customMetadata?.descripcion || '',
            createdAt,
            uid,
          } as UserPhoto;
        })
      );
      return items;
    } catch (err) {
      // Si la carpeta no existe (p.ej. en el path viejo), devolvemos vacío
      return [];
    }
  };

  // Compatibilidad: primero el path correcto de reglas ("galery"), luego el legacy ("gallery")
  const [galeryItems, legacyItems] = await Promise.all([
    loadFolder(`uploads/galery/${uid}`),
    loadFolder(`uploads/gallery/${uid}`),
  ]);

  return [...galeryItems, ...legacyItems].sort(
    (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
  );
}
