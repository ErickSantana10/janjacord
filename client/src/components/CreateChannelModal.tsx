import React, { useState } from 'react';
import { X, Hash, Volume2, Plus, Film } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  serverName: string;
  initialType?: 'text' | 'voice' | 'media';
  onClose: () => void;
  onCreateChannel: (name: string, type: 'text' | 'voice' | 'media') => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  serverName,
  initialType = 'text',
  onClose,
  onCreateChannel,
}) => {
  const [channelType, setChannelType] = useState<'text' | 'voice' | 'media'>(initialType);
  const [channelName, setChannelName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    onCreateChannel(channelName.trim(), channelType);
    setChannelName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161722] border border-[#27293b] rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232535] pb-3">
          <div>
            <h3 className="font-extrabold text-lg text-white">Criar Canal</h3>
            <p className="text-xs text-slate-400 mt-0.5">em {serverName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Tipo de Canal
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setChannelType('text')}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  channelType === 'text'
                    ? 'bg-[#1e1f30] border-indigo-500 shadow-sm'
                    : 'bg-[#1b1c2a] border-[#27293d] hover:bg-[#1f2033]'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <Hash className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">Texto</div>
                  <div className="text-xs text-slate-400">Postar mensagens, imagens e memes</div>
                </div>
                <input
                  type="radio"
                  name="channelType"
                  checked={channelType === 'text'}
                  onChange={() => setChannelType('text')}
                  className="accent-indigo-600"
                />
              </label>

              <label
                onClick={() => setChannelType('voice')}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  channelType === 'voice'
                    ? 'bg-[#1e1f30] border-emerald-500 shadow-sm'
                    : 'bg-[#1b1c2a] border-[#27293d] hover:bg-[#1f2033]'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">Voz & Compartilhamento</div>
                  <div className="text-xs text-slate-400">Conversar em chamada e transmitir jogos</div>
                </div>
                <input
                  type="radio"
                  name="channelType"
                  checked={channelType === 'voice'}
                  onChange={() => setChannelType('voice')}
                  className="accent-emerald-600"
                />
              </label>

              <label
                onClick={() => setChannelType('media')}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  channelType === 'media'
                    ? 'bg-[#1e1f30] border-amber-500 shadow-sm'
                    : 'bg-[#1b1c2a] border-[#27293d] hover:bg-[#1f2033]'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                  <Film className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-100">Sala de Música & Vídeo</div>
                  <div className="text-xs text-slate-400">Assistir YouTube e ouvir sons sincronizados com a galera</div>
                </div>
                <input
                  type="radio"
                  name="channelType"
                  checked={channelType === 'media'}
                  onChange={() => setChannelType('media')}
                  className="accent-amber-500"
                />
              </label>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Nome do Canal
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">
                {channelType === 'text' ? '#' : channelType === 'voice' ? '🔊' : '🎬'}
              </span>
              <input
                type="text"
                autoFocus
                value={channelName}
                onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="ex: cinema-da-galera"
                maxLength={25}
                className="w-full bg-[#1b1c2a] border border-[#27293d] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
              />
            </div>
          </div>

          {/* Actions */}
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
              disabled={!channelName.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Canal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
