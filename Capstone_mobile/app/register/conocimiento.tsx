import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRegistro } from '@/src/context/RegistroContext';

export default function ConocimientoScreen() {
  const router = useRouter();
  const { registroData, setRegistroData } = useRegistro();

  const [conocimiento, setConocimiento] = useState(registroData.conocimiento || '');
  const [descripcion, setDescripcion] = useState(registroData.descripcion || '');

  const canContinue = conocimiento.trim() && descripcion.trim();

  const handleNext = () => {
    if (!canContinue) return;
    setRegistroData((prev) => ({ ...prev, conocimiento, descripcion }));
    router.push('/register/etiquetas');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color="#14f195" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>¿Qué le ofreces a SkillSwap?</Text>
              <Text style={styles.subtitle}>
                Cuéntanos qué habilidad compartirás con la comunidad.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Ponle un nombre a tu conocimiento</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del conocimiento"
              placeholderTextColor="#6b7280"
              value={conocimiento}
              onChangeText={setConocimiento}
            />

            <Text style={styles.label}>Describe tu conocimiento</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Describe el contenido, formato o nivel de tu experiencia"
              placeholderTextColor="#6b7280"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.button, !canContinue && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!canContinue}
            >
              <Text style={styles.buttonText}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 16,
  },
  label: {
    color: '#cbd5f5',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2a44',
    backgroundColor: '#101a34',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: {
    minHeight: 120,
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
