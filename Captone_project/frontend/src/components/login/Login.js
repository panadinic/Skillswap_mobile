// src/components/login/Login.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import { loginWithPassword, loginWithGoogle } from "../../services/auth"; // solo login

function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!user || !pass) {
      setErr("Ingresa email y contraseA�a.");
      return;
    }

    try {
      setLoading(true);
      await loginWithPassword(user, pass);

      onLogin?.(true);
      navigate("/");
    } catch (e) {
      console.error(e);
      setErr(e.message || "No se pudo iniciar sesiA3n.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-page">
        {/* Header / logo + marca */}
        <header className="login-header">
          <div className="logo-circle">
            <span>SS</span>
          </div>
          <div>
            <h1 className="brand">SkillSwapp</h1>
            <p className="tagline">Intercambia habilidades, crea conexiones</p>
          </div>
        </header>

        {/* Texto bienvenida */}
        <div className="welcome">
          <h2>Bienvenido</h2>
          <p>Inicia sesiA3n para continuar</p>
        </div>

        {/* Tarjeta principal */}
        <div className="card login-panel">
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-wrap">
              <span className="icon" aria-hidden>
                �?�
              </span>
              <input
                type="email"
                placeholder="Correo electrA3nico"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="input-wrap">
              <span className="icon" aria-hidden>
                �?�
              </span>
              <input
                type="password"
                placeholder="ContraseA�a"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {err && <p className="form-error">{err}</p>}

            <button
              type="submit"
              className="btn-pill primary"
              disabled={loading || !user || !pass}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            <button
              type="button"
              className="btn-pill google"
              onClick={async () => {
                setErr("");
                try {
                  setLoading(true);
                  await loginWithGoogle();
                  onLogin?.(true);
                  navigate("/");
                } catch (e) {
                  console.error(e);
                  setErr(e.message || "No se pudo iniciar sesión con Google.");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? "Procesando..." : "Continuar con Google"}
            </button>

            {/* Solo redirige al wizard de registro */}
            <button
              type="button"
              className="btn-pill secondary"
              onClick={() => navigate("/registro")}
              disabled={loading}
            >
              Crear cuenta
            </button>
          </form>
        </div>

        <div className="login-footer">
          <a className="forgot" href="#recuperar">
            Recupera tu contraseA�a
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
