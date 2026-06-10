'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import { googleProvider, messaging, getToken } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  status?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  activeRole: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGooglePopup: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  switchRole: (role: string) => void;
  reloadUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUserFromFirestore = async (firebaseUser: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        const baseRole = data.role || 'RESIDENTE';

        let initialActiveRole = baseRole;
        if (baseRole === 'ADMINISTRADOR') {
          const storedRole = localStorage.getItem(`activeRole_${firebaseUser.uid}`);
          if (storedRole === 'PORTERÍA') {
            initialActiveRole = 'PORTERÍA';
          }
        }

        let userStatus = 'ACTIVE';
        if (baseRole === 'RESIDENTE') {
          try {
            const residentsQuery = query(collection(db, 'residents'), where('email', '==', firebaseUser.email));
            const residentsSnap = await getDocs(residentsQuery);
            if (!residentsSnap.empty) {
              userStatus = residentsSnap.docs[0].data().status || 'ACTIVE';
            }
          } catch (e) {
            console.error('Error fetching resident status', e);
          }
        }

        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          role: baseRole,
          tenantId: data.tenantId || '',
          status: userStatus,
        });
        setActiveRole(initialActiveRole);
      } else {
        console.error('No se encontró el documento de perfil del usuario en Firestore');
        setUser(null);
        setActiveRole(null);
      }
    } catch (e) {
      console.error('Error al cargar perfil de usuario de Firestore:', e);
      setUser(null);
      setActiveRole(null);
    }
  };

  const setupNotifications = async (uid: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && messaging) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY });
          if (token) {
            await updateDoc(doc(db, 'users', uid), { fcmToken: token });
          }
        }
      }
    } catch (e) {
      console.error('Error configurando notificaciones:', e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        await loadUserFromFirestore(firebaseUser);
        setupNotifications(firebaseUser.uid);
      } else {
        setUser(null);
        setActiveRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Login en Firebase Auth (la persistencia la maneja el SDK de Firebase automáticamente)
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      setLoading(false);
      // Traducir mensajes comunes de error de Firebase
      let message = 'Error al iniciar sesión';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = 'Usuario o contraseña incorrectos';
      } else if (error.code === 'auth/invalid-email') {
        message = 'El correo electrónico no es válido';
      }
      throw new Error(message);
    }
  };

  const loginWithGooglePopup = async (): Promise<UserCredential> => {
    setLoading(true);
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message || 'Error al iniciar sesión con Google');
    }
  };

  const reloadUserProfile = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await loadUserFromFirestore(currentUser);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setActiveRole(null);
      router.push('/login');
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (role: string) => {
    if (!user) return;
    if (user.role !== 'ADMINISTRADOR') return; // Solo administradores pueden conmutar de rol
    if (role !== 'ADMINISTRADOR' && role !== 'PORTERÍA') return;

    setActiveRole(role);
    localStorage.setItem(`activeRole_${user.id}`, role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        loading,
        login,
        loginWithGooglePopup,
        logout,
        isAuthenticated: !!user,
        switchRole,
        reloadUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
