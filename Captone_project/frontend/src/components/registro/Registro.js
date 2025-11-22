// src/components/registro/Registro.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./registro.css";
import { registerUser, loginWithPassword } from "../../services/auth";

import {
  validateName,
  validateEmail,
  validatePassword,
  validateRegisterForm,
} from "../../utils/validator";

export default function Registro() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    nombre: undefined,
    email: undefined,
    contrasena: undefined,
  });

  const hasEmpty = !nombre || !email || !contrasena;
  const hasFieldErrors = useMemo(
    () => !!(fieldErrors.nombre || fieldErrors.email || fieldErrors.contrasena),
    [fieldErrors]
  );
  const canSubmit = !loading && !hasEmpty && !hasFieldErrors;

  const handleBlur = (field) => {
    let msg;
    if (field === "nombre") msg = validateName(nombre);
    if (field === "email") msg = validateEmail(email);
    if (field === "contrasena") msg = validatePassword(contrasena);
    setFieldErrors((prev) => ({ ...prev, [field]: msg || undefined }));
  };

  const handleRegister = async () => {
    setErrMsg("");

    const formErrors = validateRegisterForm({ nombre, email, contrasena });
    setFieldErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    try {
      setLoading(true);

      // 1) Crear cuenta en Firebase Auth (el service además hace bootstrap del perfil en backend)
      await registerUser({ nombre, email, password: contrasena });

      // 2) (a prueba de balas) iniciar sesión para continuar el flujo
      await loginWithPassword(email, contrasena);

      // 3) Ir al siguiente paso del wizard para llenar los datos del post
      navigate("/registro/ConOfre");
    } catch (err) {
      console.error(err);
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;
      setErrMsg(backendMsg || "Hubo un problema al registrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-shell">
      <div className="register-page">
        <header className="reg-header">
          <div className="logo-circle">SS</div>
          <div>
            <h1 className="brand">SkillSwapp</h1>
            <p className="reg-tagline">Conecta talentos e intercambia habilidades</p>
          </div>
        </header>

        <section className="reg-card">
          <h2 className="reg-title">
            Crea tu cuenta
          </h2>
          <p className="reg-subtitle">Completa tus datos para comenzar</p>

          <div className="form-grid">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (fieldErrors.nombre) {
                setFieldErrors((prev) => ({
                  ...prev,
                  nombre: validateName(e.target.value) || undefined,
                }));
              }
            }}
            onBlur={() => handleBlur("nombre")}
            minLength={2}
            maxLength={40}
            autoComplete="name"
            inputMode="text"
            aria-invalid={!!fieldErrors.nombre}
          />
          {fieldErrors.nombre && (
            <p className="field-error">{fieldErrors.nombre}</p>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({
                  ...prev,
                  email: validateEmail(e.target.value) || undefined,
                }));
              }
            }}
            onBlur={() => handleBlur("email")}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="field-error">{fieldErrors.email}</p>
          )}

          <input
            type="password"
            placeholder="Password"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              if (fieldErrors.contrasena) {
                setFieldErrors((prev) => ({
                  ...prev,
                  contrasena: validatePassword(e.target.value) || undefined,
                }));
              }
            }}
            onBlur={() => handleBlur("contrasena")}
            minLength={6}
            autoComplete="new-password"
            aria-invalid={!!fieldErrors.contrasena}
          />
          {fieldErrors.contrasena && (
            <p className="field-error">{fieldErrors.contrasena}</p>
          )}
        </div>

          {errMsg && <p className="reg-error">{errMsg}</p>}

          <button
            className="btn-pill outline"
            onClick={handleRegister}
            disabled={!canSubmit}
          >
            {loading ? "Creando..." : "Registrar"}
          </button>

          {(!canSubmit && !loading) && (
            <p className="reg-hint">
              Completa los campos correctamente para continuar.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

