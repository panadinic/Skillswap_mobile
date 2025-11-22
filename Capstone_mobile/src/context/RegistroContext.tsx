import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RegistroData {
  nombre: string;
  email: string;
  contrasena: string;
  conocimiento: string;
  descripcion: string;
  etiquetas: string[];
  intereses: string[];
  foto: string | null;
}

interface RegistroContextType {
  registroData: RegistroData;
  setRegistroData: React.Dispatch<React.SetStateAction<RegistroData>>;
  reset: () => void;
}

const initialData: RegistroData = {
  nombre: '',
  email: '',
  contrasena: '',
  conocimiento: '',
  descripcion: '',
  etiquetas: [],
  intereses: [],
  foto: null,
};

const RegistroContext = createContext<RegistroContextType | null>(null);

export function RegistroProvider({ children }: { children: ReactNode }) {
  const [registroData, setRegistroData] = useState<RegistroData>(initialData);

  const reset = () => setRegistroData(initialData);

  return (
    <RegistroContext.Provider value={{ registroData, setRegistroData, reset }}>
      {children}
    </RegistroContext.Provider>
  );
}

export function useRegistro() {
  const ctx = useContext(RegistroContext);
  if (!ctx) throw new Error('useRegistro debe usarse dentro de RegistroProvider');
  return ctx;
}
