// src/components/PostButton.js
import React from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./PostButton.css";

export default function PostButton() {
    const navigate = useNavigate();

    const handleClick = () => {
        // Navigate to the new /publicar route
        navigate("/publicar");
    };

    return (
        <button className="post-btn" onClick={handleClick} aria-label="Crear publicación">
            <FaPlus size={18} />
        </button>
    );
}
