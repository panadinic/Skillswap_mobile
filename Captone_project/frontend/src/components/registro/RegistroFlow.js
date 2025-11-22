// src/components/registro/RegistroFlow.jsx
import React, { createContext, useContext, useState } from "react";

const initial = {
    nombre: "",
    email: "",
    contrasena: "",
    conocimiento: "",
    descripcion: "",
    etiquetas: [],
    intereses: [],
    foto: null,
};

const RegistroFlowContext = createContext(null);

export function RegistroFlowProvider({ children }) {
    const [registroData, setRegistroData] = useState(initial);

    const value = {
        registroData,
        setRegistroData,
        reset: () => setRegistroData(initial),
    };

    return (
        <RegistroFlowContext.Provider value={value}>
            {children}
        </RegistroFlowContext.Provider>
    );
}

export function useRegistroFlow() {
    const ctx = useContext(RegistroFlowContext);
    if (!ctx) {
        throw new Error(
            "useRegistroFlow debe usarse dentro de <RegistroFlowProvider>"
        );
    }
    return ctx;
}
