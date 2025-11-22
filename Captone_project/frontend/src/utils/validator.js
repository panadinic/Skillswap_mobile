export function validateName(nombre) {
    if (!nombre || !nombre.trim()) return "El nombre es obligatorio.";
    // Permitir letras Unicode y espacios, 2-40 caracteres
    const re = /^[\p{L}\s]{2,40}$/u;
    if (!re.test(nombre)) return "Solo letras y espacios (2–40).";
    return null;
}

export function validateEmail(email) {
    if (!email || !email.trim()) return "El email es obligatorio.";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!re.test(email)) return "Email inválido.";
    return null;
}

export function validatePassword(pass) {
    if (!pass) return "La contraseña es obligatoria.";
    if (pass.length < 6) return "Mínimo 6 caracteres.";
    return null;
}

export function validateRegisterForm({ nombre, email, contrasena }) {
    const errors = {};
    const e1 = validateName(nombre);
    const e2 = validateEmail(email);
    const e3 = validatePassword(contrasena);
    if (e1) errors.nombre = e1;
    if (e2) errors.email = e2;
    if (e3) errors.contrasena = e3;
    return errors;
}
