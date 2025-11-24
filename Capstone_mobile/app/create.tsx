import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { publicationsApi } from '@/src/services/api';
import { storage, auth } from '@/src/services/firebase';

const TAG_OPTIONS = [
  'DEPORTES',
  'CIENCIAS',
  'FITNESS',
  'ARTES',
  'MUSICA',
  'IDIOMAS',
  'FILOSOFIA',
  'COMPUTACION',
  'PROGRAMACION',
  'ESCRITURA',
  'COCINA',
  'FINANZAS',
  'MODA',
  'ROBOTICA',
  'QUIMICA',
  'HISTORIA',
  'MATEMATICAS',
  'LITERATURA',
];

const TOTAL_STEPS = 3;

export default function CreatePublicationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: '',
    description: '',
    skillTags: [] as string[],
    interestTags: [] as string[],
    imageUri: '' as string | null | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disablePrimary = useMemo(() => {
    if (saving) return true;
    if (step === 0) {
      return !form.title.trim() || !form.description.trim();
    }
    return false;
  }, [step, form, saving]);

  const goBack = () => {
    if (saving) return;
    if (step === 0) router.back();
    else setStep((prev) => Math.max(prev - 1, 0));
  };

  const toggleTag = (key: 'skillTags' | 'interestTags', value: string) => {
    setForm((prev) => {
      const set = new Set(prev[key]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  const pickImage = async () => {
    try {
      setPicking(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Necesitas autorizar el acceso a tus fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaType.Images,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setForm((prev) => ({ ...prev, imageUri: result.assets![0].uri }));
        setError(null);
      }
    } catch (err: any) {
      console.warn('[create-post] pick image error', err);
      setError(err?.message || 'No pudimos abrir tus fotos.');
    } finally {
      setPicking(false);
    }
  };

  const uploadImageIfNeeded = async () => {
    if (!form.imageUri) return null;
    const user = auth.currentUser;
    if (!user) throw new Error('Necesitas iniciar sesion para subir la foto.');
    const response = await fetch(form.imageUri);
    const blob = await response.blob();
    const fileRef = ref(
      storage,
      `uploads/publications/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    );
    await uploadBytes(fileRef, blob, {
      contentType: blob.type || 'image/jpeg',
    });
    return getDownloadURL(fileRef);
  };

  const handlePublish = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setError(null);
      const imageUrl = await uploadImageIfNeeded();
      await publicationsApi.create({
        title: form.title.trim(),
        content: form.description.trim(),
        tags: form.skillTags,
        interestTags: form.interestTags,
        imageUrl: imageUrl ?? null,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[create-post] publish error', err);
      setError(err?.message || 'No pudimos crear la publicacion.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrimary = () => {
    if (step === TOTAL_STEPS - 1) {
      handlePublish();
    } else {
      setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color="#0f172a" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>Paso {step + 1} de {TOTAL_STEPS}</Text>
              <Text style={styles.title}>
                {step === 0
                  ? 'Que le ofreces a SkillSwapp?'
                  : step === 1
                  ? 'Define tu conocimiento'
                  : 'Sube una imagen'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 0
                  ? 'Cuentanos que habilidad compartiras con la comunidad.'
                  : step === 1
                  ? 'Elige las etiquetas que describen tu habilidad.'
                  : 'Personaliza tu publicacion con una imagen.'}
              </Text>
            </View>
          </View>

          {step === 0 && (
            <View style={styles.formBlock}>
              <Text style={styles.label}>Ponle un nombre a tu conocimiento</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del conocimiento"
                placeholderTextColor="#6b7280"
                value={form.title}
                onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
              />
              <Text style={[styles.label, { marginTop: 16 }]}>Describe tu conocimiento</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe el contenido, formato o nivel de tu experiencia"
                placeholderTextColor="#6b7280"
                value={form.description}
                onChangeText={(text) => setForm((prev) => ({ ...prev, description: text }))}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
          )}

          {step === 1 && (
            <View style={styles.formBlock}>
              <View style={styles.chipsContainer}>
                {TAG_OPTIONS.map((option) => {
                  const active = form.skillTags.includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleTag('skillTags', option)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.formBlock}>
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage} disabled={picking}>
                <Ionicons name="image-outline" size={20} color="#0f172a" />
                <Text style={styles.uploadText}>
                  {picking ? 'Abriendo galeria...' : 'Elegir imagen'}
                </Text>
              </TouchableOpacity>
              {form.imageUri ? (
                <Image source={{ uri: form.imageUri }} style={styles.preview} />
              ) : (
                <Text style={styles.helper}>Puedes omitir este paso si no quieres subir imagen.</Text>
              )}
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, disablePrimary && { opacity: 0.6 }]}
            onPress={handlePrimary}
            disabled={disablePrimary}
          >
            {saving ? (
              <ActivityIndicator color="#052014" />
            ) : (
              <Text style={styles.primaryText}>
                {step === TOTAL_STEPS - 1 ? 'Finalizar' : 'Siguiente'}
              </Text>
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
    backgroundColor: '#030215',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: '#090f25',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#13f5a3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: {
    color: '#7dd3fc',
    fontSize: 12,
    marginBottom: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  formBlock: {
    gap: 12,
  },
  label: {
    color: '#c7d2fe',
    fontWeight: '600',
  },
  input: {
    borderRadius: 18,
    backgroundColor: '#111a3f',
    borderWidth: 1,
    borderColor: '#1e2b52',
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
  },
  textarea: {
    minHeight: 130,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111a30',
    borderWidth: 1,
    borderColor: '#1f2c56',
  },
  chipActive: {
    backgroundColor: '#13f5a3',
    borderColor: '#13f5a3',
  },
  chipText: {
    color: '#cbd5f5',
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#03150f',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#13f5a3',
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
    marginTop: 12,
  },
  helper: {
    color: '#94a3b8',
    textAlign: 'center',
  },
  errorBox: {
    borderRadius: 16,
    backgroundColor: '#7f1d1d',
    padding: 12,
  },
  errorText: {
    color: '#fee2e2',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#13f5a3',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#052014',
    fontWeight: '700',
    fontSize: 16,
  },
});
