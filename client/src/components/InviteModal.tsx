import React, { useState } from 'react';
import { X, Copy, Check, UserPlus, Users } from 'lucide-react';
import type { ServerItem, FriendItem } from '../types';

interface InviteModalProps {
  isOpen: boolean;
  server: ServerItem | null;
  friends: FriendItem[];
  onClose: () => void;
  onInviteFriend: (serverId: string, friendUserId: string) => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  server,
  friends,
  onClose,
  onInviteFriend,
}) => {
  const [copied, setCopied] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});

  if (!isOpen || !server) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(server.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = (friendUserId: string) => {
    onInviteFriend(server.id, friendUserId);
    setInvitedMap((prev) => ({ ...prev, [friendUserId]: true }));
  };

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#120b22] border border-violet-500/30 rounded-3xl p-6 shadow-2xl shadow-violet-950/60 relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-violet-500/15 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-black text-base text-white truncate">Convidar para {server.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-violet-500/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invite Code Box */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80">
            Código de Convite do Servidor
          </label>
          <div className="flex items-center gap-2 bg-[#0a0612] border border-violet-500/25 rounded-2xl p-2 pl-4">
            <span className="font-mono text-base font-black text-violet-300 tracking-wider flex-1 select-all">
              {server.inviteCode}
            </span>
            <button
              onClick={handleCopyCode}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md shadow-violet-600/20'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-violet-300/60">
            Envie esse código para seus amigos clicarem em <strong>Novo Espaço</strong> e colarem o convite.
          </p>
        </div>

        {/* Invite Friends Directly */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-violet-300/80 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            Enviar Convite Direto aos Amigos
          </label>

          <div className="bg-[#0b0714] border border-violet-500/20 rounded-2xl max-h-48 overflow-y-auto divide-y divide-violet-500/10">
            {acceptedFriends.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                Você ainda não tem amigos adicionados. Adicione amigos na Central de Amigos para convidá-los!
              </div>
            ) : (
              acceptedFriends.map((item) => {
                const friend = item.friend;
                const isMember = server.members.includes(friend.id);
                const isInvited = invitedMap[friend.id];

                return (
                  <div key={friend.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friend.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          {friend.displayName}
                        </div>
                        <div className="text-[10px] text-violet-300/60 font-mono">
                          #{friend.tag || '001'}
                        </div>
                      </div>
                    </div>

                    {isMember ? (
                      <span className="text-[11px] text-slate-500 font-semibold">Já é membro</span>
                    ) : isInvited ? (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Enviado!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(friend.id)}
                        className="px-3.5 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Convidar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
