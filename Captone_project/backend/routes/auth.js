const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../config/firebase");

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Registra un nuevo usuario y devuelve un token.
 */
router.post("/register", async (req, res) => {
  try {
    const { nombre, email, contrasena } = req.body;
    if (!nombre || !email || !contrasena) {
      return res.status(400).json({ error: "Nombre, email y contrasena son obligatorios" });
    }

    const existing = await db.collection("perfiles").where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ error: "El email ya está en uso" });
    }

    const passwordHash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    const newUser = {
      nombre,
      email,
      passwordHash,
      fechaCreacion: new Date(),
    };

    const docRef = await db.collection("perfiles").add(newUser);

    // Crear token después de registrar
    const payload = { userId: docRef.id, email: newUser.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(201).json({ 
        message: "Usuario registrado con éxito", 
        token,
        user: { id: docRef.id, nombre: newUser.nombre, email: newUser.email }
    });

  } catch (err) {
    console.error("POST /register error:", err);
    res.status(500).json({ error: "Fallo al registrar usuario" });
  }
});

/**
 * POST /api/auth/login
 * Autentica un usuario y devuelve un token.
 */
router.post("/login", async (req, res) => {
    try {
        const { email, contrasena } = req.body;
        if (!email || !contrasena) {
            return res.status(400).json({ error: "Email y contrasena son obligatorios" });
        }

        const snapshot = await db.collection("perfiles").where('email', '==', email).limit(1).get();
        if (snapshot.empty) {
            return res.status(401).json({ error: "Credenciales inválidas" }); // Error genérico por seguridad
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        const isMatch = await bcrypt.compare(contrasena, userData.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Crear el token si las credenciales son correctas
        const payload = { userId: userDoc.id, email: userData.email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({
            message: "Login exitoso",
            token,
            user: { id: userDoc.id, nombre: userData.nombre, email: userData.email }
        });

    } catch (err) {
        console.error("POST /login error:", err);
        res.status(500).json({ error: "Fallo en el login" });
    }
});

/**
 * POST /api/auth/logout
 * Invalida un token agregándolo a una lista negra.
 */
router.post("/logout", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: "Token es obligatorio" });
        }

        // Decodificar para obtener la fecha de expiración
        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000);

        // Guardar el token en la lista negra con su fecha de expiración
        await db.collection("token_blacklist").add({
            token,
            expiresAt,
        });

        res.json({ message: "Sesión cerrada correctamente" });

    } catch (err) {
        console.error("POST /logout error:", err);
        res.status(500).json({ error: "Fallo al cerrar sesión" });
    }
});


module.exports = router;