// Security & Passcode Engine for f1Cycle Paddock Access Control

export interface StationAccessConfig {
  id: string;
  name: string;
  role: string;
  defaultPasscode: string;
  description: string;
}

export interface TeamAccessConfig {
  id: string;
  name: string;
  number: number;
  color: string;
  defaultPasscode: string;
}

// Master passcodes for each official station
export const STATION_PASSCODES: Record<string, StationAccessConfig> = {
  control: {
    id: 'control',
    name: 'FIA Race Control',
    role: 'Race Director & Stewards',
    defaultPasscode: '9999',
    description: 'Master race authority: flags, penalties, session control, grid setup.',
  },
  director: {
    id: 'director',
    name: 'Video Director Desk',
    role: 'Broadcast Director & Angle Switcher',
    defaultPasscode: '8888',
    description: 'Switch live camera feeds, lower-third graphics, team radio on air.',
  },
  timer: {
    id: 'timer',
    name: 'Official Lap Timekeeper',
    role: 'Precision Timing Marshal',
    defaultPasscode: '7777',
    description: 'Stopwatch, sector split stamping, flying lap sector triggers.',
  },
  camera: {
    id: 'camera',
    name: 'Trackside Camera Station',
    role: 'Track Marshal & Camera Operator',
    defaultPasscode: '5555',
    description: 'Broadcast phone camera live video to clubhouse TV and director.',
  },
};

// Team isolation passcodes (prevent opposing teams from glitching or eavesdropping)
export const TEAM_PASSCODES: Record<string, TeamAccessConfig> = {
  'team-redbull': {
    id: 'team-redbull',
    name: 'Oracle Red Bull Racing',
    number: 1,
    color: '#3671C6',
    defaultPasscode: '1111',
  },
  'team-ferrari': {
    id: 'team-ferrari',
    name: 'Scuderia Ferrari',
    number: 16,
    color: '#E80020',
    defaultPasscode: '2222',
  },
  'team-mclaren': {
    id: 'team-mclaren',
    name: 'McLaren F1 Team',
    number: 4,
    color: '#FF8000',
    defaultPasscode: '3333',
  },
  'team-mercedes': {
    id: 'team-mercedes',
    name: 'Mercedes-AMG F1',
    number: 44,
    color: '#27F4D2',
    defaultPasscode: '4444',
  },
  'team-aston': {
    id: 'team-aston',
    name: 'Aston Martin F1',
    number: 14,
    color: '#229971',
    defaultPasscode: '5555',
  },
};

// Universal emergency bypass for event organizers
const MASTER_ORGANIZER_BYPASS = '0000';

class SecurityEngine {
  constructor() {
    // Purge any legacy permanent localStorage auth tokens so passcodes are strictly prompted
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('f1cycle_auth_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch {}
  }

  private getStorageKey(type: 'station' | 'team', id: string): string {
    return `f1cycle_auth_${type}_${id}`;
  }

  isStationUnlocked(stationId: string): boolean {
    try {
      const s = sessionStorage.getItem(this.getStorageKey('station', stationId));
      return s === 'unlocked';
    } catch {
      return false;
    }
  }

  unlockStation(stationId: string, passcode: string): boolean {
    const cleanPass = passcode.trim();
    const config = STATION_PASSCODES[stationId];
    if (!config) return false;

    if (cleanPass === config.defaultPasscode || cleanPass === MASTER_ORGANIZER_BYPASS) {
      try {
        sessionStorage.setItem(this.getStorageKey('station', stationId), 'unlocked');
      } catch {}
      return true;
    }
    return false;
  }

  lockStation(stationId: string): void {
    try {
      sessionStorage.removeItem(this.getStorageKey('station', stationId));
    } catch {}
  }

  isTeamUnlocked(teamId: string): boolean {
    try {
      const s = sessionStorage.getItem(this.getStorageKey('team', teamId));
      return s === 'unlocked';
    } catch {
      return false;
    }
  }

  unlockTeam(teamId: string, passcode: string): boolean {
    const cleanPass = passcode.trim();
    if (cleanPass === MASTER_ORGANIZER_BYPASS) {
      try {
        sessionStorage.setItem(this.getStorageKey('team', teamId), 'unlocked');
      } catch {}
      return true;
    }
    const config = TEAM_PASSCODES[teamId];
    if (!config) return false;

    if (cleanPass === config.defaultPasscode) {
      try {
        sessionStorage.setItem(this.getStorageKey('team', teamId), 'unlocked');
      } catch {}
      return true;
    }
    return false;
  }

  lockTeam(teamId: string): void {
    try {
      sessionStorage.removeItem(this.getStorageKey('team', teamId));
    } catch {}
  }

  lockAll(): void {
    try {
      sessionStorage.clear();
    } catch {}
  }
}

export const securityEngine = new SecurityEngine();
