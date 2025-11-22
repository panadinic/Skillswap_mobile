import React, { useEffect, useState } from "react";
import API_BASE from "../../api";

const HabilidadesForm = ({ onCreated }) => {
  const [perfiles, setPerfiles] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [perfilId, setPerfilId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");

  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [errorLoad, setErrorLoad] = useState("");

  // Etiqueta de versión para confirmar que este archivo se cargó
  const VERSION = "Form v3 - diag visible";

  useEffect(() => {
    const loadPerfiles = async () => {
      try {
        const res = await fetch(`${API_BASE}/perfiles`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setPerfiles(arr);
        if (arr.length > 0) setPerfilId(String(arr[0].ID)); // autoselección
      } catch (e) {
        console.error("loadPerfiles error:", e);
        setErrorLoad("No se pudieron cargar los perfiles");
      } finally {
        setLoadingPerfiles(false);
      }
    };

    const loadTipos = async () => {
      try {
        const res = await fetch(`${API_BASE}/tipo-habilidad`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setTipos(arr);
        if (arr.length > 0) setTipoId(String(arr[0].ID));   // autoselección
      } catch (e) {
        console.error("loadTipos error:", e);
        setErrorLoad((prev) => prev || "No se pudieron cargar los tipos");
      } finally {
        setLoadingTipos(false);
      }
    };

    loadPerfiles();
    loadTipos();
  }, []);

  const handleClickGuardar = () => {
    // Si haces click y no ves este log => el botón está deshabilitado o el evento no ocurre
    console.log("[CLICK] Guardar pulsado. Estado actual:", {
      perfilId, tipoId, nombre, nivel, loadingPerfiles, loadingTipos
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    console.log("[SUBMIT] Intentando enviar...");

    if (!perfilId || !tipoId) {
      alert("Debe seleccionar un perfil y un tipo de habilidad.");
      console.log("[SUBMIT] Falta perfil o tipo", { perfilId, tipoId });
      return;
    }
    if (!nombre.trim()) {
      alert("Escribe el nombre de la habilidad.");
      console.log("[SUBMIT] Falta nombre");
      return;
    }

    const payload = {
      id_perfiles: Number(perfilId),
      id_tipo_habilidad: Number(tipoId),
      nom_habilidades: nombre.trim(),
      nivel: nivel || null
    };
    console.log("[SUBMIT] Enviando payload:", payload);

    try {
      const res = await fetch(`${API_BASE}/habilidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data = null;
      try { data = await res.json(); } catch {}

      console.log("[SUBMIT] Respuesta:", res.status, data);

      if (!res.ok) {
        alert("Error al crear habilidad: " + (data?.error ?? `${res.status} ${res.statusText}`));
        return;
      }

      onCreated?.(data);
      setNombre("");
      setNivel("");
      alert("Habilidad creada correctamente.");
    } catch (err) {
      console.error("[SUBMIT] Error de red:", err);
      alert("No se pudo conectar con el servidor");
    }
  };

  const disableSubmit =
    loadingPerfiles || loadingTipos || !perfilId || !tipoId || !nombre.trim();

  return (
    <form onSubmit={submit} style={{ marginBottom: 20 }}>
      <h3>Agregar habilidad <small style={{opacity:.6}}>{VERSION}</small></h3>

      {errorLoad && (
        <div style={{ color: "crimson", marginBottom: 8 }}>{errorLoad}</div>
      )}

      {/* Diagnóstico visible */}
      <div style={{
        background:"#f6f6f6", padding:10, marginBottom:10, fontSize:12, border:"1px solid #ddd"
      }}>
        <div><strong>Diagnóstico</strong></div>
        <div>API_BASE: <code>{API_BASE}</code></div>
        <div>perfiles (len): {perfiles.length} | tipos (len): {tipos.length}</div>
        <div>perfilId: {String(perfilId)} | tipoId: {String(tipoId)}</div>
        <div>nombre: "{nombre}" | nivel: "{nivel}"</div>
        <div>loadingPerfiles: {String(loadingPerfiles)} | loadingTipos: {String(loadingTipos)}</div>
        <div>disableSubmit: {String(disableSubmit)}</div>
      </div>

      {/* Select de Perfil */}
      <select
        value={perfilId}
        onChange={(e) => setPerfilId(e.target.value)}
        disabled={loadingPerfiles || perfiles.length === 0}
        style={{ marginRight: 8 }}
      >
        {loadingPerfiles ? (
          <option value="">Cargando perfiles...</option>
        ) : perfiles.length === 0 ? (
          <option value="">No hay perfiles</option>
        ) : (
          <>
            <option value="">-- Selecciona un perfil --</option>
            {perfiles.map((p) => (
              <option key={p.ID} value={String(p.ID)}>
                {p.NOMBRE} ({p.EMAIL})
              </option>
            ))}
          </>
        )}
      </select>

      {/* Select de Tipo de Habilidad */}
      <select
        value={tipoId}
        onChange={(e) => setTipoId(e.target.value)}
        disabled={loadingTipos || tipos.length === 0}
        style={{ marginRight: 8 }}
      >
        {loadingTipos ? (
          <option value="">Cargando tipos...</option>
        ) : tipos.length === 0 ? (
          <option value="">No hay tipos</option>
        ) : (
          <>
            <option value="">-- Selecciona un tipo --</option>
            {tipos.map((t) => (
              <option key={t.ID} value={String(t.ID)}>
                {t.NOMBRE}
              </option>
            ))}
          </>
        )}
      </select>

      <input
        placeholder="Nombre habilidad (ej: React)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <input
        placeholder="Nivel (Básico/Medio/Avanzado)"
        value={nivel}
        onChange={(e) => setNivel(e.target.value)}
        style={{ marginRight: 8 }}
      />

      <button
        type="submit"
        onClick={handleClickGuardar}
        disabled={disableSubmit}
      >
        Guardar
      </button>
    </form>
  );
};

export default HabilidadesForm;
