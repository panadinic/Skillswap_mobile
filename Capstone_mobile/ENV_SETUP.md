# Configuración de Variables de Entorno

## Pasos para configurar las credenciales

1. **Copia el archivo de ejemplo:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edita `.env.local` con tus credenciales:**
   - Reemplaza los valores de Firebase con tus credenciales reales
   - Configura `EXPO_PUBLIC_API_URL` con la URL de tu backend

3. **Variables disponibles:**
   - `EXPO_PUBLIC_FIREBASE_API_KEY` - API Key de Firebase
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` - Auth Domain de Firebase
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID` - Project ID de Firebase
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` - Storage Bucket de Firebase
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Messaging Sender ID
   - `EXPO_PUBLIC_FIREBASE_APP_ID` - App ID de Firebase
   - `EXPO_PUBLIC_API_URL` - URL del backend (ej: http://localhost:5001)

## Importante

- **NUNCA** hagas commit de `.env.local` (ya está en `.gitignore`)
- Usa `.env.example` como referencia para nuevos desarrolladores
- Para producción, configura estas variables en tu plataforma de deployment (EAS Build, etc.)

## Para EAS Build (Producción)

Si usas EAS Build, configura las variables en `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_FIREBASE_API_KEY": "@FIREBASE_API_KEY",
        "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "@FIREBASE_AUTH_DOMAIN",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "@FIREBASE_PROJECT_ID",
        "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "@FIREBASE_STORAGE_BUCKET",
        "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "@FIREBASE_MESSAGING_SENDER_ID",
        "EXPO_PUBLIC_FIREBASE_APP_ID": "@FIREBASE_APP_ID",
        "EXPO_PUBLIC_API_URL": "@API_URL"
      }
    }
  }
}
```

Luego configura los secretos en EAS:
```bash
eas secret:create --scope project --name FIREBASE_API_KEY --value "tu_valor"
```
