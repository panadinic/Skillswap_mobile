// frontend/src/services/posts.js

// Hoy usamos tus mocks:
import { POSTS_MOCK } from "../fixtures/postsMock"; // ajusta el nombre si usaste PostsMocks

/**
 * Hook para obtener posts en el Home.
 * - HOY: devuelve MOCK (con loading artificial).
 * - MAÑANA: tu compañero reemplaza la parte marcada con FIREBASE.
 */
import { useEffect, useState } from "react";

export function usePosts() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;

        // ---- HOY (MOCK): simula carga -------------------------
        setLoading(true);
        const t = setTimeout(() => {
            if (!alive) return;
            setPosts(POSTS_MOCK);
            setLoading(false);
        }, 300);
        // -------------------------------------------------------

        // ---- MAÑANA (FIREBASE): reemplazar por esto -----------
        // import { db } from "../lib/firebase";
        // import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
        //
        // const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        // const off = onSnapshot(q, (snap) => {
        //   const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        //   setPosts(rows);
        //   setLoading(false);
        // }, (err) => {
        //   setError(err.message || "Error cargando posts");
        //   setLoading(false);
        // });
        //
        // return () => off();
        // -------------------------------------------------------

        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, []);

    return { posts, loading, error };
}

/**
 * Crear post (stub).
 * HOY: solo advierte.
 * MAÑANA (FIREBASE): subir imagen a Storage y guardar doc en Firestore.
 */
export async function createPost(/* { file, title, description, user } */) {
    console.warn("[createPost] No implementado (frontend). Lo hará Firebase.");
    // Ejemplo Firebase (referencia):
    // const path = `posts/${user.uid}/${Date.now()}_${file.name}`;
    // const storageRef = ref(storage, path);
    // await uploadBytes(storageRef, file);
    // const imageUrl = await getDownloadURL(storageRef);
    // await addDoc(collection(db, "posts"), {
    //   title, description, imageUrl, ownerUid: user.uid, createdAt: serverTimestamp()
    // });
}

/**
 * Toggle like (stub).
 * HOY: solo advierte.
 * MAÑANA: like por usuario en subcolección + contador.
 */
export async function toggleLike(/* { postId, uid } */) {
    console.warn("[toggleLike] No implementado (frontend). Lo hará Firebase.");
    // Ejemplo Firebase (referencia con transaction):
    // const likeRef = doc(db, `posts/${postId}/likes/${uid}`);
    // const postRef = doc(db, `posts/${postId}`);
    // await runTransaction(db, async (tx) => { ... });
}
