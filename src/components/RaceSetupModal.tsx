import React, { useState } from 'react';
import {
  Flag,
  Play,
  RotateCcw,
  Trophy,
  Zap,
  Car,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Users,
  Upload,
  Camera,
  Trash2,
  Plus,
  Sparkles,
  Activity,
  Timer
} from 'lucide-react';
import { radioEngine, RaceState, DriverState } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';

interface RaceSetupModalProps {
  raceState: RaceState | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DriverSetupItem {
  id: string;
  name: string;
  number: number;
  team: string;
  bikeType: string;
  color: string;
  photoUrl?: string;
}

const PRESET_COLORS = ['#3671C6', '#E80020', '#FF8000', '#27F4D2', '#229971', '#900000', '#52E252', '#38bdf8'];

export const RaceSetupModal: React.FC<RaceSetupModalProps> = ({
  raceState,
  isOpen,
  onClose,
}) => {
  // Step 1: 'CHOICE' (Continue vs Make New)
  // Step 2: 'MODE' (Actual Race vs Testing Race)
  // Step 3: 'ACTUAL_CONFIG' (Full Weekend vs Quick Race + Race Name)
  // Step 4: 'DRIVERS_SETUP' (Driver & Team names + photo upload)
  // Step 5: 'START_POPUP' (Pop up box saying Practice 1 starts)
  const [step, setStep] = useState<'CHOICE' | 'MODE' | 'ACTUAL_CONFIG' | 'DRIVERS_SETUP' | 'START_POPUP'>('CHOICE');

  // Configuration form state
  const [raceName, setRaceName] = useState<string>('Metro Jazz Grand Prix');
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [raceFormat, setRaceFormat] = useState<'FULL_WEEKEND' | 'QUICK_RACE' | 'TEST'>('FULL_WEEKEND');
  const [totalLaps, setTotalLaps] = useState<number>(12);
  const [practiceDurationMinutes, setPracticeDurationMinutes] = useState<number>(30);
  const [qualifyingDurationMinutes, setQualifyingDurationMinutes] = useState<number>(15);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // Drivers setup state
  const [drivers, setDrivers] = useState<DriverSetupItem[]>(() => {
    if (raceState?.drivers && raceState.drivers.length > 0) {
      return raceState.drivers.map(d => ({
        id: d.id,
        name: d.name,
        number: d.number,
        team: d.team,
        bikeType: d.bikeType,
        color: d.color,
        photoUrl: d.photoUrl,
      }));
    }
    return [];
  });

  if (!isOpen) return null;

  const handleContinueExisting = () => {
    soundEffects.playRadioChirp();
    onClose();
  };

  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setDrivers(prev => {
        const next = [...prev];
        next[index] = { ...next[index], photoUrl: dataUrl };
        return next;
      });
      soundEffects.playRadioChirp();
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    setDrivers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], photoUrl: undefined };
      return next;
    });
  };

  const updateDriverField = (index: number, field: keyof DriverSetupItem, value: any) => {
    setDrivers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddDriver = () => {
    soundEffects.playRadioChirp();
    const newIdx = drivers.length + 1;
    const newDriver: DriverSetupItem = {
      id: `team-custom-${Date.now()}`,
      name: `Rider ${newIdx}`,
      number: newIdx * 7,
      team: `Wing ${String.fromCharCode(64 + newIdx)} Racing`,
      bikeType: 'Road Bike',
      color: PRESET_COLORS[(newIdx - 1) % PRESET_COLORS.length],
    };
    setDrivers(prev => [...prev, newDriver]);
  };

  const handleRemoveDriver = (index: number) => {
    if (drivers.length <= 1) return;
    soundEffects.playRadioChirp();
    setDrivers(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinishLaunch = () => {
    if (drivers.length === 0 || drivers.some(d => !d.name.trim() || !d.team.trim())) {
      setBlockedMessage('Add at least one driver and complete every driver/team name before launching.');
      setStep('DRIVERS_SETUP');
      return;
    }
    soundEffects.playFastestLapFanfare();
    const finalName = raceName.trim() || (isTestMode ? 'Metro Jazz Free Test' : 'Metro Jazz Grand Prix');
    radioEngine.createNewRace({
      raceName: finalName,
      isTestMode,
      format: raceFormat,
      totalLaps,
      drivers,
      practiceDurationMinutes,
      qualifyingDurationMinutes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-cyan-500" />

        {/* STEP 1: Continue Existing vs Make New */}
        {step === 'CHOICE' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-red-500 font-bold">
                FIA RACE DIRECTOR COMMAND CENTER
              </span>
              <h2 className="font-racing font-bold text-2xl sm:text-3xl text-white">
                Race Session Setup
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Would you like to resume the currently active session or initiate a new race event?
              </p>
              {blockedMessage && (
                <div className="bg-amber-950/60 border border-amber-700 text-amber-200 text-xs font-mono rounded-xl px-3 py-2 max-w-lg mx-auto">
                  {blockedMessage}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Continue Current Race */}
              <div
                onClick={handleContinueExisting}
                className="bg-zinc-900/90 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-emerald-500 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 ml-0.5" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                      ACTIVE SESSION
                    </span>
                  </div>
                  <h3 className="font-racing font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                    Continue Existing Race
                  </h3>
                  <div className="mt-2 space-y-1 text-xs text-zinc-400 font-mono">
                    <div>Race: <strong className="text-white">{raceState?.raceName || 'Metro Jazz Grand Prix'}</strong></div>
                    <div>Track: <span className="text-cyan-400">{raceState?.circuitName || 'Metro Jazz Circuit'}</span></div>
                    <div>Session: <span className="text-amber-400">{raceState?.session || 'P1'}</span> • Lap: <span className="text-white">{raceState?.currentLap || 1}/{raceState?.totalLaps || 12}</span></div>
                    {raceState?.isTestMode && (
                      <div className="text-amber-400 text-[11px] font-bold">🟡 Mode: Free Test Session</div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-racing font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <span>Resume Race Control</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option 2: Make a New One */}
              <div
                onClick={() => {
                  if (raceState?.raceStatus === 'ACTIVE') {
                    setBlockedMessage('The current race must finish before you can create another race.');
                    return;
                  }
                  soundEffects.playRadioChirp();
                  setStep('MODE');
                }}
                className="bg-zinc-900/90 hover:bg-zinc-900 border-2 border-zinc-800 hover:border-red-500 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                      <RotateCcw className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950 text-red-300 font-bold border border-red-800">
                      NEW SETUP
                    </span>
                  </div>
                  <h3 className="font-racing font-bold text-lg text-white group-hover:text-red-400 transition-colors">
                    Make a New Race
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Start a brand new race event. Set up drivers and teams, upload driver photos, choose weekend format on Metro Jazz Circuit.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <span>{raceState?.raceStatus === 'ACTIVE' ? 'Finish Current Race First' : 'Configure New Race'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Actual Race vs Testing Race */}
        {step === 'MODE' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-red-500 font-bold">
                STEP 1 OF 3 • RACE PURPOSE
              </span>
              <h2 className="font-racing font-bold text-2xl sm:text-3xl text-white">
                Actual Race or Testing Race?
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Decide whether this is an official competitive race or a free test run.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Actual Race */}
              <div
                onClick={() => {
                  soundEffects.playRadioChirp();
                  setIsTestMode(false);
                  setRaceFormat('FULL_WEEKEND');
                  setStep('ACTUAL_CONFIG');
                }}
                className="bg-zinc-900 border-2 border-zinc-800 hover:border-red-500 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                      <Trophy className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950 text-red-300 font-bold border border-red-800">
                      OFFICIAL GP
                    </span>
                  </div>
                  <h3 className="font-racing font-bold text-lg text-white group-hover:text-red-400 transition-colors">
                    Actual Race
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Official Grand Prix competition. Results, fastest laps, sector split times, and championship standings are officially recorded with podium celebration.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <span>Select Actual Race</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option B: Testing Race */}
              <div
                onClick={() => {
                  soundEffects.playRadioChirp();
                  setIsTestMode(true);
                  setRaceFormat('TEST');
                  setRaceName('Metro Jazz Free Test');
                  setStep('DRIVERS_SETUP');
                }}
                className="bg-zinc-900 border-2 border-zinc-800 hover:border-amber-500 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-700 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-800">
                      FREE TEST MODE
                    </span>
                  </div>
                  <h3 className="font-racing font-bold text-lg text-white group-hover:text-amber-400 transition-colors">
                    Testing Race
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Acts as <strong>normal mode</strong> with live stopwatch, 5 red lights launch, flags, speech radio, and telemetry, <strong>but the race is NOT saved</strong> to official championship history.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-black font-racing font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors"
                >
                  <span>Configure Testing Drivers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-zinc-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Session Choice</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Actual Race Format & Race Name */}
        {step === 'ACTUAL_CONFIG' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-red-500 font-bold">
                STEP 2 OF 3 • ACTUAL RACE FORMAT
              </span>
              <h2 className="font-racing font-bold text-2xl sm:text-3xl text-white">
                Weekend Format & Race Name
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Choose full race weekend (P1, P2, P3, Q1, Race) or quick direct race.
              </p>
            </div>

            <div className="space-y-4">
              {/* Format Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setRaceFormat('FULL_WEEKEND')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    raceFormat === 'FULL_WEEKEND'
                      ? 'bg-zinc-900 border-red-500 shadow-lg shadow-red-950/40 ring-1 ring-red-500/50'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-racing font-bold text-base text-white">
                      Full Weekend
                    </span>
                    <span className="text-xs font-mono text-cyan-400">P1 ➔ P2 ➔ P3 ➔ Q1 ➔ RACE</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Complete motorsport experience: Free Practice 1, 2, 3, Qualifying shootout, then Grand Prix with winner podium.
                  </p>
                </div>

                <div
                  onClick={() => setRaceFormat('QUICK_RACE')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    raceFormat === 'QUICK_RACE'
                      ? 'bg-zinc-900 border-red-500 shadow-lg shadow-red-950/40 ring-1 ring-red-500/50'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-racing font-bold text-base text-white">
                      Quick Race
                    </span>
                    <span className="text-xs font-mono text-amber-400">DIRECT GRID START</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Skip practice and qualifying. Starts directly on the starting grid with 5 Red Lights Launch sequence!
                  </p>
                </div>
              </div>

              {/* Race Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-300 font-bold flex items-center justify-between">
                  <span>ENTER RACE NAME</span>
                  <span className="text-zinc-500 font-normal">e.g. Metro Jazz Grand Prix</span>
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="Metro Jazz Grand Prix"
                  className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-red-500 text-white font-racing font-bold text-lg py-2.5 px-4 rounded-xl outline-none shadow-inner transition-colors"
                />
              </div>

              {/* Total Laps Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-300 font-bold flex items-center justify-between">
                  <span>TOTAL RACE LAPS</span>
                  <span className="text-zinc-500 font-normal">1 to 50 laps</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={totalLaps}
                    onChange={(e) => setTotalLaps(Math.max(1, parseInt(e.target.value, 10) || 12))}
                    className="w-28 bg-zinc-900 border-2 border-zinc-800 focus:border-red-500 text-center text-white font-mono-racing font-bold text-lg py-2 rounded-xl outline-none shadow-inner"
                  />
                  <div className="flex gap-2">
                    {[5, 10, 12, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTotalLaps(num)}
                        className={`text-xs font-mono px-2.5 py-2 rounded-lg border transition-colors ${
                          totalLaps === num
                            ? 'bg-red-600 text-white border-red-500 font-bold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {num} Laps
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Practice Session Timer Setting (Default 30 Min or Customizable) */}
              {raceFormat === 'FULL_WEEKEND' && (
                <div className="space-y-1.5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5">
                  <label className="text-xs font-mono text-zinc-300 font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Timer className="w-3.5 h-3.5" />
                      <span>PRACTICE SESSION DURATION (P1, P2, P3)</span>
                    </span>
                    <span className="text-zinc-400 font-normal">Default 30 min</span>
                  </label>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    All practice sessions are set to 30 min by default, or you can adjust the clock here.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={practiceDurationMinutes}
                        onChange={(e) => setPracticeDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 30))}
                        className="w-14 bg-transparent text-center text-white font-mono-racing font-bold text-sm outline-none"
                      />
                      <span className="text-xs font-mono text-zinc-500">min</span>
                    </div>

                    {[15, 20, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setPracticeDurationMinutes(mins)}
                        className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                          practiceDurationMinutes === mins
                            ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Simplified Circuit & Corner Blueprint Banner */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">CIRCUIT BLUEPRINT:</span>
                  <span className="text-red-400 font-bold">Metro Jazz Circuit</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Corners: <span className="text-zinc-200">Finish Straight • Corner 1 • Corner 2 • Corner 3 • Corner 4</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('MODE')}
                className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-zinc-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.playRadioChirp();
                  setStep('DRIVERS_SETUP');
                }}
                className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-racing font-bold text-sm py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-red-950/60 transition-all"
              >
                <span>Configure Drivers & Teams</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DRIVERS & TEAMS SETUP + PHOTO UPLOAD */}
        {step === 'DRIVERS_SETUP' && (
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="text-center space-y-1 shrink-0">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                STEP 3 OF 3 • DRIVERS & TEAMS REGISTRATION
              </span>
              <h2 className="font-racing font-bold text-2xl sm:text-3xl text-white">
                Roster & Driver Photo Upload
              </h2>
              <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                Type driver names and teams, and <strong>upload driver pictures</strong> to show in the streaming window and winner celebration.
              </p>
            </div>

            {/* Drivers scrollable container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[46vh]">
              {drivers.map((drv, idx) => (
                <div
                  key={drv.id}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5"
                >
                  {/* Photo Upload / Avatar Card */}
                  <div className="relative group shrink-0">
                    <div
                      className="w-16 h-16 rounded-2xl border-2 flex items-center justify-center overflow-hidden bg-zinc-950 shadow-md relative"
                      style={{ borderColor: drv.color }}
                    >
                      {drv.photoUrl ? (
                        <img
                          src={drv.photoUrl}
                          alt={drv.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-1">
                          <span className="font-mono-racing font-bold text-lg text-white">
                            #{drv.number}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">NO PIC</span>
                        </div>
                      )}

                      {/* Hover Upload Overlay */}
                      <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-mono">
                        <Camera className="w-4 h-4 mb-0.5 text-cyan-400" />
                        <span>UPLOAD</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(idx, e)}
                        />
                      </label>
                    </div>

                    {drv.photoUrl && (
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow text-[10px]"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Driver & Team Inputs */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">
                        DRIVER NAME
                      </label>
                      <input
                        type="text"
                        value={drv.name}
                        onChange={(e) => updateDriverField(idx, 'name', e.target.value)}
                        placeholder="Driver Name"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-racing font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">
                        TEAM / WING
                      </label>
                      <input
                        type="text"
                        value={drv.team}
                        onChange={(e) => updateDriverField(idx, 'team', e.target.value)}
                        placeholder="Team Name"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">
                          NUMBER
                        </label>
                        <input
                          type="number"
                          value={drv.number}
                          onChange={(e) => updateDriverField(idx, 'number', parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-center text-white font-mono-racing font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">
                          TEAM COLOR
                        </label>
                        <div className="flex items-center gap-1">
                          {PRESET_COLORS.slice(0, 5).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateDriverField(idx, 'color', c)}
                              className={`w-5 h-5 rounded-full border transition-transform ${
                                drv.color === c ? 'scale-125 border-white ring-1 ring-white' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      {drivers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDriver(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors mt-3"
                          title="Remove rider"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {blockedMessage && (
              <div className="bg-amber-950/60 border border-amber-700 text-amber-200 text-xs font-mono rounded-xl px-3 py-2">{blockedMessage}</div>
            )}

            {/* Add Driver & Action Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={handleAddDriver}
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Another Driver</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setStep(isTestMode ? 'MODE' : 'ACTUAL_CONFIG')}
                  className="flex-1 sm:flex-initial text-xs font-mono text-zinc-400 hover:text-white px-3 py-2 rounded-xl hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (drivers.length === 0 || drivers.some(d => !d.name.trim() || !d.team.trim())) {
                      setBlockedMessage('Add at least one driver and complete every driver/team name before launch.');
                      return;
                    }
                    soundEffects.playRadioChirp();
                    setStep('START_POPUP');
                  }}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-racing font-bold text-sm py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 transition-all"
                >
                  <span>Ready to Launch</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: POP-UP BOX SAYING PRACTICE 1 STARTS */}
        {step === 'START_POPUP' && (
          <div className="space-y-6 text-center py-2 animate-in fade-in zoom-in-95 duration-300">
            {/* Session Icon / Badge */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-3xl bg-emerald-950/80 border-2 border-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-950/60 animate-bounce">
                <Flag className="w-10 h-10 text-emerald-400" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 inline-block">
                OFFICIAL WEEKEND COMMENCING
              </span>
              <h2 className="font-racing font-black text-3xl sm:text-4xl text-white tracking-wide">
                {raceFormat === 'QUICK_RACE' ? 'GRAND PRIX RACE STARTS NOW' : 'PRACTICE 1 STARTS NOW'}
              </h2>
              <p className="text-sm text-zinc-300 max-w-md mx-auto">
                Welcome to <strong>{raceName || 'Metro Jazz Grand Prix'}</strong> on Metro Jazz Circuit.
              </p>
            </div>

            {/* Weekend Schedule Progress Indicator */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 max-w-lg mx-auto space-y-3">
              <div className="text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>WEEKEND PROGRESSION:</span>
                <span className="text-emerald-400">SESSION 1 ACTIVE</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 text-center">
                <div className="bg-emerald-600 border border-emerald-400 text-white rounded-xl p-2 font-racing font-bold text-xs shadow-md shadow-emerald-950">
                  <span className="block text-[10px] opacity-80">STEP 1</span>
                  <span>{raceFormat === 'QUICK_RACE' ? 'RACE' : 'P1'}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-xl p-2 font-racing text-xs">
                  <span className="block text-[10px] opacity-60">STEP 2</span>
                  <span>{raceFormat === 'QUICK_RACE' ? '—' : 'P2'}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-xl p-2 font-racing text-xs">
                  <span className="block text-[10px] opacity-60">STEP 3</span>
                  <span>{raceFormat === 'QUICK_RACE' ? '—' : 'P3'}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-xl p-2 font-racing text-xs">
                  <span className="block text-[10px] opacity-60">STEP 4</span>
                  <span>{raceFormat === 'QUICK_RACE' ? '—' : 'Q1'}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-xl p-2 font-racing text-xs">
                  <span className="block text-[10px] opacity-60">STEP 5</span>
                  <span>RACE</span>
                </div>
              </div>

              {/* Registered drivers summary with photos */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-center gap-2">
                <span className="text-xs font-mono text-zinc-400">Registered Riders:</span>
                <div className="flex -space-x-2 overflow-hidden">
                  {drivers.slice(0, 6).map((d) => (
                    <div
                      key={d.id}
                      className="w-7 h-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] font-mono-racing font-bold text-white overflow-hidden"
                      style={{ backgroundColor: d.color }}
                      title={d.name}
                    >
                      {d.photoUrl ? (
                        <img src={d.photoUrl} alt={d.name} className="w-full h-full object-cover" />
                      ) : (
                        `#${d.number}`
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-mono text-zinc-400 font-bold">
                  {drivers.length} Drivers Primed
                </span>
              </div>
            </div>

            {/* Launch Action */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('DRIVERS_SETUP')}
                className="w-full sm:w-auto text-xs font-mono text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Roster</span>
              </button>

              <button
                type="button"
                onClick={handleFinishLaunch}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-racing font-bold text-base py-3.5 px-8 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/80 transition-all border border-emerald-400/40"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {raceFormat === 'QUICK_RACE' ? 'START GRAND PRIX' : 'BEGIN PRACTICE 1'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
