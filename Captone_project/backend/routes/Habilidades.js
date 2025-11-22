const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");

const mapDocWithId = (doc) => ({ id: doc.id, ID: doc.id, ...doc.data() });

/**
 * POST /api/habilidades
 * Crea una habilidad, validando la existencia del perfil y tipo asociados.
 */
router.post("/", async (req, res) => {
  try {
    const { id_perfiles, id_tipo_habilidad, nom_habilidades, nivel } = req.body;

    if (!id_perfiles || !id_tipo_habilidad || !nom_habilidades) {
      return res.status(400).json({ error: "id_perfiles, id_tipo_habilidad y nom_habilidades son obligatorios" });
    }

    // Simula FK: Validar que el perfil exista
    const perfilDoc = await db.collection("perfiles").doc(id_perfiles).get();
    if (!perfilDoc.exists) {
      return res.status(404).json({ error: "El perfil con el ID proporcionado no existe" });
    }

    // Simula FK: Validar que el tipo de habilidad exista
    const tipoDoc = await db.collection("tipos_habilidad").doc(id_tipo_habilidad).get();
    if (!tipoDoc.exists) {
      return res.status(404).json({ error: "El tipo de habilidad con el ID proporcionado no existe" });
    }

    const newHabilidad = {
      id_perfiles,
      id_tipo_habilidad,
      nom_habilidades,
      nivel: nivel || null,
      fechaCreacion: new Date(),
    };

    const docRef = await db.collection("habilidades").add(newHabilidad);
    res.status(201).json({ message: "Habilidad creada", id: docRef.id });

  } catch (err) {
    console.error("POST /habilidades error:", err);
    return res.status(500).json({ error: "Fallo al crear habilidad", detalle: err.message });
  }
});

/**
 * GET /api/habilidades/detalle
 * Simula un JOIN para obtener habilidades con detalles de perfil y tipo.
 */
router.get("/detalle", async (_req, res) => {
    try {
        const snapshot = await db.collection("habilidades").orderBy("fechaCreacion", "desc").get();
        if (snapshot.empty) {
            return res.json([]);
        }

        const promesasDetalle = snapshot.docs.map(async (doc) => {
            const habilidad = mapDocWithId(doc);

            // Obtener perfil (asumiendo que siempre existe por la validación del POST)
            const perfilSnap = await db.collection("perfiles").doc(habilidad.id_perfiles).get();
            const perfilData = perfilSnap.exists ? perfilSnap.data() : {};

            // Obtener tipo habilidad
            const tipoSnap = await db.collection("tipos_habilidad").doc(habilidad.id_tipo_habilidad).get();
            const tipoData = tipoSnap.exists ? tipoSnap.data() : {};

            return {
                ID: habilidad.id,
                NOM_HABILIDADES: habilidad.nom_habilidades,
                NIVEL: habilidad.nivel,
                ID_PERFILES: habilidad.id_perfiles,
                PERFIL_NOMBRE: perfilData.nombre || "N/A",
                PERFIL_EMAIL: perfilData.email || "N/A",
                ID_TIPO_HABILIDAD: habilidad.id_tipo_habilidad,
                TIPO_NOMBRE: tipoData.nombre || "N/A",
            };
        });

        const habilidadesConDetalle = await Promise.all(promesasDetalle);
        return res.json(habilidadesConDetalle);

    } catch (err) {
        console.error("GET /habilidades/detalle error:", err);
        return res.status(500).json({ error: "Fallo al listar detalle de habilidades", detalle: err.message });
    }
});


/**
 * GET /api/habilidades/perfil/:id_perfiles
 * Lista habilidades por un perfil específico.
 */
router.get("/perfil/:id_perfiles", async (req, res) => {
  try {
    const { id_perfiles } = req.params;
    const snapshot = await db.collection("habilidades").where("id_perfiles", "==", id_perfiles).get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const habilidades = snapshot.docs.map(mapDocWithId);
    return res.json(habilidades);
  } catch (err) {
    console.error("GET /habilidades/perfil error:", err);
    return res.status(500).json({ error: "Fallo al listar por perfil", detalle: err.message });
  }
});

/**
 * GET /api/habilidades/tipo/:id_tipo_habilidad
 * Lista habilidades por un tipo específico.
 */
router.get("/tipo/:id_tipo_habilidad", async (req, res) => {
  try {
    const { id_tipo_habilidad } = req.params;
    const snapshot = await db.collection("habilidades").where("id_tipo_habilidad", "==", id_tipo_habilidad).get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const habilidades = snapshot.docs.map(mapDocWithId);
    return res.json(habilidades);
  } catch (err) {
    console.error("GET /habilidades/tipo error:", err);
    return res.status(500).json({ error: "Fallo al listar por tipo", detalle: err.message });
  }
});

/**
 * PUT /api/habilidades/:id
 * Actualiza una habilidad.
 */
router.put("/:id", async (req, res) => { // CORRECCIÓN: Se agregaron (req, res)
  try {
    const { id } = req.params;
    const dataToUpdate = req.body;
    
    // Opcional: validar que id_tipo_habilidad, si se cambia, exista.
    if (dataToUpdate.id_tipo_habilidad) {
        const tipoDoc = await db.collection("tipos_habilidad").doc(dataToUpdate.id_tipo_habilidad).get();
        if (!tipoDoc.exists) {
            return res.status(404).json({ error: "El nuevo tipo de habilidad ID no existe" });
        }
    }

    await db.collection("habilidades").doc(id).update(dataToUpdate);
    res.json({ message: "Habilidad actualizada" });
  } catch (err) {
    console.error("PUT /habilidades/:id error:", err);
    return res.status(500).json({ error: "Fallo al actualizar habilidad", detalle: err.message });
  }
});

/**
 * DELETE /api/habilidades/:id
 * Elimina una habilidad.
 */
router.delete("/:id", async (req, res) => { // CORRECCIÓN: Se agregaron (req, res)
  try {
    const { id } = req.params;
    await db.collection("habilidades").doc(id).delete();
    res.json({ message: "Habilidad eliminada" });
  } catch (err) {
    console.error("DELETE /habilidades/:id error:", err);
    return res.status(500).json({ error: "Fallo al eliminar habilidad", detalle: err.message });
  }
});

module.exports = router;