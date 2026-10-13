import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { RaceState } from './server.js';

export type ServerRole = 'spectator' | 'team' | 'marshal' | 'admin';

type StoredRace = {
  state: RaceState;
  updatedAt: number;
  events: Array<{
    action: string;
    role: string;
    reason: string | null;
    clientActionId: string | null;
    timestamp: number;
    stateVersion: number;
  }>;
  snapshots: Record<string, { state: RaceState; createdAt: number }>;
  teamJoinCodeHashes: Record<string, string>;
};

/**
 * Fast local persistence for the race server.
 *
 * Writes are serialized per room and performed asynchronously so timer ticks and
 * WebSocket broadcasts never wait on disk. The JSON format deliberately mirrors
 * the old document/events/snapshots shape, keeping the race-control behavior
 * stable without requiring Firebase or any external database account.
 */
export class LocalRaceStore {
  private pending = new Map<string, Promise<void>>();
  private root = path.resolve(process.env.RACE_DATA_DIR || path.join(process.cwd(), 'data', 'races'));
  private available = false;

  async initialize() {
    await fs.mkdir(this.root, { recursive: true });
    this.available = true;
    console.log(`Local race persistence ready at ${this.root}`);
  }

  get enabled() {
    return this.available;
  }

  private filePath(roomId: string) {
    const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.root, `${safeRoomId}.json`);
  }

  private async read(roomId: string): Promise<StoredRace | null> {
    if (!this.available) return null;
    try {
      const raw = await fs.readFile(this.filePath(roomId), 'utf8');
      return JSON.parse(raw) as StoredRace;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      console.error(`Local race state read failed for ${roomId}:`, error);
      return null;
    }
  }

  private async write(roomId: string, document: StoredRace) {
    const target = this.filePath(roomId);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(document), 'utf8');
    await fs.rename(temporary, target);
  }

  async loadRace(roomId: string): Promise<RaceState | null> {
    return (await this.read(roomId))?.state || null;
  }

  async saveRace(roomId: string, state: RaceState, action = 'state:update', role = 'system', reason?: string, clientActionId?: string) {
    if (!this.available) return;
    const previous = this.pending.get(roomId) || Promise.resolve();
    const next = previous.then(async () => {
      const existing = await this.read(roomId);
      const document: StoredRace = existing || {
        state,
        updatedAt: Date.now(),
        events: [],
        snapshots: {},
        teamJoinCodeHashes: {},
      };
      document.state = state;
      document.updatedAt = Date.now();
      document.events.push({
        action,
        role,
        reason: reason || null,
        clientActionId: clientActionId || null,
        timestamp: Date.now(),
        stateVersion: Date.now(),
      });
      await this.write(roomId, document);
    }).catch((error) => console.error('Local race persistence failed:', error));
    this.pending.set(roomId, next);
    await next;
  }

  async writeSnapshot(roomId: string, state: RaceState, label: string) {
    if (!this.available) return;
    const previous = this.pending.get(roomId) || Promise.resolve();
    const next = previous.then(async () => {
      const existing = await this.read(roomId);
      const document: StoredRace = existing || {
        state,
        updatedAt: Date.now(),
        events: [],
        snapshots: {},
        teamJoinCodeHashes: {},
      };
      document.state = state;
      document.updatedAt = Date.now();
      document.snapshots[label] = { state, createdAt: Date.now() };
      await this.write(roomId, document);
    }).catch((error) => console.error('Local race snapshot failed:', error));
    this.pending.set(roomId, next);
    await next;
  }

  async hasAction(roomId: string, clientActionId: string) {
    const document = await this.read(roomId);
    return Boolean(document?.events.some((event) => event.clientActionId === clientActionId));
  }

  async saveTeamJoinCodeHash(roomId: string, teamId: string, hash: string) {
    if (!this.available) return;
    const previous = this.pending.get(roomId) || Promise.resolve();
    const next = previous.then(async () => {
      const existing = await this.read(roomId);
      const document: StoredRace = existing || {
        state: {} as RaceState,
        updatedAt: Date.now(),
        events: [],
        snapshots: {},
        teamJoinCodeHashes: {},
      };
      document.teamJoinCodeHashes[teamId] = hash;
      document.updatedAt = Date.now();
      await this.write(roomId, document);
    }).catch((error) => console.error('Local team-code persistence failed:', error));
    this.pending.set(roomId, next);
    await next;
  }

  async loadTeamJoinCodeHashes(roomId: string) {
    return (await this.read(roomId))?.teamJoinCodeHashes || {};
  }
}

function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

export function verifyHashedPin(pin: string, encoded: string | undefined): boolean {
  if (!encoded) return false;
  const [salt, expected] = encoded.split('$');
  if (!salt || !expected) return false;
  const actual = hashPin(pin, salt);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function createPinHash(pin: string, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}$${hashPin(pin, salt)}`;
}

export function createTeamJoinCode() {
  return String(crypto.randomInt(100000, 1000000));
}

const attempts = new Map<string, { count: number; resetAt: number }>();
export function allowAuthAttempt(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

function tokenSignature(payload: string) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'development-only-change-me').update(payload).digest('base64url');
}

export function createSessionToken(role: ServerRole, teamId = '') {
  const payload = Buffer.from(JSON.stringify({ role, teamId, exp: Date.now() + 12 * 60 * 60_000, nonce: crypto.randomUUID() })).toString('base64url');
  return `${payload}.${tokenSignature(payload)}`;
}

export function verifySessionToken(token: string | undefined): { role: ServerRole; teamId: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  const expectedSignature = payload ? tokenSignature(payload) : '';
  if (!payload || !signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role: ServerRole; teamId: string; exp: number };
    if (parsed.exp < Date.now()) return null;
    if (!['spectator', 'team', 'marshal', 'admin'].includes(parsed.role)) return null;
    return { role: parsed.role, teamId: parsed.teamId || '' };
  } catch {
    return null;
  }
}

export function roleForStation(station: string): ServerRole {
  if (station === 'control' || station === 'director') return 'admin';
  if (station === 'timer' || station === 'camera') return 'marshal';
  return 'team';
}

export function pinHashForRole(role: ServerRole): string | undefined {
  if (role === 'admin') return process.env.ADMIN_PIN_HASH;
  if (role === 'marshal') return process.env.MARSHAL_PIN_HASH;
  if (role === 'team') return process.env.TEAM_PIN_HASH;
  return undefined;
}
