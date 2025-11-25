import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { uploadUserPhoto } from '@/src/services/photos';

export default function AddPhotoScreen() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCamera = useCallback(async () => {
    if (saving) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Autoriza el acceso a la cámara para tomar fotos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length) {
        setPreview(result.assets[0].uri);
        setError(null);
      }
    } catch (err: any) {
      Alert.alert('No se pudo abrir la cámara', err?.message || 'Intenta nuevamente.');
    }
  }, [saving]);

  const openGallery = useCallback(async () => {
    if (saving) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Autoriza el acceso a tus fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!result.canceled && result.assets?.length) {
        setPreview(result.assets[0].uri);
        setError(null);
      }
    } catch (err: any) {
      Alert.alert('No se pudo abrir la galería', err?.message || 'Intenta nuevamente.');
    }
  }, [saving]);

  const save = useCallback(async () => {
    if (!preview) {
      setError('Selecciona una imagen.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await uploadUserPhoto(preview, description.trim());
      // Volver a la pestaña de fotos; al enfocar, el perfil recarga la galería
      router.replace('/(tabs)/profile');
    } catch (err: any) {
      const message = err?.message || 'No se pudo guardar la foto. Intenta nuevamente.';
      setError(message);
      Alert.alert('No se pudo guardar', message);
    } finally {
      setSaving(false);
    }
  }, [preview, description, router, saving]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#14f195" />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nueva foto</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={openCamera} disabled={saving}>
              <Ionicons name="camera" size={18} color="#032415" />
              <Text style={styles.actionText}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={openGallery} disabled={saving}>
              <Ionicons name="image" size={18} color="#032415" />
              <Text style={styles.actionText}>Elegir foto</Text>
            </TouchableOpacity>
          </View>

          {preview ? (
            <Image source={{ uri: preview }} style={styles.preview} />
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Text style={styles.placeholderText}>Sin imagen seleccionada</Text>
            </View>
          )}

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={styles.input}
            placeholder="Opcional"
            placeholderTextColor="#6b7280"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#040315',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: '#14f195',
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginRight: 38,
  },
  card: {
    backgroundColor: '#0d162f',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1a2d4f',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#14f195',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    color: '#032415',
    fontWeight: '800',
  },
  preview: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2f59',
    backgroundColor: '#0b1220',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#6b7280',
  },
  label: {
    color: '#cdd6f6',
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2f59',
    backgroundColor: '#101b3c',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    color: '#ff9a9a',
  },
  saveBtn: {
    borderRadius: 12,
    backgroundColor: '#14f195',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#032415',
    fontWeight: '800',
  },
});
