# Guía para Generar APK con EAS Build

## Opción 1: Generar APK con EAS Build (Recomendado)

### Paso 1: Instalar EAS CLI
```bash
npm install -g eas-cli
```

### Paso 2: Autenticarse en EAS
```bash
eas login
```
Ingresa tus credenciales de Expo (crea una cuenta si no tienes)

### Paso 3: Configurar el proyecto
```bash
eas build:configure
```

### Paso 4: Generar APK
```bash
eas build --platform android --local
```

O para generar en la nube (recomendado):
```bash
eas build --platform android
```

El APK se descargará automáticamente cuando esté listo.

---

## Opción 2: Generar APK Localmente con Android Studio

### Requisitos:
- Android Studio instalado
- Android SDK configurado
- Java Development Kit (JDK) instalado

### Pasos:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Generar carpeta Android:**
   ```bash
   npx expo prebuild --clean
   ```

3. **Abrir en Android Studio:**
   - Abre Android Studio
   - File → Open → Selecciona la carpeta `android/`

4. **Generar APK:**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Espera a que termine
   - El APK estará en: `android/app/build/outputs/apk/release/`

---

## Verificar que el APK funciona

```bash
adb install -r app-release.apk
```

---

## Notas Importantes

- **EAS Build** es más fácil y recomendado
- El APK generado incluirá todas tus variables de entorno de `.env.local`
- Asegúrate que `EXPO_PUBLIC_API_URL` apunte a tu backend en Render
- El APK tardará 5-10 minutos en generarse

