import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { useRegistro } from '@/src/context/RegistroContext';
import { auth, storage } from '@/src/services/firebase';
import { publicationsApi } from '@/src/services/api';
import { env } from '@/src/config/env';

const API_BASE = env.apiUrl;

export default function FotoScreen() {
  const router = useRouter();
  const { registroData, reset } = useRegistro();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Necesitas autorizar el acceso a tus fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[foto] pick error', err);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileRef = ref(
        storage,
        `uploads/avatars/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      );
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error('[foto] upload error', err);
      return null;
    }
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Debes iniciar sesión');
        return;
      }

      const token = await user.getIdToken();
      let fotoUrl: string | null = null;

      if (imageUri) {
        setUploading(true);
        fotoUrl = await uploadImage(imageUri);
        setUploading(false);

        if (fotoUrl) {
          try {
            await fetch(`${API_BASE}/api/users/me`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ fotoUrl }),
            });
          } catch (err) {
            console.warn('[foto] update profile error', err);
          }
        }
      }

      // Guardar intereses/etiquetas en el perfil para usar en el feed
      try {
        await fetch(`${API_BASE}/api/users/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            interestTags: registroData.intereses,
            intereses: registroData.intereses,
            tags: registroData.etiquetas,
          }),
        });
      } catch (err) {
        console.warn('[foto] no se pudieron guardar preferencias de usuario', err);
      }

      await publicationsApi.create({
        title: registroData.conocimiento,
        content: registroData.descripcion,
        imageUrl: fotoUrl,
        tags: registroData.etiquetas,
        interestTags: registroData.intereses,
      });

      reset();
      Alert.alert('¡Listo!', 'Tu perfil y publicación fueron creados exitosamente.');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[foto] finish error', err);
      Alert.alert('Error', err?.message || 'No se pudo completar el registro');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#14f195" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Sube tu foto</Text>
            <Text style={styles.subtitle}>
              Personaliza tu perfil con una imagen. Puedes cambiarla después.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Ionicons name="image-outline" size={20} color="#052014" />
            <Text style={styles.uploadText}>Elegir archivo</Text>
          </TouchableOpacity>

          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

          <TouchableOpacity
            style={[styles.button, (saving || uploading) && styles.buttonDisabled]}
            onPress={handleFinish}
            disabled={saving || uploading}
          >
            {saving || uploading ? (
              <ActivityIndicator color="#052014" />
            ) : (
              <Text style={styles.buttonText}>Finalizar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030816',
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#9aa0ab',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#14f195',
    paddingVertical: 12,
    justifyContent: 'center',
  },
  uploadText: {
    color: '#052014',
    fontWeight: '700',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 20,
  },
  button: {
    backgroundColor: '#14f195',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#052014',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
