// src/App.js
import React, { useEffect, useState, Fragment } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { RegistroFlowProvider } from "./components/registro/RegistroFlow";
import { onAuthChange } from "./services/auth";

// Auth / registro
import Login from "./components/login/Login";
import Registro from "./components/registro/Registro";
import ConOfre from "./components/registro/ConOfre";
import Etiqueta1 from "./components/registro/Etiqueta1";
import Etiqueta2 from "./components/registro/Etiqueta2";
import Foto from "./components/registro/Foto";

// Páginas
import Home from "./components/pages/Home";
import Publicar from "./components/pages/Publicar";
import Likes from "./components/pages/Likes";
import Chat from "./components/pages/Chat";
import Notifications from "./components/pages/Notifications";
import Profile from "./components/pages/Profile";
import BottomBar from "./components/BottomBar";

// Internas
import PerfilesList from "./components/perfiles/PerfilesList";
import PerfilesForm from "./components/perfiles/PerfilesForm";
import HabilidadesList from "./components/habilidades/HabilidadesList";
import HabilidadesForm from "./components/habilidades/HabilidadesForm";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refrescar = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    const unsub = onAuthChange((u) => setLoggedIn(!!u));
    return () => unsub?.();
  }, []);

  return (
    <Router>
      {/* Provider global para la app */}
      <RegistroFlowProvider>
        <div className={`app-shell ${loggedIn ? "app-shell-auth" : "app-shell-public"}`}>
          <Routes>
            {!loggedIn ? (
              <Fragment>
                {/* Login por defecto */}
                <Route path="/" element={<Login onLogin={setLoggedIn} />} />

                {/* Wizard disponible también estando deslogueado */}
                <Route path="/registro" element={<Registro />} />
                <Route path="/registro/ConOfre" element={<ConOfre />} />
                <Route path="/registro/Etiqueta1" element={<Etiqueta1 />} />
                <Route path="/registro/Etiqueta2" element={<Etiqueta2 />} />
                <Route path="/registro/Foto" element={<Foto />} />

                <Route path="*" element={<Login onLogin={setLoggedIn} />} />
              </Fragment>
            ) : (
              <Fragment>
                {/* Rutas logueado */}
                <Route path="/" element={<Home />} />
                <Route path="/publicar" element={<Publicar />} />
                <Route path="/likes" element={<Likes />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/chat/:id" element={<Chat />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:id" element={<Profile />} />

                {/* Wizard disponible también estando logueado */}
                <Route path="/registro" element={<Registro />} />
                <Route path="/registro/ConOfre" element={<ConOfre />} />
                <Route path="/registro/Etiqueta1" element={<Etiqueta1 />} />
                <Route path="/registro/Etiqueta2" element={<Etiqueta2 />} />
                <Route path="/registro/Foto" element={<Foto />} />

                {/* Internas */}
                <Route
                  path="/perfiles"
                  element={
                    <>
                      <h1>SkillSwap</h1>
                      <PerfilesForm onCreated={refrescar} />
                      <PerfilesList key={`perfiles-${refreshKey}`} />
                    </>
                  }
                />
                <Route
                  path="/habilidades"
                  element={
                    <>
                      <h1>Habilidades</h1>
                      <HabilidadesForm onCreated={refrescar} />
                      <HabilidadesList key={`habilidades-${refreshKey}`} />
                    </>
                  }
                />

                <Route path="*" element={<Home />} />
              </Fragment>
            )}
          </Routes>

          {/* Barra inferior solo si hay sesión */}
          {loggedIn && <BottomBar />}
        </div>
      </RegistroFlowProvider>
    </Router>
  );
}

export default App;
