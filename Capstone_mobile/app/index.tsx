import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getStoredSession, loginWithEmail } from '@/src/services/auth';
import { auth } from '@/src/services/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = useMemo(
    () => Boolean(email.trim() && password.trim() && !loading),
    [email, password, loading]
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        router.replace('/(tabs)');
      } else {
        setCheckingSession(false);
      }
    });
    return unsubscribe;
  }, [router]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }
    setErrorMsg('');
    try {
      setLoading(true);
      await loginWithEmail(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[mobile] login error', error);
      setErrorMsg(error?.message ?? 'No se pudo iniciar sesión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  const handleForgot = () => {
    router.push('/forgot');
  };

  if (checkingSession) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#59f5c9" />
        <Text style={styles.loadingText}>Preparando tu experiencia...</Text>
      </View>
    );
  }

  const horizontalPadding = Math.max(16, Math.min(28, width * 0.06));
  const cardMaxWidth = Math.min(540, width - horizontalPadding * 2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: horizontalPadding, alignItems: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.brandRow, { width: '100%', maxWidth: cardMaxWidth }]}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SS</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>SkillSwap</Text>
              <Text style={styles.brandSubtitle}>
                Intercambia habilidades y coordina sesiones
              </Text>
            </View>
          </View>

          <View style={[styles.card, { width: '100%', maxWidth: cardMaxWidth }]}>
            <Text style={styles.cardTitle}>Bienvenido de nuevo</Text>
            <Text style={styles.cardSubtitle}>Inicia sesión con tus credenciales</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9aa0ab"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor="#9aa0ab"
                secureTextEntry
                textContentType="password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.buttonPrimary, !canSubmit && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonPrimaryText}>Ingresar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonSecondary} onPress={handleRegister}>
              <Text style={styles.buttonSecondaryText}>Crear cuenta</Text>
            </TouchableOpacity>

            <Pressable onPress={handleForgot} style={styles.forgotLink}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
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
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 48,
    gap: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00d89e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#05121f',
    fontWeight: '800',
    fontSize: 20,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
  },
  brandSubtitle: {
    color: '#9aa0ab',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
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
  buttonPrimary: {
    backgroundColor: '#00c48c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#05121f',
  },
  buttonSecondary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f3d68',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d6ddff',
  },
  buttonGhost: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1a213b',
  },
  buttonGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e0e7ff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: 4,
  },
  forgotText: {
    color: '#7ed7ff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030816',
    gap: 12,
  },
  loadingText: {
    color: '#cbd5f5',
    fontSize: 15,
  },
});
