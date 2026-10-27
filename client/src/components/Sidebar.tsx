import React, { useState } from 'react';
import { 
  Hash, 
  Volume2, 
  Mic, 
  MicOff, 
  Headphones, 
  Settings, 
  PhoneOff,
  Flame,
  Plus,
  Users,
  LogOut,
  UserPlus,
  Monitor,
  Film,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import type { Channel, User, ServerItem, FriendItem, OnlineUser } from '../types';

interface SidebarProps {
  currentUser: User | null;
  servers: ServerItem[];
  currentServer: ServerItem | null;
  activeChannel: Channel | null;
  currentVoiceChannelId: string | null;
  activeDMFriendId: string | null;
  friends: FriendItem[];
  onlineUsers: OnlineUser[];
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  onSelectHome: () => void;
  onSelectDM: (friend: FriendItem['friend']) => void;
  onSelectServer: (server: ServerItem) => void;
  onOpenCreateServer: () => void;
  onOpenCreateChannel: (initialType: 'text' | 'voice' | 'media') => void;
  onOpenInviteModal: () => void;
  onOpenServerSettings: () => void;
  onLeaveServer: (serverId: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onJoinVoice: (channelId: string, serverId: string) => void;
  onViewVoiceRoom: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  servers,
  currentServer,
  activeChannel,
  currentVoiceChannelId,
  activeDMFriendId,
  friends,
  onlineUsers,
  isMuted,
  isDeafened,
  isSpeaking,
  onSelectHome,
  onSelectDM,
  onSelectServer,
  onOpenCreateServer,
  onOpenCreateChannel,
  onOpenInviteModal,
  onOpenServerSettings,
  onLeaveServer,
  onSelectChannel,
  onJoinVoice,
  onViewVoiceRoom,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onOpenSettings,
  onLogout,
}) => {
  const isAtHome = currentServer === null;
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
  const textChannels = currentServer ? currentServer.channels.filter((c) => c.type === 'text') : [];
  const voiceChannels = currentServer ? currentServer.channels.filter((c) => c.type === 'voice') : [];
  const mediaChannels = currentServer ? currentServer.channels.filter((c) => c.type === 'media') : [];
  const acceptedFriends = friends.filter((f) => f.status === 'accepted');

  const isOwner = currentUser?.id === currentServer?.ownerId;
  const myRoles = currentUser && currentServer ? currentServer.memberRoles?.[currentUser.id] || [] : [];
  const isAdmin = isOwner || (currentServer?.roles || []).some((r) => myRoles.includes(r.id) && r.isAdmin);

  const getServerInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen select-none">
      {/* 1. Server Icons Column */}
      <div className="w-[72px] bg-[#111217] flex flex-col items-center py-3 space-y-2 border-r border-[#1e1f29] overflow-y-auto overflow-x-hidden">
        {/* Home / Janjacord Logo */}
        <div className="relative group flex items-center justify-center w-full">
          <div
            className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
              isAtHome ? 'h-10' : 'h-0 group-hover:h-5'
            }`}
          />
          <button
            onClick={onSelectHome}
            className={`w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg ${
              isAtHome
                ? 'rounded-2xl bg-indigo-600 text-white shadow-indigo-600/30'
                : 'rounded-3xl bg-[#1e1f29] text-indigo-400 hover:rounded-2xl hover:bg-indigo-600 hover:text-white'
            }`}
            title="Página Inicial (Início)"
          >
            <Flame className="w-6 h-6 transition-transform group-hover:scale-110" />
          </button>
        </div>

        <div className="w-8 h-[2px] bg-[#272935] my-1" />

        {/* Dynamic Servers List */}
        {servers.map((server) => {
          const isSelected = currentServer?.id === server.id;
          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              <div
                className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                  isSelected ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />
              <button
                onClick={() => onSelectServer(server)}
                className={`w-12 h-12 flex items-center justify-center font-bold text-white text-sm transition-all duration-200 cursor-pointer shadow-md ${
                  isSelected
                    ? 'rounded-2xl ring-2 ring-white scale-105'
                    : 'rounded-3xl hover:rounded-2xl opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: server.iconColor }}
                title={server.name}
              >
                {getServerInitials(server.name)}
              </button>
            </div>
          );
        })}

        {/* Create Server / Join '+' Button */}
        <div className="relative group flex items-center justify-center w-full pt-1">
          <button
            onClick={onOpenCreateServer}
            className="w-12 h-12 rounded-3xl hover:rounded-2xl bg-[#1e1f29] hover:bg-emerald-600 transition-all duration-200 flex items-center justify-center text-emerald-400 hover:text-white cursor-pointer group shadow-md"
            title="Criar ou Entrar em Servidor (+)"
          >
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* 2. Channel List / Navigation Panel */}
      <div className="w-60 bg-[#171821] flex flex-col justify-between border-r border-[#222430]">
        <div>
          {/* Header */}
          {currentServer ? (
            <div className="relative">
              <div
                onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setIsServerMenuOpen(true);
                }}
                className="h-12 px-3 border-b border-[#222430] flex items-center justify-between font-bold text-slate-200 shadow-sm bg-[#161722] hover:bg-[#1b1c2b] transition cursor-pointer select-none"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate text-sm">{currentServer.name}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isServerMenuOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </div>

              {/* Context Dropdown Menu (Print 1 style) */}
              {isServerMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsServerMenuOpen(false)}
                  />
                  <div className="absolute top-13 left-2 right-2 z-40 bg-[#111218] border border-[#242638] rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in duration-150">
                    <button
                      onClick={() => {
                        setIsServerMenuOpen(false);
                        alert(`✨ O servidor "${currentServer.name}" está no nível de impulso máximo!`);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-fuchsia-400 hover:bg-fuchsia-500/10 hover:text-fuchsia-300 transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Impulso de Servidor</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsServerMenuOpen(false);
                        onOpenInviteModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-400 hover:bg-indigo-600/15 hover:text-indigo-300 transition cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Convidar Pessoas</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setIsServerMenuOpen(false);
                          onOpenServerSettings();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-[#1e2030] hover:text-white transition cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Configurações do Servidor</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsServerMenuOpen(false);
                        onOpenCreateChannel('text');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-[#1e2030] hover:text-white transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-slate-400" />
                      <span>Criar Canal</span>
                    </button>

                    <div className="my-1 border-t border-[#1f2130]" />

                    <button
                      onClick={() => {
                        setIsServerMenuOpen(false);
                        onLeaveServer(currentServer.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair do Servidor</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-12 px-4 border-b border-[#222430] flex items-center justify-between font-bold text-slate-200 shadow-sm">
              <span className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-indigo-400" />
                <span>Janjacord</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">HOME</span>
            </div>
          )}

          {/* Body */}
          <div className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-125px)]">
            {isAtHome ? (
              /* Home Menu with DMs */
              <div className="space-y-3">
                <button
                  onClick={onSelectHome}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    activeDMFriendId === null
                      ? 'bg-[#27293a] text-white shadow-sm'
                      : 'text-slate-400 hover:bg-[#1d1f2b] hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Amigos</span>
                </button>

                {/* Direct Messages Section */}
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Mensagens Diretas</span>
                    <span className="text-[10px] font-mono">{acceptedFriends.length}</span>
                  </div>

                  {acceptedFriends.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 italic">
                      Adicione amigos para conversar em privado!
                    </div>
                  ) : (
                    acceptedFriends.map((item) => {
                      const friend = item.friend;
                      const isActive = activeDMFriendId === friend.id;

                      return (
                        <button
                          key={friend.id}
                          onClick={() => onSelectDM(friend)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                            isActive
                              ? 'bg-[#27293a] text-white shadow-sm'
                              : 'text-slate-300 hover:bg-[#1d1f2b] hover:text-white'
                          }`}
                        >
                          <div className="relative shrink-0">
                            {friend.avatarUrl ? (
                              <img
                                src={friend.avatarUrl}
                                alt={friend.displayName}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px]"
                                style={{ backgroundColor: friend.avatarColor }}
                              >
                                {friend.displayName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#171821] ${
                                friend.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                              }`}
                            />
                          </div>

                          <div className="truncate text-left flex-1 min-w-0">
                            <div className="truncate font-semibold">{friend.displayName}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              @{friend.username}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Server Channels */
              <>
                {/* Invite shortcut banner */}
                <button
                  onClick={onOpenInviteModal}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/20 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Convidar Amigo</span>
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-600/30 px-1 rounded">
                    {currentServer.inviteCode}
                  </span>
                </button>

                {/* Text Channels */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between group">
                    <span>Canais de Texto</span>
                    <button
                      onClick={() => onOpenCreateChannel('text')}
                      className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-[#27293d] transition cursor-pointer"
                      title="Criar Canal de Texto (+)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {textChannels.map((channel) => {
                      const isActive = activeChannel?.id === channel.id;
                      return (
                        <button
                          key={channel.id}
                          onClick={() => onSelectChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-[#27293a] text-white shadow-sm font-semibold'
                              : 'text-slate-400 hover:bg-[#1d1f2b] hover:text-slate-200'
                          }`}
                        >
                          <Hash className="w-4 h-4 text-slate-400" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Voice Channels */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between group">
                    <span>Canais de Voz & Stream</span>
                    <button
                      onClick={() => onOpenCreateChannel('voice')}
                      className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-[#27293d] transition cursor-pointer"
                      title="Criar Canal de Voz (+)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1 mt-1">
                    {voiceChannels.map((channel) => {
                      const isConnectedHere = currentVoiceChannelId === channel.id;
                      const membersInThisVoice = onlineUsers.filter((u) => u.currentVoiceChannel === channel.id);

                      return (
                        <div key={channel.id} className="space-y-0.5">
                          <button
                            onClick={() => {
                              if (isConnectedHere) {
                                onViewVoiceRoom();
                              } else {
                                onJoinVoice(channel.id, currentServer.id);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
                              isConnectedHere
                                ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                                : 'text-slate-400 hover:bg-[#1d1f2b] hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Volume2 className={`w-4 h-4 ${isConnectedHere ? 'text-emerald-400' : 'text-slate-400'}`} />
                              <span className="truncate">{channel.name}</span>
                            </div>
                            {isConnectedHere && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded">conectado</span>
                            )}
                          </button>

                          {/* Connected Members Listed Directly Beneath the Voice Channel */}
                          {membersInThisVoice.length > 0 && (
                            <div className="pl-6 pr-2 py-1 space-y-1 bg-[#13141e]/50 rounded-lg my-0.5">
                              {membersInThisVoice.map((member) => {
                                const isMe = member.id === currentUser?.id;
                                const memberSpeaking = isMe ? isSpeaking : false;

                                return (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between py-1 text-xs text-slate-200"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <div className="relative shrink-0">
                                        {member.avatarUrl ? (
                                          <img
                                            src={member.avatarUrl}
                                            alt={member.displayName || member.username}
                                            className={`w-5 h-5 rounded-full object-cover transition-all ${
                                              memberSpeaking ? 'ring-2 ring-emerald-400' : ''
                                            }`}
                                          />
                                        ) : (
                                          <div
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all ${
                                              memberSpeaking ? 'ring-2 ring-emerald-400' : ''
                                            }`}
                                            style={{ backgroundColor: member.avatarColor }}
                                          >
                                            {(member.name || member.displayName || '?').slice(0, 1).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <span className="truncate text-slate-300 font-medium">
                                        {member.name || member.displayName}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-slate-400">
                                      {member.isScreenSharing && (
                                        <span title="Transmitindo tela">
                                          <Monitor className="w-3 h-3 text-indigo-400 animate-pulse" />
                                        </span>
                                      )}
                                      {member.isMuted && (
                                        <span title="Mutado">
                                          <MicOff className="w-3 h-3 text-rose-400" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Media Rooms (Salas de Música & Vídeo) */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between group">
                    <span>Salas de Vídeo & Som</span>
                    <button
                      onClick={() => onOpenCreateChannel('media')}
                      className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-[#27293d] transition cursor-pointer"
                      title="Criar Sala de Vídeo/Música (+)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {mediaChannels.map((channel) => {
                      const isActive = activeChannel?.id === channel.id;
                      return (
                        <button
                          key={channel.id}
                          onClick={() => onSelectChannel(channel)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-[#27293a] text-amber-400 shadow-sm font-semibold'
                              : 'text-slate-400 hover:bg-[#1d1f2b] hover:text-slate-200'
                          }`}
                        >
                          <Film className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">{channel.name.replace(/^🎬\s*/, '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Bottom Voice Status Banner & User Profile Bar */}
        <div>
          {currentVoiceChannelId && (
            <div className="bg-[#12131a] px-3 py-2 border-t border-[#222430] flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer group flex-1 truncate"
                onClick={onViewVoiceRoom}
                title="Clique para abrir a tela da chamada"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-emerald-400 group-hover:underline truncate">
                    Voz Conectada
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">Clique para ver palco</div>
                </div>
              </div>
              <button
                onClick={onLeaveVoice}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition shrink-0 ml-1"
                title="Desconectar da Voz"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* User Profile Bar */}
          <div className="h-14 bg-[#111218] px-3 flex items-center justify-between border-t border-[#222430]">
            <div className="flex items-center gap-2.5 truncate cursor-pointer group" onClick={onOpenSettings}>
              <div className="relative shrink-0">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className={`w-9 h-9 rounded-full object-cover transition-all ${
                      isSpeaking ? 'ring-2 ring-emerald-400' : ''
                    }`}
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm transition-all ${
                      isSpeaking ? 'ring-2 ring-emerald-400' : ''
                    }`}
                    style={{ backgroundColor: currentUser?.avatarColor || '#6366f1' }}
                  >
                    {(currentUser?.displayName || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111218]" />
              </div>

              <div className="truncate">
                <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition">
                  {currentUser?.name || currentUser?.displayName || 'Jogador'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  Tag de Amigo: #{currentUser?.tag || '001'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded hover:bg-[#222430] transition ${
                  isMuted ? 'text-rose-400' : 'text-slate-300'
                }`}
                title={isMuted ? 'Desmutar' : 'Mutar Microfone'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={onToggleDeafen}
                className={`p-1.5 rounded hover:bg-[#222430] transition ${
                  isDeafened ? 'text-rose-400' : 'text-slate-300'
                }`}
                title={isDeafened ? 'Reativar Áudio' : 'Ensurdecer'}
              >
                <Headphones className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-[#222430] transition"
                title="Editar Perfil e Foto"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
