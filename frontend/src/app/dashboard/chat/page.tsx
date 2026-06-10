'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import { Send, User, MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderRole: string;
  timestamp: any;
}

export default function ChatPage() {
  const { user, activeRole } = useAuth();
  
  // Lista de residentes (solo para Admin)
  const [residents, setResidents] = useState<any[]>([]);
  const [selectedResident, setSelectedResident] = useState<any | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = activeRole === 'ADMINISTRADOR';

  // Cargar residentes si es Admin
  useEffect(() => {
    if (isAdmin && user?.tenantId) {
      setLoadingResidents(true);
      const fetchResidents = async () => {
        try {
          const q = query(
            collection(db, 'users'),
            where('tenantId', '==', user.tenantId),
            where('role', '==', 'RESIDENTE')
          );
          const snap = await getDocs(q);
          const res: any[] = [];
          snap.forEach(doc => {
            res.push({ id: doc.id, ...doc.data() });
          });
          setResidents(res);
        } catch (e) {
          console.error('Error fetching residents:', e);
        } finally {
          setLoadingResidents(false);
        }
      };
      fetchResidents();
    }
  }, [isAdmin, user]);

  // Si es residente, autoseleccionarse
  useEffect(() => {
    if (!isAdmin && user) {
      setSelectedResident(user);
    }
  }, [isAdmin, user]);

  // Escuchar mensajes cuando haya un residente seleccionado
  useEffect(() => {
    if (!selectedResident || !user?.tenantId) return;

    setLoadingMessages(true);
    const chatId = `${user.tenantId}_${selectedResident.id}`;
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = [];
      snap.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
      setLoadingMessages(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedResident, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedResident || !user?.tenantId) return;

    const chatId = `${user.tenantId}_${selectedResident.id}`;
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    
    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(messagesRef, {
        text: msgText,
        senderId: user.id,
        senderRole: activeRole,
        timestamp: serverTimestamp(),
      });

      // Llamar al backend de notificaciones (Render)
      const isResidentSending = !isAdmin;
      const recipientId = isResidentSending ? 'ADMIN' : selectedResident.id;
      const senderName = isResidentSending 
        ? `${user.firstName || 'Residente'} ${user.lastName || ''}`.trim()
        : 'Administración';

      // Cambia esta URL a la de tu servidor de Render en producción
      const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://notificaciones-residentepro2.onrender.com';
      
      fetch(`${BACKEND_URL}/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          tenantId: user.tenantId,
          title: `Nuevo mensaje de ${senderName}`,
          body: msgText,
        })
      }).catch(err => console.error('Error triggering push:', err));

    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
      
      {/* Sidebar para Administrador */}
      {isAdmin && (
        <div className="w-1/3 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center">
              <MessageSquare className="h-4 w-4 mr-2 text-violet-500" />
              Chats con Residentes
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loadingResidents ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              </div>
            ) : residents.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No hay residentes registrados.
              </div>
            ) : (
              residents.map((res) => (
                <button
                  key={res.id}
                  onClick={() => setSelectedResident(res)}
                  className={`w-full text-left p-4 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors flex items-center space-x-3 ${
                    selectedResident?.id === res.id ? 'bg-violet-500/10 border-l-2 border-l-violet-500' : ''
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {res.firstName} {res.lastName}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">Residente</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Área Principal de Chat */}
      <div className={`flex-1 flex flex-col bg-[#09090b] relative ${!isAdmin && 'w-full'}`}>
        {!selectedResident ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">Selecciona un residente para iniciar el chat</p>
          </div>
        ) : (
          <>
            {/* Header del Chat */}
            <div className="h-16 px-6 border-b border-zinc-800 flex items-center bg-zinc-900/50 shrink-0">
              <div className="h-8 w-8 rounded-full bg-violet-600/20 flex items-center justify-center mr-3">
                <User className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {isAdmin ? `${selectedResident.firstName} ${selectedResident.lastName}` : 'Administración'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {isAdmin ? 'Residente' : 'Soporte Directo'}
                </p>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-zinc-500 text-sm">
                  No hay mensajes todavía. ¡Escribe el primero!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-violet-600 text-white rounded-tr-sm'
                            : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                        }`}
                      >
                        <p>{msg.text}</p>
                        <span className={`text-[10px] mt-1 block opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para Enviar */}
            <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="h-11 w-11 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5 ml-1" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
