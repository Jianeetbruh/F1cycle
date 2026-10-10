import React, { useState, useEffect } from 'react';
import {
  Flag,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  AlertOctagon,
  ShieldAlert,
  Car,
  CheckCircle,
  Plus,
  Users,
  Timer,
  Volume2,
  Sparkles,
  Zap,
  ArrowRight,
  Edit2,
  Trash2,
  Save,
  X,
  Gauge,
  ChevronUp,
  Lock,
  Mic,
  Radio,
  AlertTriangle,
  FastForward,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { radioEngine, RaceState, DriverState } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';
import { securityEngine } from '../utils/security';
import { computeSessionSectorBests, getSectorColorStatus, getSectorBadgeStyles } from '../utils/sectorTiming';
import { RaceSetupModal } from './RaceSetupModal';
import { PasscodeLockModal } from './PasscodeLockModal';

export const RaceControlPortal: React.FC = () => {
  // Official security passcode protection for Race Director (Passcode 9999 or master 0000)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isStationUnlocked('control'));
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [lightsRunning, setLightsRunning] = useState<boolean>(false);
  const [activeLightCount, setActiveLightCount] = useState<number>(0);

  // Director Radio & Hazard Alert State
  const [isDirectorMicActive, setIsDirectorMicActive] = useState<boolean>(false);
  const [hazardAlert, setHazardAlert] = useState<any | null>(null);
  const [calloutFeedback, setCalloutFeedback] = useState<string | null>(null);

  // New Driver Form state
  const [newDriverName, setNewDriverName] = useState<string>('');
  const [newDriverNumber, setNewDriverNumber] = useState<string>('');
  const [newDriverTeam, setNewDriverTeam] = useState<string>('');
  const [newDriverBike, setNewDriverBike] = useState<string>('Road Bike');

  // Edit Driver state
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editNumber, setEditNumber] = useState<string>('');
  const [editTeam, setEditTeam] = useState<string>('');
  const [editBike, setEditBike] = useState<string>('');

  // Total Laps state
  const [customLapsInput, setCustomLapsInput] = useState<string>('12');

  useEffect(() => {
    if (!isUnlocked) return;

    radioEngine.connect('societygp', 'control', 'control', 'Race Director');
    const unsub = radioEngine.onRaceState((state) => {
      setRaceState(state);
      if (state.totalLaps) {
        setCustomLapsInput(String(state.totalLaps));
      }
    });

    const unsubHazard = radioEngine.onTrackHazard((haz) => {
      setHazardAlert(haz);
    });

    return () => {
      unsub();
      unsubHazard();
    };
  }, [isUnlocked]);

  // 5 Red Lights Sequence Execution
  const triggerStartSequence = () => {
    if (lightsRunning) return;
    setLightsRunning(true);
    setActiveLightCount(0);

    setTimeout(() => {
      setActiveLightCount(1);
      soundEffects.playRedLightBeep();
      radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 1 });
    }, 1000);

    setTimeout(() => {
      setActiveLightCount(2);
      soundEffects.playRedLightBeep();
      radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 2 });
    }, 2000);

    setTimeout(() => {
      setActiveLightCount(3);
      soundEffects.playRedLightBeep();
      radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 3 });
    }, 3000);

    setTimeout(() => {
      setActiveLightCount(4);
      soundEffects.playRedLightBeep();
      radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 4 });
    }, 4000);

    setTimeout(() => {
      setActiveLightCount(5);
      soundEffects.playRedLightBeep();
      radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 5 });

      const randomHoldMs = Math.floor(Math.random() * 1800 + 1200);
      setTimeout(() => {
        setActiveLightCount(0);
        setLightsRunning(false);
        soundEffects.playLightsOutGo();
        radioEngine.sendRaceAction('TRIGGER_LIGHTS_STAGE', { stage: 6 });
      }, randomHoldMs);
    }, 5000);
  };

  // Flag Changes (triggers 4-second urgent screen overlay for all volunteers)
  const setFlag = (flag: 'GREEN' | 'YELLOW' | 'RED' | 'SC' | 'VSC' | 'CHEQUERED') => {
    if (flag === 'SC' || flag === 'VSC') {
      soundEffects.playSafetyCarHorn();
    } else if (flag === 'CHEQUERED') {
      soundEffects.playFastestLapFanfare();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else if (flag === 'YELLOW') {
      soundEffects.playWarningHorn();
    } else {
      soundEffects.playRadioChirp();
    }
    radioEngine.sendRaceAction('SET_FLAG', { flag });
  };

  // Session Changes
  const setSession = (session: 'PRACTICE' | 'QUALIFYING' | 'RACE' | 'PODIUM') => {
    soundEffects.playRadioChirp();
    radioEngine.sendRaceAction('SET_SESSION', { session });
    if (session === 'PODIUM') {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      soundEffects.playFastestLapFanfare();
    }
  };

  // Change Total Laps
  const handleUpdateTotalLaps = (newLaps: number) => {
    soundEffects.playRadioChirp();
    setCustomLapsInput(String(newLaps));
    radioEngine.setTotalLaps(newLaps);
  };

  // Marshal Tap Finish Line Lap Trigger
  const recordFinishLinePass = (driverId: string) => {
    soundEffects.playRadioChirp();
    const lapTime = +(Math.random() * 8 + 36).toFixed(3);
    const s1 = +(lapTime * 0.32).toFixed(2);
    const s2 = +(lapTime * 0.38).toFixed(2);
    const s3 = +(lapTime * 0.30).toFixed(2);

    radioEngine.sendRaceAction('RECORD_LAP', {
      driverId,
      lapTimeSec: lapTime,
      s1,
      s2,
      s3,
    });
  };

  // Issue 5s Penalty
  const issuePenalty = (driverId: string, reason: string) => {
    soundEffects.playRadioChirp();
    radioEngine.sendRaceAction('ADD_PENALTY', {
      driverId,
      seconds: 5,
      reason,
    });
  };

  // Director Tap-to-Speak Radio (Click once to broadcast, click again to stop - NOT HOLD)
  const toggleDirectorRadio = async () => {
    if (isDirectorMicActive) {
      setIsDirectorMicActive(false);
      radioEngine.stopPTT();
      soundEffects.playRadioChirp();
    } else {
      setIsDirectorMicActive(true);
      await radioEngine.startPTT();
      soundEffects.playRadioChirp();
    }
  };

  const sendDirectorCallout = (text: string) => {
    soundEffects.playRadioChirp();
    radioEngine.sendDirectorBroadcast(text);
    setCalloutFeedback(text);
    setTimeout(() => setCalloutFeedback(null), 3000);
  };

  // Remove / Invalidate Lap Time
  const handleRemoveDriverLap = (driverId: string, lapRecordId?: string) => {
    soundEffects.playRadioChirp();
    radioEngine.removeLapTime(driverId, lapRecordId);
  };

  // Add new society rider
  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) return;

    const newDriver: DriverState = {
      id: `team-${Date.now()}`,
      number: parseInt(newDriverNumber, 10) || Math.floor(Math.random() * 89 + 10),
      name: newDriverName.trim(),
      team: newDriverTeam.trim() || 'Society Independent',
      color: ['#E80020', '#3671C6', '#FF8000', '#27F4D2', '#229971', '#900000', '#F59E0B'][
        Math.floor(Math.random() * 7)
      ],
      bikeType: newDriverBike,
      tyreCompound: 'MEDIUM',
      lapsCompleted: 0,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      s1: null,
      s2: null,
      s3: null,
      gap: '+5.000',
      interval: '+1.500',
      speedKmh: 0,
      cadenceRpm: 0,
      tyreWearPercent: 100,
      pitStops: 0,
      status: 'TRACK',
      penaltySeconds: 0,
      isDriverOnline: false,
      isEngineerOnline: false,
    };

    radioEngine.addDriver(newDriver);
    setNewDriverName('');
    setNewDriverNumber('');
    setNewDriverTeam('');
  };

  // Start editing a driver
  const startEditingDriver = (driver: DriverState) => {
    setEditingDriverId(driver.id);
    setEditName(driver.name);
    setEditNumber(String(driver.number));
    setEditTeam(driver.team);
    setEditBike(driver.bikeType);
  };

  // Save edited driver details
  const saveDriverEdit = (driverId: string) => {
    radioEngine.updateDriver(driverId, {
      name: editName.trim(),
      number: parseInt(editNumber, 10) || undefined,
      team: editTeam.trim(),
      bikeType: editBike.trim(),
    });
    setEditingDriverId(null);
  };

  // Remove driver
  const handleRemoveDriver = (driverId: string, driverName: string) => {
    if (window.confirm(`Are you sure you want to remove ${driverName} from the race grid?`)) {
      radioEngine.removeDriver(driverId);
    }
  };

  // Reset Weekend
  const resetWeekend = () => {
    if (window.confirm('Reset society race weekend to initial state?')) {
      radioEngine.sendRaceAction('RESET_WEEKEND', {});
    }
  };

  const handleLockStation = () => {
    securityEngine.lockStation('control');
    setIsUnlocked(false);
  };

  if (!isUnlocked) {
    return (
      <PasscodeLockModal
        type="station"
        targetId="control"
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6 select-none">
      <RaceSetupModal
        isOpen={showSetupModal}
        raceState={raceState}
        onClose={() => setShowSetupModal(false)}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/50">
              <Flag className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-300 font-bold">
                  FIA / RACE DIRECTOR TOWER
                </span>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {raceState?.circuitName || 'Metro Jazz Circuit'}
                </span>
                {raceState?.isTestMode ? (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>FREE TEST (UNRECORDED)</span>
                  </span>
                ) : (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                    OFFICIAL GP
                  </span>
                )}
              </div>
              <h1 className="font-racing font-bold text-2xl text-white tracking-wide mt-0.5">
                {raceState?.raceName || 'Metro Jazz Grand Prix'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSetupModal(true)}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-racing font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-red-950/50 transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>NEW / SWITCH RACE</span>
            </button>

            <button
              onClick={resetWeekend}
              className="bg-zinc-800 hover:bg-zinc-700 text-xs font-mono px-3.5 py-2 rounded-xl border border-zinc-700 text-zinc-300 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET SESSION</span>
            </button>

            <button
              onClick={handleLockStation}
              className="bg-zinc-800 hover:bg-zinc-700 text-xs font-mono px-3.5 py-2 rounded-xl border border-zinc-700 text-zinc-300 flex items-center gap-1.5 transition-all"
              title="Lock Race Control Desk"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>LOCK</span>
            </button>
          </div>
        </div>

        {/* WEEKEND EVENT PROGRESSION & SESSION TIMER CONTROL BANNER */}
        <div className="bg-zinc-900/95 border-2 border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Active Event & Weekend Step Indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full font-bold bg-zinc-950 border border-zinc-700 text-zinc-300">
                  WEEKEND SCHEDULE
                </span>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-racing font-bold text-emerald-400">
                  {raceState?.session === 'P1' && 'PRACTICE 1 (FP1) ACTIVE'}
                  {raceState?.session === 'P2' && 'PRACTICE 2 (FP2) ACTIVE'}
                  {raceState?.session === 'P3' && 'PRACTICE 3 (FP3) ACTIVE'}
                  {raceState?.session === 'Q1' && 'QUALIFYING SHOOTOUT (Q1) ACTIVE'}
                  {raceState?.session === 'RACE' && 'GRAND PRIX MAIN RACE ACTIVE'}
                  {raceState?.session === 'PODIUM' && 'PODIUM CEREMONY'}
                </span>
              </div>

              {/* Event Step Pills */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                {[
                  { id: 'P1', label: '1. PRACTICE 1', short: 'P1' },
                  { id: 'P2', label: '2. PRACTICE 2', short: 'P2' },
                  { id: 'P3', label: '3. PRACTICE 3', short: 'P3' },
                  { id: 'Q1', label: '4. QUALIFYING', short: 'Q1' },
                  { id: 'RACE', label: '5. GRAND PRIX', short: 'RACE' },
                ].map((s) => {
                  const isActive = raceState?.session === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSession(s.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-racing font-bold text-xs flex items-center gap-1 transition-all ${
                        isActive
                          ? 'bg-red-600 text-white shadow-md shadow-red-950 ring-1 ring-red-400'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Next Event Advance Button */}
            <div className="flex items-center gap-3">
              {raceState?.session === 'P1' && (
                <button
                  type="button"
                  onClick={() => radioEngine.advanceSession()}
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white font-racing font-bold text-xs sm:text-sm py-2.5 px-4 rounded-2xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 border border-emerald-400/40"
                  title="Move from Practice 1 to Practice 2"
                >
                  <span>GO TO NEXT EVENT: PRACTICE 2 (FP2)</span>
                  <FastForward className="w-4 h-4" />
                </button>
              )}

              {raceState?.session === 'P2' && (
                <button
                  type="button"
                  onClick={() => radioEngine.advanceSession()}
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white font-racing font-bold text-xs sm:text-sm py-2.5 px-4 rounded-2xl shadow-lg shadow-emerald-950/60 flex items-center gap-2 border border-emerald-400/40"
                  title="Move from Practice 2 to Practice 3"
                >
                  <span>GO TO NEXT EVENT: PRACTICE 3 (FP3)</span>
                  <FastForward className="w-4 h-4" />
                </button>
              )}

              {raceState?.session === 'P3' && (
                <button
                  type="button"
                  onClick={() => radioEngine.advanceSession()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-racing font-bold text-xs sm:text-sm py-2.5 px-4 rounded-2xl shadow-lg shadow-purple-950/60 flex items-center gap-2 border border-purple-400/40"
                  title="Move from Practice 3 to Qualifying Shootout"
                >
                  <span>GO TO NEXT EVENT: QUALIFYING (Q1)</span>
                  <FastForward className="w-4 h-4" />
                </button>
              )}

              {raceState?.session === 'Q1' && (
                <button
                  type="button"
                  onClick={() => radioEngine.advanceSession()}
                  className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-racing font-bold text-xs sm:text-sm py-2.5 px-4 rounded-2xl shadow-lg shadow-red-950/60 flex items-center gap-2 border border-red-400/40"
                  title="Move from Qualifying to Grand Prix Race"
                >
                  <span>GO TO NEXT EVENT: GRAND PRIX RACE</span>
                  <FastForward className="w-4 h-4" />
                </button>
              )}

              {raceState?.session === 'RACE' && (
                <button
                  type="button"
                  onClick={() => radioEngine.advanceSession()}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-black font-racing font-bold text-xs sm:text-sm py-2.5 px-4 rounded-2xl shadow-lg shadow-amber-950/60 flex items-center gap-2 border border-amber-300"
                  title="Conclude Race and move to Podium"
                >
                  <span>ADVANCE TO PODIUM & CEREMONY</span>
                  <Trophy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* SESSION COUNTDOWN TIMER PROMPT & RUNNING DISPLAY */}
          {raceState?.session !== 'RACE' && raceState?.session !== 'PODIUM' && (
            <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  raceState?.sessionTimerRunning
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-400 animate-pulse'
                    : 'bg-zinc-900 border-zinc-800 text-amber-400'
                }`}>
                  <Timer className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      OFFICIAL {raceState?.session === 'Q1' ? 'QUALIFYING' : raceState?.session} SESSION TIMER
                    </span>
                    {raceState?.sessionTimerRunning ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        COUNTDOWN LIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                        TIMER PAUSED / READY TO START
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {raceState?.sessionTimerRunning
                      ? `Official clock running for ${raceState?.session}. Synchronized across all volunteers and livestream.`
                      : `Start the timer for ${raceState?.session} (All practice sessions default to 30 min).`}
                  </p>
                </div>
              </div>

              {/* Time Readout & Controls */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono-racing font-black text-2xl sm:text-3xl text-white tracking-wider">
                    {(() => {
                      const totalSecs = raceState?.sessionRemainingSeconds ?? 1800;
                      const mins = Math.floor(totalSecs / 60);
                      const secs = totalSecs % 60;
                      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    })()}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Remaining ({Math.round((raceState?.sessionRemainingSeconds ?? 1800) / 60)}m)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {!raceState?.sessionTimerRunning ? (
                    <button
                      type="button"
                      onClick={() => radioEngine.startSessionTimer()}
                      className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-racing font-bold text-xs py-2 px-3.5 rounded-xl shadow-md shadow-emerald-950/60 flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>START TIMER</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => radioEngine.pauseSessionTimer()}
                      className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-black font-racing font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>PAUSE</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => radioEngine.resetSessionTimer()}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono py-2 px-2.5 rounded-xl border border-zinc-800"
                    title="Reset to full session duration (30 min for practice)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const current = (raceState?.sessionRemainingSeconds || 1800) + 300;
                      radioEngine.resetSessionTimer(Math.round(current / 60));
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11px] font-mono py-2 px-2 rounded-xl border border-zinc-800"
                    title="Add 5 Minutes"
                  >
                    +5m
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* URGENT TRACK HAZARD ALERT FROM CAMERA MARSHAL */}
        {hazardAlert && (
          <div className="bg-yellow-950/90 border-2 border-yellow-500 rounded-3xl p-5 shadow-2xl shadow-yellow-950/80 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-yellow-500 text-black flex items-center justify-center shrink-0 animate-bounce">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-yellow-400 bg-yellow-950 px-2 py-0.5 rounded border border-yellow-700">
                      ⚠️ CAMERA OPERATOR HAZARD REPORT
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      {hazardAlert.timestamp}
                    </span>
                  </div>
                  <h3 className="font-racing font-bold text-xl text-white mt-1">
                    {hazardAlert.hazardType}: {hazardAlert.location}
                  </h3>
                  <p className="text-xs text-yellow-200/90 mt-0.5">
                    "{hazardAlert.description}" — Reported by <strong>{hazardAlert.operatorName}</strong> ({hazardAlert.cameraName})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setFlag('YELLOW');
                    setHazardAlert(null);
                  }}
                  className="bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-racing font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>DEPLOY YELLOW FLAG</span>
                </button>

                <button
                  onClick={() => {
                    setFlag('SC');
                    setHazardAlert(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-racing font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
                >
                  <Car className="w-4 h-4" />
                  <span>DEPLOY SAFETY CAR</span>
                </button>

                <button
                  onClick={() => setHazardAlert(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono py-2.5 px-3 rounded-xl transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RACE DIRECTOR LIVE RADIO COMMS (TAP TO SPEAK - NOT HOLD) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                <h3 className="font-racing font-bold text-xl text-white">
                  RACE DIRECTOR SPEECH RADIO (TAP TO SPEAK • NOT HOLD)
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Click once to turn Director microphone ON. Click again to stop. Transmits verbal orders and speech transcripts to all drivers, cameras, and streaming broadcast.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                isDirectorMicActive
                  ? 'bg-red-950 text-red-400 border border-red-500 animate-pulse'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isDirectorMicActive ? 'bg-red-500 animate-ping' : 'bg-zinc-600'}`} />
                <span>{isDirectorMicActive ? 'DIRECTOR ON AIR (LIVE)' : 'RADIO STANDBY'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            {/* Big Tap-to-Speak Toggle Button */}
            <div className="lg:col-span-1">
              <button
                type="button"
                onClick={toggleDirectorRadio}
                className={`w-full py-4 px-5 rounded-2xl font-racing font-black text-base tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-xl select-none border-2 active:scale-95 ${
                  isDirectorMicActive
                    ? 'bg-red-600 border-red-400 text-white shadow-red-600/50 animate-pulse'
                    : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-700 text-white'
                }`}
              >
                <Mic className={`w-6 h-6 ${isDirectorMicActive ? 'animate-bounce text-white' : 'text-red-500'}`} />
                <span>{isDirectorMicActive ? 'ON AIR: TAP TO FINISH' : 'TAP TO SPEAK (DIRECTOR MIC)'}</span>
              </button>
            </div>

            {/* Quick Director Tactical Callouts */}
            <div className="lg:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>ONE-TAP VERBAL ORDERS TO DRIVERS & STATIONS:</span>
                {calloutFeedback && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Transmitted: "{calloutFeedback}"
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { text: 'Yellow Flag Sector 2 - No Overtaking', label: 'YELLOW S2' },
                  { text: 'Safety Car Deployed - Maintain Delta', label: 'SC DEPLOY' },
                  { text: 'Track Clear - Racing Resumes', label: 'TRACK CLEAR' },
                  { text: 'Red Flag - All Return to Pit Lane', label: 'RED FLAG - BOX' },
                ].map((item) => (
                  <button
                    key={item.text}
                    onClick={() => sendDirectorCallout(item.text)}
                    className="bg-zinc-950 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-xs font-mono text-zinc-200 py-2.5 px-2 rounded-xl transition-colors text-center"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RACE DISTANCE & TOTAL LAPS CONTROLLER */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <Gauge className="w-4 h-4" />
              <span>RACE DISTANCE CONFIGURATION</span>
            </div>
            <h2 className="font-racing font-bold text-xl text-white mt-0.5">
              Total Race Laps: <span className="text-amber-400 font-mono">{raceState?.totalLaps || 12} Laps</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Change the number of laps in the race. Updates the race distance across all timing screens and driver cockpits immediately.
            </p>
          </div>

          {/* Lap Presets & Direct Input */}
          <div className="flex flex-wrap items-center gap-2">
            {[5, 8, 10, 12, 15, 20].map((laps) => (
              <button
                key={laps}
                onClick={() => handleUpdateTotalLaps(laps)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  raceState?.totalLaps === laps
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {laps} LAPS
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-2 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800">
              <span className="text-xs font-mono text-zinc-500">CUSTOM:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={customLapsInput}
                onChange={(e) => setCustomLapsInput(e.target.value)}
                onBlur={() => handleUpdateTotalLaps(parseInt(customLapsInput, 10) || 12)}
                className="w-14 bg-zinc-900 text-white font-mono text-xs text-center px-1 py-0.5 rounded border border-zinc-700 focus:outline-none"
              />
              <button
                onClick={() => handleUpdateTotalLaps(parseInt(customLapsInput, 10) || 12)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-2 py-0.5 rounded font-racing font-bold"
              >
                SET
              </button>
            </div>
          </div>
        </div>

        {/* 5-RED-LIGHTS OFFICIAL F1 START GANTRY */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-zinc-400">
                OFFICIAL START SYSTEM
              </div>
              <h2 className="font-racing font-bold text-xl text-white">
                FIA 5 Red Lights Launch Sequence
              </h2>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
              {lightsRunning ? 'SEQUENCE RUNNING' : 'STANDBY'}
            </span>
          </div>

          {/* Gantry Display */}
          <div className="bg-black/90 border-4 border-zinc-800 rounded-3xl p-6 my-4 shadow-inner flex flex-col items-center justify-center">
            <div className="grid grid-cols-5 gap-3 md:gap-8 max-w-2xl w-full">
              {Array.from({ length: 5 }).map((_, index) => {
                const isLit = index < activeLightCount;
                return (
                  <div
                    key={index}
                    className="bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-2 md:p-4 flex flex-col items-center gap-2 shadow-lg"
                  >
                    <div
                      className={`w-10 h-10 md:w-16 md:h-16 rounded-full transition-all duration-100 border-2 ${
                        isLit
                          ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/80 scale-105 f1-red-active'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    />
                    <div
                      className={`w-10 h-10 md:w-16 md:h-16 rounded-full transition-all duration-100 border-2 ${
                        isLit
                          ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/80 scale-105 f1-red-active'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 font-racing font-bold text-lg md:text-xl text-center">
              {lightsRunning ? (
                <span className="text-red-400 tracking-wider animate-pulse">
                  PREPARE FOR RACE START... LIGHTS ARMED
                </span>
              ) : activeLightCount === 0 && raceState?.flagStatus === 'GREEN' ? (
                <span className="text-emerald-400 tracking-wider">
                  LIGHTS OUT AND AWAY WE GO! RACE IS LIVE!
                </span>
              ) : (
                <span className="text-zinc-500 tracking-wider">
                  PRESS BELOW TO TRIGGER 5-LIGHT START SEQUENCE
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={triggerStartSequence}
              disabled={lightsRunning}
              className={`font-racing font-bold text-base px-8 py-3.5 rounded-2xl transition-all shadow-xl flex items-center gap-2 ${
                lightsRunning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50 hover:scale-102 active:scale-98'
              }`}
            >
              <Zap className="w-5 h-5" />
              <span>START 5 RED LIGHTS SEQUENCE</span>
            </button>
          </div>
        </div>

        {/* Flag Marshaling & Session Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Flag Station: Triggers 4-second urgent window for all volunteer phones */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-yellow-400" />
                <span>OFFICIAL FLAG CONTROLS</span>
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                CURRENT: {raceState?.flagStatus}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Triggering Yellow/Red/SC pops up an <strong>urgent 4-second screen alert</strong> on every volunteer phone automatically!
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => setFlag('GREEN')}
                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500" />
                <span>GREEN FLAG</span>
                <span className="text-[10px] text-emerald-400 font-mono">TRACK CLEAR</span>
              </button>

              <button
                onClick={() => setFlag('YELLOW')}
                className="bg-yellow-950 hover:bg-yellow-900 border-2 border-yellow-400 text-yellow-200 p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all shadow-lg shadow-yellow-950/40"
              >
                <div className="w-4 h-4 rounded-full bg-yellow-400 animate-ping" />
                <span>YELLOW FLAG</span>
                <span className="text-[10px] text-yellow-400 font-mono">BROADCAST 4s POPUP</span>
              </button>

              <button
                onClick={() => setFlag('RED')}
                className="bg-red-950 hover:bg-red-900 border border-red-600/50 text-red-200 p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <div className="w-4 h-4 rounded-full bg-red-600" />
                <span>RED FLAG</span>
                <span className="text-[10px] text-red-400 font-mono">STOP SESSION</span>
              </button>

              <button
                onClick={() => setFlag('SC')}
                className="bg-amber-950 hover:bg-amber-900 border border-amber-600/50 text-amber-200 p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <Car className="w-4 h-4 text-amber-400" />
                <span>SAFETY CAR</span>
                <span className="text-[10px] text-amber-400 font-mono">DEPLOY SC</span>
              </button>

              <button
                onClick={() => setFlag('VSC')}
                className="bg-orange-950 hover:bg-orange-900 border border-orange-600/50 text-orange-200 p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <AlertOctagon className="w-4 h-4 text-orange-400" />
                <span>VSC</span>
                <span className="text-[10px] text-orange-400 font-mono">VIRTUAL SC</span>
              </button>

              <button
                onClick={() => setFlag('CHEQUERED')}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white p-3 rounded-2xl font-racing font-bold text-sm text-center flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <Flag className="w-4 h-4 text-white" />
                <span>CHEQUERED</span>
                <span className="text-[10px] text-zinc-300 font-mono">RACE FINISH</span>
              </button>
            </div>
          </div>

          {/* Session Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                <Timer className="w-5 h-5 text-cyan-400" />
                <span>WEEKEND SESSION SELECTOR</span>
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                ACTIVE: {raceState?.session}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'P1', title: 'P1 (PRACTICE 1)', desc: 'Track & Radio Check' },
                { id: 'P2', title: 'P2 (PRACTICE 2)', desc: 'Pace & Sector Setup' },
                { id: 'P3', title: 'P3 (PRACTICE 3)', desc: 'Final Practice Run' },
                { id: 'Q1', title: 'Q1 (QUALIFYING)', desc: '1-Lap Flying Shootout' },
                { id: 'RACE', title: 'GRAND PRIX RACE', desc: 'Main Race with Pit Stops' },
                { id: 'PODIUM', title: 'PODIUM & CEREMONY', desc: 'Anthem & Trophies' },
              ].map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => setSession(sess.id as any)}
                  className={`p-3 rounded-2xl text-left border transition-all active:scale-95 ${
                    raceState?.session === sess.id
                      ? 'bg-red-950/70 border-red-500 text-white shadow-lg shadow-red-950/40'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-racing font-bold text-sm text-white">
                    {sess.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {sess.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEWARDS LIVE RADIO INTERCEPT & TRANSCRIPTS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-emerald-400" />
              <span>STEWARDS RADIO INTERCEPT • LIVE CONVERSATION TRANSCRIPTS</span>
            </h3>
            <span className="text-xs font-mono text-zinc-400">
              {raceState?.transcripts?.length || 0} TOTAL MESSAGES
            </span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
            {(!raceState?.transcripts || raceState.transcripts.length === 0) ? (
              <div className="text-center py-4 text-xs font-mono text-zinc-500">
                No team radio dialogue recorded yet. As drivers and engineers speak via PTT or tactical buttons, transcripts appear here.
              </div>
            ) : (
              raceState.transcripts.map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-xs font-mono bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/80">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-black shrink-0"
                    style={{ backgroundColor: t.teamColor || '#38bdf8' }}
                  >
                    #{t.driverNumber} {t.senderRole.toUpperCase()}
                  </span>
                  <span className="text-zinc-400 text-[11px] shrink-0">{t.timestamp}</span>
                  <span className="text-zinc-200">"{t.transcript}"</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DRIVER GRID MANAGEMENT: ADD, REMOVE, OR CHANGE DRIVER NAMES */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-racing font-bold text-xl text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>MANAGE RACE DRIVERS (ADD, REMOVE, CHANGE NAMES)</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Edit any rider's name, bike number, team, or remove them from the grid.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300">
              {raceState?.drivers.length || 0} REGISTERED DRIVERS
            </span>
          </div>

          {/* Drivers Grid Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {raceState?.drivers.map((driver, index) => {
              const isEditing = editingDriverId === driver.id;

              return (
                <div
                  key={driver.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between"
                >
                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                        EDITING DRIVER
                      </div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Driver Name"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          placeholder="Number"
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editTeam}
                          onChange={(e) => setEditTeam(e.target.value)}
                          placeholder="Team / Wing"
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={editBike}
                        onChange={(e) => setEditBike(e.target.value)}
                        placeholder="Bike Type (e.g. Aero Road, MTB)"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveDriverEdit(driver.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-racing font-bold text-xs py-1.5 rounded-lg flex items-center justify-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>SAVE CHANGES</span>
                        </button>
                        <button
                          onClick={() => setEditingDriverId(null)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2.5 py-1.5 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-mono-racing font-black text-lg text-black shrink-0"
                            style={{ backgroundColor: driver.color }}
                          >
                            #{driver.number}
                          </div>
                          <div>
                            <div className="font-racing font-bold text-base text-white">
                              {driver.name}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {driver.team}
                            </div>
                            <div className="text-[10px] font-mono text-amber-400">
                              {driver.bikeType}
                            </div>
                          </div>
                        </div>

                        {/* Edit & Remove Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditingDriver(driver)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white"
                            title="Edit Driver Name / Number"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                          <button
                            onClick={() => handleRemoveDriver(driver.id, driver.name)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-red-400"
                            title="Remove Driver"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Lap stats & Remove Lap button */}
                      <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mb-2 bg-zinc-900/60 p-2 rounded-xl">
                        <div>
                          <span>LAPS: <strong className="text-white text-sm">{driver.lapsCompleted}</strong></span>
                          <span className="mx-1.5 text-zinc-600">•</span>
                          <span>BEST: <strong className="text-purple-400">{driver.bestLapTime ? `${driver.bestLapTime.toFixed(2)}s` : '--'}</strong></span>
                        </div>
                        {driver.lapsCompleted > 0 && (
                          <button
                            onClick={() => handleRemoveDriverLap(driver.id)}
                            className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                            title="Remove last recorded lap time for this rider"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>REMOVE LAP</span>
                          </button>
                        )}
                      </div>

                      {/* Sector Splits (🟣 PURPLE: FASTEST • 🟢 GREEN: PERSONAL BEST • 🟡 YELLOW: SLOWER) */}
                      {(() => {
                        const bests = computeSessionSectorBests(raceState);
                        const s1Status = getSectorColorStatus(1, driver.s1, driver.id, bests);
                        const s2Status = getSectorColorStatus(2, driver.s2, driver.id, bests);
                        const s3Status = getSectorColorStatus(3, driver.s3, driver.id, bests);
                        const s1Style = getSectorBadgeStyles(s1Status);
                        const s2Style = getSectorBadgeStyles(s2Status);
                        const s3Style = getSectorBadgeStyles(s3Status);

                        return (
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono mb-3">
                            <div className={`p-1.5 rounded-lg border ${s1Style.bg} ${s1Style.border} ${s1Style.text}`}>
                              <span className="text-[9px] text-zinc-400 block">S1</span>
                              <span>{driver.s1 ? `${driver.s1.toFixed(2)}s` : '--'}</span>
                            </div>
                            <div className={`p-1.5 rounded-lg border ${s2Style.bg} ${s2Style.border} ${s2Style.text}`}>
                              <span className="text-[9px] text-zinc-400 block">S2</span>
                              <span>{driver.s2 ? `${driver.s2.toFixed(2)}s` : '--'}</span>
                            </div>
                            <div className={`p-1.5 rounded-lg border ${s3Style.bg} ${s3Style.border} ${s3Style.text}`}>
                              <span className="text-[9px] text-zinc-400 block">S3</span>
                              <span>{driver.s3 ? `${driver.s3.toFixed(2)}s` : '--'}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Driver Actions: Cross line (count lap), Overtake, Pitted (tell stream), Penalty */}
                      <div className="space-y-1.5">
                        {driver.status === 'FINISHED' || (raceState?.session === 'RACE' && driver.lapsCompleted >= (raceState?.totalLaps || 12)) ? (
                          <div className="w-full bg-zinc-800 text-amber-400 font-racing font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-zinc-700 select-none">
                            <span>🏁 CHEQUERED FLAG (FINISHED)</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => radioEngine.recordFinishLinePass(driver.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-racing font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>🏁 CROSS FINISH LINE (COUNT LAP)</span>
                          </button>
                        )}

                        {/* Overtake trigger (ONLY in RACE session, removed in Practice and Qualifying) */}
                        {raceState?.session === 'RACE' && index > 0 && driver.status !== 'FINISHED' && (
                          <button
                            onClick={() => radioEngine.overtakeDriver(driver.id, 'Chicane / Straight')}
                            className="w-full bg-cyan-700 hover:bg-cyan-600 active:scale-95 text-white font-racing font-bold text-xs py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 shadow-sm"
                            title={`Click when #${driver.number} ${driver.name} passes the rider ahead on track`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>▲ OVERTAKE (PASS CAR AHEAD)</span>
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => radioEngine.markDriverPitted(driver.id)}
                            className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-black font-racing font-bold text-xs py-2 px-2 rounded-xl flex items-center justify-center gap-1 shadow-md"
                          >
                            <span>🟡 PITTED (TELL STREAM)</span>
                          </button>

                          <button
                            onClick={() => issuePenalty(driver.id, 'Track Limits / Cutting')}
                            className="bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-yellow-300 font-mono text-xs py-2 px-2 rounded-xl border border-zinc-800 flex items-center justify-center gap-1"
                          >
                            <span>+5s PENALTY</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Driver Form */}
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 mt-4">
            <h4 className="font-racing font-bold text-sm text-white mb-2 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-red-500" />
              <span>REGISTER NEW DRIVER ON GRID</span>
            </h4>

            <form onSubmit={handleAddDriver} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Rider Name (e.g. Samarth)"
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 sm:col-span-2"
                required
              />
              <input
                type="number"
                placeholder="Bike #"
                value={newDriverNumber}
                onChange={(e) => setNewDriverNumber(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <input
                type="text"
                placeholder="Team / Wing"
                value={newDriverTeam}
                onChange={(e) => setNewDriverTeam(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-red-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>ADD DRIVER</span>
              </button>
            </form>
          </div>
        </div>

        {/* OFFICIAL LAP TIMING LOG & RECORDED LAP TIMES (REMOVE / INVALIDATE) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-racing font-bold text-xl text-white flex items-center gap-2">
                <Timer className="w-5 h-5 text-purple-400" />
                <span>OFFICIAL LAP TIMINGS LOG • REMOVE / INVALIDATE LAP TIMES</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Race Director authority: Remove or delete any inaccurate, cutting, or disputed lap times from the official record.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300">
              {raceState?.lapHistory?.length || 0} RECORDED LAPS
            </span>
          </div>

          {(!raceState?.lapHistory || raceState.lapHistory.length === 0) ? (
            <div className="text-center py-6 text-xs font-mono text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-800/80">
              No laps recorded yet. As drivers cross the finish line, their split sector times and lap times will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800 text-left">
                    <th className="py-2 px-3">LAP #</th>
                    <th className="py-2 px-3">DRIVER</th>
                    <th className="py-2 px-3">TEAM</th>
                    <th className="py-2 px-3">LAP TIME</th>
                    <th className="py-2 px-3 hidden sm:table-cell">S1</th>
                    <th className="py-2 px-3 hidden sm:table-cell">S2</th>
                    <th className="py-2 px-3 hidden sm:table-cell">S3</th>
                    <th className="py-2 px-3 text-right">DIRECTOR ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {raceState.lapHistory.slice(0, 15).map((lap) => (
                    <tr key={lap.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white">
                        L{lap.lapNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] text-black shrink-0"
                            style={{ backgroundColor: lap.teamColor }}
                          >
                            #{lap.driverNumber}
                          </span>
                          <span className="font-racing font-bold text-white text-xs">
                            {lap.driverName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {lap.team}
                      </td>
                      <td className="py-2.5 px-3 font-mono-racing font-bold text-sm text-purple-300">
                        {lap.lapTimeSec.toFixed(3)}s
                        {lap.isFastestLap && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                            FASTEST
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 hidden sm:table-cell">
                        {lap.s1 ? `${lap.s1.toFixed(2)}s` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 hidden sm:table-cell">
                        {lap.s2 ? `${lap.s2.toFixed(2)}s` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 hidden sm:table-cell">
                        {lap.s3 ? `${lap.s3.toFixed(2)}s` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveDriverLap(lap.driverId, lap.id)}
                          className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-red-300 text-[11px] font-mono px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-all active:scale-95"
                          title="Remove this invalid lap time"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>REMOVE TIME</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
