import fs from 'fs';
import path from 'path';

export interface DBUser {
  id: string;
  name: string; // ex: fulaninho
  tag: string;  // ex: 001 ou 4 dígitos
  password: string;
  avatarColor: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface DBChannel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
}

export interface DBServer {
  id: string;
  name: string;
  iconColor: string;
  ownerId: string;
  inviteCode: string;
  members: string[];
  channels: DBChannel[];
}

export interface DBFriendship {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface DBAttachment {
  name: string;
  type: 'image' | 'file';
  url: string;
  size?: number;
}

export interface DBMessage {
  id: string;
  serverId: string;
  channelId: string;
  userId: string;
  userName: string;
  avatarColor: string;
  avatarUrl?: string;
  text: string;
  attachment?: DBAttachment;
  timestamp: string;
}

export interface DBServerInvite {
  serverId: string;
  serverName: string;
  iconColor: string;
  inviteCode: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface DBDMMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  attachment?: DBAttachment;
  serverInvite?: DBServerInvite;
  timestamp: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: DBUser[];
  servers: DBServer[];
  friendships: DBFriendship[];
  messages: DBMessage[];
  dmMessages: DBDMMessage[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'janjacord.db.json');

const INITIAL_DB: DatabaseSchema = {
  users: [],
  servers: [],
  friendships: [],
  messages: [],
  dmMessages: [],
};

function ensureDataDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
  }
}

export function loadDB(): DatabaseSchema {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.dmMessages) parsed.dmMessages = [];
    return parsed as DatabaseSchema;
  } catch (err) {
    console.error('[DB] Erro ao carregar banco de dados:', err);
    return INITIAL_DB;
  }
}

export function saveDB(data: DatabaseSchema): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Erro ao salvar banco de dados:', err);
  }
}
