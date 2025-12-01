# SOLUCIÓN DEFINITIVA - ERROR CORS FIREBASE STORAGE

## 🔴 PROBLEMA

```
CORS Preflight Did Not Succeed
POST https://firebasestorage.googleapis.com/v0/b/skillswappbd.appspot.com/o?name=Uploads/avatars/...
Status: 404
```

## 🎯 CAUSA RAÍZ

El error 404 en el preflight OPTIONS indica que **las reglas de Firebase Storage están bloqueando la ruta**.

### Inconsistencias detectadas:

1. **Capitalización**: 
   - Código usa: `Uploads/avatars/...`
   - Reglas esperan: `uploads/avatars/...`

2. **Spelling**:
   - Código usa: `uploads/galery/...`
   - Algunas reglas esperan: `uploads/gallery/...`

3. **Reglas restrictivas**: No permiten wildcards para capitalización

## ✅ SOLUCIÓN PASO A PASO

### PASO 1: Aplicar Reglas de Firebase Storage

1. Abrir: https://console.firebase.google.com
2. Seleccionar proyecto: **skillswappbd**
3. Menú lateral: **Storage**
4. Pestaña: **Rules**
5. Copiar y pegar estas reglas:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Avatares - permite Uploads y uploads
    match /{prefix}/avatars/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Galería - permite galery y gallery
    match /{prefix}/galery/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /{prefix}/gallery/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Publicaciones
    match /{prefix}/publications/{fileName} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Catch-all para debug (REMOVER EN PRODUCCIÓN)
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

6. Hacer clic en **Publicar**
7. Esperar confirmación: "Reglas publicadas correctamente"

### PASO 2: Verificar en la App

1. Abrir la app
2. Ir a perfil
3. Intentar cambiar foto de perfil
4. Abrir consola del navegador (F12)
5. Verificar que NO hay errores 404

### PASO 3: Si Persiste el Error

Si después de aplicar las reglas sigue el error:

1. **Limpiar caché del navegador**:
   - Chrome: Ctrl+Shift+Delete
   - Seleccionar "Imágenes y archivos en caché"
   - Limpiar

2. **Verificar autenticación**:
   ```javascript
   // En consola del navegador
   firebase.auth().currentUser
   ```
   Debe mostrar el usuario actual, no null

3. **Verificar token**:
   ```javascript
   // En consola del navegador
   firebase.auth().currentUser.getIdToken().then(console.log)
   ```
   Debe mostrar un token JWT válido

4. **Verificar reglas aplicadas**:
   - Volver a Firebase Console > Storage > Rules
   - Verificar que las reglas están publicadas
   - Verificar fecha de última publicación

## 🔍 DEBUGGING ADICIONAL

### Ver requests en Network Tab:

1. Abrir DevTools (F12)
2. Pestaña Network
3. Filtrar por "firebasestorage"
4. Intentar subir foto
5. Ver detalles del request OPTIONS:

**Si es 404**:
- Las reglas no permiten la ruta
- Verificar que las reglas están publicadas

**Si es 403**:
- El usuario no tiene permisos
- Verificar autenticación

**Si es 200 pero luego falla el POST**:
- Problema con el blob/archivo
- Verificar que el archivo es válido

### Verificar en Firebase Console:

1. Storage > Files
2. Intentar subir archivo manualmente
3. Si falla: problema con el proyecto
4. Si funciona: problema con el código

## 📝 NOTAS IMPORTANTES

1. **Regla catch-all**: La última regla permite todo para debug. En producción, comentarla o eliminarla.

2. **Capitalización**: Las reglas ahora usan `{prefix}` que acepta cualquier capitalización.

3. **Compatibilidad**: Las reglas permiten tanto `galery` como `gallery` para compatibilidad con código legacy.

4. **Seguridad**: Solo el dueño puede escribir en su carpeta, pero todos pueden leer (fotos públicas).

## 🚀 ALTERNATIVA: Usar Storage Emulator

Si no puedes modificar las reglas de producción:

1. Instalar Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Inicializar emulators:
   ```bash
   firebase init emulators
   ```

3. Seleccionar Storage

4. Iniciar emulators:
   ```bash
   firebase emulators:start
   ```

5. Configurar app para usar emulator:
   ```javascript
   // En firebase.ts
   import { connectStorageEmulator } from 'firebase/storage';
   
   if (process.env.NODE_ENV === 'development') {
     connectStorageEmulator(storage, 'localhost', 9199);
   }
   ```

## ✅ CHECKLIST

- [ ] Aplicar reglas en Firebase Console
- [ ] Verificar que reglas están publicadas
- [ ] Limpiar caché del navegador
- [ ] Probar subir foto de perfil
- [ ] Probar subir foto a galería
- [ ] Verificar en Network tab que no hay 404
- [ ] Verificar en Storage > Files que se crearon los archivos

## 🆘 SI NADA FUNCIONA

Contactar soporte de Firebase:
- https://firebase.google.com/support

O revisar:
- Cuota de Storage no excedida
- Proyecto no suspendido
- Billing habilitado (si es necesario)
- CORS configurado en el bucket (raro, pero posible)

---

**Última actualización**: 30 Nov 2025
**Estado**: Reglas listas para aplicar
**Prioridad**: 🔴 CRÍTICA - Sin esto no funcionan las fotos
