// src/components/pages/Publicar.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegistroFlow } from '../registro/RegistroFlow';

export default function Publicar() {
    const navigate = useNavigate();
    const { setRegistroData } = useRegistroFlow();

    useEffect(() => {
        // Reset wizard data and navigate to the first step
        setRegistroData({
            conocimiento: "",
            descripcion: "",
            nivel: null,
            modalidad: null,
            ciudad: null,
            region: null,
            etiquetas: [],
            foto: null,
        });

        // Navigate to the first step of the wizard
        navigate("/registro/ConOfre");
    }, [navigate, setRegistroData]);

    // This component just redirects, so we don't render anything
    return null;
}
