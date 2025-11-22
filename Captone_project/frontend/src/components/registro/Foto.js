// src/components/registro/Foto.js
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegistroFlow } from "./RegistroFlow";
import API_BASE from "../../api";
import { auth, storage } from "../../lib/firebaseClient";
import { getIdToken } from "../../services/auth";
import { toast } from "../../utils/toast";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import "./foto.css";

export default function Foto() {
  const navigate = useNavigate();
  const { registroData, setRegistroData } = useRegistroFlow();

  const [preview, setPreview] = useState(registroData.foto || null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState(null);
  const uploadPromiseRef = useRef(null);
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const optimizeImageFile = (rawFile) =>
    new Promise((resolve, reject) => {
      if (!rawFile.type?.startsWith("image/")) {
        reject(new Error("Archivo no es imagen"));
        return;
      }
      if (rawFile.size <= 1.5 * 1024 * 1024) {
        resolve(rawFile);
        return;
      }

      const url = URL.createObjectURL(rawFile);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const maxDim = 1280;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("No se pudo optimizar la imagen"));
              return;
            }
            const optimizedFile = new File([blob], rawFile.name, {
              type: "image/jpeg",
            });
            resolve(optimizedFile);
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = url;
    });

  const startAvatarUpload = async (rawFile) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setUploadingAvatar(true);
    setUploadedAvatarUrl(null);
    try {
      const optimized = await optimizeImageFile(rawFile);
      uploadPromiseRef.current = uploadAvatarAndGetUrl(uid, optimized);
      const url = await uploadPromiseRef.current;
      setUploadedAvatarUrl(url);
    } catch (err) {
      console.error("Pre-upload avatar error:", err);
      setUploadedAvatarUrl(null);
    } finally {
      setUploadingAvatar(false);
      uploadPromiseRef.current = null;
    }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type?.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("La imagen supera los 5MB.");
      return;
    }

    if (preview && preview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(preview);
      } catch {}
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setRegistroData((prev) => ({ ...prev, foto: url }));
    startAvatarUpload(f);
  };

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(preview);
        } catch {}
      }
    };
  }, [preview]);

  const uploadAvatarAndGetUrl = (uid, f) =>
    new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const sanitizedName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const avatarRef = ref(storage, `uploads/avatars/${uid}/${timestamp}-${sanitizedName || `avatar.${ext}`}`);
      const metadata = { contentType: f.type?.startsWith("image/") ? f.type : "image/jpeg" };
      const task = uploadBytesResumable(avatarRef, f, metadata);

      task.on(
        "state_changed",
        () => {},
        (err) => reject(err),
        async () => {
          try {
            const url = await getDownloadURL(avatarRef);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

  const finish = async () => {
    try {
      setSaving(true);
      const token = await getIdToken();
      const uid = auth.currentUser?.uid;

      if (!token || !uid) {
        toast.error("Debes iniciar sesión para publicar.");
        navigate("/");
        return;
      }

      let fotoUrlFinal = uploadedAvatarUrl;
      if (!fotoUrlFinal && file) {
        try {
          const optimized = await optimizeImageFile(file);
          fotoUrlFinal = await uploadAvatarAndGetUrl(uid, optimized);

          const resProfile = await fetch(`${API_BASE}/api/users/me`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fotoUrl: fotoUrlFinal }),
          });

          if (!resProfile.ok) {
            const txt = await resProfile.text();
            console.warn("Actualizar perfil falló:", txt);
          }
          setRegistroData((prev) => ({ ...prev, foto: fotoUrlFinal }));
        } catch (e) {
          console.error("Upload avatar falló:", e);
          toast.error("La publicación continuará, pero la foto de perfil no se pudo subir.");
        }
      }

      const payload = {
        title: registroData.conocimiento,
        content: registroData.descripcion || null,
        imageUrl: fotoUrlFinal || null,
        nivel: registroData.nivel || null,
        modalidad: registroData.modalidad || null,
        ciudad: registroData.ciudad || null,
        region: registroData.region || null,
        tags: registroData.etiquetas || [],
      };

      const resPub = await fetch(`${API_BASE}/api/publications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resPub.ok) {
        const txt = await resPub.text();
        throw new Error(`Error al crear publicación: ${txt}`);
      }

      toast.success("Perfil actualizado y publicación creada.");
      navigate("/");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "No se pudo completar el proceso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="foto-shell">
      <div className="foto-card">
        <button className="foto-back" onClick={() => navigate("/")}>
          &#8249; Volver al Home
        </button>
        <h2 className="foto-title">Sube tu foto</h2>
        <p className="foto-subtitle">Personaliza tu perfil con una imagen. Puedes cambiarla después.</p>

        <label className="foto-input">
          <span>Elegir archivo</span>
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>

        {preview && (
          <img
            src={preview}
            alt="vista previa"
            className="foto-preview"
          />
        )}

        <button
          className="btn-pill primary"
          onClick={finish}
          disabled={saving || uploadingAvatar}
        >
          {saving ? "Guardando..." : uploadingAvatar ? "Cargando imagen..." : "Finalizar"}
        </button>
      </div>
    </div>
  );
}

