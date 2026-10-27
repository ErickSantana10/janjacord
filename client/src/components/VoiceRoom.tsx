import React, { useRef, useEffect, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Headphones, 
  Monitor, 
  MonitorOff, 
  PhoneOff, 
  Maximize2, 
  Sliders, 
  Users, 
  MessageSquare, 
  Send, 
  X, 
  Volume2,
  VolumeX,
  Play
} from 'lucide-react';
import { QUALITY_PRESETS } from '../types';
import type { Channel, User, OnlineUser, StreamQualityPreset, DMMessage, Message, MessageAttachment, FriendItem } from '../types';

interface RemoteStreamItem {
  peerId: string;
  stream: MediaStream;
  isScreen: boolean;
}

interface VoiceRoomProps {
  channel: Channel;
  currentUser: User | null;
  usersInRoom: OnlineUser[];
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  streamQuality: StreamQualityPreset;
  localScreenStream: MediaStream | null;
  remoteStreams: RemoteStreamItem[];
  // Side chat integration
  isDMCall?: boolean;
  targetDMFriend?: FriendItem['friend'] | null;
  dmMessages?: DMMessage[];
  channelMessages?: Message[];
  onSendMessage?: (text: string, attachment?: MessageAttachment) => void;
  // Handlers
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onLeaveVoice: () => void;
  onChangeQuality: (preset: StreamQualityPreset) => void;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  channel,
  currentUser,
  usersInRoom,
  isMuted,
  isDeafened,
  isSpeaking,
  isScreenSharing,
  streamQuality,
  localScreenStream,
  remoteStreams,
  isDMCall = false,
  targetDMFriend,
  dmMessages = [],
  channelMessages = [],
  onSendMessage,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onLeaveVoice,
  onChangeQuality,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  
  // Stream watching state: default false so user chooses when to watch
  const [isWatchingStream, setIsWatchingStream] = useState<boolean>(false);
  const [streamVolume, setStreamVolume] = useState<number>(1);
  const [isStreamMuted, setIsStreamMuted] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sideChatEndRef = useRef<HTMLDivElement>(null);

  // Determine who is actively sharing screen in this room
  const remoteScreenItem = remoteStreams.find((s) => s.isScreen);
  const isAnyPeerSharing = usersInRoom.some((u) => u.isScreenSharing);
  const hasActiveScreenStream = !!(localScreenStream || (remoteScreenItem && isAnyPeerSharing));

  const activeScreenStream = hasActiveScreenStream
    ? (localScreenStream || remoteScreenItem?.stream || null)
    : null;

  const isBroadcastingLocal = !!localScreenStream;

  // Find who is sharing screen
  const screenSharerUser = isBroadcastingLocal
    ? currentUser
    : usersInRoom.find((u) => u.isScreenSharing);

  // If local user is broadcasting their own screen, automatically let them view their local monitor
  useEffect(() => {
    if (isBroadcastingLocal) {
      setIsWatchingStream(true);
    }
  }, [isBroadcastingLocal]);

  // If the stream ended or person stopped sharing, turn off watching
  useEffect(() => {
    if (!hasActiveScreenStream) {
      setIsWatchingStream(false);
    }
  }, [hasActiveScreenStream]);

  // Sync video source & volume
  useEffect(() => {
    if (videoRef.current) {
      if (activeScreenStream && isWatchingStream) {
        videoRef.current.srcObject = activeScreenStream;
        videoRef.current.volume = isStreamMuted ? 0 : streamVolume;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [activeScreenStream, isWatchingStream, streamVolume, isStreamMuted]);

  useEffect(() => {
    if (isChatOpen) {
      sideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatOpen, dmMessages, channelMessages]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleSendSideChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !onSendMessage) return;
    onSendMessage(chatInputText.trim());
    setChatInputText('');
  };

  const displayedMessages = isDMCall && targetDMFriend
    ? dmMessages.filter(
        (m) =>
          (m.fromUserId === currentUser?.id && m.toUserId === targetDMFriend.id) ||
          (m.fromUserId === targetDMFriend.id && m.toUserId === currentUser?.id)
      )
    : channelMessages;

  // Responsive grid layout based on number of participants
  const getGridColsClass = () => {
    const count = usersInRoom.length;
    if (count <= 1) return 'max-w-xl grid-cols-1';
    if (count === 2) return 'max-w-3xl grid-cols-2';
    if (count <= 4) return 'max-w-4xl grid-cols-2';
    return 'max-w-5xl grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
  };

  return (
    <div ref={containerRef} className="flex-1 bg-gradient-to-b from-[#13141f] via-[#0f1017] to-[#0a0b10] flex flex-col justify-between overflow-hidden relative">
      {/* Hidden audio tags for remote voice audio streams (Only voice streams, not screen streams) */}
      {remoteStreams.filter(s => !s.isScreen).map((item) => (
        <AudioPlayer key={item.peerId} stream={item.stream} isDeafened={isDeafened} />
      ))}

      {/* Top Bar inside Voice Room */}
      <div className="h-12 px-6 bg-[#151622]/90 backdrop-blur-md border-b border-[#212330] flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100 flex items-center gap-2">
            {channel.name}
          </span>
          <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Transmissão de Baixa Latência
          </span>
        </div>

        {/* Right side controls (Preset & Side Chat toggle) */}
        <div className="flex items-center gap-2.5">
          {/* Side Chat Toggle Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isChatOpen
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'bg-[#1b1c28] text-slate-300 border-[#27293a] hover:bg-[#252738]'
            }`}
            title="Abrir Chat de Texto ao Lado da Chamada"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat da Call</span>
          </button>

          {/* Screen Quality Quick Switcher */}
          <div className="flex items-center gap-1.5 bg-[#1b1c28] px-3 py-1.5 rounded-xl border border-[#27293a] text-xs">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 mr-1">Preset:</span>
            <select
              value={streamQuality}
              onChange={(e) => onChangeQuality(e.target.value as StreamQualityPreset)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer"
            >
              <option value="potato" className="bg-[#1b1c28] text-slate-200">🥔 480p 20fps (PC Fraco)</option>
              <option value="balanced" className="bg-[#1b1c28] text-slate-200">⚖️ 720p 30fps (Padrão)</option>
              <option value="gamer" className="bg-[#1b1c28] text-slate-200">🚀 1080p 60fps (Gamer)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 text-xs px-2.5 py-1.5 bg-[#1b1c28] rounded-xl border border-[#27293a]">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono font-semibold">{usersInRoom.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area (Split between Stage and Side Chat) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Stage: Screen Share or Avatars Grid */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden">
          {activeScreenStream && isWatchingStream ? (
            /* ACTIVE WATCHING STREAM VIEW */
            <div className="w-full h-full max-h-[calc(100vh-170px)] flex flex-col items-center justify-center">
              <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-[#26283d] group flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isBroadcastingLocal || isStreamMuted}
                  className="w-full h-full object-contain"
                />

                {/* Top Overlay Badge */}
                <div className="absolute top-4 left-4 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-semibold">
                    {isBroadcastingLocal ? 'Você está transmitindo' : `Assistindo ${screenSharerUser?.name || 'Transmissão'}`}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] ml-1 bg-white/10 px-1.5 py-0.5 rounded">
                    {QUALITY_PRESETS[streamQuality].label.split(' ')[1]}
                  </span>
                </div>

                {/* Top Right Controls: Volume slider, parar de assistir e fullscreen */}
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                  {/* Volume Control (only for viewers) */}
                  {!isBroadcastingLocal && (
                    <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white">
                      <button
                        type="button"
                        onClick={() => setIsStreamMuted(!isStreamMuted)}
                        className="text-slate-300 hover:text-white transition cursor-pointer"
                        title={isStreamMuted ? 'Desmutar Transmissão' : 'Mutar Transmissão'}
                      >
                        {isStreamMuted || streamVolume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-indigo-400" />
                        )}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isStreamMuted ? 0 : streamVolume}
                        onChange={(e) => {
                          setStreamVolume(parseFloat(e.target.value));
                          setIsStreamMuted(false);
                        }}
                        className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        title={`Volume da Stream: ${Math.round((isStreamMuted ? 0 : streamVolume) * 100)}%`}
                      />

                      <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                        {Math.round((isStreamMuted ? 0 : streamVolume) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Stop Watching Button */}
                  {!isBroadcastingLocal && (
                    <button
                      onClick={() => setIsWatchingStream(false)}
                      className="px-3 py-1.5 bg-black/75 hover:bg-rose-500 text-slate-200 hover:text-white rounded-xl backdrop-blur-md border border-white/10 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
                      title="Parar de assistir a transmissão e ver a call"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Parar de Assistir</span>
                    </button>
                  )}

                  <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-black/75 hover:bg-black text-white rounded-xl backdrop-blur-md border border-white/10 transition cursor-pointer"
                    title="Tela Cheia"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-strip of participant avatars */}
              <div className="flex items-center gap-3 mt-3 overflow-x-auto py-1">
                {usersInRoom.map((user) => {
                  const isMe = user.id === currentUser?.id;
                  const userSpeaking = isMe ? isSpeaking : false;

                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#171826] border transition-all ${
                        userSpeaking ? 'border-emerald-500 shadow-md shadow-emerald-500/20' : 'border-[#27293d]'
                      }`}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-slate-200 font-medium truncate max-w-[120px]">{user.name}</span>
                      {user.isMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Centered, proportioned Discord style grid of users */
            <div className="w-full flex flex-col items-center justify-center space-y-4">
              {/* If someone is sharing screen and user is not watching: Show prominent watch banner with their name */}
              {isAnyPeerSharing && !isBroadcastingLocal && !isWatchingStream && (
                <div className="bg-[#1c1d2e] border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between shadow-2xl max-w-xl w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                      <Monitor className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{screenSharerUser?.name || 'Um amigo'}</span>
                        <span className="text-[10px] bg-rose-500 text-white font-mono px-1.5 py-0.2 rounded font-bold animate-pulse">
                          AO VIVO
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Está compartilhando a tela na sala.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsWatchingStream(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Assistir Stream</span>
                  </button>
                </div>
              )}

              <div className={`w-full ${getGridColsClass()} grid gap-5 p-4 mx-auto items-center justify-center`}>
                {usersInRoom.map((user) => {
                  const isMe = user.id === currentUser?.id;
                  const userSpeaking = isMe ? isSpeaking : false;
                  const userIsSharing = user.isScreenSharing;

                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        if (userIsSharing && !isMe) {
                          setIsWatchingStream(true);
                        }
                      }}
                      className={`aspect-video rounded-3xl bg-[#141522]/90 backdrop-blur-sm border flex flex-col items-center justify-center relative group shadow-2xl transition-all duration-200 overflow-hidden ${
                        userIsSharing && !isMe
                          ? 'border-indigo-500/80 hover:border-indigo-400 hover:scale-[1.02] cursor-pointer ring-2 ring-indigo-500/20'
                          : userSpeaking
                          ? 'border-emerald-500 ring-4 ring-emerald-500/25 scale-[1.02]'
                          : 'border-[#232537] hover:border-indigo-500/40'
                      }`}
                    >
                      {/* Centered Avatar Icon / Image */}
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shadow-2xl transition-transform ${
                            userSpeaking ? 'scale-105' : ''
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform ${
                            userSpeaking ? 'scale-105' : ''
                          }`}
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}

                      {/* Screen Sharing Quick Join Overlay (Click to watch) */}
                      {userIsSharing && !isMe && !isWatchingStream && (
                        <div className="absolute inset-0 bg-indigo-950/75 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4 text-center">
                          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl mb-2 group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 fill-current ml-0.5" />
                          </div>
                          <span className="text-xs font-bold text-white">Assistir Transmissão</span>
                          <span className="text-[10px] text-indigo-300">Clique para entrar na stream de {user.name}</span>
                        </div>
                      )}

                      {/* Bottom User Name & Status Badge */}
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-semibold text-slate-100 truncate">{user.name}</span>
                          {isMe && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-medium">
                              Você
                            </span>
                          )}
                          {userIsSharing && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              AO VIVO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {user.isMuted && (
                            <span title="Microfone mutado">
                              <MicOff className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                          {user.isDeafened && (
                            <span title="Áudio desativado">
                              <Headphones className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Collapsible Side Chat Panel */}
        {isChatOpen && (
          <div className="w-84 bg-[#141520] border-l border-[#222432] flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="h-12 px-4 border-b border-[#222432] flex items-center justify-between bg-[#171825]">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Chat de Texto da Chamada</span>
              </span>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {displayedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <MessageSquare className="w-8 h-8 opacity-40" />
                  <p className="text-xs">Nenhuma mensagem enviada nesta chamada ainda.</p>
                </div>
              ) : (
                displayedMessages.map((msg: any) => {
                  const isMe = msg.userId === currentUser?.id || msg.fromUserId === currentUser?.id;
                  const senderName = isMe
                    ? currentUser?.name
                    : msg.userName || (targetDMFriend ? targetDMFriend.name : 'Membro');
                  const avatarColor = isMe
                    ? currentUser?.avatarColor
                    : msg.avatarColor || (targetDMFriend ? targetDMFriend.avatarColor : '#6366f1');

                  return (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: avatarColor || '#6366f1' }}
                        >
                          {(senderName || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-200">{senderName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                      </div>
                      <div className="pl-7 text-xs text-slate-300 break-words">
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={sideChatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendSideChatMessage} className="p-3 border-t border-[#222432] bg-[#161723]">
              <div className="flex items-center gap-2 bg-[#1b1c2a] border border-[#26283d] rounded-xl px-3 py-1.5 focus-within:border-indigo-500 transition">
                <input
                  type="text"
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  placeholder="Conversar na call..."
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none select-text"
                />
                <button
                  type="submit"
                  disabled={!chatInputText.trim()}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar (Mute, Deafen, Screen Share, Quality, Hang up) */}
      <div className="h-20 bg-transparent flex items-center justify-center px-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-[#141520]/80 backdrop-blur-md p-2 rounded-2xl border border-[#232537] shadow-2xl pointer-events-auto">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className={`p-3 rounded-xl transition-all cursor-pointer ${
              isMuted
                ? 'bg-[#f43f5e] hover:bg-[#e11d48] text-white shadow-lg shadow-rose-500/25'
                : 'bg-[#1e1f2f] hover:bg-[#282a3d] text-slate-200'
            }`}
            title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Deafen Button */}
          <button
            onClick={onToggleDeafen}
            className={`p-3 rounded-xl transition-all cursor-pointer ${
              isDeafened
                ? 'bg-[#f43f5e] hover:bg-[#e11d48] text-white shadow-lg shadow-rose-500/25'
                : 'bg-[#1e1f2f] hover:bg-[#282a3d] text-slate-200'
            }`}
            title={isDeafened ? 'Reativar Áudio da Chamada' : 'Ensurdecer'}
          >
            <Headphones className="w-5 h-5" />
          </button>

          {/* Screen Share Button */}
          <button
            onClick={onToggleScreenShare}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-[#f43f5e] hover:bg-[#e11d48] text-white shadow-lg shadow-rose-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
            title={isScreenSharing ? 'Parar de Compartilhar' : 'Transmitir Tela/Jogo'}
          >
            {isScreenSharing ? (
              <>
                <MonitorOff className="w-5 h-5" />
                <span>Parar Tela</span>
              </>
            ) : (
              <>
                <Monitor className="w-5 h-5" />
                <span>Transmitir Tela</span>
              </>
            )}
          </button>

          {/* Leave Voice Button */}
          <button
            onClick={onLeaveVoice}
            className="p-3 bg-[#f43f5e] hover:bg-[#e11d48] text-white rounded-xl transition shadow-lg shadow-rose-500/25 cursor-pointer"
            title="Desconectar da Chamada"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AudioPlayer: React.FC<{ stream: MediaStream; isDeafened: boolean }> = ({ stream, isDeafened }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline muted={isDeafened} />;
};
