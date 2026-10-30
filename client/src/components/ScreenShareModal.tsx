import React, { useState, useEffect } from 'react';
import { Monitor, AppWindow, Volume2, RefreshCw, X, Sparkles, Check } from 'lucide-react';
import { QUALITY_PRESETS, type DesktopSource, type StreamQualityPreset } from '../types';

interface ScreenShareModalProps {
  isOpen: boolean;
  currentQuality: StreamQualityPreset;
  onClose: () => void;
  onConfirm: (sourceId: string, quality: StreamQualityPreset, shareAudio: boolean) => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  currentQuality,
  onClose,
  onConfirm,
}) => {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [quality, setQuality] = useState<StreamQualityPreset>(currentQuality);
  const [shareAudio, setShareAudio] = useState<boolean>(true);

  const loadSources = async () => {
    if (!window.electronAPI?.getDesktopSources) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.getDesktopSources();
      setSources(list);
      if (list.length > 0 && !selectedSourceId) {
        const firstScreen = list.find((s) => s.isScreen) || list[0];
        setSelectedSourceId(firstScreen.id);
      }
    } catch (err) {
      console.error('Erro ao buscar telas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQuality(currentQuality);
      loadSources();
    }
  }, [isOpen, currentQuality]);

  if (!isOpen) return null;

  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen && s.name.trim() !== '');
  const displayedSources = activeTab === 'screens' ? screens : windows;

  const handleStart = () => {
    if (!selectedSourceId && sources.length > 0) {
      onConfirm(sources[0].id, quality, shareAudio);
    } else if (selectedSourceId) {
      onConfirm(selectedSourceId, quality, shareAudio);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#110c1d] border border-violet-500/30 rounded-3xl shadow-2xl shadow-violet-950/50 overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-violet-500/15 flex items-center justify-between bg-gradient-to-r from-violet-950/40 via-[#150f24] to-fuchsia-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-600/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Transmitir Tela ou Jogo</h3>
              <p className="text-xs text-violet-300/70">
                Escolha o monitor ou janela que deseja compartilhar na chamada
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Refresh */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-[#0b0713] p-1 rounded-2xl border border-violet-500/15">
            <button
              type="button"
              onClick={() => {
                setActiveTab('screens');
                const first = screens[0];
                if (first) setSelectedSourceId(first.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'screens'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Telas Inteiras ({screens.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('windows');
                const first = windows[0];
                if (first) setSelectedSourceId(first.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'windows'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AppWindow className="w-4 h-4" />
              <span>Janelas & Jogos ({windows.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadSources}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 text-xs font-semibold transition cursor-pointer"
            title="Atualizar lista de janelas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Grid of Sources */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && sources.length === 0 ? (
            <div className="py-16 text-center text-sm text-violet-300/70">
              Carregando prévia das telas e jogos abertos...
            </div>
          ) : displayedSources.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Nenhuma fonte encontrada nesta categoria.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {displayedSources.map((src) => {
                const isSelected = selectedSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => setSelectedSourceId(src.id)}
                    className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col bg-[#161026] ${
                      isSelected
                        ? 'border-violet-500 ring-2 ring-violet-500/30 shadow-xl shadow-violet-600/20 scale-[1.01]'
                        : 'border-violet-500/15 hover:border-violet-500/40'
                    }`}
                  >
                    <div className="aspect-video w-full bg-black relative overflow-hidden">
                      <img
                        src={src.thumbnail}
                        alt={src.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex items-center gap-2 bg-[#140e22]">
                      {src.appIcon ? (
                        <img src={src.appIcon} alt="" className="w-4 h-4 object-contain shrink-0" />
                      ) : (
                        <Monitor className="w-4 h-4 text-violet-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-200 truncate">{src.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings Bar: Audio & Quality */}
        <div className="px-6 py-4 bg-[#0d0816] border-t border-violet-500/15 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quality Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-violet-300/80 mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                Qualidade:
              </span>
              {(['potato', 'balanced', 'gamer'] as StreamQualityPreset[]).map((key) => {
                const active = quality === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={QUALITY_PRESETS[key].description}
                    onClick={() => setQuality(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      active
                        ? 'bg-violet-600/25 border-violet-400 text-white shadow-sm'
                        : 'bg-[#161026] border-violet-500/15 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {key === 'potato' ? '480p Leve' : key === 'balanced' ? '720p 30FPS' : '1080p 60FPS'}
                  </button>
                );
              })}
            </div>

            {/* System Audio Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer bg-[#161026] px-3.5 py-2 rounded-xl border border-violet-500/20 hover:border-violet-500/40 transition">
              <input
                type="checkbox"
                checked={shareAudio}
                onChange={(e) => setShareAudio(e.target.checked)}
                className="accent-violet-500 w-4 h-4 rounded cursor-pointer"
              />
              <Volume2 className={`w-4 h-4 ${shareAudio ? 'text-violet-400' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-200">Compartilhar Áudio do Sistema</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!selectedSourceId && sources.length === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 text-white text-xs font-black tracking-wide shadow-lg shadow-violet-600/30 transition cursor-pointer"
            >
              Iniciar Transmissão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
