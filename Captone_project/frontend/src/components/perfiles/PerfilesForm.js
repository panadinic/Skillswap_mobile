import React, { useState } from "react";
import API_BASE from "../../api";

const PerfilesForm = ({ onCreated }) => {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !contrasena.trim()) {
      alert("Completa nombre, email y contraseña.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/perfiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          contrasena: contrasena.trim()
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert("Error al crear perfil: " + (data?.error ?? `${res.status} ${res.statusText}`));
        return;
      }
      onCreated?.(data); // para refrescar lista arriba/afuera si quieres
      setNombre(""); setEmail(""); setContrasena("");
      alert("Perfil creado.");
    } catch (err) {
      console.error(err);
      alert("No se pudo conectar con el servidor");
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: 20 }}>
      <h3>Crear perfil rápido</h3>
      <input
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <input
        placeholder="Contraseña"
        type="password"
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <button type="submit">Crear perfil</button>
    </form>
  );
};

export default PerfilesForm;
