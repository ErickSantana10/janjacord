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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161722] border border-[#27293b] rounded-3xl p-6 shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232535] pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-extrabold text-lg text-white">Convidar para {server.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222435] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invite Code Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Código de Convite do Servidor
          </label>
          <div className="flex items-center gap-2 bg-[#1b1c2a] border border-[#27293d] rounded-xl p-2 pl-4">
            <span className="font-mono text-base font-bold text-indigo-300 tracking-wider flex-1 select-all">
              {server.inviteCode}
            </span>
            <button
              onClick={handleCopyCode}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Envie esse código para seus amigos. Eles só precisam clicar em <strong>+</strong> e colar o código.
          </p>
        </div>

        {/* Invite Friends Directly */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Convidar seus Amigos
          </label>

          <div className="bg-[#1b1c2a] border border-[#27293d] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#232537]">
            {acceptedFriends.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Você ainda não tem amigos adicionados. Adicione amigos na Página Inicial para convidá-los diretamente!
              </div>
            ) : (
              acceptedFriends.map((item) => {
                const friend = item.friend;
                const isMember = server.members.includes(friend.id);
                const isInvited = invitedMap[friend.id];

                return (
                  <div key={friend.id} className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                        style={{ backgroundColor: friend.avatarColor }}
                      >
                        {friend.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {friend.displayName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{friend.username}
                        </div>
                      </div>
                    </div>

                    {isMember ? (
                      <span className="text-[11px] text-slate-500 font-medium">Já é membro</span>
                    ) : isInvited ? (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Convite enviado no chat!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(friend.id)}
                        className="px-3 py-1 bg-[#282a3d] hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
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
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#222435] hover:bg-[#2b2d42] text-slate-300 rounded-xl text-xs font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
