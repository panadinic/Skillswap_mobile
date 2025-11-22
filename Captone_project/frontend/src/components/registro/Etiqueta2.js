// src/components/registro/Etiqueta2.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./etiqueta2.css";
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

export default function Etiqueta2() {
  const navigate = useNavigate();
  const { registroData, setRegistroData } = useRegistroFlow();

  const [seleccionadas, setSeleccionadas] = useState(
    Array.isArray(registroData.intereses) ? registroData.intereses : []
  );

  const toggle = (et) => {
    setSeleccionadas((prev) =>
      prev.includes(et) ? prev.filter((x) => x !== et) : [...prev, et]
    );
  };

  const goNext = () => {
    setRegistroData((prev) => ({ ...prev, intereses: seleccionadas }));
    navigate("/registro/Foto");
  };

  return (
    <div className="e2-shell">
      <div className="e2-page">
        <header className="e2-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">
            &#8249;
          </button>
          <div>
            <h1 className="e2-title">¿Qué temas te interesan?</h1>
            <p className="e2-sub">Puedes marcar más de una opción.</p>
          </div>
        </header>

        <main className="e2-main">
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

