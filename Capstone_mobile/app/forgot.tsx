import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { sendResetPasswordEmail } from '@/src/services/auth';

export default function ForgotScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => Boolean(email.trim()) && !sending, [email, sending]);

  const handleSend = async () => {
    if (!email.trim()) {
      setErrorMsg('Ingresa tu correo.');
      return;
    }
    setErrorMsg('');
    try {
      setSending(true);
      await sendResetPasswordEmail(email.trim());
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No pudimos enviar el correo. Intenta nuevamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Recupera tu contraseña</Text>
          <Text style={styles.subtitle}>
            Te enviaremos un enlace de restablecimiento al correo asociado a tu cuenta.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#8a93aa"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          {success ? (
            <Text style={styles.success}>
              Si el correo existe, enviamos un enlace de recuperación. Revisa también spam.
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.buttonPrimary, !canSubmit && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!canSubmit}
          >
            {sending ? (
              <ActivityIndicator color="#04121c" />
            ) : (
              <Text style={styles.buttonText}>Enviar enlace</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.buttonGhost} onPress={() => router.replace('/')}>
            <Text style={styles.buttonGhostText}>Volver al login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030816',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#9aa0ab',
    fontSize: 14,
  },
  fieldGroup: {
    gap: 6,
    marginTop: 8,
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
  success: {
    color: '#7ef2c8',
    fontSize: 13,
  },
  buttonPrimary: {
    backgroundColor: '#00c48c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#05121f',
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
});
