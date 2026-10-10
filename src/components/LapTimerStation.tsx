import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Trophy,
  CheckCircle2,
  ChevronRight,
  Zap,
  Flame,
  Award,
  Lock,
  Radio,
  Check
} from 'lucide-react';
import { radioEngine, RaceState, DriverState, FlyingLapRequest } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';
import { securityEngine } from '../utils/security';
import { computeSessionSectorBests, getSectorColorStatus, getSectorBadgeStyles } from '../utils/sectorTiming';
import { PasscodeLockModal } from './PasscodeLockModal';
import { LapHistoryTable } from './LapHistoryTable';

export const LapTimerStation: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isStationUnlocked('timer'));
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('team-redbull');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stage, setStage] = useState<'IDLE' | 'FLYING' | 'S1_DONE' | 'S2_DONE' | 'FINISHED'>('IDLE');

  // Incoming flying lap alerts from teams
  const [incomingRequest, setIncomingRequest] = useState<FlyingLapRequest | null>(null);

  const [s1Time, setS1Time] = useState<number | null>(null);
  const [s2Time, setS2Time] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const startTimestampRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isUnlocked) return;

    radioEngine.connect('societygp', 'timer', '', 'Official Timekeeper');
    const unsub = radioEngine.onRaceState((state) => {
      setRaceState(state);
      if (state.liveTimer && state.liveTimer.driverId) {
        setSelectedDriverId(state.liveTimer.driverId);
      }
    });

    const unsubReq = radioEngine.onFlyingLapRequest((req) => {
      soundEffects.playRadioChirp();
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      setIncomingRequest(req);
    });

    return () => {
      unsub();
      unsubReq();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isUnlocked]);

  const handleAcceptFlyingLap = (req: FlyingLapRequest) => {
    setSelectedDriverId(req.driverId);
    radioEngine.setTimerDriver(req.driverId);
    soundEffects.playRadioChirp();
    setIncomingRequest(null);
  };

  const handleSelectDriver = (drvId: string) => {
    setSelectedDriverId(drvId);
    radioEngine.setTimerDriver(drvId);
    soundEffects.playRadioChirp();
  };

  const handleLockStation = () => {
    securityEngine.lockStation('timer');
    setIsUnlocked(false);
  };

  const activeDriver = raceState?.drivers.find(d => d.id === selectedDriverId) || raceState?.drivers[0];
  const poleTime = raceState?.provisionalPoleTime || 0;

  // Running stopwatch clock loop
  useEffect(() => {
    if (isRunning && startTimestampRef.current !== null) {
      const updateClock = () => {
        const now = Date.now();
        const diff = now - startTimestampRef.current!;
        setElapsedMs(diff);
        animFrameRef.current = requestAnimationFrame(updateClock);
      };
      animFrameRef.current = requestAnimationFrame(updateClock);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning]);

  // Start Flying Lap
  const handleStartFlyingLap = () => {
    const now = Date.now();
    startTimestampRef.current = now;
    setElapsedMs(0);
    setIsRunning(true);
    setStage('FLYING');
    setS1Time(null);
    setS2Time(null);
    setTotalTime(null);

    radioEngine.startFlyingLap(selectedDriverId);
  };

  // Stamp Sector 1 (e.g. Society Gate to Chicane)
  const handleStampSector1 = () => {
    if (!isRunning || startTimestampRef.current === null) return;
    const split = +( (Date.now() - startTimestampRef.current) / 1000 ).toFixed(3);
    setS1Time(split);
    setStage('S1_DONE');

    radioEngine.splitSector1(split);
  };

  // Stamp Sector 2 (e.g. Swimming Pool Esses)
  const handleStampSector2 = () => {
    if (!isRunning || startTimestampRef.current === null || s1Time === null) return;
    const currentTotal = (Date.now() - startTimestampRef.current) / 1000;
    const splitS2 = +(currentTotal - s1Time).toFixed(3);
    setS2Time(splitS2);
    setStage('S2_DONE');

    radioEngine.splitSector2(splitS2);
  };

  // Finish Lap (Main Straight / Gate)
  const handleFinishLap = () => {
    if (!isRunning || startTimestampRef.current === null) return;
    const total = +( (Date.now() - startTimestampRef.current) / 1000 ).toFixed(3);
    const s1 = s1Time || +(total * 0.32).toFixed(3);
    const s2 = s2Time || +(total * 0.38).toFixed(3);
    const s3 = +(total - s1 - s2).toFixed(3);

    setIsRunning(false);
    setTotalTime(total);
    setStage('FINISHED');

    radioEngine.finishLap(total, s3);
  };

  // Reset
  const handleReset = () => {
    setIsRunning(false);
    startTimestampRef.current = null;
    setElapsedMs(0);
    setStage('IDLE');
    setS1Time(null);
    setS2Time(null);
    setTotalTime(null);

    radioEngine.resetTimer();
  };

  // Format milliseconds into MM:SS.mmm
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor(ms % 1000);

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  };

  if (!isUnlocked) {
    return (
      <PasscodeLockModal
        type="station"
        targetId="timer"
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black shadow-lg">
              <Timer className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 font-bold">
                  OFFICIAL TIMEKEEPER DESK
                </span>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-mono text-cyan-400">
                  SESSION: {raceState?.session}
                </span>
              </div>
              <h1 className="font-racing font-bold text-2xl text-white mt-1">
                Qualifying Flying Lap Stopwatch
              </h1>
            </div>
          </div>

          {/* Active Provisional Pole Banner & Lock */}
          <div className="flex items-center gap-3">
            <div className="bg-purple-950/80 border border-purple-600/60 px-4 py-2 rounded-2xl flex items-center gap-3">
              <Trophy className="w-5 h-5 text-purple-400" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 block">
                  PROVISIONAL POLE TIME
                </span>
                <span className="font-mono-racing font-black text-lg text-purple-200">
                  {poleTime > 0 ? `${poleTime.toFixed(3)}s` : '--:--.---'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLockStation}
              className="p-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 border border-zinc-700 transition-colors"
              title="Lock station with passcode"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* OFFICIAL SESSION COUNTDOWN TIMER (FP1, FP2, FP3, QUALI) */}
        {raceState?.session !== 'RACE' && raceState?.session !== 'PODIUM' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                raceState?.sessionTimerRunning ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 animate-pulse' : 'bg-zinc-950 border border-zinc-800 text-amber-400'
              }`}>
                <Timer className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-racing font-bold text-base text-white">
                    {raceState?.session === 'Q1' ? 'QUALIFYING' : raceState?.session} SESSION CLOCK
                  </span>
                  {raceState?.sessionTimerRunning ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE COUNTDOWN
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 font-bold">
                      READY / PAUSED
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Controls the broadcast timer shown above POS/DRIVER on the TV stream
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono-racing font-black text-2xl text-white">
                  {(() => {
                    const totalSecs = raceState?.sessionRemainingSeconds ?? 1800;
                    const mins = Math.floor(totalSecs / 60);
                    const secs = totalSecs % 60;
                    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  })()}
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {Math.round((raceState?.sessionRemainingSeconds ?? 1800) / 60)}m Remaining
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!raceState?.sessionTimerRunning ? (
                  <button
                    onClick={() => radioEngine.startSessionTimer()}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-racing font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/60"
                  >
                    <Play className="w-4 h-4" />
                    <span>START TIMER</span>
                  </button>
                ) : (
                  <button
                    onClick={() => radioEngine.pauseSessionTimer()}
                    className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-racing font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5"
                  >
                    <Pause className="w-4 h-4" />
                    <span>PAUSE</span>
                  </button>
                )}

                <button
                  onClick={() => radioEngine.resetSessionTimer()}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                  title="Reset session clock"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INCOMING FLYING LAP REQUEST FROM TEAM PIT WALL */}
        {incomingRequest && (
          <div className="bg-purple-950/90 border-2 border-purple-500 rounded-3xl p-5 shadow-2xl shadow-purple-950/80 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black animate-pulse shadow-lg shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-mono text-purple-300 font-bold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    <span>⚡ INCOMING FLYING LAP REQUEST</span>
                    <span>• {incomingRequest.timestamp}</span>
                  </div>
                  <div className="font-racing font-bold text-lg text-white">
                    {incomingRequest.driverName} (#{incomingRequest.driverNumber}) is preparing for flying lap!
                  </div>
                  <div className="text-xs text-zinc-400">
                    Radio alert sent by {incomingRequest.engineerName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIncomingRequest(null)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleAcceptFlyingLap(incomingRequest)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-racing font-bold text-xs sm:text-sm shadow-xl shadow-purple-950/80 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SELECT & PRIME RIDER</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Driver on Flying Lap Selector & Options Grid */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">
                CLICK A RIDER AMONG OPTIONS TO SIGNAL FLYING LAP:
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Click any driver below to prime them on the timing gantry and confirm back to their pit wall.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedDriverId}
                disabled={isRunning}
                onChange={(e) => handleSelectDriver(e.target.value)}
                className="bg-zinc-950 text-white font-racing font-bold text-sm px-4 py-2 rounded-xl border border-zinc-700 focus:outline-none cursor-pointer"
              >
                {raceState?.drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    #{d.number} {d.name} ({d.team})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick 1-Click Driver Selection Chips Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {raceState?.drivers.map(drv => {
              const isSelected = drv.id === selectedDriverId;
              return (
                <button
                  key={drv.id}
                  disabled={isRunning}
                  onClick={() => handleSelectDriver(drv.id)}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col text-left ${
                    isSelected
                      ? 'bg-zinc-950 border-purple-500 shadow-lg shadow-purple-950/50 ring-2 ring-purple-500/40'
                      : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center font-mono font-black text-xs text-black"
                      style={{ backgroundColor: drv.color }}
                    >
                      #{drv.number}
                    </span>
                    {raceState?.session === 'RACE' && drv.lapsCompleted >= (raceState?.totalLaps || 12) ? (
                      <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-950 px-1.5 rounded">
                        FIN 🏁
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-950 px-1.5 rounded">
                        PRIMED
                      </span>
                    ) : null}
                  </div>
                  <div className="font-racing font-bold text-xs text-white truncate">
                    {drv.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 truncate">
                    {drv.team.split(' ')[0]}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-mono-racing font-black text-2xl text-black shadow-lg"
              style={{ backgroundColor: activeDriver?.color || '#3671C6' }}
            >
              #{activeDriver?.number || 1}
            </div>
            <div>
              <div className="font-racing font-bold text-lg text-white">
                {activeDriver?.name}
              </div>
              <div className="text-xs text-zinc-400">
                {activeDriver?.team} • Bike: {activeDriver?.bikeType}
              </div>
            </div>
          </div>
        </div>

        {/* BIG F1 OFFICIAL STOPWATCH DISPLAY */}
        <div className="bg-black border-2 border-zinc-800 rounded-3xl p-6 md:p-8 text-center relative overflow-hidden shadow-2xl">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-2">
            OFFICIAL RUNNING QUALIFYING TIME
          </div>

          {/* Running Clock Readout */}
          <div className="font-mono-racing font-black text-6xl md:text-8xl tracking-tight text-white my-3">
            {formatTime(elapsedMs)}
          </div>

          {/* Sector Splits Progress (🟣 PURPLE: FASTEST • 🟢 GREEN: PERSONAL BEST • 🟡 YELLOW: SLOWER) */}
          {(() => {
            const sectorBests = computeSessionSectorBests(raceState);
            const s3Val = totalTime !== null && s1Time !== null && s2Time !== null ? +(totalTime - s1Time - s2Time).toFixed(3) : null;

            const s1Status = s1Time !== null ? getSectorColorStatus(1, s1Time, selectedDriverId, sectorBests) : 'YELLOW';
            const s2Status = s2Time !== null ? getSectorColorStatus(2, s2Time, selectedDriverId, sectorBests) : 'YELLOW';
            const s3Status = s3Val !== null ? getSectorColorStatus(3, s3Val, selectedDriverId, sectorBests) : 'YELLOW';

            const s1Styles = getSectorBadgeStyles(s1Status);
            const s2Styles = getSectorBadgeStyles(s2Status);
            const s3Styles = getSectorBadgeStyles(s3Status);

            return (
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mt-6">
                <div className={`p-3 rounded-2xl border text-center transition-all ${
                  s1Time !== null
                    ? `${s1Styles.bg} ${s1Styles.border} ${s1Styles.text}`
                    : stage === 'FLYING'
                    ? 'bg-yellow-950/50 border-yellow-500 text-yellow-300 animate-pulse'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}>
                  <span className="text-[10px] font-mono block">
                    SECTOR 1 {s1Time !== null && (s1Status === 'PURPLE' ? '🟣' : s1Status === 'GREEN' ? '🟢' : '🟡')}
                  </span>
                  <span className="font-mono-racing font-bold text-base">
                    {s1Time !== null ? `${s1Time.toFixed(3)}s` : '--'}
                  </span>
                </div>

                <div className={`p-3 rounded-2xl border text-center transition-all ${
                  s2Time !== null
                    ? `${s2Styles.bg} ${s2Styles.border} ${s2Styles.text}`
                    : stage === 'S1_DONE'
                    ? 'bg-yellow-950/50 border-yellow-500 text-yellow-300 animate-pulse'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}>
                  <span className="text-[10px] font-mono block">
                    SECTOR 2 {s2Time !== null && (s2Status === 'PURPLE' ? '🟣' : s2Status === 'GREEN' ? '🟢' : '🟡')}
                  </span>
                  <span className="font-mono-racing font-bold text-base">
                    {s2Time !== null ? `${s2Time.toFixed(3)}s` : '--'}
                  </span>
                </div>

                <div className={`p-3 rounded-2xl border text-center transition-all ${
                  stage === 'FINISHED' && s3Val !== null
                    ? `${s3Styles.bg} ${s3Styles.border} ${s3Styles.text}`
                    : stage === 'S2_DONE'
                    ? 'bg-yellow-950/50 border-yellow-500 text-yellow-300 animate-pulse'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}>
                  <span className="text-[10px] font-mono block">
                    SECTOR 3 {stage === 'FINISHED' && s3Val !== null && (s3Status === 'PURPLE' ? '🟣' : s3Status === 'GREEN' ? '🟢' : '🟡')}
                  </span>
                  <span className="font-mono-racing font-bold text-base">
                    {s3Val !== null ? `${s3Val.toFixed(3)}s` : '--'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Marshal Action Buttons */}
        <div className="space-y-3">
          {stage === 'IDLE' && (
            (raceState?.session === 'RACE' && (activeDriver?.lapsCompleted || 0) >= (raceState?.totalLaps || 12)) ? (
              <div className="w-full bg-zinc-900 border-2 border-amber-500/60 text-amber-400 font-racing font-bold text-lg py-5 px-4 rounded-3xl flex items-center justify-center gap-3 shadow-xl select-none text-center">
                <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
                <span>🏁 RIDER HAS COMPLETED RACE ({activeDriver?.lapsCompleted}/{raceState?.totalLaps} LAPS)</span>
              </div>
            ) : (
              <button
                onClick={handleStartFlyingLap}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-racing font-bold text-xl py-6 rounded-3xl shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-3"
              >
                <Play className="w-7 h-7" />
                <span>START FLYING LAP (START STOPWATCH)</span>
              </button>
            )
          )}

          {stage === 'FLYING' && (
            <button
              onClick={handleStampSector1}
              className="w-full bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-racing font-bold text-xl py-6 rounded-3xl shadow-xl shadow-purple-950/50 flex items-center justify-center gap-3"
            >
              <Zap className="w-7 h-7" />
              <span>STAMP SECTOR 1 (CORNER 2)</span>
            </button>
          )}

          {stage === 'S1_DONE' && (
            <button
              onClick={handleStampSector2}
              className="w-full bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white font-racing font-bold text-xl py-6 rounded-3xl shadow-xl shadow-cyan-950/50 flex items-center justify-center gap-3"
            >
              <Zap className="w-7 h-7" />
              <span>STAMP SECTOR 2 (CORNER 4)</span>
            </button>
          )}

          {stage === 'S2_DONE' && (
            <button
              onClick={handleFinishLap}
              className="w-full bg-red-600 hover:bg-red-500 active:scale-98 text-white font-racing font-bold text-xl py-6 rounded-3xl shadow-xl shadow-red-950/50 flex items-center justify-center gap-3 animate-pulse"
            >
              <Flag className="w-7 h-7" />
              <span>FINISH LAP (FINISH STRAIGHT)</span>
            </button>
          )}

          {stage === 'FINISHED' && (
            <div className="space-y-3">
              <div className="bg-emerald-950 border border-emerald-600 p-4 rounded-2xl text-center">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest block">
                  LAP RECORDED & BROADCAST TO STREAM!
                </span>
                <div className="font-mono-racing font-black text-3xl text-white mt-1">
                  OFFICIAL LAP TIME: {totalTime?.toFixed(3)}s
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-racing font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                <span>READY FOR NEXT RIDER'S FLYING LAP</span>
              </button>
            </div>
          )}

          {isRunning && (
            <button
              onClick={handleReset}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-mono text-xs py-3 rounded-xl border border-zinc-800"
            >
              ABORT LAP & RESET STOPWATCH
            </button>
          )}
        </div>

        {/* Lap History & Sector Split Log (Automatic logging from finish line taps) */}
        <LapHistoryTable
          lapHistory={raceState?.lapHistory || []}
          fastestLapHolder={raceState?.fastestLapHolder}
        />
      </div>
    </div>
  );
};
