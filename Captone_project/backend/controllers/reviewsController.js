const { db } = require('../config/firebase');
const admin = require('firebase-admin');

async function getUserPublicData(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { uid, nombre: 'Usuario', fotoUrl: null };
  const d = snap.data();
  return {
    uid,
    nombre: d.nombre || d.displayName || (d.email ? d.email.split('@')[0] : 'Usuario'),
    fotoUrl: d.fotoUrl || d.photoURL || null,
  };
}

async function createNotification(userId, data) {
  if (!userId) return;
  try {
    await db.collection('notifications').add({
      userId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...data,
    });
  } catch (error) {
    console.warn('No se pudo crear notificación:', error);
  }
}

const createReview = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { postId, rating, comment } = req.body || {};
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    const ratingValue = Number(rating);
    if (!postId || Number.isNaN(ratingValue)) {
      return res.status(400).json({ error: 'postId y rating son obligatorios' });
    }
    if (ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ error: 'rating debe estar entre 1 y 5' });
    }

    const postRef = db.collection('publications').doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return res.status(404).json({ error: 'Publicación no encontrada' });
    const post = postSnap.data();
    const teacherId = post.creatorId || post.authorUid;
    if (!teacherId) return res.status(400).json({ error: 'Publicación sin creador válido' });
    if (teacherId === uid) return res.status(400).json({ error: 'No puedes reseñar tu propia publicación' });

    // Requiere match entre ambos usuarios
    const [u1, u2] = uid < teacherId ? [uid, teacherId] : [teacherId, uid];
    const matchId = `${u1}_${u2}`;
    const matchSnap = await db.collection('matches').doc(matchId).get();
    if (!matchSnap.exists) {
      return res.status(403).json({ error: 'Solo puedes reseñar a usuarios con los que hiciste match.' });
    }

    // Requiere que el alumno haya dado like a esta publicación
    const likeSnap = await db
      .collection('userLikes')
      .where('fromUid', '==', uid)
      .where('publicationId', '==', postId)
      .limit(1)
      .get();
    if (likeSnap.empty) {
      return res.status(403).json({ error: 'Solo puedes reseñar publicaciones a las que diste like.' });
    }

    const student = await getUserPublicData(uid);
    const reviewId = `${postId}_${uid}`;
    const reviewRef = db.collection('reviews').doc(reviewId);
    const existingReview = await reviewRef.get();
    const prevRating = existingReview.exists ? Number(existingReview.data()?.rating || 0) : null;

    const reviewData = {
      postId,
      teacherId,
      studentUid: uid,
      student,
      rating: ratingValue,
      comment: comment || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await reviewRef.set(reviewData);

    await db.runTransaction(async (trx) => {
      const snap = await trx.get(postRef);
      const data = snap.data() || {};
      let ratingCount = Number(data.ratingCount) || 0;
      let ratingSum = Number(data.ratingSum) || 0;
      if (prevRating !== null) {
        ratingSum = ratingSum - prevRating + ratingValue;
      } else {
        ratingCount += 1;
        ratingSum += ratingValue;
      }
      trx.update(postRef, { ratingCount, ratingSum });
    });

    await createNotification(teacherId, {
      type: 'review',
      title: 'Nueva reseña',
      message: `${student.nombre || 'Un usuario'} calificó tu publicación ${post.title || post.titulo || ''}`,
      postId,
      rating: ratingValue,
      otherUser: student,
    });

    return res.status(201).json({ id: reviewId, ...reviewData });
  } catch (error) {
    console.error('Error al crear reseña:', error);
    return res.status(500).json({ error: 'No se pudo crear la reseña.' });
  }
};

const getReviewsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!postId) return res.status(400).json({ error: 'postId es obligatorio' });
    const snapshot = await db
      .collection('reviews')
      .where('postId', '==', postId)
      .limit(100)
      .get();

    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt;
        const ts = createdAt?.toDate ? createdAt.toDate().getTime() : createdAt?._seconds ? createdAt._seconds * 1000 : 0;
        return {
          id: doc.id,
          ...data,
          createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : createdAt || null,
          _ts: ts,
        };
      })
      .sort((a, b) => (b._ts || 0) - (a._ts || 0))
      .map(({ _ts, ...rest }) => rest);
    return res.status(200).json(items);
  } catch (error) {
    console.error('Error al obtener reseñas:', error);
    return res.status(500).json({ error: 'No se pudieron obtener las reseñas.' });
  }
};

module.exports = { createReview, getReviewsByPost };


