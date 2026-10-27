import React, { useState } from 'react';
import { Flame, ArrowRight, Lock, User, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onLogin: (name: string, password: string, callback: (error?: string) => void) => void;
  onRegister: (
    name: string,
    password: string,
    avatarColor: string,
    callback: (error?: string) => void
  ) => void;
}

const COLOR_OPTIONS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#3b82f6', // Blue
];

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onRegister }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (tab === 'login') {
      onLogin(name, password, (err) => {
        setLoading(false);
        if (err) setError(err);
      });
    } else {
      onRegister(name, password, selectedColor, (err) => {
        setLoading(false);
        if (err) setError(err);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0d14]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161722] border border-[#27293b] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Janjacord</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Voz, chat e compartilhamento de tela leve para o seu PC.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#1b1c2a] p-1 rounded-xl border border-[#27293d] mt-6">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {tab === 'register' && (
            <>
              {/* Avatar Preview */}
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-xl transition-all"
                  style={{ backgroundColor: selectedColor }}
                >
                  {(name || '?').slice(0, 1).toUpperCase()}
                </div>
                <span className="text-[11px] text-slate-400 mt-1.5 font-medium">Cor do seu Avatar</span>
              </div>

              {/* Color Picker */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      selectedColor === color ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#161722]' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Nome */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {tab === 'login' ? 'Nome ou Nome#hashtag' : 'Seu Nome'}
              </label>
              {tab === 'register' && (
                <span className="text-[10px] text-indigo-400 font-mono">
                  (sua # será gerada automaticamente)
                </span>
              )}
            </div>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === 'login' ? 'Ex: fulaninho ou fulaninho#001' : 'Ex: fulaninho'}
                required
                className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <span>{loading ? 'Aguarde...' : tab === 'login' ? 'Entrar no Janjacord' : 'Criar minha Conta'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};