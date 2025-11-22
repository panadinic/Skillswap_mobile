# SkillSwap

Aplicación de intercambio de habilidades entre usuarios.

## Documentación 
- https://github.com/Vicente-Godoy/Capstone_Doc.git

## Stack Tecnológico
- **Frontend**: React
- **Backend**: Node.js/Express
- **Base de datos**: Oracle XE

## Requisitos
- Node.js (>=18) y npm
- Oracle XE en local (con usuario dedicado, ej. bd_skillSwapApp)
- Git para control de versiones

## Instalación

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Librerías Instaladas

### Backend
- **express**: framework para servidor y API REST
- **oracledb**: driver oficial Oracle para Node.js
- **cors**: habilitar comunicación con frontend
- **nodemon (dev)**: reinicio automático en desarrollo
- **bcryptjs**: hash de contraseñas (portable en Windows)

### Frontend
- **react**: librería base
- **react-dom**: renderizado en navegador
- **react-scripts**: scripts CRA (start, build, test)
- El frontend usa fetch (nativo de JS), no fue necesario instalar Axios.

## Endpoints Clave
- **Perfiles**: `/api/perfiles` → CRUD (contraseñas hasheadas en backend)
- **Tipos**: `/api/tipo-habilidad` → catálogo de categorías
- **Habilidades**:
  - `GET /api/habilidades` → lista cruda (IDs)
  - `GET /api/habilidades/detalle` → lista con nombres de perfil y tipo
  - `POST /api/habilidades` → crear nueva habilidad

## Seguridad Aplicada
- Hash de contraseñas con bcryptjs
- Variables sensibles en .env (excluido en .gitignore)
- CORS habilitado solo para frontend en desarrollo

## Troubleshooting
- No se puede cargar habilidades → verificar `GET /api/habilidades/detalle` en Postman/navegador
- Error bcrypt en Windows → usar bcryptjs (`npm i bcryptjs`)
- Repo vacío → asegurarse de no tener `.git/` dentro de `backend/` o `frontend/` (evita submódulos)

## Nota
Este proyecto es parte de un trabajo académico. No subir datos sensibles ni credenciales reales al repositorio.
