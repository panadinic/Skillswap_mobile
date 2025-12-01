# SkillSwap Mobile - Proyecto Completo

> Plataforma de intercambio de habilidades - Versión móvil con React Native/Expo

---

## 🚀 INICIO RÁPIDO

### 1. Backend
```bash
cd Captone_project/backend
npm install
npm start
```

### 2. App Móvil
```bash
cd Capstone_mobile
npm install
npm start
```

### 3. ⚠️ IMPORTANTE: Aplicar Reglas Firebase Storage
Ver: [`FIREBASE_STORAGE_RULES_FINAL.txt`](FIREBASE_STORAGE_RULES_FINAL.txt)

---

## 📚 DOCUMENTACIÓN

### 🌟 Empieza Aquí:
1. **[RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md)** - Resumen de fixes y estado
2. **[ESTADO_PROYECTO.md](ESTADO_PROYECTO.md)** - Estado completo del proyecto

### Documentación Técnica:
- **[FIXES_APLICADOS_COMPLETOS.md](FIXES_APLICADOS_COMPLETOS.md)** - Detalle de fixes
- **[SOLUCION_CORS_STORAGE.md](SOLUCION_CORS_STORAGE.md)** - Guía CORS
- **[LIMPIEZA_REALIZADA.md](LIMPIEZA_REALIZADA.md)** - Archivos eliminados

---

## 📁 ESTRUCTURA

```
Skillswap_mobile/
├── Capstone_mobile/          ← 🎯 APP MÓVIL (React Native/Expo)
│   ├── app/                  ← Pantallas
│   ├── components/           ← Componentes
│   ├── src/services/         ← Lógica de negocio
│   └── package.json
│
├── Captone_project/
│   ├── backend/              ← 🔧 API (Node.js/Express)
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── config/
│   │
│   └── frontend/             ← 📦 Legacy (no usar)
│
└── Documentación/            ← 📚 5 archivos esenciales
```

---

## ✅ ESTADO ACTUAL

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend API | 🟢 Funcional | Node.js + Firebase |
| App Móvil | 🟢 Funcional | React Native + Expo |
| Autenticación | ✅ OK | Firebase Auth |
| Feed | ✅ OK | Muestra publicaciones |
| Perfil | ✅ OK | Editar, ver, eliminar |
| Chat | ✅ OK | Mensajes en tiempo real |
| Logout | ✅ OK | Limpia sesión completa |
| Storage | ⚠️ Pendiente | Aplicar reglas Firebase |

---

## 🎯 CARACTERÍSTICAS

### Implementadas:
- ✅ Autenticación (login/registro)
- ✅ Feed de publicaciones
- ✅ Crear publicaciones
- ✅ Perfiles de usuario
- ✅ Sistema de likes/matches
- ✅ Chat/Conversaciones
- ✅ Calendario de sesiones
- ✅ Galería de fotos
- ✅ Notificaciones
- ✅ Reviews/Reseñas

### En Desarrollo:
- 🔄 Editar publicación
- 🔄 Compartir publicación
- 🔄 Reportar contenido

---

## 🛠️ TECNOLOGÍAS

### Frontend:
- React Native 0.76.3
- Expo ~52.0.11
- TypeScript
- Expo Router
- Firebase SDK

### Backend:
- Node.js
- Express
- Firebase Admin SDK
- JWT Authentication

### Base de Datos:
- Firebase Firestore
- Firebase Storage
- Firebase Authentication

---

## 🔐 CONFIGURACIÓN

### Variables de Entorno:

#### Backend (`Captone_project/backend/.env`):
```env
PORT=5000
FIREBASE_PROJECT_ID=skillswappbd
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
JWT_SECRET=...
```

#### App (`Capstone_mobile/.env`):
```env
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

Ver `.env.example` en cada proyecto para plantilla completa.

---

## 🧪 TESTING

### Checklist Básico:
```bash
# Backend
curl http://localhost:5000/api/health
# Debe responder: {"status":"ok"}

# App
npm start
# Debe abrir Expo DevTools
```

### Funcionalidades:
- [ ] Login/Registro
- [ ] Ver feed
- [ ] Crear publicación
- [ ] Ver perfil
- [ ] Editar perfil
- [ ] Chat
- [ ] Likes/Matches
- [ ] Logout

---

## 📦 INSTALACIÓN COMPLETA

### Requisitos:
- Node.js >= 18
- npm >= 9
- Expo CLI (se instala automáticamente)
- Cuenta Firebase

### Pasos:

1. **Clonar repositorio**
   ```bash
   git clone <repo-url>
   cd Skillswap_mobile
   ```

2. **Backend**
   ```bash
   cd Captone_project/backend
   npm install
   cp .env.example .env
   # Editar .env con tus credenciales
   npm start
   ```

3. **App Móvil**
   ```bash
   cd Capstone_mobile
   npm install
   cp .env.example .env
   # Editar .env con tus credenciales
   npm start
   ```

4. **Firebase Storage**
   - Ir a Firebase Console
   - Storage > Rules
   - Copiar reglas de `FIREBASE_STORAGE_RULES_FINAL.txt`
   - Publicar

---

## 🐛 TROUBLESHOOTING

### "No se pueden subir fotos"
→ Aplicar reglas de Firebase Storage  
→ Ver: `SOLUCION_CORS_STORAGE.md`

### "Error de conexión al backend"
→ Verificar que backend está corriendo  
→ Verificar URL en `.env`

### "Feed vacío"
→ Crear algunas publicaciones de prueba  
→ Verificar filtros en `index.tsx`

### "Logout no funciona"
→ Ya resuelto en última actualización  
→ Hacer `git pull` para obtener última versión

---

## 📊 MÉTRICAS

- **Líneas de código**: ~15,000
- **Componentes**: ~30
- **Servicios**: ~15
- **Endpoints API**: 8 grupos
- **Pantallas**: ~20

---

## 🤝 CONTRIBUIR

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📝 CHANGELOG

### [30 Nov 2025] - Limpieza y Fixes
- ✅ Logout completo implementado
- ✅ Feed de publicaciones funcional
- ✅ Menú contextual en publicaciones
- ✅ Eliminados 27 archivos obsoletos
- ✅ Documentación consolidada
- ⚠️ Pendiente: Aplicar reglas Firebase Storage

---

## 📄 LICENCIA

Este proyecto es parte de un trabajo académico.

---

## 👥 EQUIPO

Proyecto Capstone - Universidad [Nombre]

---

## 🔗 ENLACES

- [Firebase Console](https://console.firebase.google.com)
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)

---

## ⚠️ IMPORTANTE

**Antes de usar en producción:**
1. ✅ Aplicar reglas de Firebase Storage
2. ✅ Configurar variables de entorno
3. ✅ Revisar permisos de Firestore
4. ✅ Configurar dominio en Firebase Auth
5. ✅ Testing exhaustivo

---

**Estado**: 🟢 Listo para desarrollo  
**Última actualización**: 30 Nov 2025  
**Versión**: 1.0.0-post-cleanup
