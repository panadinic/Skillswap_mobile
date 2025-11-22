const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { db } = require("../config/firebase");

const SALT_ROUNDS = 10;
const mapDocWithId = (doc) => ({ id: doc.id, ID: doc.id, ...doc.data() });

/**
 * GET /api/perfiles
 * Lista todos los perfiles sin exponer información sensible.
 */
router.get("/", async (_req, res) => {
  try {
    const snapshot = await db.collection("perfiles").orderBy("nombre").get();
    if (snapshot.empty) {
      return res.json([]);
    }
    // Mapeamos los datos y excluimos el hash de la contraseña.
    const perfiles = snapshot.docs.map(doc => {
      const { passwordHash, ...data } = doc.data(); // Excluir passwordHash
      return { id: doc.id, ID: doc.id, ...data };
    });
    return res.json(perfiles);
  } catch (err) {
    console.error("GET /perfiles error:", err);
    return res.status(500).json({ error: "Fallo al listar perfiles" });
  }
});

/**
 * GET /api/perfiles/:id
 * Obtiene un perfil por su ID.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("perfiles").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }
    
    const { passwordHash, ...data } = doc.data(); // Excluir passwordHash
    return res.json({ id: doc.id, ID: doc.id, ...data });
  } catch (err) {
    console.error("GET /perfiles/:id error:", err);
    return res.status(500).json({ error: "Fallo al obtener perfil" });
  }
});

/**
 * POST /api/perfiles
 * Crea un nuevo perfil, hasheando la contraseña.
 */
router.post("/", async (req, res) => {
  try {
    const { nombre, email, contrasena } = req.body;

    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ error: "Nombre, email y contraseña son obligatorios" });
    }

    // --- Validación de email único ---
    const existingUserQuery = await db.collection('perfiles').where('email', '==', email.trim().toLowerCase()).limit(1).get();
    if (!existingUserQuery.empty) {
        return res.status(409).json({ error: "El email ya está en uso" }); // 409 Conflict
    }

    const passwordHash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const newPerfil = {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      passwordHash, // Guardamos el hash, no la contraseña
      fechaCreacion: new Date(),
    };

    const docRef = await db.collection("perfiles").add(newPerfil);
    res.status(201).json({ message: "Perfil creado", id: docRef.id });
  } catch (err) {
    console.error("POST /perfiles error:", err);
    return res.status(500).json({ error: "Fallo al crear perfil" });
  }
});

/**
 * PUT /api/perfiles/:id
 * Actualiza un perfil. Si se provee una nueva contraseña, la hashea.
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, contrasena } = req.body;

    if (!nombre && !email && !contrasena) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    const docRef = db.collection("perfiles").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }

    const updateData = {};
    if (nombre) updateData.nombre = nombre.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (contrasena) {
      updateData.passwordHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    }

    await docRef.update(updateData);
    return res.json({ message: "Perfil actualizado" });
  } catch (err) {
    console.error("PUT /perfiles/:id error:", err);
    return res.status(500).json({ error: "Fallo al actualizar perfil" });
  }
});

/**
 * DELETE /api/perfiles/:id
 * Elimina un perfil.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("perfiles").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }

    await docRef.delete();
    return res.json({ message: "Perfil eliminado" });
  } catch (err) {
    console.error("DELETE /perfiles/:id error:", err);
    return res.status(500).json({ error: "Fallo al eliminar perfil" });
  }
});

module.exports = router;