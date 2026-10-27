import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { DMChatArea } from './components/DMChatArea';
import { VoiceRoom } from './components/VoiceRoom';
import { MediaRoom } from './components/MediaRoom';
import { HomeView } from './components/HomeView';
import { LoginModal } from './components/LoginModal';
import { CreateServerModal } from './components/CreateServerModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { InviteModal } from './components/InviteModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { UserProfileCard } from './components/UserProfileCard';
import { ServerMemberList } from './components/ServerMemberList';
import { WebRTCManager } from './services/webrtc';
import { sounds } from './services/soundEffects';
import { Phone, PhoneOff } from 'lucide-react';
import type { Channel, Message, DMMessage, User, ServerItem, FriendItem, OnlineUser, StreamQualityPreset, MessageAttachment, ServerMemberInfo, MediaRoomState } from './types';

interface RemoteStreamItem {
  peerId: string;
  stream: MediaStream;
  isScreen: boolean;
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [allServerMembers, setAllServerMembers] = useState<ServerMemberInfo[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);

  // Navigation
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeDMFriend, setActiveDMFriend] = useState<FriendItem['friend'] | null>(null);
  const [currentVoiceChannelId, setCurrentVoiceChannelId] = useState<string | null>(null);
  const [dmVoiceTarget, setDmVoiceTarget] = useState<FriendItem['friend'] | null>(null);

  // View mode when in voice: 'stage' (voice/screen grid) or 'chat' (browsing text channel)
  const [voiceViewMode, setVoiceViewMode] = useState<'stage' | 'chat'>('stage');

  // Call states with sound
  const [callingFriend, setCallingFriend] = useState<FriendItem['friend'] | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ fromUser: User; channelId: string } | null>(null);

  // Audio / Stream state
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamQuality, setStreamQuality] = useState<StreamQualityPreset>('balanced');
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamItem[]>([]);

  // Modals
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice' | 'media'>('text');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | ServerMemberInfo | null>(null);

  // Media Room State (Watch together / Music DJ)
  const [mediaRoomState, setMediaRoomState] = useState<MediaRoomState | null>(null);

  // Toast Notification customizada
  const [toast, setToast] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (text: string, type: 'error' | 'info' = 'error') => {
    setToast({ text, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const socketRef = useRef<Socket | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const activeChannelRef = useRef<Channel | null>(null);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    const rtc = new WebRTCManager(socket);
    rtcManagerRef.current = rtc;

    rtc.onSpeakingChange = (speaking) => {
      setIsSpeaking(speaking);
    };

    rtc.onRemoteStream = (peerId, stream, isScreen) => {
      console.log(`[App] Nova stream de ${peerId}: screen=${isScreen}`);
      setRemoteStreams((prev) => {
        const filtered = prev.filter((item) => !(item.peerId === peerId && item.isScreen === isScreen));
        return [...filtered, { peerId, stream, isScreen }];
      });
      sounds.stopOutgoingRing();
      setCallingFriend(null);
    };

    rtc.onPeerDisconnected = (peerId) => {
      setRemoteStreams((prev) => prev.filter((item) => item.peerId !== peerId));
    };

    rtc.onScreenShareEnded = () => {
      setIsScreenSharing(false);
      setLocalScreenStream(null);
      socket.emit('user:update-state', { isScreenSharing: false });
    };

    // Auto resume saved user session
    const savedUserId = localStorage.getItem('janjacord_user_id');
    if (savedUserId) {
      socket.emit('auth:session', { userId: savedUserId }, (res: { success: boolean; user?: any; state?: any }) => {
        if (res.success && res.user && res.state) {
          const u: User = {
            ...res.user,
            name: res.user.name || res.user.displayName || res.user.username,
            tag: res.user.tag || '001',
          };
          setCurrentUser(u);
          setServers(res.state.servers || []);
          setAllServerMembers(res.state.allServerMembers || []);
          setMessages(res.state.messages || []);
          setDmMessages(res.state.dmMessages || []);
          setFriends(res.state.friends || []);
          setOnlineUsers(res.state.onlineUsers || []);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('janjacord_user_id');
          setIsAuthenticated(false);
        }
      });
    }

    // Real-time events
    socket.on('online:list', (list: OnlineUser[]) => {
      setOnlineUsers(list);
    });

    socket.on('server:created', (newServer: ServerItem) => {
      setServers((prev) => [...prev.filter((s) => s.id !== newServer.id), newServer]);
      setCurrentServerId(newServer.id);
      setActiveDMFriend(null);
      const textChannel = newServer.channels.find((c) => c.type === 'text') || null;
      setActiveChannel(textChannel);
      setVoiceViewMode('chat');
    });

    socket.on('server:channel-created', ({ serverId, channel }: { serverId: string; channel: Channel }) => {
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, channels: [...s.channels, channel] } : s))
      );
    });

    socket.on('server:joined', (joinedServer: ServerItem) => {
      setServers((prev) => [...prev.filter((s) => s.id !== joinedServer.id), joinedServer]);
    });

    socket.on('server:updated', (updatedServer: ServerItem) => {
      setServers((prev) => prev.map((s) => (s.id === updatedServer.id ? updatedServer : s)));
    });

    socket.on('server:kicked', ({ serverId }: { serverId: string }) => {
      showToast('Você foi removido deste servidor.', 'error');
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      setCurrentServerId((prev) => (prev === serverId ? null : prev));
      setActiveChannel(null);
    });

    socket.on('server:left', ({ serverId }: { serverId: string }) => {
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      setCurrentServerId((prev) => (prev === serverId ? null : prev));
      setActiveChannel(null);
    });

    socket.on('server:deleted', ({ serverId }: { serverId: string }) => {
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      setCurrentServerId((prev) => (prev === serverId ? null : prev));
      setActiveChannel(null);
    });

    socket.on('chat:error', ({ message }: { message: string }) => {
      showToast(message, 'error');
    });

    socket.on('friend:list', (updatedFriends: FriendItem[]) => {
      setFriends(updatedFriends);
    });

    socket.on('chat:message', (newMessage: Message) => {
      setMessages((prev) => [...prev, newMessage]);
      sounds.playMessagePop();
    });

    socket.on('media:state-updated', (updatedState: MediaRoomState) => {
      if (activeChannelRef.current?.id === updatedState.channelId) {
        setMediaRoomState(updatedState);
      }
    });

    socket.on('dm:message', (newDM: DMMessage) => {
      setDmMessages((prev) => [...prev, newDM]);
      sounds.playMessagePop();
    });

    socket.on('dm:invite-updated', ({ messageId, status }: { messageId: string; status: 'accepted' | 'declined' }) => {
      setDmMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.serverInvite
            ? { ...m, serverInvite: { ...m.serverInvite, status } }
            : m
        )
      );
    });

    // Incoming DM Call: Start ringtone
    socket.on('dm:incoming-call', ({ fromUser, channelId }: { fromUser: User; channelId: string }) => {
      setIncomingCall({ fromUser, channelId });
      sounds.startIncomingRingtone();
    });

    socket.on('dm:call-ended', () => {
      setIncomingCall(null);
      sounds.stopIncomingRingtone();
      sounds.stopOutgoingRing();
      setCallingFriend(null);
    });

    socket.on('user:profile-updated', (updatedUser: any) => {
      const u: User = {
        ...updatedUser,
        name: updatedUser.name || updatedUser.displayName || updatedUser.username,
        tag: updatedUser.tag || '001',
      };
      setCurrentUser(u);
    });

    // Voice channel events
    socket.on('voice:room-users', async ({ channelId, peers }: { channelId: string; peers: any[] }) => {
      setCurrentVoiceChannelId(channelId);
      setVoiceViewMode('stage');
      sounds.playJoinVoice();

      try {
        await rtc.startMicrophone();
      } catch (err) {
        console.warn('Microfone não concedido:', err);
      }

      peers.forEach((peer) => {
        rtc.connectToPeer(peer.socketId);
      });

      if (peers.length > 0) {
        sounds.stopOutgoingRing();
        setCallingFriend(null);
      }
    });

    socket.on('voice:peer-joined', ({ peer }: { peer: any }) => {
      console.log(`[Voice] Peer entrou na sala: ${peer.name}`);
      sounds.stopOutgoingRing();
      setCallingFriend(null);
    });

    return () => {
      sounds.stopIncomingRingtone();
      sounds.stopOutgoingRing();
      rtc.leaveAll();
      socket.disconnect();
    };
  }, []);

  // Auth Handlers
  const handleLogin = (name: string, password: string, callback: (error?: string) => void) => {
    socketRef.current?.emit('auth:login', { name, password }, (res: { success: boolean; error?: string; user?: any; state?: any }) => {
      if (res.success && res.user && res.state) {
        localStorage.setItem('janjacord_user_id', res.user.id);
        const u: User = { ...res.user, name: res.user.name || res.user.displayName || res.user.username, tag: res.user.tag || '001' };
        setCurrentUser(u);
        setServers(res.state.servers || []);
        setAllServerMembers(res.state.allServerMembers || []);
        setMessages(res.state.messages || []);
        setDmMessages(res.state.dmMessages || []);
        setFriends(res.state.friends || []);
        setOnlineUsers(res.state.onlineUsers || []);
        setIsAuthenticated(true);
        callback();
      } else {
        callback(res.error || 'Erro ao entrar na conta.');
      }
    });
  };

  const handleRegister = (
    name: string,
    password: string,
    avatarColor: string,
    callback: (error?: string) => void
  ) => {
    socketRef.current?.emit(
      'auth:register',
      { name, password, avatarColor },
      (res: { success: boolean; error?: string; user?: any; state?: any }) => {
        if (res.success && res.user && res.state) {
          localStorage.setItem('janjacord_user_id', res.user.id);
          const u: User = { ...res.user, name: res.user.name || res.user.displayName || res.user.username, tag: res.user.tag || '001' };
          setCurrentUser(u);
          setServers(res.state.servers || []);
          setAllServerMembers(res.state.allServerMembers || []);
          setMessages(res.state.messages || []);
          setDmMessages(res.state.dmMessages || []);
          setFriends(res.state.friends || []);
          setOnlineUsers(res.state.onlineUsers || []);
          setIsAuthenticated(true);
          callback();
        } else {
          callback(res.error || 'Erro ao criar conta.');
        }
      }
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('janjacord_user_id');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentServerId(null);
    setActiveChannel(null);
    setActiveDMFriend(null);
    setDmVoiceTarget(null);
    handleCancelOutgoingCall();
    handleLeaveVoice();
  };

  // Profile Update
  const handleSaveProfile = (updates: { name: string; avatarColor: string; avatarUrl?: string }) => {
    socketRef.current?.emit('user:update-profile', updates, (res: { success: boolean; error?: string; user?: any }) => {
      if (res?.success && res.user) {
        const u: User = { ...res.user, name: res.user.name || res.user.displayName || res.user.username, tag: res.user.tag || '001' };
        setCurrentUser(u);
      } else if (res?.error) {
        showToast(res.error, 'error');
      }
    });
  };

  // Navigation
  const currentServer = servers.find((s) => s.id === currentServerId) || null;

  const handleSelectHome = () => {
    setCurrentServerId(null);
    setActiveDMFriend(null);
    if (!currentVoiceChannelId) setVoiceViewMode('chat');
  };

  const handleSelectDM = (friend: FriendItem['friend']) => {
    setCurrentServerId(null);
    setActiveDMFriend(friend);
    setVoiceViewMode('chat');
  };

  const handleSelectServer = (server: ServerItem) => {
    setCurrentServerId(server.id);
    setActiveDMFriend(null);
    const defaultTextChannel = server.channels.find((c) => c.type === 'text') || null;
    setActiveChannel(defaultTextChannel);
    setVoiceViewMode('chat');
  };

  const handleSelectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    setVoiceViewMode('chat'); // browse text or media channel while staying in voice
    if (channel.type === 'media') {
      socketRef.current?.emit('media:get-state', { channelId: channel.id }, (res: any) => {
        if (res?.success && res.state) {
          setMediaRoomState(res.state);
        }
      });
    }
  };

  const handleViewVoiceRoom = () => {
    setVoiceViewMode('stage'); // show the stage / screen share
  };

  const handleCreateServer = (name: string, iconColor: string, callback?: (error?: string) => void) => {
    socketRef.current?.emit('server:create', { name, iconColor }, (res: { success: boolean; error?: string; server?: ServerItem }) => {
      if (res.success && res.server) {
        callback?.();
      } else {
        callback?.(res.error || 'Erro ao criar servidor.');
      }
    });
  };

  const handleCreateChannel = (name: string, type: 'text' | 'voice' | 'media') => {
    if (!currentServer) return;
    socketRef.current?.emit('channel:create', { serverId: currentServer.id, name, type }, (res: { success: boolean; channel?: Channel }) => {
      if (res.success && res.channel && (type === 'text' || type === 'media')) {
        setActiveChannel(res.channel);
        setVoiceViewMode('chat');
        if (type === 'media') {
          socketRef.current?.emit('media:get-state', { channelId: res.channel.id }, (r: any) => {
            if (r?.success && r.state) {
              setMediaRoomState(r.state);
            }
          });
        }
      }
    });
  };

  const handleUpdateServerSettings = (name: string, iconColor: string) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:update-settings', { serverId: currentServer.id, name, iconColor }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleCreateRole = (name: string, color: string, isAdmin: boolean) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:create-role', { serverId: currentServer.id, name, color, isAdmin }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleDeleteRole = (roleId: string) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:delete-role', { serverId: currentServer.id, roleId }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleAssignRole = (targetUserId: string, roleId: string) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:assign-role', { serverId: currentServer.id, targetUserId, roleId }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleTimeoutMember = (targetUserId: string, durationMinutes: number) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:timeout-member', { serverId: currentServer.id, targetUserId, durationMinutes }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleKickMember = (targetUserId: string) => {
    if (!currentServer) return;
    socketRef.current?.emit('server:kick-member', { serverId: currentServer.id, targetUserId }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleLeaveServer = (serverId: string) => {
    socketRef.current?.emit('server:leave', { serverId }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  const handleDeleteServer = (serverId: string) => {
    socketRef.current?.emit('server:delete', { serverId }, (res: any) => {
      if (res?.error) showToast(res.error, 'error');
    });
  };

  // Media Room Handlers (Watch Together & Music DJ)
  useEffect(() => {
    if (activeChannel?.type === 'media') {
      socketRef.current?.emit('media:join-room', { channelId: activeChannel.id });
      return () => {
        socketRef.current?.emit('media:leave-room', { channelId: activeChannel.id });
      };
    }
  }, [activeChannel?.id, activeChannel?.type]);

  const handlePlayMedia = (url: string, title?: string) => {
    if (!activeChannel) return;
    socketRef.current?.emit('media:play', { channelId: activeChannel.id, url, inputUrl: url, title }, (res: any) => {
      if (res?.error) {
        showToast(res.error, 'error');
      }
    });
  };

  const handleMediaSyncAction = (action: 'play' | 'pause' | 'skip' | 'seek', time?: number) => {
    if (!activeChannel) return;
    socketRef.current?.emit('media:sync-action', { channelId: activeChannel.id, action, time });
  };

  const handleMediaHeartbeat = (currentTime: number, isPlaying: boolean) => {
    if (!activeChannel) return;
    socketRef.current?.emit('media:heartbeat', { channelId: activeChannel.id, currentTime, isPlaying });
  };

  const handleVoteSkip = () => {
    if (!activeChannel) return;
    socketRef.current?.emit('media:vote-skip', { channelId: activeChannel.id }, (res: any) => {
      if (res?.error) {
        showToast(res.error, 'error');
      }
    });
  };

  const handleJoinByInvite = (inviteCode: string, callback?: (error?: string) => void) => {
    socketRef.current?.emit('server:join-by-invite', { inviteCode }, (res: { success: boolean; error?: string; server?: ServerItem }) => {
      if (res.success && res.server) {
        setCurrentServerId(res.server.id);
        setActiveDMFriend(null);
        const textChannel = res.server.channels.find((c) => c.type === 'text') || null;
        setActiveChannel(textChannel);
        setVoiceViewMode('chat');
        callback?.();
      } else {
        callback?.(res.error || 'Código de convite inválido.');
      }
    });
  };

  const handleInviteFriend = (serverId: string, friendUserId: string) => {
    socketRef.current?.emit('server:invite-friend', { serverId, friendUserId }, (res: any) => {
      if (res?.error) {
        showToast(res.error, 'error');
      }
    });
  };

  const handleRespondServerInvite = (messageId: string, action: 'accept' | 'decline') => {
    socketRef.current?.emit('server:respond-invite', { messageId, action }, (res: any) => {
      if (res?.error) {
        showToast(res.error, 'error');
      } else if (res?.server && action === 'accept') {
        setCurrentServerId(res.server.id);
        setActiveDMFriend(null);
        const textChannel = res.server.channels.find((c: any) => c.type === 'text') || null;
        setActiveChannel(textChannel);
        setVoiceViewMode('chat');
      }
    });
  };

  // Friend Handlers
  const handleSendFriendRequest = (
    targetIdentifier: string,
    callback: (res: { success: boolean; message?: string; error?: string }) => void
  ) => {
    socketRef.current?.emit('friend:request', { targetIdentifier }, callback);
  };

  const handleAcceptFriend = (friendshipId: string) => {
    socketRef.current?.emit('friend:accept', { friendshipId });
  };

  const handleRemoveFriend = (friendshipId: string) => {
    socketRef.current?.emit('friend:remove', { friendshipId });
    if (activeDMFriend) {
      const removed = friends.find((f) => f.friendshipId === friendshipId);
      if (removed && removed.friend.id === activeDMFriend.id) {
        setActiveDMFriend(null);
      }
    }
  };

  // Direct Message Sending
  const handleSendDM = (text: string, attachment?: MessageAttachment) => {
    const recipientId = activeDMFriend ? activeDMFriend.id : dmVoiceTarget ? dmVoiceTarget.id : null;
    if (!recipientId) return;
    socketRef.current?.emit('dm:send', { toUserId: recipientId, text, attachment });
  };

  // Server message sending
  const handleSendMessage = (text: string, attachment?: MessageAttachment) => {
    if (!currentServer || !activeChannel) return;
    socketRef.current?.emit('chat:send', {
      serverId: currentServer.id,
      channelId: activeChannel.id,
      text,
      attachment,
    });
  };

  // DM Private Call with Ringing Sound
  const handleStartDMCall = (friend: FriendItem['friend']) => {
    if (!currentUser) return;
    const channelId = `dm-call-${[currentUser.id, friend.id].sort().join('-')}`;
    setDmVoiceTarget(friend);
    setCallingFriend(friend);
    setVoiceViewMode('stage');

    sounds.startOutgoingRing();

    socketRef.current?.emit('dm:call-start', { toUserId: friend.id, channelId });
    socketRef.current?.emit('voice:join', { channelId });
  };

  const handleCancelOutgoingCall = () => {
    sounds.stopOutgoingRing();
    if (callingFriend) {
      socketRef.current?.emit('dm:call-end', { toUserId: callingFriend.id });
      setCallingFriend(null);
    }
    handleLeaveVoice();
  };

  const handleAnswerCall = () => {
    if (!incomingCall) return;
    sounds.stopIncomingRingtone();

    const friend = friends.find((f) => f.friend.id === incomingCall.fromUser.id)?.friend;
    if (friend) setDmVoiceTarget(friend);
    setVoiceViewMode('stage');

    socketRef.current?.emit('voice:join', { channelId: incomingCall.channelId });
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    if (!incomingCall) return;
    sounds.stopIncomingRingtone();

    socketRef.current?.emit('dm:call-end', { toUserId: incomingCall.fromUser.id });
    setIncomingCall(null);
  };

  // Voice Handlers
  const handleJoinVoice = (channelId: string, serverId: string) => {
    if (currentVoiceChannelId === channelId) {
      setVoiceViewMode('stage');
      return;
    }
    setDmVoiceTarget(null);
    setVoiceViewMode('stage');
    socketRef.current?.emit('voice:join', { channelId, serverId });
  };

  const handleLeaveVoice = () => {
    sounds.playLeaveVoice();
    sounds.stopIncomingRingtone();
    sounds.stopOutgoingRing();
    setCallingFriend(null);

    if (dmVoiceTarget) {
      socketRef.current?.emit('dm:call-end', { toUserId: dmVoiceTarget.id });
    }

    rtcManagerRef.current?.leaveAll();
    socketRef.current?.emit('voice:leave');
    setCurrentVoiceChannelId(null);
    setDmVoiceTarget(null);
    setIsScreenSharing(false);
    setLocalScreenStream(null);
    setRemoteStreams([]);
  };

  const handleToggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    rtcManagerRef.current?.setMicrophoneMuted(nextState);
    socketRef.current?.emit('user:update-state', { isMuted: nextState });
  };

  const handleToggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    if (!isMuted && nextState) {
      handleToggleMute();
    }
    socketRef.current?.emit('user:update-state', { isDeafened: nextState });
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      rtcManagerRef.current?.stopScreenShare();
      setIsScreenSharing(false);
      setLocalScreenStream(null);
      socketRef.current?.emit('user:update-state', { isScreenSharing: false });
    } else {
      try {
        const stream = await rtcManagerRef.current?.startScreenShare(streamQuality);
        if (stream) {
          setIsScreenSharing(true);
          setLocalScreenStream(stream);
          socketRef.current?.emit('user:update-state', {
            isScreenSharing: true,
            streamQuality,
          });
        }
      } catch (e) {
        console.warn('Compartilhamento cancelado:', e);
      }
    }
  };

  const handleChangeQuality = (preset: StreamQualityPreset) => {
    setStreamQuality(preset);
    rtcManagerRef.current?.updateScreenQuality(preset);
    socketRef.current?.emit('user:update-state', { streamQuality: preset });
  };

  // Find active voice channel or virtual DM channel
  let activeVoiceChannel: Channel | null = null;
  if (currentVoiceChannelId) {
    if (currentVoiceChannelId.startsWith('dm-call-')) {
      activeVoiceChannel = {
        id: currentVoiceChannelId,
        serverId: '',
        name: `📞 Chamada com ${dmVoiceTarget?.displayName || 'Amigo'}`,
        type: 'voice',
      };
    } else {
      for (const server of servers) {
        const found = server.channels.find((c) => c.id === currentVoiceChannelId);
        if (found) {
          activeVoiceChannel = found;
          break;
        }
      }
    }
  }

  const usersInVoiceRoom = onlineUsers.filter((u) => u.currentVoiceChannel === currentVoiceChannelId);

  return (
    <div className="flex h-screen w-screen bg-[#0f1016] text-slate-100 overflow-hidden font-sans">
      {/* 1. Login/Register Modal */}
      {!isAuthenticated && (
        <LoginModal onLogin={handleLogin} onRegister={handleRegister} />
      )}

      {/* Caixinha de Alerta / Notificação Flutuante Customizada */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-[#161722] border border-rose-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-black/60 flex items-center gap-3 animate-in fade-in duration-150 select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <span className="text-xs font-bold text-white">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="text-xs text-slate-400 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Outgoing Call Animated Overlay */}
      {callingFriend && (
        <div className="fixed inset-0 z-50 bg-[#0c0d14]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-8 select-none">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-44 h-44 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="absolute w-36 h-36 rounded-full bg-emerald-500/30 animate-pulse" />

            {callingFriend.avatarUrl ? (
              <img
                src={callingFriend.avatarUrl}
                alt={callingFriend.displayName}
                className="w-28 h-28 rounded-full object-cover shadow-2xl relative border-4 border-emerald-500 z-10"
              />
            ) : (
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center font-black text-white text-4xl shadow-2xl relative border-4 border-emerald-500 z-10"
                style={{ backgroundColor: callingFriend.avatarColor }}
              >
                {callingFriend.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="text-center space-y-1.5 z-10">
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Chamando...
            </div>
            <h3 className="text-2xl font-black text-white">{callingFriend.displayName}</h3>
            <p className="text-xs text-slate-400 font-mono">@{callingFriend.username}</p>
          </div>

          <button
            onClick={handleCancelOutgoingCall}
            className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-600/30 flex items-center gap-2.5 font-bold text-sm transition cursor-pointer z-10"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Cancelar Chamada</span>
          </button>
        </div>
      )}

      {/* 3. Incoming Call Ringing Banner */}
      {incomingCall && (
        <div className="fixed top-6 right-6 z-50 bg-[#161722] border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-500/20 flex items-center gap-4 animate-bounce">
          <div className="relative">
            {incomingCall.fromUser.avatarUrl ? (
              <img
                src={incomingCall.fromUser.avatarUrl}
                alt={incomingCall.fromUser.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-base"
                style={{ backgroundColor: incomingCall.fromUser.avatarColor }}
              >
                {incomingCall.fromUser.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#161722] flex items-center justify-center animate-ping" />
          </div>

          <div>
            <div className="text-xs text-emerald-400 font-bold">Chamada recebida...</div>
            <div className="text-sm font-extrabold text-white">{incomingCall.fromUser.displayName}</div>
            <div className="text-[11px] text-slate-400 font-mono">@{incomingCall.fromUser.username}</div>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleAnswerCall}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition cursor-pointer"
              title="Atender Chamada"
            >
              <Phone className="w-5 h-5" />
            </button>
            <button
              onClick={handleDeclineCall}
              className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition cursor-pointer"
              title="Recusar"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Left Sidebar with Connected Voice Members Indented */}
      <Sidebar
        currentUser={currentUser}
        servers={servers}
        currentServer={currentServer}
        activeChannel={activeChannel}
        currentVoiceChannelId={currentVoiceChannelId}
        activeDMFriendId={activeDMFriend?.id || null}
        friends={friends}
        onlineUsers={onlineUsers}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSpeaking={isSpeaking}
        onSelectHome={handleSelectHome}
        onSelectDM={handleSelectDM}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
        onOpenCreateChannel={(type) => {
          setCreateChannelType(type);
          setIsCreateChannelOpen(true);
        }}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenServerSettings={() => setIsServerSettingsOpen(true)}
        onLeaveServer={handleLeaveServer}
        onSelectChannel={handleSelectChannel}
        onJoinVoice={handleJoinVoice}
        onViewVoiceRoom={handleViewVoiceRoom}
        onLeaveVoice={handleLeaveVoice}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* 5. Main Center Stage */}
      {/* If user is in voice AND viewing the stage: show VoiceRoom */}
      <div className="flex-1 flex overflow-hidden">
        {currentVoiceChannelId && activeVoiceChannel && voiceViewMode === 'stage' ? (
          <VoiceRoom
            channel={activeVoiceChannel}
            currentUser={currentUser}
            usersInRoom={usersInVoiceRoom}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isSpeaking={isSpeaking}
            isScreenSharing={isScreenSharing}
            streamQuality={streamQuality}
            localScreenStream={localScreenStream}
            remoteStreams={remoteStreams}
            isDMCall={!!dmVoiceTarget}
            targetDMFriend={dmVoiceTarget}
            dmMessages={dmMessages}
            channelMessages={activeChannel ? messages.filter((m) => m.channelId === activeChannel.id) : []}
            onSendMessage={(text, attachment) => {
              if (dmVoiceTarget) {
                handleSendDM(text, attachment);
              } else if (currentServer && activeChannel) {
                handleSendMessage(text, attachment);
              }
            }}
            onToggleMute={handleToggleMute}
            onToggleDeafen={handleToggleDeafen}
            onToggleScreenShare={handleToggleScreenShare}
            onLeaveVoice={handleLeaveVoice}
            onChangeQuality={handleChangeQuality}
          />
        ) : currentServer && activeChannel?.type === 'media' ? (
          /* Synchronized Media Room (Watch Together & Music DJ) */
          <MediaRoom
            channel={activeChannel}
            currentUser={currentUser}
            mediaState={mediaRoomState}
            messages={messages.filter((m) => m.serverId === currentServer.id)}
            onSendMessage={handleSendMessage}
            onPlayMedia={handlePlayMedia}
            onSyncAction={handleMediaSyncAction}
            onHeartbeat={handleMediaHeartbeat}
            onVoteSkip={handleVoteSkip}
            onSelectUser={(u) => setSelectedProfileUser(u)}
          />
        ) : currentServer && activeChannel ? (
          /* If user is inside a server's text channel (can be talking in voice at the same time!) */
          <ChatArea
            channel={activeChannel}
            currentUser={currentUser}
            messages={messages.filter((m) => m.serverId === currentServer.id)}
            onSendMessage={handleSendMessage}
            onSelectUser={(u) => setSelectedProfileUser(u)}
          />
        ) : activeDMFriend ? (
          /* 1-on-1 private chat with friend */
          <DMChatArea
            currentUser={currentUser}
            targetFriend={activeDMFriend}
            messages={dmMessages}
            onSendMessage={handleSendDM}
            onStartCall={handleStartDMCall}
            onRespondServerInvite={handleRespondServerInvite}
          />
        ) : (
          /* Default: Home View */
          <HomeView
            currentUser={currentUser}
            onlineUsers={onlineUsers}
            servers={servers}
            friends={friends}
            onOpenCreateServer={() => setIsCreateServerOpen(true)}
            onSelectServer={handleSelectServer}
            onJoinVoice={handleJoinVoice}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriend={handleAcceptFriend}
            onRemoveFriend={handleRemoveFriend}
          />
        )}

        {/* Server Members Sidebar: Shown whenever a server is open */}
        {currentServer && (
          <ServerMemberList
            server={currentServer}
            currentUser={currentUser}
            onlineUsers={onlineUsers}
            allMembersInfo={allServerMembers}
            onSelectMember={(member) => setSelectedProfileUser(member)}
          />
        )}
      </div>

      {/* 6. Modals */}
      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        onCreate={handleCreateServer}
        onJoinByInvite={handleJoinByInvite}
      />

      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        serverName={currentServer?.name || 'Servidor'}
        initialType={createChannelType}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreateChannel={handleCreateChannel}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        server={currentServer}
        friends={friends}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteFriend={handleInviteFriend}
      />

      <UserSettingsModal
        currentUser={currentUser}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveProfile}
      />

      {currentServer && (
        <ServerSettingsModal
          isOpen={isServerSettingsOpen}
          server={currentServer}
          currentUser={currentUser}
          allMembersInfo={allServerMembers}
          onClose={() => setIsServerSettingsOpen(false)}
          onUpdateSettings={handleUpdateServerSettings}
          onCreateRole={handleCreateRole}
          onDeleteRole={handleDeleteRole}
          onAssignRole={handleAssignRole}
          onTimeoutMember={handleTimeoutMember}
          onKickMember={handleKickMember}
          onDeleteServer={() => handleDeleteServer(currentServer.id)}
        />
      )}

      {selectedProfileUser && (
        <UserProfileCard
          user={selectedProfileUser}
          currentUser={currentUser}
          server={currentServer}
          friends={friends}
          onlineUsers={onlineUsers}
          onClose={() => setSelectedProfileUser(null)}
          onSendFriendRequest={handleSendFriendRequest}
          onStartDMCall={handleStartDMCall}
          onSelectDM={handleSelectDM}
          onSendDM={(toUserId, text) => {
            socketRef.current?.emit('dm:send', { toUserId, text });
          }}
          onAssignRole={handleAssignRole}
          onTimeoutMember={handleTimeoutMember}
          onKickMember={handleKickMember}
        />
      )}
    </div>
  );
};

export default App;
