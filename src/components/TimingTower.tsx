import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flag,
  Flame,
  Radio as RadioIcon,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { radioEngine, RaceState, DriverState, RadioTransmission } from '../services/radioEngine';

export const TimingTower: React.FC = () => {
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [audioBroadcastEnabled, setAudioBroadcastEnabled] = useState<boolean>(true);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(() => raceState?.sessionRemainingSeconds ?? 1800);

  useEffect(() => {
    if (raceState?.sessionRemainingSeconds !== undefined) {
      setSessionTimeLeft(raceState.sessionRemainingSeconds);
    }
  }, [raceState?.sessionRemainingSeconds]);

  useEffect(() => {
    if (!raceState?.sessionTimerRunning) return;
    const interval = setInterval(() => {
      setSessionTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [raceState?.sessionTimerRunning]);

  const [activeRadioGraphic, setActiveRadioGraphic] = useState<{
    show: boolean;
    name: string;
    number: number;
    team: string;
    role: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    radioEngine.connect('societygp', 'spectator', '', 'TV Broadcast');
    const unsubState = radioEngine.onRaceState(setRaceState);

    const unsubRadio = radioEngine.onRadio((trans: RadioTransmission) => {
      const driver = raceState?.drivers.find(d => d.id === trans.teamId);
      setActiveRadioGraphic({
        show: true,
        name: driver?.name || trans.senderName,
        number: driver?.number || 1,
        team: driver?.team || 'Society Racing',
        role: trans.senderRole.toUpperCase(),
        text: trans.transcript || `${trans.senderRole.toUpperCase()} voice transmission`,
      });

      // Hide after 4.5s
      setTimeout(() => {
        setActiveRadioGraphic(null);
      }, 4500);
    });

    const unsubPTT = radioEngine.onPTT((isTalking, role, name) => {
      if (isTalking) {
        setActiveRadioGraphic({
          show: true,
          name,
          number: 1,
          team: 'Live Audio',
          role: role.toUpperCase(),
          text: 'TRANSMITTING LIVE...',
        });
      } else {
        setTimeout(() => setActiveRadioGraphic(null), 1500);
      }
    });

    return () => {
      unsubState();
      unsubRadio();
      unsubPTT();
    };
  }, [raceState?.drivers]);

  const flagStatus = raceState?.flagStatus || 'GREEN';

  const getTyreBadge = (compound: string) => {
    switch (compound) {
      case 'SOFT':
        return <span className="w-5 h-5 rounded-full border-2 border-red-500 text-red-500 font-bold flex items-center justify-center text-[10px] bg-red-950/40">S</span>;
      case 'MEDIUM':
        return <span className="w-5 h-5 rounded-full border-2 border-yellow-400 text-yellow-400 font-bold flex items-center justify-center text-[10px] bg-yellow-950/40">M</span>;
      case 'HARD':
        return <span className="w-5 h-5 rounded-full border-2 border-white text-white font-bold flex items-center justify-center text-[10px] bg-zinc-900">H</span>;
      default:
        return <span className="w-5 h-5 rounded-full border-2 border-cyan-400 text-cyan-400 font-bold flex items-center justify-center text-[10px]">W</span>;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-3 md:p-6 select-none relative overflow-x-hidden">
      {/* Top F1 Broadcast Bar */}
      <div className="max-w-7xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 md:px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono-racing font-black text-xl text-red-500 tracking-tighter">
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-sm font-black">F1</span>
            <span>SOCIETY GP</span>
          </div>

          <div className="h-5 w-px bg-zinc-800 hidden sm:block" />

          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
            <span className="font-bold text-white uppercase">{raceState?.circuitName}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-amber-400 font-bold uppercase">{raceState?.session}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Lap Count Indicator */}
          <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl text-xs font-mono">
            <span className="text-zinc-500">LAP </span>
            <span className="font-bold text-white text-sm">
              {raceState?.currentLap || 1}
            </span>
            <span className="text-zinc-500"> / {raceState?.totalLaps || 12}</span>
          </div>

          {/* Session Flag Indicator */}
          <div
            className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
              flagStatus === 'GREEN'
                ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                : flagStatus === 'SC'
                ? 'bg-amber-950 border border-amber-500 text-amber-300 animate-pulse'
                : flagStatus === 'VSC'
                ? 'bg-orange-950 border border-orange-500 text-orange-300'
                : flagStatus === 'RED'
                ? 'bg-red-950 border border-red-500 text-red-300 animate-pulse'
                : 'bg-zinc-800 text-zinc-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span>{flagStatus} FLAG</span>
          </div>

          {/* Audio broadcast toggle */}
          <button
            onClick={() => setAudioBroadcastEnabled(!audioBroadcastEnabled)}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
            title={audioBroadcastEnabled ? 'Mute Radio Audio' : 'Unmute Radio Audio'}
          >
            {audioBroadcastEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Broadcast Center: Left Timing Tower & Right Live Feed */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Authentic F1 Official Leaderboard Tower (7 cols) */}
        <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800/90 rounded-3xl p-4 md:p-6 shadow-2xl relative">
          {/* Official FOM Session Countdown Clock (Shown when started for FP1, FP2, FP3, or Quali) */}
          {(() => {
            const sessionUpper = (raceState?.session || 'P1').toUpperCase();
            const isPracticeOrQuali = ['P1', 'P2', 'P3', 'Q1', 'FP1', 'FP2', 'FP3', 'QUALI', 'QUALIFYING'].includes(sessionUpper);
            const isSessionTimerStarted = Boolean(
              raceState?.sessionTimerRunning ||
              (raceState?.sessionRemainingSeconds !== undefined && raceState.sessionRemainingSeconds < (raceState.sessionTotalSeconds || 1800) && raceState.sessionRemainingSeconds > 0)
            );
            if (!isPracticeOrQuali || !isSessionTimerStarted) return null;

            const sessionNameMap: Record<string, string> = {
              P1: 'FP1',
              P2: 'FP2',
              P3: 'FP3',
              Q1: 'QUALI',
              FP1: 'FP1',
              FP2: 'FP2',
              FP3: 'FP3',
              QUALI: 'QUALI',
              QUALIFYING: 'QUALI',
            };
            const sessionDisplayTag = sessionNameMap[sessionUpper] || sessionUpper;
            const timerMins = Math.floor(sessionTimeLeft / 60);
            const timerSecs = sessionTimeLeft % 60;
            const formattedClock = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;

            return (
              <div className="mb-4 bg-zinc-900 border-l-4 border-red-600 border-t border-r border-b border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="bg-[#e10600] text-white text-xs font-black px-2 py-0.5 rounded font-racing tracking-wider">
                    {sessionDisplayTag}
                  </span>
                  <span className="text-xs text-zinc-300 font-mono font-bold uppercase tracking-wider">
                    SESSION TIME REMAINING
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono-racing font-bold text-lg tracking-wider">
                  <span className={`w-2 h-2 rounded-full ${raceState?.sessionTimerRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className={raceState?.sessionTimerRunning ? 'text-white' : 'text-amber-300'}>
                    {formattedClock}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
            <h2 className="font-racing font-bold text-xl text-white tracking-wide flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>LIVE RACE STANDINGS</span>
            </h2>
            <div className="text-xs font-mono text-zinc-400 flex items-center gap-4">
              <span>INTERVAL</span>
              <span>GAP</span>
            </div>
          </div>

          {/* Standings Rows */}
          <div className="space-y-2">
            {raceState?.drivers.map((driver, index) => {
              const isLeader = index === 0;
              const hasFastestLap = raceState?.fastestLapHolder?.driverName === driver.name;

              return (
                <div
                  key={driver.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isLeader
                      ? 'bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border-zinc-700 shadow-md'
                      : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  {/* Left: Pos, Color, Number, Name */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono-racing font-black text-lg w-6 text-zinc-400">
                      {index + 1}
                    </span>

                    {/* Team Color Pill */}
                    <div
                      className="w-1.5 h-8 rounded-full"
                      style={{ backgroundColor: driver.color }}
                    />

                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-mono-racing font-bold text-xs text-black"
                      style={{ backgroundColor: driver.color }}
                    >
                      {driver.number}
                    </div>

                    <div>
                      <div className="font-racing font-bold text-base text-zinc-100 flex items-center gap-2">
                        <span>{driver.name}</span>
                        {hasFastestLap && (
                          <span className="bg-purple-900/80 text-purple-300 border border-purple-600/50 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                            FL
                          </span>
                        )}
                        {driver.penaltySeconds > 0 && (
                          <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-mono px-1.5 rounded">
                            +{driver.penaltySeconds}s
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <span>{driver.team}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400 font-mono text-[11px]">
                          LAPS: {driver.lapsCompleted}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Interval, Gap, Tyre, Speed */}
                  <div className="flex items-center gap-4 text-right">
                    <div className="font-mono text-xs hidden sm:block">
                      <span className="text-zinc-500 block text-[10px]">INTERVAL</span>
                      <span className="text-zinc-300 font-bold">{driver.interval}</span>
                    </div>

                    <div className="font-mono text-xs">
                      <span className="text-zinc-500 block text-[10px]">GAP</span>
                      <span className={`font-bold ${isLeader ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {driver.gap}
                      </span>
                    </div>

                    <div className="font-mono text-xs hidden md:block">
                      <span className="text-zinc-500 block text-[10px]">SPEED</span>
                      <span className="text-cyan-400 font-bold">{driver.speedKmh} km/h</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fastest Lap Banner (DHL Style) */}
          {raceState?.fastestLapHolder && (
            <div className="mt-4 bg-purple-950/80 border border-purple-600/60 rounded-2xl p-3 flex items-center justify-between shadow-lg shadow-purple-950/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-xs">
                  FL
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-purple-300">
                    DHL FASTEST LAP OF SESSION
                  </div>
                  <div className="font-racing font-bold text-sm text-white">
                    {raceState.fastestLapHolder.driverName} ({raceState.fastestLapHolder.team})
                  </div>
                </div>
              </div>
              <div className="font-mono-racing font-black text-lg text-purple-300">
                {raceState.fastestLapHolder.time.toFixed(3)}s
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Live Ticker & Race Events & Radio Chatter (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Circuit Status Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5">
            <h3 className="font-racing font-bold text-base text-white mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>CIRCUIT TELEMETRY OVERVIEW</span>
            </h3>
            <div className="space-y-2 text-xs font-mono text-zinc-300">
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">CIRCUIT</span>
                <span className="font-bold text-white">{raceState?.circuitName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">LAP LENGTH</span>
                <span>{raceState?.lapLengthMeters || 480} meters / lap</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">TOTAL DISTANCE</span>
                <span>{(((raceState?.lapLengthMeters || 480) * (raceState?.totalLaps || 12)) / 1000).toFixed(2)} km</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-500">ONLINE RIDERS</span>
                <span className="text-emerald-400 font-bold">
                  {raceState?.drivers.filter(d => d.isDriverOnline).length || 0} Connected
                </span>
              </div>
            </div>
          </div>

          {/* Official Event Ticker */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5">
            <h3 className="font-racing font-bold text-base text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>RACE CONTROL & COMMENTARY FEED</span>
            </h3>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {raceState?.events.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase font-bold">
                      {evt.type}
                    </span>
                    <span>LAP {evt.lap} • {evt.timestamp}</span>
                  </div>
                  <div className="text-zinc-200 font-sans leading-relaxed">
                    {evt.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP F1 OFFICIAL TEAM RADIO BROADCAST GRAPHIC */}
      {activeRadioGraphic?.show && (
        <div className="fixed bottom-6 left-6 right-6 md:right-auto md:w-96 z-50">
          <div className="bg-[#0b0c10]/95 border-l-4 border-emerald-500 border-t border-r border-b border-zinc-800 rounded-lg p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-1.5 border-b border-zinc-800/80 pb-1">
              <div className="flex items-center gap-1.5">
                <RadioIcon className="w-4 h-4 text-emerald-400" />
                <span className="font-racing font-bold text-xs uppercase tracking-widest text-emerald-400">
                  FOM TEAM RADIO
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded">
                LIVE
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-emerald-600 text-white font-mono-racing font-bold flex items-center justify-center text-xs">
                #{activeRadioGraphic.number}
              </div>
              <div>
                <div className="font-racing font-bold text-xs text-white">
                  {activeRadioGraphic.name}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {activeRadioGraphic.team} • {activeRadioGraphic.role}
                </div>
              </div>
            </div>

            <div className="mt-1.5 text-xs font-mono text-emerald-300 italic bg-emerald-950/30 p-2 rounded border border-emerald-800/40">
              "{activeRadioGraphic.text}"
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
