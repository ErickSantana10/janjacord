import React, { useState } from 'react';
import {
  X,
  Settings,
  Shield,
  Users,
  Trash2,
  Plus,
  Crown,
  Clock,
  UserX,
  Save,
  Check
} from 'lucide-react';
import type { ServerItem, User, ServerMemberInfo } from '../types';

interface ServerSettingsModalProps {
  isOpen: boolean;
  server: ServerItem;
  currentUser: User | null;
  allMembersInfo: ServerMemberInfo[];
  onClose: () => void;
  onUpdateSettings: (name: string, iconColor: string) => void;
  onCreateRole: (name: string, color: string, isAdmin: boolean) => void;
  onDeleteRole: (roleId: string) => void;
  onAssignRole: (targetUserId: string, roleId: string) => void;
  onTimeoutMember: (targetUserId: string, durationMinutes: number) => void;
  onKickMember: (targetUserId: string) => void;
  onDeleteServer: () => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  server,
  currentUser,
  allMembersInfo,
  onClose,
  onUpdateSettings,
  onCreateRole,
  onDeleteRole,
  onAssignRole,
  onTimeoutMember,
  onKickMember,
  onDeleteServer,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'members'>('overview');
  const [serverName, setServerName] = useState(server.name);
  const [serverColor, setServerColor] = useState(server.iconColor || '#10b981');
  const [isSaved, setIsSaved] = useState(false);

  // New role form
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#818cf8');
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Member search
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmDeleteServer, setConfirmDeleteServer] = useState(false);
  const [confirmKickMember, setConfirmKickMember] = useState<{ id: string; name: string } | null>(null);
  const [timeoutMemberTarget, setTimeoutMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [customTimeoutMinutes, setCustomTimeoutMinutes] = useState('15');

  if (!isOpen) return null;

  const isOwner = currentUser?.id === server.ownerId;
  const myRoles = currentUser ? server.memberRoles?.[currentUser.id] || [] : [];
  const isAdmin = isOwner || (server.roles || []).some((r) => myRoles.includes(r.id) && r.isAdmin);

  const handleSaveOverview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    onUpdateSettings(serverName.trim(), serverColor);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    onCreateRole(newRoleName.trim(), newRoleColor, newRoleIsAdmin);
    setNewRoleName('');
    setNewRoleColor('#818cf8');
    setNewRoleIsAdmin(false);
    setIsCreatingRole(false);
  };

  // Map member info
  const membersMap = new Map<string, ServerMemberInfo>();
  allMembersInfo.forEach((u) => membersMap.set(u.id, u));
  if (currentUser) {
    membersMap.set(currentUser.id, {
      id: currentUser.id,
      name: currentUser.name || (currentUser as any).displayName || 'Jogador',
      tag: currentUser.tag || '001',
      avatarColor: currentUser.avatarColor,
      avatarUrl: currentUser.avatarUrl,
      bio: currentUser.bio,
    });
  }

  const serverMembers = (server.members || []).map((id) => {
    const info = membersMap.get(id);
    return {
      id,
      name: info?.name || 'Membro',
      tag: info?.tag || '001',
      avatarColor: info?.avatarColor || '#6366f1',
      avatarUrl: info?.avatarUrl,
    };
  }).filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()));

  const serverRoles = server.roles || [
    { id: 'role-admin', name: 'Administrador', color: '#ef4444', isAdmin: true },
    { id: 'role-mod', name: 'Moderador', color: '#3b82f6', isAdmin: false },
    { id: 'role-member', name: 'Membro', color: '#94a3b8', isAdmin: false },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl h-[560px] bg-[#161722] border border-[#27293b] rounded-3xl shadow-2xl flex overflow-hidden select-none">
        {/* 1. Left Sidebar Tabs */}
        <div className="w-56 bg-[#111218] border-r border-[#222430] p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="px-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {server.name}
              </h4>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#1f2130] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181924]'
                }`}
              >
                <Settings className="w-4 h-4 text-indigo-400" />
                <span>Visão Geral</span>
              </button>

              <button
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-[#1f2130] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181924]'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Cargos ({serverRoles.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('members')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-[#1f2130] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181924]'
                }`}
              >
                <Users className="w-4 h-4 text-blue-400" />
                <span>Membros ({server.members.length})</span>
              </button>
            </div>
          </div>

          {/* Delete Server Option at Bottom (Owner Only) */}
          {isOwner && (
            <button
              onClick={() => setConfirmDeleteServer(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Servidor</span>
            </button>
          )}
        </div>

        {/* 2. Main Tab Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-14 px-6 border-b border-[#222430] flex items-center justify-between bg-[#151620]">
            <div>
              <h3 className="font-extrabold text-base text-white">
                {activeTab === 'overview' && 'Visão Geral do Servidor'}
                {activeTab === 'roles' && 'Cargos & Permissões'}
                {activeTab === 'members' && 'Gerenciamento de Membros'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#202230] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* TAB 1: VISÃO GERAL */}
            {activeTab === 'overview' && (
              <form onSubmit={handleSaveOverview} className="space-y-6 max-w-md">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg"
                    style={{ backgroundColor: serverColor }}
                  >
                    {serverName.slice(0, 2).toUpperCase() || 'JJ'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-400">Ícone do Servidor</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Escolha uma cor de destaque para o ícone</p>
                    <div className="flex items-center gap-2 mt-2">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setServerColor(c)}
                          className={`w-6 h-6 rounded-full transition cursor-pointer ${
                            serverColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Nome do Servidor
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    maxLength={32}
                    className="w-full bg-[#181926] border border-[#27293d] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Código de Convite
                  </label>
                  <div className="p-3 bg-[#181926] border border-[#27293d] rounded-xl text-xs font-mono text-indigo-300 flex items-center justify-between">
                    <span>{server.inviteCode}</span>
                    <span className="text-[10px] text-slate-500">Compartilhe para convidar amigos</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!serverName.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                  {isSaved && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                      <Check className="w-4 h-4" />
                      <span>Alterações salvas!</span>
                    </span>
                  )}
                </div>
              </form>
            )}

            {/* TAB 2: CARGOS */}
            {activeTab === 'roles' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cargos do Servidor</h4>
                    <p className="text-xs text-slate-400">
                      Crie cargos para organizar membros e definir quem pode administrar.
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setIsCreatingRole(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo Cargo</span>
                    </button>
                  )}
                </div>

                {/* Form to create role */}
                {isCreatingRole && (
                  <form onSubmit={handleCreateRoleSubmit} className="p-4 bg-[#1a1b28] border border-indigo-500/40 rounded-2xl space-y-3">
                    <div className="font-bold text-xs text-white uppercase">Criar Novo Cargo</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Cargo</label>
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="ex: Campeão, DJ, VIP"
                          className="w-full mt-1 bg-[#151622] border border-[#2a2d40] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition select-text"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400">Cor do Cargo</label>
                        <div className="flex items-center gap-2 mt-2">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewRoleColor(c)}
                              className={`w-5 h-5 rounded-full transition cursor-pointer ${
                                newRoleColor === c ? 'ring-2 ring-white scale-110' : ''
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRoleIsAdmin}
                        onChange={(e) => setNewRoleIsAdmin(e.target.checked)}
                        className="accent-indigo-600 rounded"
                      />
                      <span>Conceder Permissão de Administrador (Kick, Timeout, Gerenciar)</span>
                    </label>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingRole(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!newRoleName.trim()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow"
                      >
                        Salvar Cargo
                      </button>
                    </div>
                  </form>
                )}

                {/* Roles List */}
                <div className="space-y-2">
                  {serverRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-3 bg-[#181926] border border-[#242639] rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{role.name}</span>
                            {role.isAdmin && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            ID: {role.id}
                          </div>
                        </div>
                      </div>

                      {isAdmin && role.id !== 'role-admin' && (
                        <button
                          onClick={() => onDeleteRole(role.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#202230] transition cursor-pointer"
                          title="Excluir Cargo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: MEMBROS */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Membros ({server.members.length})</h4>
                    <p className="text-xs text-slate-400">
                      Atribua cargos, silencie com timeout ou remova membros deste servidor.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Buscar membro..."
                    className="bg-[#181926] border border-[#27293d] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition select-text"
                  />
                </div>

                <div className="space-y-2">
                  {serverMembers.map((member) => {
                    const isMemberOwner = member.id === server.ownerId;
                    const assignedRoleIds = server.memberRoles?.[member.id] || [];
                    const timeoutExp = server.timeouts?.[member.id];
                    const isTimedOut = timeoutExp && timeoutExp > Date.now();
                    const remainingMin = isTimedOut ? Math.ceil((timeoutExp - Date.now()) / 60000) : 0;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-[#181926] border border-[#242639] rounded-2xl"
                      >
                        {/* Member Identity */}
                        <div className="flex items-center gap-3 min-w-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ backgroundColor: member.avatarColor }}
                            >
                              {member.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">{member.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">#{member.tag}</span>
                              {isMemberOwner && (
                                <span title="Dono do Servidor">
                                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                </span>
                              )}
                              {isTimedOut && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{remainingMin}m</span>
                                </span>
                              )}
                            </div>

                            {/* Assigned roles badges */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {serverRoles
                                .filter((r) => assignedRoleIds.includes(r.id))
                                .map((r) => (
                                  <span
                                    key={r.id}
                                    className="px-2 py-0.2 rounded text-[10px] font-semibold"
                                    style={{
                                      backgroundColor: `${r.color}20`,
                                      color: r.color,
                                    }}
                                  >
                                    {r.name}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Actions (Timeout, Assign Role, Kick) */}
                        {isAdmin && !isMemberOwner && member.id !== currentUser?.id && (
                          <div className="flex items-center gap-2">
                            {/* Role selector dropdown */}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  onAssignRole(member.id, e.target.value);
                                }
                              }}
                              className="bg-[#202233] border border-[#2a2d42] text-slate-200 text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                            >
                              <option value="">+ Cargo</option>
                              {serverRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {assignedRoleIds.includes(r.id) ? `✓ ${r.name}` : `+ ${r.name}`}
                                </option>
                              ))}
                            </select>

                            {/* Timeout Button */}
                            <button
                              onClick={() => {
                                if (isTimedOut) {
                                  onTimeoutMember(member.id, 0); // remover timeout
                                } else {
                                  setTimeoutMemberTarget({ id: member.id, name: member.name });
                                  setCustomTimeoutMinutes('15');
                                }
                              }}
                              className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                                isTimedOut
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-[#202233] text-slate-300 hover:text-white border-[#2a2d42]'
                              }`}
                              title={isTimedOut ? 'Remover silenciamento' : 'Silenciar temporariamente (Timeout)'}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>

                            {/* Kick Member */}
                            <button
                              onClick={() => setConfirmKickMember({ id: member.id, name: member.name })}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                              title="Expulsar do Servidor"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Customizado: Confirmar Exclusão do Servidor */}
        {confirmDeleteServer && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setConfirmDeleteServer(false)}
          >
            <div
              className="w-full max-w-sm bg-[#141520] border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Excluir Servidor?</h4>
                  <p className="text-[11px] text-rose-300 font-semibold">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Tem certeza que deseja excluir permanentemente o servidor <span className="font-bold text-white">"{server.name}"</span> e todos os seus canais?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteServer(false)}
                  className="px-4 py-2 rounded-xl bg-[#202233] hover:bg-[#282b40] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteServer(false);
                    onDeleteServer();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Customizado: Confirmar Expulsão de Membro */}
        {confirmKickMember && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setConfirmKickMember(null)}
          >
            <div
              className="w-full max-w-sm bg-[#141520] border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Expulsar {confirmKickMember.name}?</h4>
                  <p className="text-[11px] text-slate-400">Remover membro do servidor</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Tem certeza que deseja expulsar <span className="font-bold text-rose-300">{confirmKickMember.name}</span> do servidor <span className="font-bold text-white">{server.name}</span>?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmKickMember(null)}
                  className="px-4 py-2 rounded-xl bg-[#202233] hover:bg-[#282b40] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onKickMember(confirmKickMember.id);
                    setConfirmKickMember(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer"
                >
                  Sim, Expulsar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Customizado: Escolher Tempo de Timeout */}
        {timeoutMemberTarget && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setTimeoutMemberTarget(null)}
          >
            <div
              className="w-full max-w-sm bg-[#141520] border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Silenciar {timeoutMemberTarget.name}</h4>
                  <p className="text-[11px] text-slate-400">Escolha por quanto tempo aplicar o Timeout</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '5 minutos', mins: 5 },
                  { label: '15 minutos', mins: 15 },
                  { label: '1 hora', mins: 60 },
                  { label: '24 horas', mins: 1440 },
                ].map((opt) => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => {
                      onTimeoutMember(timeoutMemberTarget.id, opt.mins);
                      setTimeoutMemberTarget(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-[#1d1f30] hover:bg-amber-500 hover:text-black text-slate-200 text-xs font-bold border border-[#2a2d42] transition cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-[#222436] space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Ou defina os minutos personalizados:
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10080"
                    value={customTimeoutMinutes}
                    onChange={(e) => setCustomTimeoutMinutes(e.target.value)}
                    className="flex-1 bg-[#181926] border border-[#27293d] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500 select-text"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const mins = Number(customTimeoutMinutes);
                      if (mins > 0) {
                        onTimeoutMember(timeoutMemberTarget.id, mins);
                        setTimeoutMemberTarget(null);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setTimeoutMemberTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#202233] hover:bg-[#282b40] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};