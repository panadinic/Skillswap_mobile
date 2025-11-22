import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { registerUser } from '@/src/services/register';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/src/services/firebase';

export default function RegistroScreen() {
  const router = useRouter();
  const { registroData, setRegistroData } = useRegistro();

  const [nombre, setNombre] = useState(registroData.nombre || '');
  const [email, setEmail] = useState(registroData.email || '');
  const [contrasena, setContrasena] = useState(registroData.contrasena || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(
    () => nombre.trim().length >= 2 && email.trim().includes('@') && contrasena.length >= 6 && !loading,
    [nombre, email, contrasena, loading]
  );

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError('');

    try {
      setLoading(true);
      await registerUser({ nombre: nombre.trim(), email: email.trim(), password: contrasena });
      await signInWithEmailAndPassword(auth, email.trim(), contrasena);

      setRegistroData((prev) => ({ ...prev, nombre, email, contrasena }));
      router.push('/register/conocimiento');
    } catch (err: any) {
      console.error('[register] error', err);
      setError(err?.message || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#14f195" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SS</Text>
            </View>
            <Text style={styles.title}>SkillSwap</Text>
            <Text style={styles.subtitle}>Conecta talentos e intercambia habilidades</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Crea tu cuenta</Text>
            <Text style={styles.cardSubtitle}>Completa tus datos para comenzar</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor="#6b7280"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#6b7280"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#6b7280"
                value={contrasena}
                onChangeText={setContrasena}
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#052014" />
              ) : (
                <Text style={styles.buttonText}>Registrar</Text>
              )}
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#14f195',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#052014',
    fontWeight: '800',
    fontSize: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#9aa0ab',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9aa0ab',
  },
  fieldGroup: {
    gap: 6,
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
  error: {
    color: '#ff9a9a',
    fontSize: 13,
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
