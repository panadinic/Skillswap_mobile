// src/services/storage.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebaseClient";

/**
 * Sube un archivo a Firebase Storage y retorna el URL público.
 * @param {File} file - Archivo a subir.
 * @param {string} uid - UID del usuario autenticado.
 * @returns {Promise<string>} URL de descarga.
 */
export async function uploadPublicationImage(file, uid) {
  if (!file) {
    throw new Error("No hay archivo para cargar");
  }
  if (!uid) {
    throw new Error("UID requerido para generar la ruta de Storage");
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `uploads/posts/${uid}/${timestamp}-${sanitizedName}`;
  const fileRef = ref(storage, storagePath);

  const contentType =
    file.type && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";
  const metadata = {
    cacheControl: "public,max-age=3600",
    contentType,
  };

  await uploadBytes(fileRef, file, metadata);
  const downloadURL = await getDownloadURL(fileRef);
  return downloadURL;
}
