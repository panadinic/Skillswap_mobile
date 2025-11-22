// src/components/registro/Etiqueta1.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./etiqueta1.css";

import { useRegistroFlow } from "./RegistroFlow";

const OPCIONES = [
  "DEPORTES",
  "CIENCIAS",
  "FITNESS",
  "ARTES",
  "MÚSICA",
  "IDIOMAS",
  "FILOSOFÍA",
  "COMPUTACIÓN",
  "PROGRAMACIÓN",
  "ESCRITURA",
  "COCINA",
  "FINANZAS",
  "MODA",
  "ROBÓTICA",
  "QUÍMICA",
  "HISTORIA",
  "MATEMÁTICAS",
  "LITERATURA",
];

export default function Etiqueta1() {
  const navigate = useNavigate();
  const { registroData, setRegistroData } = useRegistroFlow();

  const [seleccionadas, setSeleccionadas] = useState(
    Array.isArray(registroData.etiquetas) ? registroData.etiquetas : []
  );

  const toggle = (et) => {
    setSeleccionadas((prev) =>
      prev.includes(et) ? prev.filter((x) => x !== et) : [...prev, et]
    );
  };

  const goNext = () => {
    setRegistroData((prev) => ({ ...prev, etiquetas: seleccionadas }));
    navigate("/registro/Etiqueta2");
  };

  return (
    <div className="e1-shell">
      <div className="e1-page">
        <header className="e1-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">
            &#8249;
          </button>
          <div>
            <h1 className="e1-title">Define tu conocimiento</h1>
            <p className="e1-sub">Elige las etiquetas que describen tu habilidad.</p>
          </div>
        </header>

        <main className="e1-main">
          <div className="chips-grid">
            {OPCIONES.map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => toggle(et)}
                className={`chip ${seleccionadas.includes(et) ? "selected" : ""}`}
              >
                {et}
              </button>
            ))}
          </div>

          <button className="btn-pill primary" onClick={goNext}>
            Siguiente
          </button>
        </main>
      </div>
    </div>
  );
}

