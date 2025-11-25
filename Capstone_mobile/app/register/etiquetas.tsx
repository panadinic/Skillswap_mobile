import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRegistro } from '@/src/context/RegistroContext';

const OPCIONES = [
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

export default function EtiquetasScreen() {
  const router = useRouter();
  const { registroData, setRegistroData } = useRegistro();

  const [seleccionadas, setSeleccionadas] = useState<string[]>(
    registroData.etiquetas || []
  );

  const toggle = (tag: string) => {
    setSeleccionadas((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const handleNext = () => {
    setRegistroData((prev) => ({ ...prev, etiquetas: seleccionadas }));
    router.push('/register/intereses');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#14f195" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Define tu conocimiento</Text>
            <Text style={styles.subtitle}>Elige las etiquetas que describen tu habilidad.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.chipsContainer}>
            {OPCIONES.map((tag) => {
              const active = seleccionadas.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggle(tag)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>Siguiente</Text>
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
    backgroundColor: '#14f195',
    borderColor: '#14f195',
  },
  chipText: {
    color: '#cbd5f5',
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#03150f',
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
});
