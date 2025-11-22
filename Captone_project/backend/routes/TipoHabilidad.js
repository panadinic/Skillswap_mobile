const express = require("express");
const router = express.Router();
// Importamos la instancia de la base de datos de Firestore
const { db } = require("../config/firebase");

// --- Mapeador de datos ---
// Helper para asegurar que los datos de Firestore incluyan el ID del documento.
const mapDocWithId = (doc) => ({
  id: doc.id,
  ID: doc.id,
  ...doc.data()
});


/**
 * GET /api/tipo-habilidad
 * Lista todos los tipos de habilidad.
 * Firestore no tiene un 'activo=S' por defecto, lo simularemos con una query.
 */
router.get("/", async (req, res) => {
  try {
    const incluirInactivos = req.query.incluirInactivos === "true";
    let query = db.collection("tipos_habilidad");

    // Si no se pide incluir inactivos, filtramos por el campo 'activo'.
    if (!incluirInactivos) {
      query = query.where("activo", "==", true);
    }
    
    const snapshot = await query.orderBy("nombre").get();

    if (snapshot.empty) {
      return res.json([]);
    }
    // Mapeamos los resultados para incluir el ID autogenerado por Firestore.
    const tipos = snapshot.docs.map(mapDocWithId);
    return res.json(tipos);
  } catch (err) {
    console.error("GET /tipo-habilidad error:", err);
    return res.status(500).json({ error: "Fallo al listar tipos" });
  }
});

/**
 * POST /api/tipo-habilidad
 * Crea un nuevo tipo de habilidad.
 */
router.post("/", async (req, res) => {
  try {
    const { nombre, descripcion } = req.body || {};
    // El campo 'activo' lo manejamos como booleano en Firestore.
    const activo = req.body.activo !== false; // Por defecto es true

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El campo 'nombre' es obligatorio" });
    }

    const newTipo = {
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      activo: activo,
      // En Firestore, es común añadir timestamps de creación/actualización.
      fechaCreacion: new Date(),
    };

    const docRef = await db.collection("tipos_habilidad").add(newTipo);
    return res.status(201).json({ message: "Tipo creado", id: docRef.id });
  } catch (err) {
    console.error("POST /tipo-habilidad error:", err);
    return res.status(500).json({ error: "Fallo al crear tipo" });
  }
});

/**
 * PUT /api/tipo-habilidad/:id
 * Actualiza un tipo de habilidad.
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body || {};
    const activo = req.body.activo !== false;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El campo 'nombre' es obligatorio" });
    }

    const docRef = db.collection("tipos_habilidad").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Tipo no encontrado" });
    }

    await docRef.update({
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      activo: activo,
    });

    return res.json({ message: "Tipo actualizado" });
  } catch (err) {
    console.error("PUT /tipo-habilidad/:id error:", err);
    return res.status(500).json({ error: "Fallo al actualizar tipo" });
  }
});

/**
 * DELETE /api/tipo-habilidad/:id
 * Elimina un tipo de habilidad.
 * La validación de FK se debe hacer manualmente.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: En el futuro, validar que ninguna habilidad use este tipo.
    // Por ahora, lo eliminamos directamente.

    const docRef = db.collection("tipos_habilidad").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Tipo no encontrado" });
    }

    await docRef.delete();
    return res.json({ message: "Tipo eliminado correctamente" });
  } catch (err) {
    console.error("DELETE /tipo-habilidad/:id error:", err);
    return res.status(500).json({ error: "Fallo al eliminar tipo" });
  }
});

module.exports = router;