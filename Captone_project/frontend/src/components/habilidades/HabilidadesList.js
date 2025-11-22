import React, { useEffect, useState } from "react";
import API_BASE from "../../api";

const HabilidadesList = () => {
  const [habilidades, setHabilidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorLoad, setErrorLoad] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // 1) intento con /detalle
        let res = await fetch(`${API_BASE}/habilidades/detalle`);
        if (res.ok) {
          const data = await res.json();
          setHabilidades(Array.isArray(data) ? data : []);
        } else {
          // 2) fallback a /habilidades (sin joins)
          res = await fetch(`${API_BASE}/habilidades`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
          // mapea a un formato homogéneo mínimo
          const mapped = (Array.isArray(data) ? data : []).map((h) => ({
            ID: h.ID,
            NOM_HABILIDADES: h.NOM_HABILIDADES,
            NIVEL: h.NIVEL,
            ID_PERFILES: h.ID_PERFILES,
            TIPO_NOMBRE: `#${h.ID_TIPO_HABILIDAD}`, // marcador
            PERFIL_NOMBRE: `Perfil #${h.ID_PERFILES}`,
            PERFIL_EMAIL: ""
          }));
          setHabilidades(mapped);
        }
      } catch (e) {
        console.error(e);
        setErrorLoad("No se pudieron cargar las habilidades.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p>Cargando habilidades...</p>;
  if (errorLoad) return <p style={{ color: "crimson" }}>{errorLoad}</p>;
  if (habilidades.length === 0) return <p>No hay habilidades registradas.</p>;

  return (
    <div>
      <h2>Habilidades</h2>
      <ul>
        {habilidades.map((h) => (
          <li key={h.ID}>
            <strong>{h.NOM_HABILIDADES}</strong>{h.NIVEL ? ` (${h.NIVEL})` : ""}{" "}
            — <em>Tipo:</em> {h.TIPO_NOMBRE}{" "}
            — <em>Perfil:</em> {h.PERFIL_NOMBRE}{h.PERFIL_EMAIL ? ` (${h.PERFIL_EMAIL})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HabilidadesList;
