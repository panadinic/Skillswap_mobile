# PLAN.md - AnÃ¡lisis y Fixes para SkillSwap

## ðŸ” ANÃLISIS DEL REPOSITORIO

### 1. InicializaciÃ³n de Firebase

**Backend (Admin SDK):**
- **Archivo:** `backend/config/firebase.js`
- **InicializaciÃ³n:** Firebase Admin SDK con `serviceAccountKey.json`
- **Servicios:** `auth` (Authentication) y `db` (Firestore)
- **Storage:** No inicializado en backend

**Frontend (Client SDK):**
- **Archivo:** `frontend/src/lib/firebaseClient.js`
- **InicializaciÃ³n:** Firebase Client SDK con variables de entorno
- **Servicios:** `auth` (Authentication) y `storage` (Storage)
- **Firestore:** No inicializado en frontend (solo se usa en backend)

### 2. CreaciÃ³n/ActualizaciÃ³n de Usuarios `/users/{uid}`

**Flujo Actual:**
1. **Registro:** `frontend/src/components/registro/Registro.js` â†’ `frontend/src/services/auth.js` â†’ `registerUser()`
2. **Backend:** `backend/controllers/authController.js` â†’ `register()` crea usuario en Firebase Auth + documento en `/users/{uid}`
3. **Login:** `frontend/src/components/login/Login.js` â†’ `frontend/src/services/auth.js` â†’ `loginWithPassword()`

**Problema Identificado:** 
- El frontend usa Firebase Client SDK para registro/login
- El backend usa Firebase Admin SDK para crear usuarios
- **DESCONEXIÃ“N:** El frontend no llama al backend para registro, solo usa Firebase Client SDK

### 3. CreaciÃ³n de Posts `/posts` y Listado en Home

**CreaciÃ³n de Posts:**
- **Frontend:** `frontend/src/services/publications.js` â†’ `createPublication()` â†’ llama a `backend/api/publications`
- **Backend:** `backend/controllers/publicationsController.js` â†’ `createPublication()` â†’ crea en colecciÃ³n `publications`
- **Middleware:** `backend/middleware/authMiddleware.js` verifica token Firebase

**Listado en Home:**
- **Frontend:** `frontend/src/components/pages/Home.js` â†’ fetch a `backend/api/publications`
- **Backend:** `backend/controllers/publicationsController.js` â†’ `getAllPublications()` â†’ consulta `publications` donde `activo == true`

### 4. HipÃ³tesis Concretas de Por QuÃ© No Funciona

#### ðŸ”´ **PROBLEMA PRINCIPAL: DESCONEXIÃ“N FRONTEND-BACKEND**

1. **Registro de Usuarios:**
   - Frontend usa Firebase Client SDK (`registerUser()`)
   - Backend tiene endpoint `/api/auth/register` que NO se usa
   - **Resultado:** Usuarios se crean en Firebase Auth pero NO en Firestore `/users/{uid}`

2. **AutenticaciÃ³n:**
   - Frontend usa Firebase Client SDK para login
   - Backend espera tokens Firebase ID para middleware
   - **Resultado:** Login funciona pero backend no puede verificar tokens

3. **CreaciÃ³n de Posts:**
   - Frontend llama a backend con token Firebase ID
   - Backend middleware verifica token pero puede fallar
   - **Resultado:** Posts no se crean o no se muestran

4. **Variables de Entorno:**
   - Frontend necesita `.env` con config Firebase
   - Backend necesita `serviceAccountKey.json`
   - **Resultado:** Posible falta de configuraciÃ³n

## ðŸ› ï¸ PLAN DE FIXES MÃNIMOS

### **PASO 1: Verificar ConfiguraciÃ³n Firebase**
- [ ] Verificar que `frontend/.env` existe con variables Firebase
- [ ] Verificar que `backend/serviceAccountKey.json` existe y es vÃ¡lido
- [ ] Verificar que `backend/.env` existe con `JWT_SECRET`

### **PASO 2: Conectar Frontend con Backend para Registro**
- [ ] Modificar `frontend/src/services/auth.js` para llamar a `backend/api/auth/register`
- [ ] Asegurar que el backend crea documento en `/users/{uid}` tras registro
- [ ] Verificar que el token Firebase ID se genera correctamente

### **PASO 3: Verificar Middleware de AutenticaciÃ³n**
- [ ] Verificar que `backend/middleware/authMiddleware.js` funciona con tokens Firebase ID
- [ ] AÃ±adir logs para debuggear verificaciÃ³n de tokens
- [ ] Verificar que `req.user` contiene `uid` correcto

### **PASO 4: Verificar CreaciÃ³n de Posts**
- [ ] Verificar que `frontend/src/services/publications.js` envÃ­a token correcto
- [ ] Verificar que `backend/controllers/publicationsController.js` crea posts en colecciÃ³n `publications`
- [ ] Verificar que posts se crean con `activo: true`

### **PASO 5: Verificar Listado en Home**
- [ ] Verificar que `frontend/src/components/pages/Home.js` llama a endpoint correcto
- [ ] Verificar que `backend/controllers/publicationsController.js` retorna posts con `activo: true`
- [ ] Verificar que consulta Firestore funciona correctamente

### **PASO 6: AÃ±adir Logs y Debugging**
- [ ] AÃ±adir `console.log` en frontend para verificar llamadas a API
- [ ] AÃ±adir `console.log` en backend para verificar recepciÃ³n de requests
- [ ] AÃ±adir manejo de errores mÃ¡s detallado

### **PASO 7: Verificar Firestore Rules**
- [ ] Verificar que reglas de Firestore permiten lectura/escritura en `/users` y `/publications`
- [ ] Verificar que reglas permiten acceso autenticado

### **PASO 8: Testing End-to-End**
- [ ] Probar registro completo: frontend â†’ backend â†’ Firestore
- [ ] Probar login completo: frontend â†’ backend â†’ middleware
- [ ] Probar creaciÃ³n de post: frontend â†’ backend â†’ Firestore
- [ ] Probar listado en Home: frontend â†’ backend â†’ Firestore

## ðŸŽ¯ PRIORIDADES

1. **CRÃTICO:** Conectar frontend con backend para registro
2. **CRÃTICO:** Verificar middleware de autenticaciÃ³n
3. **ALTO:** Verificar creaciÃ³n de posts
4. **ALTO:** Verificar listado en Home
5. **MEDIO:** AÃ±adir logs y debugging
6. **BAJO:** Verificar Firestore rules

## ðŸ“ NOTAS ADICIONALES

- El proyecto tiene **DOS sistemas de autenticaciÃ³n** (Firebase Client + Backend JWT)
- Necesita **unificaciÃ³n** en un solo flujo
- El backend estÃ¡ preparado para Firebase Admin SDK
- El frontend estÃ¡ preparado para Firebase Client SDK
- **SoluciÃ³n:** Usar Firebase Client SDK en frontend + Firebase Admin SDK en backend



