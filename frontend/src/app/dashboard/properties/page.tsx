'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import {
  Building, Home, Plus, Loader2, Users, ChevronRight, ArrowLeft,
  Search, CheckCircle2, XCircle, Eye, Sparkles, Hash, Layers,
  UserCheck, User, X, AlertCircle, ChevronDown, Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../../../lib/mail';

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface Property {
  id: string;
  tower: string;
  towerType: 'apartment' | 'house';
  unit: string;
  floor: number | null;
  status: 'VACANT' | 'OCCUPIED';
  ownerId: string | null;
  ownerName: string | null;
  inhabitantId: string | null;
  inhabitantName: string | null;
  tenantId: string;
}

interface ResidentOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  properties: { tower: string; unit: string }[];
}

interface TowerGroup {
  name: string;
  type: 'apartment' | 'house';
  units: Property[];
  occupied: number;
  vacant: number;
}

// ─── SEARCHABLE DROPDOWN ──────────────────────────────────────────────────
function ResidentDropdown({
  label, value, residents, onSelect, disabled,
}: {
  label: string;
  value: { id: string | null; name: string | null };
  residents: ResidentOption[];
  onSelect: (id: string | null, name: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = residents.filter(r =>
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
          value.id
            ? 'bg-violet-500/10 border-violet-500/30 text-violet-200'
            : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
        } disabled:opacity-50`}
      >
        <span className="truncate">{value.name || `Asignar ${label}...`}</span>
        <div className="flex items-center space-x-1 shrink-0 ml-2">
          {value.id && (
            <span
              onClick={(e) => { e.stopPropagation(); onSelect(null, null); }}
              className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="p-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-950/80 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60"
                />
              </div>
            </div>
            {/* Options */}
            <div className="max-h-44 overflow-y-auto">
              <div
                onClick={() => { onSelect(null, null); setOpen(false); }}
                className="px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800 cursor-pointer italic"
              >
                — Sin asignar
              </div>
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-zinc-600 text-center">Sin resultados</div>
              ) : (
                filtered.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { onSelect(r.id, `${r.firstName} ${r.lastName}`); setOpen(false); }}
                    className={`px-3 py-2.5 text-xs cursor-pointer hover:bg-zinc-800 transition-colors ${
                      value.id === r.id ? 'bg-violet-500/10 text-violet-200' : 'text-zinc-300'
                    }`}
                  >
                    <p className="font-medium">{r.firstName} {r.lastName}</p>
                    <p className="text-zinc-600 text-[10px]">{r.email}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MODAL CREACIÓN MASIVA ─────────────────────────────────────────────────
function MassCreationModal({
  onClose, onCreated, tenantId,
}: { onClose: () => void; onCreated: () => void; tenantId: string }) {
  const [tab, setTab] = useState<'apartment' | 'house'>('apartment');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apartamentos
  const [aptTower, setAptTower] = useState('');
  const [aptFloors, setAptFloors] = useState(5);
  const [aptPerFloor, setAptPerFloor] = useState(4);
  const [aptStart, setAptStart] = useState(1);

  // Casas
  const [houseTower, setHouseTower] = useState('');
  const [housePattern, setHousePattern] = useState<'numeric' | 'letter-number'>('numeric');
  const [houseCount, setHouseCount] = useState(10);
  const [housePrefix, setHousePrefix] = useState('Casa');
  const [housePerLetter, setHousePerLetter] = useState(5);

  // Preview de apartamentos
  const aptPreview = React.useMemo(() => {
    if (!aptFloors || !aptPerFloor || aptFloors < 1 || aptPerFloor < 1) return [];
    const floors = Math.min(aptFloors, 30);
    const perFloor = Math.min(aptPerFloor, 20);
    const result: { floor: number; units: string[] }[] = [];
    for (let f = floors; f >= 1; f--) {
      const units: string[] = [];
      for (let u = aptStart; u < aptStart + perFloor; u++) {
        units.push(`${f}${String(u).padStart(2, '0')}`);
      }
      result.push({ floor: f, units });
    }
    return result;
  }, [aptFloors, aptPerFloor, aptStart]);

  // Preview de casas
  const housePreview = React.useMemo(() => {
    if (!houseCount || houseCount < 1) return [];
    const count = Math.min(houseCount, 100);
    if (housePattern === 'numeric') {
      return Array.from({ length: Math.min(count, 6) }, (_, i) => `${housePrefix} ${i + 1}`);
    } else {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const perLetter = Math.max(1, housePerLetter);
      const result: string[] = [];
      outer: for (let l = 0; l < letters.length; l++) {
        for (let n = 1; n <= perLetter; n++) {
          result.push(`${letters[l]}${n}`);
          if (result.length >= 6) break outer;
        }
      }
      return result;
    }
  }, [housePattern, houseCount, housePrefix, housePerLetter]);

  const totalApt = aptFloors * aptPerFloor;
  const totalHouse = houseCount;

  const handleCreate = async () => {
    if (tab === 'apartment') {
      if (!aptTower.trim()) { setError('Escribe el nombre de la torre.'); return; }
      if (aptFloors < 1 || aptPerFloor < 1) { setError('Define pisos y apartamentos por piso.'); return; }
    } else {
      if (!houseTower.trim()) { setError('Escribe el nombre del bloque/etapa.'); return; }
      if (houseCount < 1) { setError('Define la cantidad de casas.'); return; }
    }

    setSubmitting(true);
    setError(null);

    try {
      const batch = writeBatch(db);

      if (tab === 'apartment') {
        const floors = Math.min(aptFloors, 30);
        const perFloor = Math.min(aptPerFloor, 20);
        for (let f = 1; f <= floors; f++) {
          for (let u = aptStart; u < aptStart + perFloor; u++) {
            const unit = `${f}${String(u).padStart(2, '0')}`;
            const ref = doc(collection(db, 'properties'));
            batch.set(ref, {
              tenantId,
              tower: aptTower.trim(),
              towerType: 'apartment',
              unit,
              floor: f,
              status: 'VACANT',
              ownerId: null,
              ownerName: null,
              inhabitantId: null,
              inhabitantName: null,
              createdAt: serverTimestamp(),
            });
          }
        }
      } else {
        const count = Math.min(houseCount, 100);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const perLetter = Math.max(1, housePerLetter);
        let generated = 0;
        if (housePattern === 'numeric') {
          for (let i = 1; i <= count; i++) {
            const ref = doc(collection(db, 'properties'));
            batch.set(ref, {
              tenantId, tower: houseTower.trim(), towerType: 'house',
              unit: `${housePrefix} ${i}`, floor: null, status: 'VACANT',
              ownerId: null, ownerName: null, inhabitantId: null, inhabitantName: null,
              createdAt: serverTimestamp(),
            });
          }
        } else {
          outer: for (let l = 0; l < letters.length; l++) {
            for (let n = 1; n <= perLetter; n++) {
              const ref = doc(collection(db, 'properties'));
              batch.set(ref, {
                tenantId, tower: houseTower.trim(), towerType: 'house',
                unit: `${letters[l]}${n}`, floor: null, status: 'VACANT',
                ownerId: null, ownerName: null, inhabitantId: null, inhabitantName: null,
                createdAt: serverTimestamp(),
              });
              generated++;
              if (generated >= count) break outer;
            }
          }
        }
      }

      await batch.commit();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear las unidades.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center space-x-3">
          <div className="p-2 bg-violet-500/10 rounded-xl">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Creación Masiva de Viviendas</h3>
            <p className="text-[11px] text-zinc-500">Genera todas las unidades de un bloque o torre en un solo paso</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-5">
          {[
            { key: 'apartment', label: '🏢 Edificio / Torre', sub: 'Apartamentos por piso' },
            { key: 'house', label: '🏘️ Conjunto de Casas', sub: 'Letras o números' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => !submitting && setTab(t.key as any)}
              className={`flex-1 py-3 text-left px-2 border-b-2 transition-all ${
                tab === t.key ? 'border-violet-500 text-violet-300' : 'border-transparent text-zinc-500 hover:text-zinc-400'
              }`}
            >
              <p className="text-xs font-semibold">{t.label}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{t.sub}</p>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-center space-x-2">
              <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'apartment' ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nombre de la Torre *</label>
                <input
                  type="text" value={aptTower} onChange={e => setAptTower(e.target.value)}
                  disabled={submitting} placeholder="Ej: Torre 1, Torre Norte, Bloque A"
                  className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Pisos</label>
                  <input
                    type="number" min={1} max={30} value={aptFloors}
                    onChange={e => setAptFloors(Number(e.target.value))} disabled={submitting}
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Aptos / Piso</label>
                  <input
                    type="number" min={1} max={20} value={aptPerFloor}
                    onChange={e => setAptPerFloor(Number(e.target.value))} disabled={submitting}
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Inicio en piso 1</label>
                  <input
                    type="number" min={0} max={9} value={aptStart}
                    onChange={e => setAptStart(Number(e.target.value))} disabled={submitting}
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors text-center font-bold"
                  />
                </div>
              </div>

              {/* Preview */}
              {aptTower && aptFloors > 0 && (
                <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Vista Previa · {aptTower}</p>
                    <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                      {totalApt} unidades
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {aptPreview.map(({ floor, units }) => (
                      <div key={floor} className="flex items-center space-x-2">
                        <span className="text-[10px] text-zinc-600 w-12 shrink-0 font-mono">Piso {floor}</span>
                        <div className="flex flex-wrap gap-1">
                          {units.map(u => (
                            <span key={u} className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                              {u}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nombre del Bloque / Etapa *</label>
                <input
                  type="text" value={houseTower} onChange={e => setHouseTower(e.target.value)}
                  disabled={submitting} placeholder="Ej: Etapa 1, Bloque Norte, Manzana A"
                  className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                />
              </div>

              {/* Patrón */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Patrón de Numeración</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'numeric', label: 'Numérico', example: 'Casa 1, Casa 2...' },
                    { key: 'letter-number', label: 'Letra + Número', example: 'A1, A2, B1, B2...' },
                  ].map(p => (
                    <button
                      key={p.key} type="button"
                      onClick={() => setHousePattern(p.key as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        housePattern === p.key
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
                      }`}
                    >
                      <p className="text-xs font-semibold text-zinc-200">{p.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{p.example}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {housePattern === 'numeric' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Prefijo</label>
                    <input
                      type="text" value={housePrefix} onChange={e => setHousePrefix(e.target.value)}
                      disabled={submitting} placeholder="Casa, Lote, Unidad"
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                    />
                  </div>
                )}
                {housePattern === 'letter-number' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Por Letra</label>
                    <input
                      type="number" min={1} max={20} value={housePerLetter}
                      onChange={e => setHousePerLetter(Number(e.target.value))} disabled={submitting}
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors text-center font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Total de Casas</label>
                  <input
                    type="number" min={1} max={100} value={houseCount}
                    onChange={e => setHouseCount(Number(e.target.value))} disabled={submitting}
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors text-center font-bold"
                  />
                </div>
              </div>

              {/* Preview */}
              {houseTower && houseCount > 0 && (
                <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Vista Previa · {houseTower}</p>
                    <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                      {totalHouse} casas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {housePreview.map((u, i) => (
                      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                        {u}
                      </span>
                    ))}
                    {totalHouse > 6 && (
                      <span className="text-[10px] text-zinc-600 px-1.5 py-0.5 italic">
                        +{totalHouse - 6} más...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 flex items-center justify-end space-x-3">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-5 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20 flex items-center space-x-2"
          >
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Creando...</span></>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /><span>Crear {tab === 'apartment' ? totalApt : totalHouse} Unidades</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Navegación: 'towers' | 'units'
  const [view, setView] = useState<'towers' | 'units'>('towers');
  const [selectedTower, setSelectedTower] = useState<string | null>(null);

  // Búsqueda en la vista de unidades
  const [unitSearch, setUnitSearch] = useState('');

  // Saving state para dropdowns
  const [savingId, setSavingId] = useState<string | null>(null);

  // Estados para envío de correo personalizado
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mailTargetName, setMailTargetName] = useState('');
  const [mailTargetEmail, setMailTargetEmail] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSubmitting, setMailSubmitting] = useState(false);
  const [mailSuccess, setMailSuccess] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);

  const handleOpenMail = (residentId: string, role: 'owner' | 'inhabitant') => {
    const resident = residents.find(r => r.id === residentId);
    if (resident) {
      setMailTargetName(`${resident.firstName} ${resident.lastName} (${role === 'owner' ? 'Propietario' : 'Habitante'})`);
      setMailTargetEmail(resident.email);
      setMailSubject('');
      setMailMessage('');
      setMailError(null);
      setMailSuccess(null);
      setIsMailOpen(true);
    }
  };

  const handleSendCustomMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTargetEmail || !mailSubject || !mailMessage) return;

    setMailSubmitting(true);
    setMailError(null);
    setMailSuccess(null);

    try {
      const result = await sendEmail({
        toEmail: mailTargetEmail,
        toName: mailTargetName,
        subject: mailSubject,
        message: mailMessage,
        tenantId: user?.tenantId,
        type: 'general',
      });

      setMailSuccess(result.message || 'Correo enviado exitosamente.');
      setMailSubject('');
      setMailMessage('');
      setTimeout(() => {
        setIsMailOpen(false);
        setMailSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setMailError(err.message || 'Error al enviar el correo.');
    } finally {
      setMailSubmitting(false);
    }
  };

  // ── Cargar datos ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const [propSnap, resSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), where('tenantId', '==', user.tenantId))),
        getDocs(query(collection(db, 'residents'), where('tenantId', '==', user.tenantId), where('status', '==', 'ACTIVE'))),
      ]);

      const propList: Property[] = [];
      propSnap.forEach(d => {
        const data = d.data();
        propList.push({
          id: d.id,
          tower: data.tower || '',
          towerType: data.towerType || 'apartment',
          unit: data.unit || '',
          floor: data.floor ?? null,
          status: data.status || 'VACANT',
          ownerId: data.ownerId || null,
          ownerName: data.ownerName || null,
          inhabitantId: data.inhabitantId || null,
          inhabitantName: data.inhabitantName || null,
          tenantId: data.tenantId || '',
        });
      });
      // Ordenar por torre y luego por unidad (numérico si aplica)
      propList.sort((a, b) => {
        if (a.tower !== b.tower) return a.tower.localeCompare(b.tower);
        const aFloor = a.floor ?? 0;
        const bFloor = b.floor ?? 0;
        if (aFloor !== bFloor) return aFloor - bFloor;
        return a.unit.localeCompare(b.unit, undefined, { numeric: true });
      });
      setProperties(propList);

      const resList: ResidentOption[] = [];
      resSnap.forEach(d => {
        const data = d.data();
        resList.push({
          id: d.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          properties: data.properties || [],
        });
      });
      setResidents(resList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Asignar propietario / habitante ────────────────────────────────────
  const handleAssign = async (
    propId: string,
    field: 'owner' | 'inhabitant',
    id: string | null,
    name: string | null
  ) => {
    setSavingId(propId + field);
    try {
      const updateData =
        field === 'owner'
          ? { ownerId: id, ownerName: name }
          : { inhabitantId: id, inhabitantName: name };

      // Determinar nuevo status
      const prop = properties.find(p => p.id === propId)!;
      const newOwnerId = field === 'owner' ? id : prop.ownerId;
      const newInhabitantId = field === 'inhabitant' ? id : prop.inhabitantId;
      const status = (newOwnerId || newInhabitantId) ? 'OCCUPIED' : 'VACANT';

      await updateDoc(doc(db, 'properties', propId), { ...updateData, status });

      // Sincronizar en Colección 'residents'
      // 1. Quitar el inmueble del antiguo residente asignado en ese campo
      const oldId = field === 'owner' ? prop.ownerId : prop.inhabitantId;
      if (oldId && oldId !== id) {
        const residentRef = doc(db, 'residents', oldId);
        const residentSnap = await getDoc(residentRef);
        if (residentSnap.exists()) {
          const resData = residentSnap.data();
          const currentProps = resData.properties || [];
          const updatedProps = currentProps.filter((p: any) => p.id !== propId);
          await updateDoc(residentRef, { properties: updatedProps });
        }
      }

      // 2. Agregar el inmueble al nuevo residente asignado
      if (id) {
        const residentRef = doc(db, 'residents', id);
        const residentSnap = await getDoc(residentRef);
        if (residentSnap.exists()) {
          const resData = residentSnap.data();
          const currentProps = resData.properties || [];
          const alreadyLinked = currentProps.some((p: any) => p.id === propId);
          if (!alreadyLinked) {
            const updatedProps = [...currentProps, { id: propId, tower: prop.tower, unit: prop.unit }];
            await updateDoc(residentRef, { properties: updatedProps });
          }
        }
      }

      setProperties(prev =>
         prev.map(p =>
           p.id === propId
             ? {
                 ...p,
                 ownerId: field === 'owner' ? id : p.ownerId,
                 ownerName: field === 'owner' ? name : p.ownerName,
                 inhabitantId: field === 'inhabitant' ? id : p.inhabitantId,
                 inhabitantName: field === 'inhabitant' ? name : p.inhabitantName,
                 status,
               }
             : p
         )
      );
    } catch (e) { console.error(e); }
    finally { setSavingId(null); }
  };

  // ── Agrupar por torres ─────────────────────────────────────────────────
  const towerGroups: TowerGroup[] = React.useMemo(() => {
    const map = new Map<string, TowerGroup>();
    properties.forEach(p => {
      if (!map.has(p.tower)) {
        map.set(p.tower, { name: p.tower, type: p.towerType, units: [], occupied: 0, vacant: 0 });
      }
      const group = map.get(p.tower)!;
      group.units.push(p);
      if (p.status === 'OCCUPIED') group.occupied++;
      else group.vacant++;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  // Unidades del tower seleccionado (filtradas por búsqueda)
  const selectedGroup = towerGroups.find(g => g.name === selectedTower);
  const filteredUnits = selectedGroup?.units.filter(u =>
    u.unit.toLowerCase().includes(unitSearch.toLowerCase()) ||
    (u.ownerName || '').toLowerCase().includes(unitSearch.toLowerCase()) ||
    (u.inhabitantName || '').toLowerCase().includes(unitSearch.toLowerCase())
  ) ?? [];

  // Agrupar filteredUnits por piso (para edificios)
  const byFloor = React.useMemo(() => {
    if (selectedGroup?.type !== 'apartment') return null;
    const map = new Map<number, Property[]>();
    filteredUnits.forEach(u => {
      const f = u.floor ?? 0;
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(u);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filteredUnits, selectedGroup]);

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          {view === 'units' && (
            <button
              onClick={() => { setView('towers'); setSelectedTower(null); setUnitSearch(''); }}
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center space-x-2.5">
              <Building className="h-7 w-7 text-violet-400" />
              <span>
                {view === 'towers'
                  ? 'Gestión de Inmuebles'
                  : `${selectedGroup?.type === 'apartment' ? '🏢' : '🏘️'} ${selectedTower}`}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              {view === 'towers'
                ? `${towerGroups.length} torre(s) · ${properties.length} unidades en total`
                : `${selectedGroup?.units.length ?? 0} unidades · ${selectedGroup?.occupied ?? 0} ocupadas · ${selectedGroup?.vacant ?? 0} vacías`}
            </p>
          </div>
        </div>
        {view === 'towers' && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20"
          >
            <Sparkles className="h-4 w-4" />
            <span>Crear Torre / Bloque</span>
          </button>
        )}
      </div>

      {/* Barra de búsqueda en vista de unidades */}
      {view === 'units' && (
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por unidad, propietario o habitante..."
            value={unitSearch}
            onChange={e => setUnitSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
          />
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Cargando inmuebles...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── VISTA: TORRES ─────────────────────────────────────────── */}
          {view === 'towers' && (
            <>
              {towerGroups.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="py-24 border-2 border-dashed border-zinc-800 rounded-2xl text-center space-y-4"
                >
                  <div className="flex justify-center space-x-3">
                    <Building className="h-10 w-10 text-zinc-700" />
                    <Home className="h-10 w-10 text-zinc-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-400">No hay inmuebles registrados</p>
                    <p className="text-xs text-zinc-600 mt-1">Crea tu primera torre o conjunto de casas</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20 mx-auto"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Crear primera Torre / Bloque</span>
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {towerGroups.map((group, i) => {
                    const pct = group.units.length > 0 ? Math.round((group.occupied / group.units.length) * 100) : 0;
                    return (
                      <motion.div
                        key={group.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 hover:border-zinc-700/60 hover:bg-zinc-900/40 transition-all group cursor-pointer"
                        onClick={() => { setSelectedTower(group.name); setView('units'); setUnitSearch(''); }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2.5 rounded-xl ${group.type === 'apartment' ? 'bg-violet-500/10' : 'bg-amber-500/10'}`}>
                              {group.type === 'apartment'
                                ? <Building className={`h-5 w-5 text-violet-400`} />
                                : <Home className={`h-5 w-5 text-amber-400`} />}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-zinc-200">{group.name}</h3>
                              <p className="text-[10px] text-zinc-600 capitalize">
                                {group.type === 'apartment' ? 'Apartamentos' : 'Casas'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-violet-400 transition-colors mt-1" />
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {[
                            { label: 'Total', value: group.units.length, color: 'text-zinc-300' },
                            { label: 'Ocupadas', value: group.occupied, color: 'text-emerald-400' },
                            { label: 'Vacías', value: group.vacant, color: 'text-amber-400' },
                          ].map(s => (
                            <div key={s.label} className="text-center p-2 bg-zinc-950/40 rounded-xl">
                              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                              <p className="text-[9px] text-zinc-600 font-medium mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Progress bar ocupación */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-600">Ocupación</span>
                            <span className="text-zinc-400 font-semibold">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── VISTA: UNIDADES ───────────────────────────────────────── */}
          {view === 'units' && selectedGroup && (
            <>
              {filteredUnits.length === 0 ? (
                <div className="py-16 border border-dashed border-zinc-800 rounded-2xl text-center">
                  <Search className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">Sin resultados para esa búsqueda</p>
                </div>
              ) : selectedGroup.type === 'apartment' && byFloor ? (
                // Vista por pisos (edificio)
                <div className="space-y-4">
                  {byFloor.map(([floor, units]) => (
                    <div key={floor} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Piso {floor}</span>
                        <div className="flex-1 h-px bg-zinc-800/60" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {units.map(unit => (
                          <UnitCard
                            key={unit.id}
                            unit={unit}
                            residents={residents}
                            onAssign={handleAssign}
                            onOpenMail={handleOpenMail}
                            saving={savingId}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Vista en grid (casas)
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredUnits.map(unit => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      residents={residents}
                      onAssign={handleAssign}
                      onOpenMail={handleOpenMail}
                      saving={savingId}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <MassCreationModal
            onClose={() => setShowModal(false)}
            onCreated={loadData}
            tenantId={user?.tenantId || ''}
          />
        )}
      </AnimatePresence>

      {/* Mail Modal */}
      <AnimatePresence>
        {isMailOpen && mailTargetEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMailOpen(false);
                setMailTargetEmail('');
                setMailTargetName('');
                setMailError(null);
                setMailSuccess(null);
              }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold text-zinc-100 flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-violet-400" />
                  <span>Enviar Correo Personalizado</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Redacte un mensaje personalizado para enviar directamente a este habitante/propietario.
                </p>
              </div>

              {mailSuccess && (
                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  {mailSuccess}
                </div>
              )}

              {mailError && (
                <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-455 text-xs font-semibold">
                  {mailError}
                </div>
              )}

              <form onSubmit={handleSendCustomMail} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Destinatario</label>
                  <input
                    type="text"
                    readOnly
                    value={`${mailTargetName} (${mailTargetEmail})`}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-zinc-400 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Asunto / Título *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Recordatorio importante de administración"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1.5">Mensaje *</label>
                  <textarea
                    required
                    placeholder="Redacte su mensaje aquí..."
                    rows={5}
                    value={mailMessage}
                    onChange={(e) => setMailMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMailOpen(false);
                      setMailTargetEmail('');
                      setMailTargetName('');
                      setMailError(null);
                      setMailSuccess(null);
                    }}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={mailSubmitting}
                    className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-550 rounded-xl transition-all shadow-lg shadow-violet-600/10 flex items-center space-x-1.5"
                  >
                    {mailSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Enviar Correo</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UNIT CARD ─────────────────────────────────────────────────────────────
function UnitCard({
  unit, residents, onAssign, onOpenMail, saving,
}: {
  unit: Property;
  residents: ResidentOption[];
  onAssign: (id: string, field: 'owner' | 'inhabitant', resId: string | null, name: string | null) => void;
  onOpenMail: (residentId: string, role: 'owner' | 'inhabitant') => void;
  saving: string | null;
}) {
  const isOccupied = unit.status === 'OCCUPIED';
  const isSaving = saving === unit.id + 'owner' || saving === unit.id + 'inhabitant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border transition-all ${
        isOccupied
          ? 'border-zinc-700/40 bg-zinc-900/20'
          : 'border-zinc-800/30 bg-zinc-950/30'
      }`}
    >
      {/* Unit header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
            isOccupied ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
          }`}>
            {unit.towerType === 'apartment'
              ? unit.unit
              : <Home className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-200">
              {unit.towerType === 'apartment' ? `Apto ${unit.unit}` : unit.unit}
            </p>
            {unit.floor && (
              <p className="text-[10px] text-zinc-600">Piso {unit.floor}</p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          isOccupied
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : 'text-zinc-600 bg-zinc-800 border-zinc-700'
        }`}>
          {isOccupied ? 'Ocupado' : 'Vacío'}
        </span>
      </div>

      {/* Dropdowns */}
      <div className="space-y-2.5">
        {isSaving ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <ResidentDropdown
                  label="👤 Propietario"
                  value={{ id: unit.ownerId, name: unit.ownerName }}
                  residents={residents}
                  onSelect={(id, name) => onAssign(unit.id, 'owner', id, name)}
                />
              </div>
              {unit.ownerId && (
                <button
                  type="button"
                  onClick={() => onOpenMail(unit.ownerId!, 'owner')}
                  className="p-2 px-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-violet-400 hover:border-violet-500/30 transition-all shrink-0 mb-[1px]"
                  title="Enviar correo personalizado al propietario"
                >
                  <Mail className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <ResidentDropdown
                  label="🏠 Habitante / Arrendatario"
                  value={{ id: unit.inhabitantId, name: unit.inhabitantName }}
                  residents={residents}
                  onSelect={(id, name) => onAssign(unit.id, 'inhabitant', id, name)}
                />
              </div>
              {unit.inhabitantId && (
                <button
                  type="button"
                  onClick={() => onOpenMail(unit.inhabitantId!, 'inhabitant')}
                  className="p-2 px-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-violet-400 hover:border-violet-500/30 transition-all shrink-0 mb-[1px]"
                  title="Enviar correo personalizado al habitante"
                >
                  <Mail className="h-4 w-4" />
                </button>
              )}
            </div>

            {!unit.inhabitantId && unit.ownerId && (
              <p className="text-[10px] text-zinc-600 italic pl-1">
                Sin habitante → se asume que el propietario reside aquí
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
