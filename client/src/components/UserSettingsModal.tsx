import React, { useState, useRef } from 'react';
import { X, User, Palette, Check, Camera, Image, Trash2 } from 'lucide-react';
import type { User as UserType } from '../types';

interface UserSettingsModalProps {
  currentUser: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { name: string; avatarColor: string; avatarUrl?: string; bio?: string }) => void;
}

const COLOR_OPTIONS = [
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
];

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  const currentName = currentUser?.name || currentUser?.displayName || currentUser?.username || '';
  const [name, setName] = useState(currentName);
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [selectedColor, setSelectedColor] = useState(currentUser?.avatarColor || '#8b5cf6');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser?.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      avatarColor: selectedColor,
      avatarUrl: avatarUrl || '',
      bio: bio.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#120b22] border border-violet-500/30 rounded-3xl p-6 shadow-2xl shadow-violet-950/60 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-violet-500/15 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <User className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg text-white">Meu Perfil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-violet-500/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar Preview & Photo Controls */}
        <div className="flex flex-col items-center bg-[#0b0714] p-5 rounded-2xl border border-violet-500/15 space-y-3">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-24 h-24 rounded-full object-cover shadow-2xl border-2 border-violet-500/50"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl transition-colors"
                style={{ backgroundColor: selectedColor }}
              >
                {(name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition cursor-pointer"
            >
              <Camera className="w-6 h-6 mb-1" />
              <span>Trocar</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Image className="w-3.5 h-3.5" />
              <span>Enviar Foto</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(undefined)}
                className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/25 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover</span>
              </button>
            )}
          </div>
        </div>

        {/* Name Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80">
              Seu Nome
            </label>
            {currentUser?.tag && (
              <span className="text-xs font-mono text-violet-300 font-bold bg-violet-500/15 px-2 py-0.5 rounded-lg border border-violet-500/25">
                Tag: #{currentUser.tag}
              </span>
            )}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome no Janjacord"
            className="w-full bg-[#0a0612] border border-violet-500/25 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400 transition select-text"
          />
        </div>

        {/* Bio / Recado */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80">
            Status / Recado do Perfil
          </label>
          <input
            type="text"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={60}
            placeholder="Ex: Jogando Valorant • Online à noite"
            className="w-full bg-[#0a0612] border border-violet-500/25 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-violet-400 transition select-text"
          />
        </div>

        {/* Color Palette */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-violet-400" />
            Cor de Destaque do Perfil
          </label>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_OPTIONS.map((color) => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className="h-8 rounded-xl flex items-center justify-center transition-transform hover:scale-105 relative shadow-sm cursor-pointer"
                  style={{ backgroundColor: color }}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition shadow-lg shadow-violet-600/30 cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};
