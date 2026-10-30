import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
  Sliders,
  Sparkles,
  Volume2,
  MessageSquare,
  Send,
  Paperclip,
  FileText,
  Download,
  X,
} from 'lucide-react';
import {
  QUALITY_PRESETS,
  type Channel,
  type OnlineUser,
  type StreamQualityPreset,
  type User,
  type FriendItem,
  type DMMessage,
  type Message,
  type MessageAttachment,
} from '../types';

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
  isDMCall?: boolean;
  targetDMFriend?: FriendItem['friend'] | null;
  dmMessages?: DMMessage[];
  channelMessages?: Message[];
  onSendMessage?: (text: string, attachment?: MessageAttachment) => void;
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
  targetDMFriend = null,
  dmMessages = [],
  channelMessages = [],
  onSendMessage,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onLeaveVoice,
  onChangeQuality,
}) => {
  const [focusedStream, setFocusedStream] = useState<'local' | string | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showCallChat, setShowCallChat] = useState(isDMCall);
  const [chatInput, setChatInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const screenShares = remoteStreams.filter((s) => s.isScreen);
  const audioStreams = remoteStreams.filter((s) => !s.isScreen);

  // Reseta o foco automaticamente se a transmissão focada for encerrada
  useEffect(() => {
    if (focusedStream === 'local' && (!isScreenSharing || !localScreenStream)) {
      setFocusedStream(null);
    } else if (focusedStream && focusedStream !== 'local') {
      const stillExists = screenShares.some((s) => s.peerId === focusedStream);
      if (!stillExists) {
        setFocusedStream(null);
      }
    }
  }, [focusedStream, isScreenSharing, localScreenStream, screenShares]);

  const activeCallMessages =
    isDMCall && targetDMFriend
      ? dmMessages.filter(
          (m) =>
            (m.fromUserId === currentUser?.id && m.toUserId === targetDMFriend.id) ||
            (m.fromUserId === targetDMFriend.id && m.toUserId === currentUser?.id)
        )
      : channelMessages;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCallMessages.length, showCallChat]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return;
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingAttachment({
          name: file.name,
          type: isImage ? 'image' : 'file',
          url: reader.result,
          size: file.size,
        });
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !pendingAttachment) || !onSendMessage) return;
    onSendMessage(chatInput.trim(), pendingAttachment || undefined);
    setChatInput('');
    setPendingAttachment(null);
  };

  return (
    <div className="flex-1 bg-[#0a0612] flex flex-col justify-between overflow-hidden relative select-none">
      {/* Hidden Audio Players for Remote Voice Peers */}
      {audioStreams.map((item) => (
        <RemoteAudioPlayer key={`${item.peerId}-audio`} stream={item.stream} muted={isDeafened} />
      ))}

      {/* Top Header */}
      <div className="h-14 px-6 border-b border-violet-500/15 flex items-center justify-between bg-[#100a1d]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-violet-400 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-slate-100 text-sm">{channel.name}</div>
            <div className="text-[11px] text-violet-300/60 font-medium">
              {usersInRoom.length} {usersInRoom.length === 1 ? 'participante' : 'participantes'} na sala
            </div>
          </div>
        </div>

        {/* Stream Quality Selector & Chat Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#19112c] hover:bg-[#23183c] text-xs font-bold text-violet-200 border border-violet-500/25 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Qualidade: {QUALITY_PRESETS[streamQuality].label}</span>
            </button>

            {showQualityMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-[#140d24] border border-violet-500/30 rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                <div className="text-xs font-bold text-violet-300 px-2 py-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Otimizador de Transmissão</span>
                </div>
                {(Object.keys(QUALITY_PRESETS) as StreamQualityPreset[]).map((key) => {
                  const preset = QUALITY_PRESETS[key];
                  const active = streamQuality === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onChangeQuality(key);
                        setShowQualityMenu(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex flex-col gap-0.5 cursor-pointer ${
                        active
                          ? 'bg-violet-600/25 border border-violet-500/50 text-white'
                          : 'hover:bg-[#1e1433] text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{preset.label}</span>
                        {active && (
                          <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-md">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{preset.description}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowCallChat(!showCallChat)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              showCallChat
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 border-violet-400 text-white shadow-lg shadow-violet-600/20'
                : 'bg-[#19112c] hover:bg-[#23183c] border-violet-500/25 text-violet-200'
            }`}
            title="Abrir/Fechar Chat da Chamada"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Stage + Optional Side Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stage / Grid Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 items-center justify-center">
          {/* Spotlight / Focused Screen Share Mode */}
          {focusedStream && (
            <div className="w-full h-full max-h-[74vh] bg-black rounded-3xl overflow-hidden border border-violet-500/30 relative shadow-2xl shadow-violet-950/40 flex items-center justify-center">
              {focusedStream === 'local' && localScreenStream ? (
                <StreamVideo stream={localScreenStream} muted={true} />
              ) : (
                (() => {
                  const target = screenShares.find((s) => s.peerId === focusedStream);
                  return target ? <StreamVideo stream={target.stream} muted={isDeafened} /> : null;
                })()
              )}

              <button
                onClick={() => setFocusedStream(null)}
                className="absolute top-4 right-4 bg-black/75 hover:bg-violet-950/90 text-white p-2.5 rounded-xl backdrop-blur-md border border-violet-500/30 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Voltar para Grade</span>
              </button>
            </div>
          )}

          {/* Normal Grid View (Screens + User Cards) */}
          {!focusedStream && (
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
              {/* 1. Local Screen Share Card */}
              {isScreenSharing && localScreenStream && (
                <div className="col-span-1 md:col-span-2 aspect-video bg-black rounded-3xl overflow-hidden border-2 border-violet-500/60 relative group shadow-2xl shadow-violet-900/25">
                  <StreamVideo stream={localScreenStream} muted={true} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-[10px] font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-md uppercase tracking-wider shadow">
                        AO VIVO • SUA TELA ({QUALITY_PRESETS[streamQuality].name.toUpperCase()})
                      </span>
                    </div>
                    <button
                      onClick={() => setFocusedStream('local')}
                      className="p-2 bg-black/60 hover:bg-violet-600 text-white rounded-xl backdrop-blur-md transition cursor-pointer"
                      title="Expandir Tela"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Remote Screen Shares */}
              {screenShares.map((share) => {
                const peerUser = usersInRoom.find((u) => u.socketId === share.peerId);
                return (
                  <div
                    key={`${share.peerId}-screen`}
                    className="col-span-1 md:col-span-2 aspect-video bg-black rounded-3xl overflow-hidden border-2 border-fuchsia-500/60 relative group shadow-2xl shadow-fuchsia-900/20"
                  >
                    <StreamVideo stream={share.stream} muted={isDeafened} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-md uppercase tracking-wider animate-pulse">
                          AO VIVO
                        </span>
                        <span className="text-sm font-bold text-white">
                          Tela de {peerUser?.displayName || 'Participante'}
                        </span>
                      </div>
                      <button
                        onClick={() => setFocusedStream(share.peerId)}
                        className="p-2 bg-black/60 hover:bg-violet-600 text-white rounded-xl backdrop-blur-md transition cursor-pointer"
                        title="Assistir em Tela Cheia"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 3. Voice Participant Avatar Cards */}
              {usersInRoom.map((user) => {
                const isMe = user.id === currentUser?.id;
                const speaking = isMe ? isSpeaking && !isMuted : false;

                return (
                  <div
                    key={user.id}
                    className={`aspect-video bg-[#130d21]/90 rounded-3xl border transition-all duration-150 flex flex-col items-center justify-center relative p-6 shadow-xl ${
                      speaking
                        ? 'border-violet-400 ring-2 ring-violet-500/30 shadow-violet-500/20'
                        : 'border-violet-500/15 hover:border-violet-500/30'
                    }`}
                  >
                    <div className="relative">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className={`w-20 h-20 rounded-full object-cover shadow-xl transition-transform duration-150 ${
                            speaking ? 'scale-110 ring-4 ring-violet-400/50' : ''
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-xl transition-transform duration-150 ${
                            speaking ? 'scale-110 ring-4 ring-violet-400/50' : ''
                          }`}
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      {user.isMuted && (
                        <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full shadow-md border-2 border-[#130d21]">
                          <MicOff className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">
                        {user.displayName} {isMe && '(Você)'}
                      </span>
                    </div>

                    <div className="text-[11px] text-violet-300/60 mt-0.5">
                      {user.isScreenSharing ? 'Transmitindo tela' : user.isMuted ? 'Microfone mutado' : 'Conectado'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side Chat Drawer inside Voice Call */}
        {showCallChat && (
          <div className="w-80 bg-[#120b20] border-l border-violet-500/15 flex flex-col justify-between h-full">
            <div className="p-3.5 border-b border-violet-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <MessageSquare className="w-4 h-4 text-violet-400" />
                <span>{isDMCall ? `Chat com ${targetDMFriend?.displayName}` : 'Chat da Sala'}</span>
              </div>
              <button
                onClick={() => setShowCallChat(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {activeCallMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-4">
                  Envie mensagens ou fotos aqui enquanto conversa por voz!
                </div>
              ) : (
                activeCallMessages.map((m: any) => {
                  const isMe = (m.fromUserId || m.userId) === currentUser?.id;
                  const senderName = isMe
                    ? currentUser?.displayName
                    : m.userName || targetDMFriend?.displayName || 'Amigo';

                  return (
                    <div key={m.id} className="text-xs space-y-1 bg-[#19112b] p-2.5 rounded-2xl border border-violet-500/10">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isMe ? 'text-violet-400' : 'text-slate-200'}`}>
                          {senderName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{m.timestamp}</span>
                      </div>
                      {m.text && <p className="text-slate-300 break-words select-text">{m.text}</p>}
                      {m.attachment && (
                        <div className="mt-1.5">
                          {m.attachment.type === 'image' ? (
                            <img
                              src={m.attachment.url}
                              alt={m.attachment.name}
                              className="max-h-40 rounded-xl object-contain border border-violet-500/20"
                            />
                          ) : (
                            <a
                              href={m.attachment.url}
                              download={m.attachment.name}
                              className="flex items-center gap-2 bg-[#211638] p-2 rounded-xl text-violet-300 hover:text-white"
                            >
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="truncate flex-1">{m.attachment.name}</span>
                              <Download className="w-3.5 h-3.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-violet-500/15">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              {pendingAttachment && (
                <div className="mb-2 bg-[#1a112c] p-2 rounded-xl flex items-center justify-between text-xs border border-violet-500/30">
                  <span className="truncate text-slate-200 font-medium">{pendingAttachment.name}</span>
                  <button onClick={() => setPendingAttachment(null)} className="text-rose-400 ml-2 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form
                onSubmit={handleChatSubmit}
                className="flex items-center gap-1.5 bg-[#19112b] border border-violet-500/20 rounded-xl px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-violet-400 cursor-pointer"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Mensagem na call..."
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none select-text"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="pb-6 pt-2 flex justify-center z-10">
        <div className="bg-[#150e26]/95 backdrop-blur-xl border border-violet-500/25 px-6 py-3 rounded-2xl shadow-2xl shadow-violet-950/60 flex items-center gap-4">
          <button
            onClick={onToggleMute}
            className={`p-3.5 rounded-xl font-semibold transition flex items-center gap-2 cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-[#211738] text-slate-200 hover:bg-[#2b1e47]'
            }`}
            title={isMuted ? 'Ativar Microfone' : 'Mutar Microfone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`p-3.5 rounded-xl font-semibold transition flex items-center gap-2 cursor-pointer ${
              isDeafened
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-[#211738] text-slate-200 hover:bg-[#2b1e47]'
            }`}
            title={isDeafened ? 'Ativar Áudio' : 'Desativar Áudio'}
          >
            <Headphones className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleScreenShare}
            className={`px-5 py-3.5 rounded-xl font-bold text-sm transition flex items-center gap-2 cursor-pointer ${
              isScreenSharing
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-fuchsia-500'
                : 'bg-[#211738] text-slate-200 hover:bg-[#2b1e47]'
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span>{isScreenSharing ? 'Parar Transmissão' : 'Transmitir Tela'}</span>
          </button>

          <div className="w-[1px] h-8 bg-violet-500/20 mx-1" />

          <button
            onClick={onLeaveVoice}
            className="px-5 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Desconectar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const StreamVideo: React.FC<{ stream: MediaStream; muted?: boolean }> = ({ stream, muted = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    videoEl.muted = muted;
    videoEl.play().catch(() => {});
  }, [stream, muted]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-contain bg-black"
    />
  );
};

const RemoteAudioPlayer: React.FC<{ stream: MediaStream; muted: boolean }> = ({ stream, muted }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay muted={muted} className="hidden" />;
};
