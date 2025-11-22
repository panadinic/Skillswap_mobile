// backend/controllers/usersController.js
const { db } = require('../config/firebase');

/**
 * Obtiene el perfil completo del usuario autenticado.
 */
const getMyProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const snap = await db.collection('users').doc(uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Perfil de usuario no encontrado.' });
    }

    return res.status(200).json({ id: snap.id, ...snap.data() });
  } catch (error) {
    console.error('Error al obtener mi perfil:', error);
    return res.status(500).json({ error: 'No se pudo obtener el perfil del usuario.' });
  }
};

/**
 * Crea o actualiza el perfil del usuario autenticado (upsert).
 * - Si el doc no existe, lo crea.
 * - Si existe, lo actualiza solo con los campos enviados.
 */
const updateMyProfile = async (req, res) => {
  try {
    const { uid, email: authEmail, name: authName } = req.user || {};
    const { nombre, bio, fotoUrl, ciudad, region, email } = req.body || {};

    const userRef = db.collection('users').doc(uid);

    // Leemos para saber si existe (para setear createdAt la 1a vez).
    const prev = await userRef.get();
    const timestamps = prev.exists
      ? { updatedAt: new Date() }
      : { createdAt: new Date(), updatedAt: new Date() };

    // Solo incluimos lo que venga en el body; además podemos rellenar nombre/email desde el token.
    const updateData = {
      // datos del body (opcionales)
      ...(typeof nombre !== 'undefined' && { nombre }),
      ...(typeof bio !== 'undefined' && { bio }),
      ...(typeof fotoUrl !== 'undefined' && { fotoUrl }),
      ...(typeof ciudad !== 'undefined' && { ciudad }),
      ...(typeof region !== 'undefined' && { region }),
      ...(typeof email !== 'undefined' && { email }),

      // fallback desde el token si aún no existe el doc
      ...(!prev.exists && (authEmail || authName) && {
        ...(authEmail && { email: authEmail }),
        ...(authName && { nombre: authName }),
      }),

      ...timestamps,
    };

    // Si vino vacío el body y tampoco tenemos nada que poner, igual hacemos upsert mínimo.
    // (Así evitamos el 400 y garantizamos que el doc exista para las publicaciones)
    if (Object.keys(updateData).length === 2 || Object.keys(updateData).length === 0) {
      // Solo timestamps → agregamos un mínimo
      updateData.minimal = true;
    }

    // Upsert seguro: crea si no existe, actualiza si existe
    await userRef.set(updateData, { merge: true });

    const snap = await userRef.get();
    return res.status(200).json({ id: snap.id, ...snap.data() });
  } catch (error) {
    console.error('Error al actualizar mi perfil:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
  }
};

/**
 * Perfil público por ID (sin datos sensibles).
 */
const getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const d = userDoc.data();
    const publicProfile = {
      id: userDoc.id,
      nombre: d.nombre,
      fotoUrl: d.fotoUrl,
      bio: d.bio,
      ciudad: d.ciudad,
      region: d.region,
      fechaCreacion: d.fechaCreacion || d.createdAt,
    };

    return res.status(200).json(publicProfile);
  } catch (error) {
    console.error('Error al obtener perfil público:', error);
    return res.status(500).json({ error: 'No se pudo obtener el perfil del usuario.' });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getUserProfileById,
};
