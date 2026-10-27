import React, { useState, useRef } from 'react';
import { X, User, Palette, Check, Camera, Image, Trash2 } from 'lucide-react';
import type { User as UserType } from '../types';

interface UserSettingsModalProps {
  currentUser: UserType | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { name: string; avatarColor: string; avatarUrl?: string }) => void;
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

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  const currentName = currentUser?.name || currentUser?.displayName || currentUser?.username || '';
  const [name, setName] = useState(currentName);
  const [selectedColor, setSelectedColor] = useState(currentUser?.avatarColor || '#6366f1');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser?.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

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
      avatarUrl: avatarUrl || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161722] border border-[#262838] rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-[#232535] pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <h3 className="font-extrabold text-lg text-slate-100">Editar Perfil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar Preview & Photo Controls */}
        <div className="flex flex-col items-center bg-[#1b1c2a] p-5 rounded-2xl border border-[#26283b] space-y-3">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-24 h-24 rounded-full object-cover shadow-2xl border-2 border-indigo-500/50"
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
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold transition backdrop-blur-xs cursor-pointer"
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
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Image className="w-3.5 h-3.5" />
              <span>Upload de Foto</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(undefined)}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Remover foto e usar cor"
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
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Nome
            </label>
            {currentUser?.tag && (
              <span className="text-xs font-mono text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Sua Tag: #{currentUser.tag}
              </span>
            )}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome no Janjacord"
            className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 transition select-text"
          />
          <p className="text-[11px] text-slate-400">
            Outras pessoas também podem se chamar <span className="text-indigo-300 font-semibold">{name || 'fulaninho'}</span>. Para seus amigos te adicionarem, basta passar <span className="font-mono text-emerald-400 font-semibold">{name || 'fulaninho'}#{currentUser?.tag || '001'}</span>. A # não é exibida no perfil ou nos chats.
          </p>
        </div>

        {/* Color Palette (Fallback if no custom image) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            Cor de Fundo do Avatar
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
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};