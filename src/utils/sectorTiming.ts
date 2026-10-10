// Sector timing logic & color classification based on authentic F1 rules:
// - PURPLE: Fastest sector among all drivers in the session
// - GREEN: Personal best sector for this driver
// - YELLOW: Slower than personal best

import { RaceState } from '../services/radioEngine';

export type SectorColorStatus = 'PURPLE' | 'GREEN' | 'YELLOW';

export interface SessionSectorBests {
  overallFastest: { s1: number | null; s2: number | null; s3: number | null };
  driverPersonalBests: Record<string, { s1: number | null; s2: number | null; s3: number | null }>;
}

export function computeSessionSectorBests(raceState: RaceState | null): SessionSectorBests {
  const result: SessionSectorBests = {
    overallFastest: { s1: null, s2: null, s3: null },
    driverPersonalBests: {},
  };

  if (!raceState) return result;

  // 1. From lapHistory
  if (raceState.lapHistory && raceState.lapHistory.length > 0) {
    for (const lap of raceState.lapHistory) {
      if (!result.driverPersonalBests[lap.driverId]) {
        result.driverPersonalBests[lap.driverId] = { s1: null, s2: null, s3: null };
      }
      const drvBests = result.driverPersonalBests[lap.driverId];

      if (lap.s1 && lap.s1 > 0) {
        if (result.overallFastest.s1 === null || lap.s1 < result.overallFastest.s1) {
          result.overallFastest.s1 = lap.s1;
        }
        if (drvBests.s1 === null || lap.s1 < drvBests.s1) {
          drvBests.s1 = lap.s1;
        }
      }

      if (lap.s2 && lap.s2 > 0) {
        if (result.overallFastest.s2 === null || lap.s2 < result.overallFastest.s2) {
          result.overallFastest.s2 = lap.s2;
        }
        if (drvBests.s2 === null || lap.s2 < drvBests.s2) {
          drvBests.s2 = lap.s2;
        }
      }

      if (lap.s3 && lap.s3 > 0) {
        if (result.overallFastest.s3 === null || lap.s3 < result.overallFastest.s3) {
          result.overallFastest.s3 = lap.s3;
        }
        if (drvBests.s3 === null || lap.s3 < drvBests.s3) {
          drvBests.s3 = lap.s3;
        }
      }
    }
  }

  // 2. Also incorporate current driver state s1, s2, s3
  if (raceState.drivers) {
    for (const d of raceState.drivers) {
      if (!result.driverPersonalBests[d.id]) {
        result.driverPersonalBests[d.id] = { s1: null, s2: null, s3: null };
      }
      const drvBests = result.driverPersonalBests[d.id];

      if (d.s1 && d.s1 > 0) {
        if (result.overallFastest.s1 === null || d.s1 < result.overallFastest.s1) {
          result.overallFastest.s1 = d.s1;
        }
        if (drvBests.s1 === null || d.s1 < drvBests.s1) {
          drvBests.s1 = d.s1;
        }
      }

      if (d.s2 && d.s2 > 0) {
        if (result.overallFastest.s2 === null || d.s2 < result.overallFastest.s2) {
          result.overallFastest.s2 = d.s2;
        }
        if (drvBests.s2 === null || d.s2 < drvBests.s2) {
          drvBests.s2 = d.s2;
        }
      }

      if (d.s3 && d.s3 > 0) {
        if (result.overallFastest.s3 === null || d.s3 < result.overallFastest.s3) {
          result.overallFastest.s3 = d.s3;
        }
        if (drvBests.s3 === null || d.s3 < drvBests.s3) {
          drvBests.s3 = d.s3;
        }
      }
    }
  }

  return result;
}

export function getSectorColorStatus(
  sectorNum: 1 | 2 | 3,
  value: number | null | undefined,
  driverId: string | undefined,
  bests: SessionSectorBests
): SectorColorStatus {
  if (value === null || value === undefined || value <= 0) {
    return 'YELLOW';
  }

  const sKey = `s${sectorNum}` as 's1' | 's2' | 's3';
  const overall = bests.overallFastest[sKey];

  // Fastest among all competitors on track -> PURPLE
  if (overall !== null && Math.abs(value - overall) < 0.001) {
    return 'PURPLE';
  }
  if (overall !== null && value <= overall) {
    return 'PURPLE';
  }

  // Personal best for this driver -> GREEN
  if (driverId && bests.driverPersonalBests[driverId]) {
    const drvBest = bests.driverPersonalBests[driverId][sKey];
    if (drvBest !== null && Math.abs(value - drvBest) < 0.001) {
      return 'GREEN';
    }
    if (drvBest !== null && value <= drvBest) {
      return 'GREEN';
    }
  }

  // Slower -> YELLOW
  return 'YELLOW';
}

export function getSectorBadgeStyles(status: SectorColorStatus): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (status) {
    case 'PURPLE':
      return {
        bg: 'bg-purple-950/80',
        text: 'text-purple-300 font-black',
        border: 'border-purple-600',
        badge: 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm shadow-purple-900/50',
      };
    case 'GREEN':
      return {
        bg: 'bg-emerald-950/80',
        text: 'text-emerald-400 font-bold',
        border: 'border-emerald-500',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm shadow-emerald-900/50',
      };
    case 'YELLOW':
    default:
      return {
        bg: 'bg-amber-950/70',
        text: 'text-amber-300 font-medium',
        border: 'border-amber-600/70',
        badge: 'bg-amber-950/70 text-amber-300 border-amber-600/70 shadow-sm shadow-amber-900/40',
      };
  }
}
