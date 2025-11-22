// src/components/registro/ConOfre.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./conofre.css";
import { useRegistroFlow } from "./RegistroFlow";

export default function ConOfre() {
  const navigate = useNavigate();
  const { registroData, setRegistroData } = useRegistroFlow();

  const [conocimiento, setConocimiento] = useState(registroData.conocimiento || "");
  const [descripcion, setDescripcion] = useState(registroData.descripcion || "");

  const goNext = () => {
    if (!conocimiento || !descripcion) return;
    setRegistroData((prev) => ({
      ...prev,
      conocimiento,
      descripcion,
    }));
    navigate("/registro/Etiqueta1");
  };

  return (
    <div className="co-shell">
      <div className="co-page">
        <header className="co-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">
            &#8249;
          </button>
          <div>
            <h1 className="co-title">¿Qué le ofreces a SkillSwapp?</h1>
            <p className="co-subtitle">Cuéntanos qué habilidad compartirás con la comunidad.</p>
          </div>
        </header>

        <main className="co-main">
          <label className="co-label">Ponle un nombre a tu conocimiento</label>
          <input
            className="co-input"
            placeholder="Nombre del conocimiento"
            value={conocimiento}
            onChange={(e) => setConocimiento(e.target.value)}
          />

          <label className="co-label">Describe tu conocimiento</label>
          <textarea
            className="co-textarea"
            placeholder="Describe el contenido, formato o nivel de tu experiencia"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <button className="btn-pill primary" onClick={goNext} disabled={!conocimiento || !descripcion}>
            Siguiente
          </button>
        </main>
      </div>
    </div>
  );
}

