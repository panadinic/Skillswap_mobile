// src/components/common/LogoutButton.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../../services/auth";
import "./LogoutButton.css";

export default function LogoutButton({ className = "" }) {
  const navigate = useNavigate();
  const doLogout = async () => {
    await logoutUser();
    navigate("/"); // vuelve al login
  };
  return (
    <button className={`${className} logout-btn`.trim()} onClick={doLogout}>
      Cerrar sesión
    </button>
  );
}

