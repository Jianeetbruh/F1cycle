import React, { useState } from 'react';
import {
  Clock,
  Trophy,
  Filter,
  Flame,
  Search,
  Download,
  Check,
  Zap,
  ChevronDown
} from 'lucide-react';
import { CompletedLapRecord } from '../services/radioEngine';

interface LapHistoryTableProps {
  lapHistory: CompletedLapRecord[];
  fastestLapHolder?: { driverName: string; team: string; time: number } | null;
}

export const LapHistoryTable: React.FC<LapHistoryTableProps> = ({
  lapHistory,
  fastestLapHolder,
}) => {
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);

  // Compute sector records across laps (Overall fastest = Purple, Personal best = Green, Slower = Yellow)
  const sessionBests = React.useMemo(() => {
    const overall = { s1: null as number | null, s2: null as number | null, s3: null as number | null };
    const driverBests: Record<string, { s1: number | null; s2: number | null; s3: number | null }> = {};

    lapHistory.forEach(l => {
      if (!driverBests[l.driverId]) {
        driverBests[l.driverId] = { s1: null, s2: null, s3: null };
      }
      const dBest = driverBests[l.driverId];

      if (l.s1 && l.s1 > 0) {
        if (overall.s1 === null || l.s1 < overall.s1) overall.s1 = l.s1;
        if (dBest.s1 === null || l.s1 < dBest.s1) dBest.s1 = l.s1;
      }
      if (l.s2 && l.s2 > 0) {
        if (overall.s2 === null || l.s2 < overall.s2) overall.s2 = l.s2;
        if (dBest.s2 === null || l.s2 < dBest.s2) dBest.s2 = l.s2;
      }
      if (l.s3 && l.s3 > 0) {
        if (overall.s3 === null || l.s3 < overall.s3) overall.s3 = l.s3;
        if (dBest.s3 === null || l.s3 < dBest.s3) dBest.s3 = l.s3;
      }
    });

    return { overall, driverBests };
  }, [lapHistory]);

  const renderSectorPill = (sectorNum: 1 | 2 | 3, val?: number | null, driverId?: string) => {
    if (!val || val <= 0) return <span className="text-zinc-600 font-mono text-[10px]">--</span>;
    const key = `s${sectorNum}` as 's1' | 's2' | 's3';
    const overallVal = sessionBests.overall[key];
    const drvVal = driverId && sessionBests.driverBests[driverId] ? sessionBests.driverBests[driverId][key] : null;

    let colorClass = 'bg-amber-950/70 text-amber-300 border-amber-600/60'; // yellow (slower)

    if (overallVal !== null && val <= overallVal) {
      colorClass = 'bg-purple-950 text-purple-300 border-purple-500 font-bold shadow-sm shadow-purple-900/60'; // purple (fastest among others)
    } else if (drvVal !== null && val <= drvVal) {
      colorClass = 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'; // green (his fastest)
    }

    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${colorClass}`}>
        {val.toFixed(2)}s
      </span>
    );
  };

  // Filter laps
  const filteredLaps = selectedDriverFilter === 'ALL'
    ? lapHistory
    : lapHistory.filter(l => l.driverId === selectedDriverFilter);

  // Extract unique drivers for filter dropdown
  const driversMap = new Map<string, { id: string; name: string; number: number; color: string }>();
  lapHistory.forEach(l => {
    if (!driversMap.has(l.driverId)) {
      driversMap.set(l.driverId, {
        id: l.driverId,
        name: l.driverName,
        number: l.driverNumber,
        color: l.teamColor,
      });
    }
  });
  const uniqueDrivers = Array.from(driversMap.values());

  // Copy lap times summary to clipboard for WhatsApp/Discord
  const handleCopySummary = () => {
    if (lapHistory.length === 0) return;
    const text = lapHistory.slice(0, 20).map(l =>
      `Lap ${l.lapNumber} | #${l.driverNumber} ${l.driverName}: ${l.lapTimeSec.toFixed(3)}s ${l.isFastestLap ? '🟣 (FASTEST)' : ''}`
    ).join('\n');

    navigator.clipboard.writeText(`🏁 SOCIETY GP - LAP TIMES LOG:\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800/80 flex items-center justify-center text-purple-300 shadow-md">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-bold">
                OFFICIAL TIMEKEEPING LOG
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-zinc-400">
                {lapHistory.length} {lapHistory.length === 1 ? 'LAP RECORDED' : 'LAPS RECORDED'}
              </span>
            </div>
            <h3 className="font-racing font-bold text-xl text-white">
              Lap History & Sector Split Log
            </h3>
          </div>
        </div>

        {/* Fastest Lap Banner & Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {fastestLapHolder && (
            <div className="bg-purple-950/70 border border-purple-600/70 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono text-purple-200">
              <Trophy className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>
                FASTEST: <strong>{fastestLapHolder.time.toFixed(3)}s</strong> ({fastestLapHolder.driverName.split(' ')[0]})
              </span>
            </div>
          )}

          {/* Filter by Driver */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedDriverFilter}
              onChange={(e) => setSelectedDriverFilter(e.target.value)}
              className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Drivers ({lapHistory.length})</option>
              {uniqueDrivers.map(d => (
                <option key={d.id} value={d.id}>
                  #{d.number} {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Copy Summary Button */}
          <button
            onClick={handleCopySummary}
            disabled={lapHistory.length === 0}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono px-3 py-1.5 rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all disabled:opacity-40"
            title="Copy Lap Summary to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>{copied ? 'COPIED!' : 'COPY LOG'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
        <div className="max-h-[360px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
          <table className="w-full text-left text-xs font-mono border-collapse min-w-[620px]">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400 uppercase tracking-wider font-semibold z-10">
              <tr>
                <th className="py-2.5 px-3 w-16">LAP</th>
                <th className="py-2.5 px-3">DRIVER / TEAM</th>
                <th className="py-2.5 px-3">LAP TIME</th>
                <th className="py-2.5 px-3">SECTORS (S1 / S2 / S3)</th>
                <th className="py-2.5 px-3">TIME LOGGED</th>
                <th className="py-2.5 px-3 text-right">STATUS</th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-zinc-800/60">
              {filteredLaps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
                    <div>No laps completed yet for this session.</div>
                    <div className="text-[11px] text-zinc-600 mt-1">
                      Laps automatically appear here the moment the Race Director or Timekeeper clicks the finish line button.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLaps.map((lap) => {
                  const isPurple = lap.isFastestLap;
                  const isGreen = !lap.isFastestLap && lap.isPersonalBest;

                  return (
                    <tr
                      key={lap.id}
                      className={`hover:bg-zinc-900/70 transition-colors ${
                        isPurple ? 'bg-purple-950/20' : ''
                      }`}
                    >
                      {/* Lap Number */}
                      <td className="py-2.5 px-3 font-bold text-white">
                        <span className="bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/60 text-zinc-200">
                          L{lap.lapNumber}
                        </span>
                      </td>

                      {/* Driver */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] text-black shrink-0"
                            style={{ backgroundColor: lap.teamColor || '#E80020' }}
                          >
                            #{lap.driverNumber}
                          </div>
                          <div>
                            <span className="font-racing font-bold text-sm text-white block leading-tight">
                              {lap.driverName}
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate max-w-[140px]">
                              {lap.team}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Lap Time */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-mono-racing font-bold text-base ${
                            isPurple
                              ? 'text-purple-400 font-black'
                              : isGreen
                              ? 'text-emerald-400'
                              : 'text-zinc-200'
                          }`}
                        >
                          {lap.lapTimeSec.toFixed(3)}s
                        </span>
                      </td>

                      {/* Sectors */}
                      <td className="py-2.5 px-3 text-[11px]">
                        <div className="flex items-center gap-1">
                          {renderSectorPill(1, lap.s1, lap.driverId)}
                          {renderSectorPill(2, lap.s2, lap.driverId)}
                          {renderSectorPill(3, lap.s3, lap.driverId)}
                        </div>
                      </td>

                      {/* Time Logged */}
                      <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                        {lap.timestamp}
                      </td>

                      {/* Status Badges */}
                      <td className="py-2.5 px-3 text-right">
                        {isPurple ? (
                          <span className="inline-flex items-center gap-1 bg-purple-950 border border-purple-600 text-purple-300 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm shadow-purple-950/50">
                            <Trophy className="w-3 h-3 text-purple-400" />
                            FASTEST
                          </span>
                        ) : isGreen ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            PERSONAL BEST
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[10px]">
                            VALID
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
