const { db } = require('../config/firebase');
const admin = require('firebase-admin');

const normalizeText = (text = '') => {
  const safe = text ?? '';
  return safe
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const tokenize = (text = '') => {
  const normalized = normalizeText(text ?? '');
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 2 && token.length < 40);
};

const buildSearchTokens = (title, content, tags = []) => {
  const set = new Set();
  tokenize(title).forEach((t) => set.add(t));
  tokenize(content).forEach((t) => set.add(t));
  (Array.isArray(tags) ? tags : [])
    .flatMap((tag) => tokenize(tag))
    .forEach((t) => set.add(t));
  return Array.from(set);
};

/**
 * Crea una nueva publicación.
 * DENORMALIZACIÓN: Obtiene datos del usuario y los incrusta en la publicación.
 */
const createPublication = async (req, res) => {
  try {
    const { uid } = req.user; // UID del usuario autenticado
    const { title, content, imageUrl, tipo, titulo, descripcion, nivel, modalidad, ciudad, region, tags } = req.body;

    // Log del request
    console.log(`[CREATE PUBLICATION] Request from user ${uid}:`, {
      title, content, imageUrl, tipo, titulo, descripcion
    });

    // Validación: soportar tanto el formato nuevo (title, content) como el viejo (tipo, titulo)
    const finalTitle = title || titulo;
    const finalContent = content || descripcion;

    if (!finalTitle) {
      console.log('[CREATE PUBLICATION] Missing title');
      return res.status(400).json({ error: 'Título es obligatorio.' });
    }

    // --- Inicio de la Denormalización ---
    // 1. Obtener el documento del perfil del creador
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.log(`[CREATE PUBLICATION] User ${uid} not found in Firestore`);
      return res.status(404).json({ error: 'El usuario creador no existe.' });
    }
    const userData = userDoc.data();
    console.log(`[CREATE PUBLICATION] User data retrieved:`, { nombre: userData.nombre });
    // --- Fin de la Denormalización ---

    const tagList = Array.isArray(tags) ? tags : [];
    const searchTokens = buildSearchTokens(finalTitle, finalContent, [
      ...tagList,
      nivel,
      modalidad,
      ciudad,
      region,
    ]);

    const newPublication = {
      creatorId: uid,
      // Datos denormalizados: Copiamos los datos del autor aquí
      creatorInfo: {
        nombre: userData.nombre || 'Anónimo',
        fotoUrl: userData.fotoUrl || null
      },
      // Author data for better compatibility (new fields)
      authorUid: uid,
      authorName: userData.nombre || userData.displayName || userData.email?.split('@')[0] || 'Anónimo',
      authorPhotoURL: userData.fotoUrl || userData.photoURL || null,
      // Campos principales (soporte para ambos formatos)
      title: finalTitle,
      content: finalContent,
      imageUrl: imageUrl || null,
      // Campos legacy (mantener compatibilidad)
      tipo: tipo || 'publicacion',
      titulo: finalTitle,
      descripcion: finalContent,
      nivel: nivel || null,
      modalidad: modalidad || null,
      ciudad: ciudad || null,
      region: region || null,
      tags: tagList,
      searchTokens,
      activo: true,
      ratingCount: 0,
      ratingSum: 0,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`[CREATE PUBLICATION] Saving to Firestore:`, {
      creatorId: newPublication.creatorId,
      title: newPublication.title,
      activo: newPublication.activo
    });

    const docRef = await db.collection('publications').add(newPublication);

    console.log(`[CREATE PUBLICATION] Success! Document ID: ${docRef.id}`);
    res.status(201).json({
      message: 'Publicación creada con éxito',
      id: docRef.id,
      title: finalTitle
    });

  } catch (error) {
    console.error("[CREATE PUBLICATION] Error:", error);
    res.status(500).json({ error: 'No se pudo crear la publicación.' });
  }
};

/**
 * Obtiene todas las publicaciones activas (el feed principal).
 * Es una consulta única y eficiente gracias a la denormalización.
 */
const getAllPublications = async (_req, res) => {
  try {
    console.log('[GET PUBLICATIONS] Fetching active publications...');

    const snapshot = await db.collection('publications')
      .where('activo', '==', true)
      .orderBy('fechaCreacion', 'desc')
      .limit(50) // Paginación básica para no traer toda la base de datos
      .get();

    console.log(`[GET PUBLICATIONS] Found ${snapshot.size} publications`);

    if (snapshot.empty) {
      console.log('[GET PUBLICATIONS] No publications found, returning empty array');
      return res.status(200).json([]);
    }

    const publications = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`[GET PUBLICATIONS] Publication ${doc.id}:`, {
        title: data.title || data.titulo,
        creator: data.creatorInfo?.nombre,
        activo: data.activo,
        fechaCreacion: data.fechaCreacion
      });
      return {
        id: doc.id,
        ...data,
        ratingAvg: data.ratingCount ? (data.ratingSum || 0) / data.ratingCount : 0,
      };
    });

    console.log(`[GET PUBLICATIONS] Returning ${publications.length} publications`);
    res.status(200).json(publications);

  } catch (error) {
    console.error("[GET PUBLICATIONS] Error:", error);
    res.status(500).json({ error: 'No se pudieron obtener las publicaciones.' });
  }
};


const runScoredSearch = (docs, tokens) => {
  const normalizedTokens = tokens || [];
  const results = [];
  docs.forEach((doc) => {
    const data = doc.data();
    if (!data?.activo) return;

    const title = data.title || data.titulo || '';
    const description = data.content || data.descripcion || '';
    const normalizedTitle = normalizeText(title);
    const normalizedDescription = normalizeText(description);
    const tagTokens = new Set(
      (Array.isArray(data.tags) ? data.tags : []).flatMap((tag) => tokenize(tag))
    );

    let score = 0;
    normalizedTokens.forEach((tok) => {
      if (!tok) return;
      if (normalizedTitle.includes(tok)) score += 3;
      if (normalizedDescription.includes(tok)) score += 2;
      if (tagTokens.has(tok)) score += 2;
    });

    const ratingCount = Number(data.ratingCount) || 0;
    const ratingSum = Number(data.ratingSum) || 0;
    const ratingAvg = ratingCount ? ratingSum / ratingCount : 0;
    score += ratingAvg * Math.log2(ratingCount + 2);

    const createdAt = data.fechaCreacion?.toDate
      ? data.fechaCreacion.toDate().getTime()
      : data.fechaCreacion?._seconds
      ? data.fechaCreacion._seconds * 1000
      : 0;
    if (createdAt) {
      const daysAgo = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysAgo < 7) score += 1.5;
      else if (daysAgo < 30) score += 0.5;
    }

    results.push({
      id: doc.id,
      ...data,
      ratingAvg,
      _score: score,
      _createdAt: createdAt,
      _ratingCount: ratingCount,
    });
  });

  results.sort(
    (a, b) =>
      (b._score || 0) - (a._score || 0) ||
      (b.ratingAvg || 0) - (a.ratingAvg || 0) ||
      (b._ratingCount || 0) - (a._ratingCount || 0) ||
      (b._createdAt || 0) - (a._createdAt || 0)
  );

  return results.map(({ _score, _createdAt, _ratingCount, ...rest }) => rest);
};

const searchPublications = async (req, res) => {
  try {
    const query = req.query?.q || '';
    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return getAllPublications(req, res);
    }

    const limitedTokens = tokens.slice(0, 10);
    let snapshot = await db
      .collection('publications')
      .where('searchTokens', 'array-contains-any', limitedTokens)
      .limit(100)
      .get();

    let docs = snapshot.docs;
    if (!docs.length) {
      snapshot = await db
        .collection('publications')
        .orderBy('fechaCreacion', 'desc')
        .limit(100)
        .get();
      docs = snapshot.docs;
    }

    const scored = runScoredSearch(docs, tokens);
    return res.status(200).json(scored.slice(0, 50));
  } catch (error) {
    console.error('Error en searchPublications:', error);
    return res.status(500).json({ error: 'No se pudieron buscar las publicaciones.' });
  }
};

/**
 * Obtiene una única publicación por su ID.
 */
const getPublicationById = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const doc = await db.collection('publications').doc(publicationId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }

    const data = doc.data();
    res.status(200).json({
      id: doc.id,
      ...data,
      ratingAvg: data.ratingCount ? (data.ratingSum || 0) / data.ratingCount : 0,
    });

  } catch (error) {
    console.error("Error al obtener publicación por ID:", error);
    res.status(500).json({ error: 'No se pudo obtener la publicación.' });
  }
};

const deletePublication = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    if (!publicationId) return res.status(400).json({ error: 'publicationId es obligatorio' });

    const docRef = db.collection('publications').doc(publicationId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'PublicaciA3n no encontrada.' });
    }

    const data = doc.data();
    const ownerId = data.creatorId || data.authorUid;
    if (ownerId !== uid) {
      return res.status(403).json({ error: 'No autorizado para eliminar esta publicaciA3n.' });
    }

    await docRef.delete();
    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Error al eliminar publicaciA3n:', error);
    return res.status(500).json({ error: 'No se pudo eliminar la publicaciA3n.' });
  }
};


module.exports = {
  createPublication,
  getAllPublications,
  searchPublications,
  getPublicationById,
  deletePublication,
};
