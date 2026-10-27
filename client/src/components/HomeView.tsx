import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Volume2, 
  Flame,
  UserPlus,
  Check,
  X,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import type { User, ServerItem, FriendItem, OnlineUser } from '../types';

interface HomeViewProps {
  currentUser: User | null;
  onlineUsers: OnlineUser[];
  servers: ServerItem[];
  friends: FriendItem[];
  onOpenCreateServer: () => void;
  onSelectServer: (server: ServerItem) => void;
  onJoinVoice: (channelId: string, serverId: string) => void;
  onSendFriendRequest: (targetUsername: string, callback: (res: { success: boolean; message?: string; error?: string }) => void) => void;
  onAcceptFriend: (friendshipId: string) => void;
  onRemoveFriend: (friendshipId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  onlineUsers,
  servers,
  friends,
  onOpenCreateServer,
  onSelectServer,
  onJoinVoice,
  onSendFriendRequest,
  onAcceptFriend,
  onRemoveFriend,
}) => {
  const [tab, setTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [addUsernameInput, setAddUsernameInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getServerInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const pendingRequests = friends.filter((f) => f.status === 'pending');
  const incomingPending = pendingRequests.filter((f) => !f.isInitiator);
  const outgoingPending = pendingRequests.filter((f) => f.isInitiator);

  const onlineFriends = acceptedFriends.filter((f) => {
    return onlineUsers.some((ou) => ou.id === f.friend.id);
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsernameInput.trim()) return;
    setFeedback(null);

    onSendFriendRequest(addUsernameInput.trim(), (res) => {
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Pedido enviado com sucesso!' });
        setAddUsernameInput('');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao enviar pedido.' });
      }
    });
  };

  return (
    <div className="flex-1 bg-[#12131c] flex flex-col overflow-hidden">
      {/* Top Bar with Navigation Tabs */}
      <div className="h-12 px-6 border-b border-[#212330] flex items-center justify-between bg-[#151622] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Flame className="w-5 h-5 text-indigo-500" />
            <span>Amigos</span>
          </div>

          <div className="w-[1px] h-4 bg-[#2a2c3d] mx-2" />

          {/* Subtabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab('online')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                tab === 'online' ? 'bg-[#27293d] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Disponíveis ({onlineFriends.length})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                tab === 'all' ? 'bg-[#27293d] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({acceptedFriends.length})
            </button>
            <button
              onClick={() => setTab('pending')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition relative ${
                tab === 'pending' ? 'bg-[#27293d] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Pendentes</span>
              {incomingPending.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full">
                  {incomingPending.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('add')}
              className={`ml-2 px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                tab === 'add'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Adicionar Amigo</span>
            </button>
          </div>
        </div>

        <button
          onClick={onOpenCreateServer}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Criar ou Entrar</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto space-y-8 max-w-5xl mx-auto w-full">
        {/* TAB: ADICIONAR AMIGO */}
        {tab === 'add' && (
          <div className="bg-[#161722] border border-[#27293b] rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-lg font-black text-white">ADICIONAR AMIGO</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Você pode adicionar um amigo usando o nome e a # dele (ex: <span className="text-indigo-400 font-semibold font-mono">fulaninho#001</span>). A # serve para distinguir quem tem o mesmo nome.
              </p>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="flex items-center gap-2 bg-[#1b1c2a] border border-[#27293d] rounded-2xl p-2 pl-4 focus-within:border-emerald-500 transition">
                <input
                  type="text"
                  autoFocus
                  value={addUsernameInput}
                  onChange={(e) => setAddUsernameInput(e.target.value)}
                  placeholder="Digite Nome#001 do seu amigo"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none select-text"
                />
                <button
                  type="submit"
                  disabled={!addUsernameInput.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Enviar Pedido
                </button>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{feedback.message}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB: PENDENTES */}
        {tab === 'pending' && (
          <div className="space-y-6">
            {/* Incoming Requests */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pedidos Recebidos ({incomingPending.length})
              </h4>

              {incomingPending.length === 0 ? (
                <div className="p-6 bg-[#161722] border border-[#242637] rounded-2xl text-center text-xs text-slate-500">
                  Nenhum pedido de amizade pendente no momento.
                </div>
              ) : (
                <div className="bg-[#161722] border border-[#242637] rounded-2xl divide-y divide-[#222435]">
                  {incomingPending.map((req) => (
                    <div key={req.friendshipId} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                          style={{ backgroundColor: req.friend.avatarColor }}
                        >
                          {req.friend.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{req.friend.name || req.friend.displayName}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: #{req.friend.tag || '001'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onAcceptFriend(req.friendshipId)}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition"
                          title="Aceitar Pedido"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveFriend(req.friendshipId)}
                          className="p-2 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl transition"
                          title="Recusar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            {outgoingPending.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pedidos Enviados ({outgoingPending.length})
                </h4>
                <div className="bg-[#161722] border border-[#242637] rounded-2xl divide-y divide-[#222435]">
                  {outgoingPending.map((req) => (
                    <div key={req.friendshipId} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                          style={{ backgroundColor: req.friend.avatarColor }}
                        >
                          {req.friend.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{req.friend.name || req.friend.displayName}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: #{req.friend.tag || '001'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Aguardando resposta</span>
                        <button
                          onClick={() => onRemoveFriend(req.friendshipId)}
                          className="ml-2 p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                          title="Cancelar Pedido"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ONLINE OU TODOS */}
        {(tab === 'online' || tab === 'all') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>{tab === 'online' ? 'Amigos Disponíveis' : 'Todos os Amigos'}</span>
              </h3>
              <span className="text-xs text-slate-400">
                {tab === 'online' ? `${onlineFriends.length} online` : `${acceptedFriends.length} amigos`}
              </span>
            </div>

            {(tab === 'online' ? onlineFriends : acceptedFriends).length === 0 ? (
              <div className="py-12 bg-[#161722] border border-[#242637] rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#1d1f2e] flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-slate-300 font-bold text-sm">
                  {tab === 'online' ? 'Nenhum amigo online agora' : 'Você ainda não tem amigos adicionados'}
                </div>
                <button
                  onClick={() => setTab('add')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
                >
                  Adicionar Amigos
                </button>
              </div>
            ) : (
              <div className="bg-[#161722] border border-[#242637] rounded-2xl divide-y divide-[#222435]">
                {(tab === 'online' ? onlineFriends : acceptedFriends).map((item) => {
                  const friend = item.friend;
                  const onlineUser = onlineUsers.find((ou) => ou.id === friend.id);
                  const isOnline = !!onlineUser;
                  const inVoiceChannel = onlineUser?.currentVoiceChannel;
                  const userServer = inVoiceChannel ? servers.find((s) => s.id === onlineUser.currentServerId) : null;

                  return (
                    <div key={friend.id} className="p-3 flex items-center justify-between hover:bg-[#191a27] rounded-xl transition">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm relative"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friend.displayName.slice(0, 1).toUpperCase()}
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#161722] ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                            <span>{friend.name || friend.displayName}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {inVoiceChannel ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                <Volume2 className="w-3 h-3" />
                                Em chamada no {userServer?.name || 'servidor'}
                              </span>
                            ) : isOnline ? (
                              <span className="text-emerald-400">Online</span>
                            ) : (
                              <span className="text-slate-500">Offline</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {inVoiceChannel && userServer && (
                          <button
                            onClick={() => {
                              onSelectServer(userServer);
                              onJoinVoice(inVoiceChannel, userServer.id);
                            }}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Entrar na Sala</span>
                          </button>
                        )}

                        <button
                          onClick={() => onRemoveFriend(item.friendshipId)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Remover Amigo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SERVERS SECTION */}
        <div className="space-y-4 pt-4 border-t border-[#222435]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-slate-200">Seus Servidores Privados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Somente servidores onde você foi convidado pelo criador aparecem aqui.
              </p>
            </div>
            <span className="text-xs text-slate-400">{servers.length} participando</span>
          </div>

          {servers.length === 0 ? (
            <div className="p-8 bg-[#161722] border border-[#242637] rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1d1f2e] flex items-center justify-center text-slate-400">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="text-slate-300 font-bold text-sm">Você ainda não faz parte de nenhum servidor</div>
              <p className="text-xs text-slate-400 max-w-sm">
                Crie seu primeiro servidor ou peça o código de convite para um amigo.
              </p>
              <button
                onClick={onOpenCreateServer}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-600/20"
              >
                + Criar Servidor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server) => {
                const textCount = server.channels.filter((c) => c.type === 'text').length;
                const voiceCount = server.channels.filter((c) => c.type === 'voice').length;
                const isOwner = server.ownerId === currentUser?.id;

                return (
                  <div
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className="bg-[#171824] hover:bg-[#1d1f2e] border border-[#27293b] hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-md group space-y-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-base shadow-md group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: server.iconColor }}
                      >
                        {getServerInitials(server.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-100 truncate group-hover:text-indigo-400 transition">
                            {server.name}
                          </h4>
                          {isOwner && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono font-bold">
                              DONO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {textCount} texto • {voiceCount} voz • {server.members.length} membros
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#232537] flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[11px] bg-[#12131c] px-2 py-0.5 rounded border border-white/5">
                        Convite: {server.inviteCode}
                      </span>
                      <span className="text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
