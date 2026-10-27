import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, iconColor: string, callback?: (error?: string) => void) => void;
  onJoinByInvite: (inviteCode: string, callback?: (error?: string) => void) => void;
}

const SERVER_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onJoinByInvite,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedColor, setSelectedColor] = useState(SERVER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (tab === 'create') {
      if (!serverName.trim()) return;
      onCreate(serverName.trim(), selectedColor, (err) => {
        setLoading(false);
        if (err) {
          setError(err);
        } else {
          setServerName('');
          onClose();
        }
      });
    } else {
      if (!inviteCode.trim()) return;
      onJoinByInvite(inviteCode.trim(), (err) => {
        setLoading(false);
        if (err) {
          setError(err);
        } else {
          setInviteCode('');
          onClose();
        }
      });
    }
  };

  const getInitials = (name: string) => {
    if (!name.trim()) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161722] border border-[#27293b] rounded-3xl p-6 shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232535] pb-3">
          <div>
            <h3 className="font-extrabold text-xl text-white">Servidores</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Crie seu espaço exclusivo ou entre com um código de convite.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-[#1b1c2a] p-1 rounded-xl border border-[#27293d]">
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              tab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Criar Servidor
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('join');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              tab === 'join' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar com Convite
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'create' ? (
            <>
              {/* Server Icon Preview */}
              <div className="flex flex-col items-center justify-center py-1">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-xl transition-all"
                  style={{ backgroundColor: selectedColor }}
                >
                  {getInitials(serverName)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 font-medium">Ícone do Servidor</span>
              </div>

              {/* Name Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Nome do Servidor
                </label>
                <input
                  type="text"
                  autoFocus
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Ex: Squad dos Crias, Servidor do Erick..."
                  maxLength={30}
                  className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
                />
              </div>

              {/* Color Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Cor do Ícone
                </label>
                <div className="flex items-center justify-between gap-2">
                  {SERVER_COLORS.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`flex-1 h-7 rounded-lg transition-transform ${
                          isSelected ? 'ring-2 ring-white scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-[#1b1c2a] p-3 rounded-xl border border-[#27293d] text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Servidor Privado & Seguro:
                </div>
                <p className="text-slate-400">
                  Apenas amigos convidados por você ou que possuam o código de convite poderão entrar.
                </p>
              </div>
            </>
          ) : (
            /* Join with Invite */
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Código de Convite
                </label>
                <input
                  type="text"
                  autoFocus
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: JJ-A9B2"
                  className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition font-mono tracking-widest text-center select-text"
                />
              </div>

              <div className="bg-[#1b1c2a] p-3 rounded-xl border border-[#27293d] text-xs text-slate-400">
                Peça o código de convite para o dono do servidor para poder ter acesso e conversar na sala.
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (tab === 'create' ? !serverName.trim() : !inviteCode.trim())}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition shadow-lg shadow-indigo-600/30"
            >
              {loading ? 'Processando...' : tab === 'create' ? 'Criar Servidor' : 'Entrar no Servidor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
