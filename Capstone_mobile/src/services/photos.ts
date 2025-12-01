import { deleteObject, getDownloadURL, getMetadata, listAll, ref, uploadBytes } from 'firebase/storage';
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

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const fileRef = ref(
      storage,
      `uploads/galery/${user.uid}/${timestamp}-${random}.jpg`
    );
    await uploadBytes(fileRef, blob, {
      contentType: 'image/jpeg',
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
  } catch (err: any) {
    console.error('[photos] Error subiendo foto:', err);
    throw new Error('No se pudo subir la foto. Verifica tu conexión.');
  }
}

export async function deleteUserPhoto(photo: UserPhoto) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión.');
  if (photo.uid !== user.uid) throw new Error('Solo puedes borrar tus propias fotos.');
  if (!photo.url) throw new Error('Foto inválida');
  try {
    const parsed = new URL(photo.url);
    const matcher = parsed.pathname.match(/\/o\/(.+)$/);
    if (!matcher?.[1]) throw new Error('Ruta inválida');
    const decoded = decodeURIComponent(matcher[1]);
    const trimmed = decoded.split('?')[0];
    const fileRef = ref(storage, trimmed);
    await deleteObject(fileRef);
    return true;
  } catch (err: any) {
    console.error('[photos] Error eliminando foto:', err);
    const isInvalid = err?.code === 'storage/unauthenticated' || err?.code === 'auth/invalid-credential';
    if (isInvalid) {
      await logout();
      throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    }
    throw new Error('No se pudo eliminar la foto.');
  }
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

export async function uploadPublicationImage(localUri: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para editar publicaciones.');
  const response = await fetch(localUri);
  const blob = await response.blob();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 11);
  const fileRef = ref(
    storage,
    `uploads/publications/${user.uid}/${timestamp}-${random}.jpg`
  );
  await uploadBytes(fileRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });
  return getDownloadURL(fileRef);
}
