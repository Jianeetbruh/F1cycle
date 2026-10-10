import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Radio as RadioIcon,
  Volume2,
  Gauge,
  Activity,
  Layers,
  Clock,
  Play,
  Share2,
  RotateCcw,
  Sparkles,
  Zap,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Lock,
  MessageSquare,
  Send,
  Timer
} from 'lucide-react';
import { radioEngine, RaceState, DriverState, RadioTransmission, RadioTranscript } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';
import { securityEngine, TEAM_PASSCODES } from '../utils/security';
import { PasscodeLockModal } from './PasscodeLockModal';

interface PitWallPortalProps {
  teamId: string;
  engineerName: string;
  onSwitchTeam: (teamId: string) => void;
}

export const PitWallPortal: React.FC<PitWallPortalProps> = ({
  teamId,
  engineerName,
  onSwitchTeam,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isTeamUnlocked(teamId));
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPeerOnline, setIsPeerOnline] = useState<boolean>(false);
  const [radioFeed, setRadioFeed] = useState<RadioTransmission[]>(radioEngine.radioHistory);
  const [cannedCallSent, setCannedCallSent] = useState<string | null>(null);
  const [lastDriverChat, setLastDriverChat] = useState<{ sender: string; text: string } | null>(null);

  // Flying Lap handshake state
  const [flyingLapStatus, setFlyingLapStatus] = useState<'IDLE' | 'ALERTED' | 'PRIMED'>('IDLE');

  // Custom text message to driver
  const [customMsg, setCustomMsg] = useState<string>('');

  const currentDriver = raceState?.drivers.find(d => d.id === teamId);

  useEffect(() => {
    setIsUnlocked(securityEngine.isTeamUnlocked(teamId));
  }, [teamId]);

  useEffect(() => {
    if (!isUnlocked) return;

    radioEngine.connect('societygp', 'engineer', teamId, engineerName || 'Race Engineer');

    const unsubState = radioEngine.onRaceState(setRaceState);
    const unsubStatus = radioEngine.onStatus((connected, peerOnline) => {
      setIsConnected(connected);
      setIsPeerOnline(peerOnline);
    });

    const unsubRadio = radioEngine.onRadio((trans) => {
      setRadioFeed([...radioEngine.radioHistory]);
      if (trans && trans.teamId === teamId && trans.senderRole === 'driver') {
        soundEffects.playRadioChirp();
        setLastDriverChat({ sender: trans.senderName, text: trans.transcript || 'Quick chat' });
        setTimeout(() => setLastDriverChat(null), 5000);
      }
    });

    const unsubConfirmed = radioEngine.onFlyingLapConfirmed((data) => {
      if (data.driverId === teamId) {
        soundEffects.playRadioChirp();
        setFlyingLapStatus('PRIMED');
        setTimeout(() => setFlyingLapStatus('IDLE'), 15000);
      }
    });

    return () => {
      unsubState();
      unsubStatus();
      unsubRadio();
      unsubConfirmed();
    };
  }, [teamId, engineerName, isUnlocked]);

  // Request flying lap from timekeeper
  const handleRequestFlyingLap = () => {
    if (!currentDriver) return;
    setFlyingLapStatus('ALERTED');
    radioEngine.requestFlyingLap(
      teamId,
      currentDriver.id,
      currentDriver.name,
      currentDriver.number,
      engineerName || 'Race Engineer'
    );
  };

  const handleSendCustomTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;
    const text = customMsg.trim();
    radioEngine.sendCannedRadioCall(text);
    setCannedCallSent(text);
    setCustomMsg('');
    setTimeout(() => setCannedCallSent(null), 3000);
  };

  const handleLockChannel = () => {
    securityEngine.lockTeam(teamId);
    setIsUnlocked(false);
  };

  const sendCallout = (phrase: string) => {
    radioEngine.sendCannedRadioCall(phrase);
    setCannedCallSent(phrase);
    setTimeout(() => setCannedCallSent(null), 3000);
  };

  const currentLap = currentDriver?.lapsCompleted || 0;
  const totalLaps = raceState?.totalLaps || 12;
  const tyreWear = currentDriver?.tyreWearPercent ?? 100;

  // Filter conversation transcripts between this team's engineer and driver
  const teamTranscripts = (raceState?.transcripts || []).filter(t => t.teamId === teamId);

  // Pit Window calculation
  const isPitWindowOpen = currentLap >= Math.floor(totalLaps * 0.4) && currentLap <= Math.floor(totalLaps * 0.7);

  if (!isUnlocked) {
    return (
      <PasscodeLockModal
        type="team"
        targetId={teamId}
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header: Pit Wall Command Center */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-mono-racing font-black text-2xl text-black shadow-lg"
              style={{ backgroundColor: currentDriver?.color || '#3671C6' }}
            >
              #{currentDriver?.number || 1}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  PIT WALL COMMAND
                </span>
                <span className="text-xs font-mono text-zinc-500">•</span>
                <span className="text-xs font-mono text-cyan-400">
                  ENG: {engineerName || 'Race Engineer'}
                </span>
              </div>
              <h1 className="font-racing font-bold text-2xl text-white tracking-wide">
                {currentDriver?.name} ({currentDriver?.team})
              </h1>
            </div>
          </div>

          {/* Team Switcher, Status Badges & Security Lock */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
              <span className="text-zinc-500">SWITCH TEAM:</span>
              <select
                value={teamId}
                onChange={(e) => onSwitchTeam(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {raceState?.drivers.map(d => (
                  <option key={d.id} value={d.id} className="bg-zinc-900 text-white">
                    #{d.number} {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400">SECURE LINK ACTIVE</span>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
              {isPeerOnline ? (
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  DRIVER ONLINE
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  WAITING FOR DRIVER
                </span>
              )}
            </div>

            {/* Lock Channel Button */}
            <button
              onClick={handleLockChannel}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 px-3 py-1.5 rounded-xl border border-zinc-700 text-xs font-mono transition-colors"
              title="Lock team channel with passcode"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>LOCK CHANNEL</span>
            </button>
          </div>
        </div>

        {/* Incoming Driver Transmission Alert */}
        {lastDriverChat && (
          <div className="bg-emerald-950/80 border-2 border-emerald-400 text-emerald-200 px-5 py-3 rounded-2xl flex items-center justify-between animate-pulse shadow-lg shadow-emerald-950/40">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-emerald-400 animate-bounce" />
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  💬 QUICK CHAT RECEIVED FROM DRIVER
                </span>
                <div className="font-racing font-bold text-lg text-white">
                  "{lastDriverChat.text}"
                </div>
              </div>
            </div>
            <span className="text-xs font-mono bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-700 text-emerald-300 font-bold">
              {lastDriverChat.sender}
            </span>
          </div>
        )}

        {/* Main Grid: Left Side Telemetry & Strategy, Right Side Radio Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Telemetry & Strategy (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Driver Telemetry Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  SPEED
                </div>
                <div className="font-mono-racing font-black text-3xl text-white mt-1">
                  {currentDriver?.speedKmh || 0} <span className="text-xs font-sans text-zinc-500">KM/H</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-1">
                  Peak: 38 km/h
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  CADENCE
                </div>
                <div className="font-mono-racing font-black text-3xl text-cyan-400 mt-1">
                  {currentDriver?.cadenceRpm || 0} <span className="text-xs font-sans text-zinc-500">RPM</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-1">
                  Pedal cadence
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  POSITION & INTERVAL
                </div>
                <div className="font-mono-racing font-black text-3xl text-amber-400 mt-1">
                  {currentDriver?.gap || 'P1'}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-1">
                  Best: {currentDriver?.bestLapTime ? `${currentDriver.bestLapTime.toFixed(2)}s` : '--'}
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  PIT STOPS & STATUS
                </div>
                <div className="font-mono-racing font-black text-3xl text-emerald-400 mt-1">
                  {currentDriver?.pitStops || 0} <span className="text-xs font-sans text-zinc-500">STOPS</span>
                </div>
                <div className="text-[11px] text-cyan-400 font-mono mt-1 uppercase">
                  STATUS: {currentDriver?.status || 'TRACK'}
                </div>
              </div>
            </div>

            {/* Pit Stop Strategy & Callout */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-red-500" />
                  <span>PIT STOP WINDOW & TACTICAL CALLOUTS</span>
                </h3>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  COMPOUND: {currentDriver?.tyreCompound}
                </span>
              </div>

              {/* Strategy Recommendation Box & Flying Lap Handshake */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                    RECOMMENDED PIT WINDOW
                  </span>
                  <div className="font-racing font-bold text-base text-white mt-1 flex items-center gap-2">
                    <span>LAPS {Math.floor(totalLaps * 0.4)} - {Math.floor(totalLaps * 0.65)}</span>
                    {isPitWindowOpen && (
                      <span className="text-[10px] bg-red-600/30 text-red-400 px-2 py-0.5 rounded-full border border-red-500/50">
                        WINDOW OPEN
                      </span>
                    )}
                  </div>
                </div>

                {/* Flying Lap Handshake with Lap Timekeeper */}
                <div className="bg-zinc-950 p-3.5 rounded-2xl border border-purple-900/60 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-400" />
                      QUALIFYING FLYING LAP HANDSHAKE
                    </span>
                    <span className="text-xs text-zinc-300 font-bold mt-1 block">
                      {flyingLapStatus === 'ALERTED'
                        ? '⏳ Timekeeper Alerted! Awaiting Confirmation...'
                        : flyingLapStatus === 'PRIMED'
                        ? '✅ Timekeeper Primed on Gantry! Ready!'
                        : 'Alert Timekeeper: Driver Starting Flying Lap'}
                    </span>
                  </div>
                  <button
                    onClick={handleRequestFlyingLap}
                    disabled={flyingLapStatus === 'ALERTED'}
                    className={`font-racing font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 ${
                      flyingLapStatus === 'ALERTED'
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 animate-pulse cursor-wait'
                        : flyingLapStatus === 'PRIMED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                        : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-purple-950/60'
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>{flyingLapStatus === 'PRIMED' ? 'RE-ALERT TIMEKEEPER' : '⚡ ALERT TIMEKEEPER'}</span>
                  </button>
                </div>
              </div>

              {/* Confirm Pit Box Banner button */}
              <div className="mt-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                    TELL STREAM: DRIVER IN PIT LANE
                  </span>
                  <span className="text-xs text-zinc-300 font-bold block">
                    Broadcast "Boxed / Pit Stop" banner to TV & spectators
                  </span>
                </div>
                <button
                  onClick={() => radioEngine.markDriverPitted(teamId)}
                  className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-racing font-bold text-xs px-3 py-2 rounded-xl shadow-md"
                >
                  CONFIRM PIT STOP
                </button>
              </div>
            </div>

            {/* Split Timing Table */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5">
              <h3 className="font-racing font-bold text-lg text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span>SECTOR & LAP ANALYSIS</span>
              </h3>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SECTOR 1 (GATE TO CHICANE)</div>
                  <div className="font-mono-racing font-bold text-xl text-emerald-400 mt-1">
                    {currentDriver?.s1 ? `${currentDriver.s1.toFixed(2)}s` : '12.4s'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SECTOR 2 (SWIMMING POOL)</div>
                  <div className="font-mono-racing font-bold text-xl text-purple-400 mt-1">
                    {currentDriver?.s2 ? `${currentDriver.s2.toFixed(2)}s` : '14.1s'}
                  </div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SECTOR 3 (MAIN STRAIGHT)</div>
                  <div className="font-mono-racing font-bold text-xl text-yellow-400 mt-1">
                    {currentDriver?.s3 ? `${currentDriver.s3.toFixed(2)}s` : '11.8s'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Radio Console & Quick Chats (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Engineer Quick Chats Panel */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-racing font-bold text-lg text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <span>PIT WALL QUICK CHATS</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Instant tactical callouts transmitted directly to driver's cockpit HUD
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold">
                  CHANNEL #{currentDriver?.number || 1}
                </span>
              </div>

              {/* Quick Engineer Tactical Canned Callouts */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                  <span>TACTICAL CALLOUT BUTTONS (TAP TO SEND)</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'BOX, BOX, BOX', call: 'Box, box, box! Pit this lap.' },
                    { label: 'PUSH NOW!', call: 'Push now! Maximum pace.' },
                    { label: 'GAP TO LEADER', call: `Gap to leader is ${currentDriver?.gap || '2.0s'}.` },
                    { label: 'MANAGE TYRES', call: 'Manage tyres in the high speed turns.' },
                    { label: 'RADIO CHECK', call: 'Radio check, driver, can you hear me?' },
                    { label: 'SAFETY CAR', call: 'Safety car deployed! Reduce speed, maintain positive delta.' },
                    { label: 'OVERTAKE AVAILABLE', call: 'Overtake mode available! Go for the pass.' },
                    { label: 'SAVE ENERGY', call: 'Pace yourself, conserve energy.' },
                    { label: 'CAR BEHIND CLOSING', call: 'Car behind is closing in, defend your line.' },
                    { label: 'CONFIRM PIT STOP', call: 'Pit crew ready, confirm box this lap.' },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => sendCallout(btn.call)}
                      className="bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-xs font-mono p-3 rounded-2xl border border-zinc-800 hover:border-emerald-600/60 text-zinc-300 text-left transition-all flex flex-col justify-between shadow-sm"
                    >
                      <span className="font-bold text-white block">{btn.label}</span>
                      <span className="text-[10px] text-zinc-500 truncate block mt-0.5">"{btn.call}"</span>
                    </button>
                  ))}
                </div>

                {cannedCallSent && (
                  <div className="text-center text-xs font-mono text-emerald-400 py-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-center gap-1.5 animate-pulse">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Transmitted to Driver: "{cannedCallSent}"</span>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE CONVERSATION TRANSCRIPT: ENGINEER <-> DRIVER DIALOGUE */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-racing font-bold text-base text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>LIVE CONVERSATION TRANSCRIPT (TEAM & DRIVER)</span>
                </h3>
                <span className="text-xs font-mono text-zinc-500">
                  {teamTranscripts.length} MESSAGES
                </span>
              </div>

              {/* Chat-style transcript dialogue stream */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800">
                {teamTranscripts.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                    No conversation recorded yet. Hold PTT to speak, use tactical buttons, or type below.
                  </div>
                ) : (
                  teamTranscripts.map((item) => {
                    const isDriver = item.senderRole === 'driver';
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col ${isDriver ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 text-[10px] font-mono text-zinc-400">
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded uppercase ${
                              isDriver
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                            }`}
                          >
                            {isDriver ? `DRIVER (#${item.driverNumber})` : 'PIT WALL'}
                          </span>
                          <span>• {item.timestamp}</span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-mono ${
                            isDriver
                              ? 'bg-zinc-900 border border-emerald-900/60 text-zinc-100 rounded-tl-none'
                              : 'bg-cyan-950/70 border border-cyan-800/80 text-cyan-100 rounded-tr-none'
                          }`}
                        >
                          "{item.transcript}"
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Type message directly to driver */}
              <form onSubmit={handleSendCustomTranscript} className="flex gap-2">
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Type message to driver (e.g. Delta plus 0.4)..."
                  className="flex-1 bg-zinc-950 border border-zinc-700 text-xs font-mono px-3 py-2 rounded-xl text-white outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!customMsg.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-racing font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>RADIO</span>
                </button>
              </form>
            </div>

            {/* Radio Log & Transmission Replays */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-racing font-bold text-base text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>TEAM RADIO LOG</span>
                </h3>
                <span className="text-xs font-mono text-zinc-500">
                  {radioFeed.length} TRANSMISSIONS
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {radioFeed.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                    No radio chatter yet. Hold the button above or use tactical callouts.
                  </div>
                ) : (
                  radioFeed.map((item) => (
                    <div
                      key={item.id}
                      className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                            item.senderRole === 'driver'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          {item.senderRole}
                        </span>
                        <span className="text-zinc-200">
                          {item.transcript || `${item.senderName} voice transmission`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-zinc-500 font-mono text-[10px]">
                        <span>{item.timestamp}</span>
                        {item.audioData && (
                          <button
                            onClick={() => radioEngine.playIncomingRadioClip(item.audioData!)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                            title="Replay Audio"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
