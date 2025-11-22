import React, { useEffect, useState } from "react";
import API_BASE from "../../api";

const PerfilesList = () => {
  const [perfiles, setPerfiles] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/perfiles`)
      .then((res) => res.json())
      .then((data) => setPerfiles(data))
      .catch((err) => console.error("Error cargando perfiles:", err));
  }, []);

  return (
    <div>
      <h2>Perfiles</h2>
      <ul>
        {perfiles.map((p) => (
          <li key={p.ID}>
            {p.NOMBRE} — {p.EMAIL}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PerfilesList;
