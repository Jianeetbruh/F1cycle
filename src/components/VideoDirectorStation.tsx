import React, { useState, useEffect } from 'react';
import {
  Video,
  Tv,
  Layers,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Mic,
  Send,
  Trash2,
  Sparkles,
  Play,
  Lock,
  Trophy,
  Flag,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { radioEngine, RaceState, RadioTranscript, CameraAngle } from '../services/radioEngine';
import { SmoothVideoCanvas } from './SmoothVideoCanvas';
import { securityEngine } from '../utils/security';
import { webrtcVideoEngine } from '../services/webrtcVideoEngine';
import { PasscodeLockModal } from './PasscodeLockModal';

export const VideoDirectorStation: React.FC = () => {
  // Official security passcode protection for Video Director desk
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isStationUnlocked('director'));
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [manualNote, setManualNote] = useState<string>('');
  const [customRadioText, setCustomRadioText] = useState<string>('');

  useEffect(() => {
    if (!isUnlocked) return;

    radioEngine.connect('societygp', 'director', '', 'Broadcast Video Director');
    const unsub = radioEngine.onRaceState(setRaceState);

    return () => {
      unsub();
    };
  }, [isUnlocked]);

  const production = raceState?.production || {
    activeCameraId: 'cam-1',
    showTimerOverlay: true,
    showRadioOverlay: true,
    showTowerOverlay: true,
    showTelemetryOverlay: true,
    directorNote: '',
    activeRadioBanner: null,
  };

  const handleSwitchCamera = (camId: string) => {
    radioEngine.switchCamera(camId);
  };

  const handleToggleOverlay = (
    overlay: 'timer' | 'radio' | 'tower' | 'telemetry' | 'winner' | 'flag' | 'hazard' | 'directorNote',
    currentVal: boolean
  ) => {
    radioEngine.toggleOverlay(overlay, !currentVal);
  };

  const handleSetAllOverlays = (val: boolean) => {
    radioEngine.setAllOverlays(val);
  };

  const handlePutRadioOnStream = (transcriptId: string) => {
    radioEngine.putRadioOnStream(transcriptId);
  };

  const handleDismissRadioBanner = () => {
    radioEngine.dismissRadioBanner();
  };

  const handleSendDirectorNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNote.trim()) return;
    radioEngine.setDirectorNote(manualNote.trim());
    setManualNote('');
  };

  const handleInjectCustomTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRadioText.trim()) return;
    radioEngine.sendManualTranscript(customRadioText.trim());
    setCustomRadioText('');
  };

  const handleLockStation = () => {
    securityEngine.lockStation('director');
    setIsUnlocked(false);
  };

  if (!isUnlocked) {
    return (
      <PasscodeLockModal
        type="station"
        targetId="director"
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  const activeCam = raceState?.cameras.find(c => c.id === production.activeCameraId) || raceState?.cameras[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6 select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-black shadow-lg">
              <Tv className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  PRODUCTION SWITCHER DESK
                </span>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-mono text-emerald-400">
                  PROGRAM FEED: {activeCam?.name}
                </span>
              </div>
              <h1 className="font-racing font-bold text-2xl text-white mt-1">
                Video Director & Angle Switcher
              </h1>
            </div>
          </div>

          {/* Quick Active Program Badge & Lock Button */}
          <div className="flex items-center gap-3">
            <div className="bg-red-950 border border-red-600 px-4 py-2 rounded-2xl flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-mono text-red-200 font-bold">
                ON AIR: {production.activeCameraId.toUpperCase()}
              </span>
            </div>

            <button
              onClick={handleLockStation}
              className="bg-zinc-800 hover:bg-zinc-700 text-xs font-mono px-3.5 py-2 rounded-xl border border-zinc-700 text-zinc-300 flex items-center gap-1.5 transition-all"
              title="Lock Station with Passcode"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>LOCK</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: MULTI-CAM GRID VIEW (All Live Video Angles) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-racing font-bold text-lg text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-400" />
              <span>LIVE CAMERA ANGLE GRID (CLICK ANY TO CUT TO PROGRAM)</span>
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              5 TRACKSIDE ANGLES ONLINE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {raceState?.cameras.map((cam) => {
              const isProgram = production.activeCameraId === cam.id;
              return (
                <div
                  key={cam.id}
                  onClick={() => handleSwitchCamera(cam.id)}
                  className={`cursor-pointer rounded-2xl border-2 transition-all overflow-hidden flex flex-col justify-between ${
                    isProgram
                      ? 'bg-zinc-950 border-red-500 shadow-xl shadow-red-950/60 ring-2 ring-red-500/50 scale-102'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {/* Camera Video View / Thumbnail */}
                  <div className="h-32 bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                    <SmoothVideoCanvas
                      cameraId={cam.id}
                      fallbackLabel={cam.name}
                      className="w-full h-full object-cover"
                    />

                    {/* On Air Tally Tag */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono">
                      {isProgram ? (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          ON AIR
                        </span>
                      ) : (
                        <span className="text-zinc-400">{cam.id.toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  {/* Camera Details */}
                  <div className="p-3 bg-zinc-950 flex flex-col justify-between flex-1">
                    <div>
                      <div className="font-racing font-bold text-xs text-white truncate">
                        {cam.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {cam.location}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchCamera(cam.id);
                      }}
                      className={`mt-2 w-full text-xs font-racing font-bold py-1.5 rounded-lg transition-all ${
                        isProgram
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {isProgram ? '✓ ACTIVE STREAM' : 'CUT TO ANGLE'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: STREAM OVERLAYS & CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Overlay Toggle Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>BROADCAST STREAM GRAPHICS & OVERLAYS</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Full Video Director permission to show or remove any graphics (winner, flags, leaderboard, timer):
                </p>
              </div>

              {/* Master Bulk Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllOverlays(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  title="Remove all graphics from the streaming window (Clean Feed)"
                >
                  <EyeOff className="w-3 h-3 text-red-400" />
                  <span>CLEAN FEED</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllOverlays(true)}
                  className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  title="Restore all stream graphics"
                >
                  <Eye className="w-3 h-3 text-emerald-400" />
                  <span>ALL ON</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[44vh] overflow-y-auto pr-1">
              {/* 1. RACE WINNER CELEBRATION OVERLAY */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      Race Winner Celebration Graphic
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Chequered flag victory banner with driver photo & team stats
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('winner', production.showWinnerOverlay !== false)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showWinnerOverlay !== false
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showWinnerOverlay !== false ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>

              {/* 2. LEADERBOARD TIMING TOWER */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      F1 Timing Tower (Leaderboard)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Left-hand leaderboard showing positions, intervals & tyre compounds
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('tower', production.showTowerOverlay)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showTowerOverlay
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showTowerOverlay ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>

              {/* 3. QUALIFYING RUNNING LAP TIMER */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Timer className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      Flying Lap Stopwatch & Delta
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Live millisecond stopwatch, micro-sectors & pole delta
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('timer', production.showTimerOverlay)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showTimerOverlay
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showTimerOverlay ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>

              {/* 4. TEAM RADIO TRANSCRIPT BANNER */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      Team Radio Broadcast Banner
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Popup graphic showing English transcript of driver/pit speech
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('radio', production.showRadioOverlay)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showRadioOverlay
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showRadioOverlay ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>

              {/* 5. FLAG & SESSION STATUS BADGE */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Flag className="w-4 h-4 text-yellow-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      Flag & Status Overlay Badge
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Green/Yellow/Red flag box, SC alert, and lap counter badge
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('flag', production.showFlagOverlay !== false)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showFlagOverlay !== false
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showFlagOverlay !== false ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>

              {/* 6. TRACK HAZARD BANNER */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-racing font-bold text-sm text-white block">
                      Track Hazard Alert Banner
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Camera marshal incident and debris warning on broadcast stream
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleOverlay('hazard', production.showHazardOverlay !== false)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    production.showHazardOverlay !== false
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {production.showHazardOverlay !== false ? 'ON STREAM' : 'REMOVED'}
                </button>
              </div>
            </div>

            {/* Custom Director Note / Lower Third */}
            <form onSubmit={handleSendDirectorNote} className="pt-2">
              <span className="text-xs font-mono text-zinc-400 block mb-1">
                BROADCAST TICKER / LOWER-THIRD MESSAGE:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Q3 POLE SHOOTOUT: VERSTAPPEN ON PURPLE SECTOR 2"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl text-xs font-racing font-bold"
                >
                  SEND
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: TEAM RADIO SPEECH-TO-TEXT TRANSCRIPTS (PUT ON STREAM!) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400" />
                <span>TEAM RADIO ENGLISH TRANSCRIPTS</span>
              </h3>
              {production.activeRadioBanner && (
                <button
                  onClick={handleDismissRadioBanner}
                  className="text-xs font-mono text-red-400 hover:text-red-300 bg-red-950 px-2 py-0.5 rounded border border-red-800"
                >
                  TAKE OFF AIR
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              When driver & engineer speak, words are transcribed in English. Click <strong>"PUT ON STREAM"</strong> to broadcast it to the main f1Cycle viewer feed!
            </p>

            {/* Active On-Air Radio Banner indicator */}
            {production.activeRadioBanner && (
              <div className="bg-emerald-950 border-2 border-emerald-500 p-3 rounded-2xl flex items-center justify-between animate-pulse">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                    🔴 CURRENTLY ON AIR BROADCAST:
                  </div>
                  <div className="font-racing font-bold text-white text-sm">
                    {production.activeRadioBanner.senderName}: "{production.activeRadioBanner.transcript}"
                  </div>
                </div>
                <button
                  onClick={handleDismissRadioBanner}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-2.5 py-1 rounded-lg border border-zinc-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Transcripts Feed */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {raceState?.transcripts.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                  No radio transcripts yet. Use the Team Radio app or send a test call below.
                </div>
              ) : (
                raceState?.transcripts.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 flex-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-mono-racing font-bold text-xs text-black shrink-0"
                        style={{ backgroundColor: item.teamColor || '#E80020' }}
                      >
                        #{item.driverNumber}
                      </div>
                      <div>
                        <div className="font-racing font-bold text-white flex items-center gap-2">
                          <span>{item.senderName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({item.senderRole})</span>
                        </div>
                        <div className="text-zinc-300 font-mono text-[11px] mt-0.5">
                          "{item.transcript}"
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handlePutRadioOnStream(item.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-racing font-bold text-xs px-3 py-1.5 rounded-xl shrink-0 shadow-md shadow-emerald-950/40"
                    >
                      PUT ON STREAM
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Manual Speech / Transcript Injector for testing */}
            <form onSubmit={handleInjectCustomTranscript} className="pt-2 border-t border-zinc-800/80">
              <span className="text-xs font-mono text-zinc-400 block mb-1">
                INJECT TEST ENGLISH RADIO CHATTER:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Box this lap for fresh medium tyres"
                  value={customRadioText}
                  onChange={(e) => setCustomRadioText(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-racing font-bold"
                >
                  ADD TRANSCRIPT
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
