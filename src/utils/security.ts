// Client access helper. PINs and hashes are server-only and are never bundled here.
export interface StationAccessConfig { id: string; name: string; role: string; description: string; }
export interface TeamAccessConfig { id: string; name: string; number: number; color: string; }

export const STATION_PASSCODES: Record<string, StationAccessConfig> = {
  control: { id: 'control', name: 'FIA Race Control', role: 'Race Director & Stewards', description: 'Master race authority: flags, penalties, session control, grid setup.' },
  director: { id: 'director', name: 'Video Director Desk', role: 'Broadcast Director & Angle Switcher', description: 'Switch live camera feeds and broadcast graphics.' },
  timer: { id: 'timer', name: 'Official Lap Timekeeper', role: 'Precision Timing Marshal', description: 'Stopwatch, sector split stamping, and flying-lap timing.' },
  camera: { id: 'camera', name: 'Trackside Camera Station', role: 'Track Marshal & Camera Operator', description: 'Broadcast phone camera to the director and TV feed.' },
};

export const TEAM_PASSCODES: Record<string, TeamAccessConfig> = {
  'team-redbull': { id: 'team-redbull', name: 'Oracle Red Bull Racing', number: 1, color: '#3671C6' },
  'team-ferrari': { id: 'team-ferrari', name: 'Scuderia Ferrari', number: 16, color: '#E80020' },
  'team-mclaren': { id: 'team-mclaren', name: 'McLaren F1 Team', number: 4, color: '#FF8000' },
  'team-mercedes': { id: 'team-mercedes', name: 'Mercedes-AMG F1', number: 44, color: '#27F4D2' },
  'team-aston': { id: 'team-aston', name: 'Aston Martin F1', number: 14, color: '#229971' },
};

function authBaseUrl() {
  const configured = new URLSearchParams(window.location.search).get('server') || (import.meta.env.VITE_SIGNAL_SERVER_URL as string | undefined);
  return configured ? new URL(configured, window.location.origin).origin : window.location.origin;
}
function tokenKey(type: 'station' | 'team', id: string) { return `f1cycle_session_${type}_${id}`; }
function serverRoleForStation(stationId: string) { return stationId === 'control' || stationId === 'director' ? 'admin' : 'marshal'; }

class SecurityEngine {
  isStationUnlocked(stationId: string) { try { return Boolean(sessionStorage.getItem(tokenKey('station', stationId))); } catch { return false; } }
  isTeamUnlocked(teamId: string) { try { return Boolean(sessionStorage.getItem(tokenKey('team', teamId))); } catch { return false; } }
  getStationToken(stationId: string) { try { return sessionStorage.getItem(tokenKey('station', stationId)); } catch { return null; } }
  getTeamToken(teamId: string) { try { return sessionStorage.getItem(tokenKey('team', teamId)); } catch { return null; } }
  async unlockStation(stationId: string, passcode: string) { return this.login(serverRoleForStation(stationId), passcode, '', tokenKey('station', stationId)); }
  async unlockTeam(teamId: string, passcode: string) { return this.login('team', passcode, teamId, tokenKey('team', teamId)); }
  private async login(role: 'admin' | 'marshal' | 'team', pin: string, teamId: string, storageKey: string) {
    try {
      const response = await fetch(`${authBaseUrl()}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, pin, teamId, roomId: 'societygp' }) });
      if (!response.ok) return false;
      const data = await response.json() as { token?: string };
      if (!data.token) return false;
      sessionStorage.setItem(storageKey, data.token);
      return true;
    } catch { return false; }
  }
  lockStation(stationId: string) { try { sessionStorage.removeItem(tokenKey('station', stationId)); } catch {} }
  lockTeam(teamId: string) { try { sessionStorage.removeItem(tokenKey('team', teamId)); } catch {} }
  lockAll() { try { sessionStorage.clear(); } catch {} }
}
export const securityEngine = new SecurityEngine();

export async function getSpectatorToken() {
  const key = 'f1cycle_session_spectator';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const response = await fetch(`${authBaseUrl()}/api/auth/spectator`, { method: 'POST' });
    if (!response.ok) return null;
    const data = await response.json() as { token?: string };
    if (data.token) sessionStorage.setItem(key, data.token);
    return data.token || null;
  } catch { return null; }
}
