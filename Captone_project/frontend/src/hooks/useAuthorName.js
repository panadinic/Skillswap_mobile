// src/hooks/useAuthorName.js
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';

export function useAuthorName(post) {
    const [authorName, setAuthorName] = useState(post?.authorName || post?.creatorInfo?.nombre || 'Ver perfil');
    const [loading, setLoading] = useState(false);
    const [hasTried, setHasTried] = useState(false);

    useEffect(() => {
        // If post is null, don't do anything
        if (!post) return;

        // If we already have authorName, don't fetch
        if (post.authorName || post.creatorInfo?.nombre) {
            setAuthorName(post.authorName || post.creatorInfo?.nombre);
            return;
        }

        // If we've already tried to fetch this author, don't try again
        if (hasTried) return;

        const authorUid = post.authorUid || post.creatorId;
        if (!authorUid) return;

        const fetchAuthorName = async () => {
            try {
                setLoading(true);
                setHasTried(true);

                // Try to get user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', authorUid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const name = userData.nombre || userData.displayName || userData.email?.split('@')[0] || 'Usuario';
                    setAuthorName(name);
                }
            } catch (error) {
                console.error('Error fetching author name:', error);
                // Keep the fallback "Ver perfil"
            } finally {
                setLoading(false);
            }
        };

        fetchAuthorName();
    }, [post, hasTried]);

    return { authorName, loading };
}
