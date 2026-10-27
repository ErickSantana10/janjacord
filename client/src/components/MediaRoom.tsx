import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  MessageSquare,
  Plus,
  Send,
  Maximize2,
  Music2,
  Users
} from 'lucide-react';
import type { Channel, Message, User, MediaRoomState, MessageAttachment } from '../types';

interface MediaRoomProps {
  channel: Channel;
  currentUser?: User | null;
  mediaState: MediaRoomState | null;
  messages: Message[];
  onSendMessage: (text: string, attachment?: MessageAttachment) => void;
  onPlayMedia: (url: string, title?: string) => void;
  onSyncAction: (action: 'play' | 'pause' | 'skip' | 'seek', time?: number) => void;
  onVoteSkip: () => void;
}

export const MediaRoom: React.FC<MediaRoomProps> = ({
  channel,
  currentUser,
  mediaState,
  messages,
  onSendMessage,
  onPlayMedia,
  onSyncAction,
  onVoteSkip,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'chat'>('queue');
  const [urlInput, setUrlInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastVideoIdRef = useRef<string | null>(null);

  // Votação para pular (50% + 1)
  const skipVotes = mediaState?.skipVotes || [];
  const listeners = mediaState?.listeners || [];
  const totalListeners = Math.max(1, listeners.length);
  const requiredVotes = Math.floor(totalListeners / 2) + 1;
  const currentVoteCount = skipVotes.length;
  const hasUserVoted = currentUser ? skipVotes.includes(currentUser.id) : false;

  // Filter messages for this media channel
  const channelMessages = messages.filter((m) => m.channelId === channel.id);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [channelMessages, activeTab]);

  // Load YouTube IFrame API script tag once
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Synchronize or initialize player whenever mediaState changes
  const syncPlayerWithState = (state: MediaRoomState | null) => {
    if (!state || !state.currentTrack) {
      if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
        try {
          playerRef.current.stopVideo();
        } catch (e) {}
      }
      lastVideoIdRef.current = null;
      return;
    }

    const { videoId } = state.currentTrack;
    const elapsed = state.isPlaying ? Math.max(0, (Date.now() - state.updatedAt) / 1000) : 0;
    const targetTime = (state.currentTime || 0) + elapsed;

    if (!(window as any).YT || !(window as any).YT.Player) {
      // API not ready yet, will be picked up once ready
      return;
    }

    // If player instance already exists and is valid
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      if (lastVideoIdRef.current !== videoId) {
        lastVideoIdRef.current = videoId;
        try {
          playerRef.current.loadVideoById({
            videoId,
            startSeconds: targetTime,
          });
          if (state.isPlaying) {
            playerRef.current.playVideo?.();
          } else {
            playerRef.current.pauseVideo?.();
          }
        } catch (err) {
          console.warn('Erro ao carregar vídeo no player existente:', err);
        }
      } else {
        // Same video: adjust drift and play state
        try {
          const curTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
          if (Math.abs(curTime - targetTime) > 3) {
            playerRef.current.seekTo(targetTime, true);
          }
          if (state.isPlaying) {
            playerRef.current.playVideo?.();
          } else {
            playerRef.current.pauseVideo?.();
          }
        } catch (err) {
          console.warn('Erro ao sincronizar player:', err);
        }
      }
      return;
    }

    // Need to instantiate player on DOM
    if (!playerContainerRef.current) return;
    playerContainerRef.current.innerHTML = '<div id="youtube-media-element" style="width:100%;height:100%"></div>';
    lastVideoIdRef.current = videoId;

    try {
      playerRef.current = new (window as any).YT.Player('youtube-media-element', {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: {
          autoplay: state.isPlaying ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          playsinline: 1,
          start: Math.floor(targetTime),
        },
        events: {
          onReady: (event: any) => {
            try {
              event.target.setVolume(volume);
              if (state.isPlaying) {
                event.target.playVideo();
              }
            } catch (e) {}
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              onSyncAction('skip');
            }
          },
          onError: (err: any) => {
            console.warn('YouTube Player Error:', err);
          },
        },
      });
    } catch (err) {
      console.warn('Erro ao instanciar YT.Player:', err);
    }
  };

  // Watch for state changes and trigger sync
  useEffect(() => {
    syncPlayerWithState(mediaState);
  }, [mediaState]);

  // Periodic check if YouTube API loaded in case it was slow
  useEffect(() => {
    const checkYT = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        if (!playerRef.current && mediaState?.currentTrack) {
          syncPlayerWithState(mediaState);
        }
      }
    }, 300);

    return () => clearInterval(checkYT);
  }, [mediaState]);

  // Track timer loop for progress UI
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function') {
        try {
          const cur = player.getCurrentTime();
          const dur = player.getDuration ? player.getDuration() : 0;
          setPlayerCurrentTime(cur || 0);
          setPlayerDuration(dur || 0);
        } catch (e) {}
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setIsSubmitting(true);
    onPlayMedia(url);
    setUrlInput('');
    setTimeout(() => setIsSubmitting(false), 1200);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    // Check for /play or /tocar command
    const playMatch = text.match(/^\/(?:play|tocar)\s+(.+)$/i);
    if (playMatch) {
      const url = playMatch[1].trim();
      onPlayMedia(url);
      setChatInput('');
      return;
    }

    // Check for /skip or /pular or /voteskip command
    if (/^\/(?:skip|pular|voteskip)$/i.test(text)) {
      onVoteSkip();
      setChatInput('');
      return;
    }

    onSendMessage(text);
    setChatInput('');
  };

  const handleTogglePlayPause = () => {
    const player = playerRef.current;
    const curTime = player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
    if (mediaState?.isPlaying) {
      onSyncAction('pause', curTime);
    } else {
      onSyncAction('play', curTime);
    }
  };

  const handleSkip = () => {
    onVoteSkip();
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(newVol);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      handleVolumeChange(volume || 50);
    } else {
      setIsMuted(true);
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(0);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0d0e14]">
      {/* 1. Main Left Screen: Video Stage & Controls */}
      <div className="flex-1 flex flex-col h-full border-r border-[#1e1f2b] min-w-0">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#1e1f2b] flex items-center justify-between bg-[#12131c]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Film className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{channel.name}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sala de Vídeo & DJ
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {/* Active Listeners count */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181926] border border-[#27293d] text-slate-300 font-semibold"
              title="Pessoas conectadas nesta sala"
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{totalListeners} {totalListeners === 1 ? 'ouvindo' : 'ouvindo'}</span>
            </span>

            {/* Vote Skip Indicator Pill */}
            {mediaState?.currentTrack && currentVoteCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold animate-pulse">
                🗳️ Pular: {currentVoteCount}/{requiredVotes}
              </span>
            )}

            {mediaState?.currentTrack ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {mediaState.isPlaying ? 'Reproduzindo' : 'Pausado'}
              </span>
            ) : (
              <span className="text-slate-500 italic">Fila Vazia</span>
            )}
          </div>
        </div>

        {/* Video Canvas Container */}
        <div ref={containerRef} className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden group">
          {/* YouTube Player Element (always exists in DOM for YT API) */}
          <div
            ref={playerContainerRef}
            className={`w-full h-full absolute inset-0 ${
              mediaState?.currentTrack ? 'block z-10' : 'hidden pointer-events-none'
            }`}
          >
            <div id="youtube-media-element" className="w-full h-full" />
          </div>

          {/* Placeholder when no video is playing */}
          {!mediaState?.currentTrack && (
            <div className="z-20 text-center max-w-md p-6 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 via-indigo-600/20 to-purple-600/20 border border-white/10 flex items-center justify-center shadow-2xl relative">
                <Music2 className="w-10 h-10 text-amber-400 animate-bounce" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 animate-ping" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Nenhum som tocando</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Adicione um vídeo do YouTube para assistir e ouvir sincronizado com todo mundo no servidor!
                </p>
              </div>

              {/* Quick URL form inside placeholder */}
              <form onSubmit={handleAddTrack} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Cole o link do YouTube (ex: youtu.be/...)"
                  className="flex-1 bg-[#1a1b26] border border-[#2e3146] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition select-text"
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>{isSubmitting ? 'Adicionando...' : 'Tocar'}</span>
                </button>
              </form>

              <div className="text-[11px] text-slate-500 font-mono">
                Dica: Você também pode digitar <span className="text-amber-400 font-bold">/play link</span> no chat da sala!
              </div>
            </div>
          )}
        </div>

        {/* Media Controls Bar */}
        <div className="h-16 px-4 bg-[#12131c] border-t border-[#1e1f2b] flex items-center justify-between gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-0 max-w-[35%]">
            {mediaState?.currentTrack ? (
              <>
                <img
                  src={mediaState.currentTrack.thumbnailUrl}
                  alt={mediaState.currentTrack.title}
                  className="w-12 h-9 rounded-lg object-cover shadow border border-white/10 shrink-0"
                />
                <div className="min-w-0 truncate">
                  <div className="text-xs font-bold text-white truncate" title={mediaState.currentTrack.title}>
                    {mediaState.currentTrack.title}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                    <span>Adicionado por</span>
                    <span className="font-semibold text-amber-400">
                      {mediaState.currentTrack.addedBy.name}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 italic">
                Aguardando nova faixa...
              </div>
            )}
          </div>

          {/* Center: Play / Pause / Skip Controls */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlayPause}
                disabled={!mediaState?.currentTrack}
                className="w-10 h-10 rounded-full bg-white hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-white text-black flex items-center justify-center transition shadow-lg shadow-white/10 cursor-pointer"
                title={mediaState?.isPlaying ? 'Pausar para todos' : 'Tocar para todos'}
              >
                {mediaState?.isPlaying ? (
                  <Pause className="w-5 h-5 fill-black" />
                ) : (
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={!mediaState?.currentTrack}
                className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-30 ${
                  hasUserVoted
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-[#1e1f2b]'
                }`}
                title={`Votação para pular música (50% + 1): ${currentVoteCount} de ${requiredVotes} votos necessários`}
              >
                <SkipForward className="w-4 h-4" />
                <span>
                  {hasUserVoted ? 'Votado' : 'Pular'} ({currentVoteCount}/{requiredVotes})
                </span>
              </button>
            </div>

            {/* Time progress label */}
            {mediaState?.currentTrack && (
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <span>{formatSeconds(playerCurrentTime)}</span>
                <span>/</span>
                <span>{formatSeconds(playerDuration)}</span>
              </div>
            )}
          </div>

          {/* Right: Volume & Fullscreen */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 accent-amber-500 cursor-pointer h-1.5 bg-[#222435] rounded-lg"
              />
            </div>

            <button
              onClick={handleFullscreen}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#1e1f2b] rounded-lg transition cursor-pointer"
              title="Tela Cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Right Side Panel: Tabs (Fila / Chat) */}
      <div className="w-80 bg-[#12131c] flex flex-col h-full shrink-0">
        {/* Navigation Tabs */}
        <div className="h-12 border-b border-[#1e1f2b] flex items-center px-2 bg-[#101118]">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-[#1e1f2f] text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Fila ({mediaState?.queue ? mediaState.queue.length : 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#1e1f2f] text-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat da Sala</span>
          </button>
        </div>

        {/* Tab 1: Fila de Reprodução */}
        {activeTab === 'queue' ? (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            {/* Add Track Input */}
            <form onSubmit={handleAddTrack} className="mb-3 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Adicionar Música / Vídeo</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Link do YouTube..."
                  className="flex-1 bg-[#181926] border border-[#27293d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition select-text"
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center"
                  title="Adicionar à fila"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Currently Playing Card */}
            {mediaState?.currentTrack && (
              <div className="mb-3 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Tocando Agora</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <img
                    src={mediaState.currentTrack.thumbnailUrl}
                    alt={mediaState.currentTrack.title}
                    className="w-16 h-12 rounded-lg object-cover shadow shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white line-clamp-2" title={mediaState.currentTrack.title}>
                      {mediaState.currentTrack.title}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                      <span>por</span>
                      <span className="font-semibold text-slate-200">
                        {mediaState.currentTrack.addedBy.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Votação para Pular (50% + 1) */}
            {mediaState?.currentTrack && (
              <div className="mb-3 p-3 bg-[#181926] border border-[#27293d] rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <span>🗳️ Votação para Pular</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {currentVoteCount} de {requiredVotes} votos
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-[#101118] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (currentVoteCount / requiredVotes) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-slate-400">
                    Regra: 50% + 1 ({totalListeners} {totalListeners === 1 ? 'pessoa' : 'pessoas'} na sala)
                  </span>
                  <button
                    onClick={onVoteSkip}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      hasUserVoted
                        ? 'bg-amber-500 text-black hover:bg-amber-400'
                        : 'bg-[#222435] text-slate-300 hover:text-white hover:bg-[#2c2f47]'
                    }`}
                  >
                    {hasUserVoted ? 'Retirar Voto' : 'Votar para Pular'}
                  </button>
                </div>
              </div>
            )}

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Próximos na Fila</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {mediaState?.queue.length || 0} vídeos
                </span>
              </div>

              {(!mediaState?.queue || mediaState.queue.length === 0) ? (
                <div className="text-center py-8 text-slate-500 space-y-1">
                  <ListMusic className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-medium">A fila está vazia!</p>
                  <p className="text-[11px] text-slate-600">Adicione links para continuar o som.</p>
                </div>
              ) : (
                mediaState.queue.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 p-2 bg-[#181926] hover:bg-[#1d1f30] border border-[#232538] rounded-xl transition group"
                  >
                    <span className="text-xs font-mono font-bold text-slate-500 w-4 text-center">
                      {index + 1}
                    </span>
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-12 h-9 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate" title={item.title}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.addedBy.name}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Tab 2: Chat Integrado da Sala */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {channelMessages.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhuma mensagem ainda. Digite algo ou use <span className="text-amber-400 font-bold">/play link</span> para pedir música!
                </div>
              ) : (
                channelMessages.map((msg) => {
                  const isDJ = msg.userId === 'system';
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 text-xs ${
                        isDJ ? 'bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl' : ''
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0"
                        style={{ backgroundColor: msg.avatarColor || '#6366f1' }}
                      >
                        {msg.userName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`font-bold ${isDJ ? 'text-amber-400' : 'text-slate-200'}`}>
                            {msg.userName}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div className="text-slate-300 mt-0.5 break-words select-text">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChatMessage} className="p-2.5 border-t border-[#1e1f2b] bg-[#101118]">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Conversar ou /play link..."
                  className="w-full bg-[#181926] border border-[#27293d] rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-1.5 p-1.5 text-indigo-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};