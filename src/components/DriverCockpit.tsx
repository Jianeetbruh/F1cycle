import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Radio as RadioIcon,
  Volume2,
  Navigation,
  Flag,
  RotateCcw,
  Zap,
  Gauge,
  Wifi,
  WifiOff,
  AlertTriangle,
  Flame,
  Check,
  Trophy,
  Lock,
  MessageSquare
} from 'lucide-react';
import { radioEngine, RaceState, DriverState } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';
import { securityEngine } from '../utils/security';
import { computeSessionSectorBests, getSectorColorStatus, getSectorBadgeStyles } from '../utils/sectorTiming';
import { PasscodeLockModal } from './PasscodeLockModal';

interface DriverCockpitProps {
  teamId: string;
  driverName: string;
  onSwitchTeam: (teamId: string) => void;
}

export const DriverCockpit: React.FC<DriverCockpitProps> = ({
  teamId,
  driverName,
  onSwitchTeam,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isTeamUnlocked(teamId));
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPeerOnline, setIsPeerOnline] = useState<boolean>(false);
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [incomingTransmitting, setIncomingTransmitting] = useState<{ active: boolean; name: string }>({
    active: false,
    name: '',
  });

  // Telemetry state
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [cadenceRpm, setCadenceRpm] = useState<number>(0);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [quickReplySent, setQuickReplySent] = useState<string | null>(null);
  const [lastRadioMessage, setLastRadioMessage] = useState<{ sender: string; text: string } | null>(null);

  const speedRef = useRef(speedKmh);
  speedRef.current = speedKmh;
  const lastAnnouncedFlagRef = useRef<string | null>(null);

  // Active driver data
  const currentDriver: DriverState | undefined = raceState?.drivers.find(d => d.id === teamId);
  const recentTeamTranscripts = (raceState?.transcripts || []).filter(t => t.teamId === teamId).slice(0, 4);

  useEffect(() => {
    setIsUnlocked(securityEngine.isTeamUnlocked(teamId));
  }, [teamId]);

  // Connect to radio engine & listen for automated voice flag announcements
  useEffect(() => {
    if (!isUnlocked) return;

    soundEffects.unlockAudio();
    radioEngine.connect('societygp', 'driver', teamId, driverName || currentDriver?.name || 'Driver');

    const unsubState = radioEngine.onRaceState((state) => {
      setRaceState(state);
      // Auto voice announcement if flag changed
      if (state?.flagStatus && state.flagStatus !== lastAnnouncedFlagRef.current) {
        lastAnnouncedFlagRef.current = state.flagStatus;
        announceFlagVoice(state.flagStatus);
      }
    });

    const unsubStatus = radioEngine.onStatus((connected, peerOnline) => {
      setIsConnected(connected);
      setIsPeerOnline(peerOnline);
    });

    // Listen for direct urgent flag alerts broadcast by Race Director
    const unsubFlag = radioEngine.onFlagAlert((flag) => {
      announceFlagVoice(flag);
    });

    const unsubRadio = radioEngine.onRadio((trans) => {
      if (trans.teamId === teamId && trans.senderRole !== 'driver') {
        setLastRadioMessage({
          sender: trans.senderName,
          text: trans.transcript || 'Quick chat message',
        });
        soundEffects.playRadioChirp();
        // Speak incoming quick chat to rider's earphone
        if (trans.transcript) {
          setTimeout(() => {
            soundEffects.speakRadioPhrase(`Pit wall: ${trans.transcript}`);
          }, 300);
        }
        setTimeout(() => setLastRadioMessage(null), 6000);
      }
    });

    return () => {
      unsubState();
      unsubStatus();
      unsubFlag();
      unsubRadio();
    };
  }, [teamId, driverName, currentDriver?.name, isUnlocked]);

  // Automated voice callout to every driver when director raises any flag
  const announceFlagVoice = (flag: string) => {
    soundEffects.unlockAudio();
    if (flag === 'YELLOW') {
      soundEffects.playWarningHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Caution driver, yellow flag! Caution on track, no overtaking.");
      }, 300);
    } else if (flag === 'RED') {
      soundEffects.playSafetyCarHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Red flag, red flag! Session suspended. Return to pit lane immediately.");
      }, 300);
    } else if (flag === 'SC') {
      soundEffects.playSafetyCarHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Safety car deployed! Slow down, maintain positive delta.");
      }, 300);
    } else if (flag === 'VSC') {
      soundEffects.playWarningHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Virtual safety car deployed. Reduce speed, maintain delta.");
      }, 300);
    } else if (flag === 'GREEN') {
      soundEffects.playRadioChirp();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Green flag! Track clear, racing resumed. Push now!");
      }, 300);
    } else if (flag === 'CHEQUERED') {
      soundEffects.playLightsOutGo();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Chequered flag! That is the chequered flag, race is finished!");
      }, 300);
    }
  };

  // GPS Speedometer
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsActive(true);
          if (pos.coords.speed !== null && pos.coords.speed >= 0) {
            const kmh = Math.round(pos.coords.speed * 3.6);
            setSpeedKmh(kmh);
            setCadenceRpm(Math.round(kmh * 2.8));
            radioEngine.sendTelemetry(kmh, Math.round(kmh * 2.8));
          }
        },
        (err) => {
          console.warn('GPS position error or permission denied:', err);
          setGpsActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    } catch (e) {
      console.warn(e);
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Push-to-Talk touch handlers
  const handlePttStart = async (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsPTTActive(true);
    await radioEngine.startPTT();
  };

  const handlePttEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsPTTActive(false);
    radioEngine.stopPTT();
  };

  // Driver manual lap completion trigger
  const handleCompleteLap = () => {
    soundEffects.playRadioChirp();
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);

    // Generate random simulated split times
    const lapTime = (Math.random() * 8 + 36); // e.g. 38.45s around society circuit
    const s1 = +(lapTime * 0.32).toFixed(2);
    const s2 = +(lapTime * 0.38).toFixed(2);
    const s3 = +(lapTime * 0.30).toFixed(2);

    radioEngine.sendRaceAction('RECORD_LAP', {
      driverId: teamId,
      lapTimeSec: +lapTime.toFixed(3),
      s1,
      s2,
      s3,
    });
  };

  // Quick radio status reply
  const sendQuickReply = (text: string) => {
    soundEffects.playRadioChirp();
    radioEngine.sendCannedRadioCall(text);
    setQuickReplySent(text);
    setTimeout(() => setQuickReplySent(null), 2500);
  };

  // Flag style banner
  const flagStatus = raceState?.flagStatus || 'GREEN';
  const getFlagBanner = () => {
    switch (flagStatus) {
      case 'YELLOW':
        return {
          bg: 'bg-yellow-500 text-black',
          title: '⚠️ YELLOW FLAG - CAUTION IN SECTOR',
          desc: 'No overtaking! Reduce speed in hazard area.',
        };
      case 'RED':
        return {
          bg: 'bg-red-600 text-white animate-pulse',
          title: '🛑 RED FLAG - SESSION STOPPED',
          desc: 'Return to society pit lane immediately.',
        };
      case 'SC':
        return {
          bg: 'bg-amber-500 text-black animate-pulse',
          title: '🚗 SAFETY CAR DEPLOYED (SC)',
          desc: 'Follow the lead safety bicycle. Maintain delta positive.',
        };
      case 'VSC':
        return {
          bg: 'bg-yellow-400 text-black',
          title: '⚡ VIRTUAL SAFETY CAR (VSC)',
          desc: 'Maintain delta. No overtaking allowed.',
        };
      case 'CHEQUERED':
        return {
          bg: 'bg-zinc-100 text-black font-black',
          title: '🏁 CHEQUERED FLAG - FINISH!',
          desc: 'Lap completed! Cool down lap to pit lane.',
        };
      default:
        return {
          bg: 'bg-emerald-600 text-white',
          title: '🟢 TRACK CLEAR - GREEN FLAG',
          desc: 'Push now. Society circuit green.',
        };
    }
  };

  const flagInfo = getFlagBanner();

  const handleLockCockpit = () => {
    securityEngine.lockTeam(teamId);
    setIsUnlocked(false);
  };

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
    <div className="flex flex-col min-h-screen bg-black text-white select-none">
      {/* Top Motorsport Flag Banner */}
      <div className={`px-4 py-2 text-center transition-colors duration-300 font-bold ${flagInfo.bg}`}>
        <div className="text-sm tracking-wider uppercase flex items-center justify-center gap-2">
          <Flag className="w-4 h-4" />
          <span>{flagInfo.title}</span>
        </div>
        <div className="text-xs opacity-90">{flagInfo.desc}</div>
      </div>

      {/* Main Steering Wheel Cockpit Body */}
      <div className="flex-1 flex flex-col justify-between p-4 max-w-md mx-auto w-full">
        {/* Header HUD: Driver Info & Connection Pill */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-mono-racing font-black text-xl text-black shadow-lg"
                style={{ backgroundColor: currentDriver?.color || '#3671C6' }}
              >
                #{currentDriver?.number || 1}
              </div>
              <div>
                <div className="font-racing font-bold text-base leading-tight tracking-wide text-zinc-100">
                  {currentDriver?.name || driverName}
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-2">
                  <span>{currentDriver?.team}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-amber-400 font-mono text-[11px]">
                    {currentDriver?.bikeType}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Team Picker */}
              <select
                value={teamId}
                onChange={(e) => onSwitchTeam(e.target.value)}
                className="bg-zinc-800 text-xs text-zinc-300 border border-zinc-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {raceState?.drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    #{d.number} {d.name.split(' ')[0]}
                  </option>
                ))}
              </select>

              {/* Lock Channel */}
              <button
                onClick={handleLockCockpit}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                title="Lock team cockpit"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Connection Status Bar */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  RADIO LINKED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400">
                  <WifiOff className="w-3 h-3" />
                  OFFLINE
                </span>
              )}

              <span className="text-zinc-700">|</span>

              {isPeerOnline ? (
                <span className="text-cyan-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-cyan-400 animate-bounce" />
                  PIT WALL ACTIVE
                </span>
              ) : (
                <span className="text-zinc-500">PIT WALL STANDBY</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-zinc-400">
              <span>LAP {currentDriver?.lapsCompleted || 0}/{raceState?.totalLaps || 12}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-yellow-400">P{raceState?.drivers.findIndex(d => d.id === teamId)! + 1 || 1}</span>
            </div>
          </div>
        </div>

        {/* Incoming Pit Wall Transmission Alert */}
        {incomingTransmitting.active && (
          <div className="my-2 bg-cyan-950/90 border-2 border-cyan-400 text-cyan-200 px-4 py-2.5 rounded-xl animate-pulse flex items-center gap-3 shadow-lg shadow-cyan-950/50">
            <Volume2 className="w-6 h-6 text-cyan-400 animate-ping" />
            <div>
              <div className="font-racing font-bold text-xs uppercase tracking-wider text-cyan-300">
                📻 RACE ENGINEER TRANSMITTING
              </div>
              <div className="text-sm font-semibold text-white">
                Listen: Instructions from Pit Wall...
              </div>
            </div>
          </div>
        )}

        {/* Last Radio Message Banner */}
        {lastRadioMessage && (
          <div className="my-2 bg-black/90 border-2 border-cyan-400 text-cyan-200 px-4 py-2.5 rounded-2xl animate-in fade-in slide-in-from-top flex items-center gap-3 shadow-xl">
            <Volume2 className="w-6 h-6 text-cyan-400 shrink-0 animate-bounce" />
            <div>
              <div className="font-racing font-bold text-xs uppercase tracking-wider text-cyan-300">
                📻 {lastRadioMessage.sender} (PIT WALL)
              </div>
              <div className="text-sm font-bold text-white">
                "{lastRadioMessage.text}"
              </div>
            </div>
          </div>
        )}

        {/* Big Speedometer & Delta HUD (F1 Steering Wheel Display) */}
        <div className="my-4 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
          {/* Subtle kerb accent top border */}
          <div className="absolute top-0 left-0 right-0 h-1.5 kerb-stripes opacity-70"></div>

          {/* Rev / Shift Lights (Green -> Amber -> Red -> Blue Shift!) */}
          <div className="flex justify-between items-center gap-1 mb-4">
            {Array.from({ length: 15 }).map((_, i) => {
              const activeRatio = speedKmh / 45; // Max 45 km/h for bike sprint
              const isActive = (i / 15) <= activeRatio;
              let color = 'bg-zinc-800';
              if (isActive) {
                if (i < 5) color = 'bg-emerald-500 shadow-sm shadow-emerald-500';
                else if (i < 10) color = 'bg-amber-500 shadow-sm shadow-amber-500';
                else color = 'bg-red-500 shadow-sm shadow-red-500';
              }
              return (
                <div
                  key={i}
                  className={`h-2.5 flex-1 rounded-sm transition-all duration-150 ${color}`}
                />
              );
            })}
          </div>

          {/* Speed & Cadence Readout */}
          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Speed Gauge */}
            <div className="text-center border-r border-zinc-800/80 pr-3">
              <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
                SPEED (KM/H)
              </div>
              <div className="font-mono-racing font-black text-6xl tracking-tight text-white my-1">
                {speedKmh}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-center gap-1">
                {gpsActive ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> GPS SATELLITE
                  </span>
                ) : (
                  <span>TAP TO ACCELERATE</span>
                )}
              </div>
            </div>

            {/* Lap Times & Cadence (No delta time, no tyre percent) */}
            <div className="text-center pl-3">
              <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
                LAST LAP TIME
              </div>
              <div className="font-mono-racing font-black text-3xl tracking-tight text-white my-2">
                {currentDriver?.lastLapTime ? `${currentDriver.lastLapTime.toFixed(2)}s` : '--'}
              </div>
              <div className="flex items-center justify-around text-xs font-mono text-zinc-400">
                <div>
                  <span className="text-zinc-500">BEST</span>{' '}
                  <span className="text-purple-400 font-bold">
                    {currentDriver?.bestLapTime ? `${currentDriver.bestLapTime.toFixed(2)}s` : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">CADENCE</span>{' '}
                  <span className="text-cyan-400 font-bold">{cadenceRpm} RPM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Speed Simulator Buttons (For indoor testing / handlebar clicker) */}
          <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                const newSpeed = Math.min(50, speedKmh + 5);
                setSpeedKmh(newSpeed);
                setCadenceRpm(Math.round(newSpeed * 2.8));
                radioEngine.sendTelemetry(newSpeed, Math.round(newSpeed * 2.8));
              }}
              className="bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-200"
            >
              + PEDAL HARD (+5)
            </button>
            <button
              onClick={() => {
                const newSpeed = Math.max(0, speedKmh - 5);
                setSpeedKmh(newSpeed);
                setCadenceRpm(Math.round(newSpeed * 2.8));
                radioEngine.sendTelemetry(newSpeed, Math.round(newSpeed * 2.8));
              }}
              className="bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400"
            >
              BRAKE (-5)
            </button>
          </div>
        </div>

        {/* Lap Record & Split Times */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 mb-3">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">LAST LAP</span>
            <span className="text-white font-bold">
              {currentDriver?.lastLapTime ? `${currentDriver.lastLapTime.toFixed(2)}s` : '--.--s'}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">BEST</span>
            <span className="text-purple-400 font-bold">
              {currentDriver?.bestLapTime ? `${currentDriver.bestLapTime.toFixed(2)}s` : '--.--s'}
            </span>
          </div>

          {/* Sector Splits (🟣 PURPLE: OVERALL FASTEST • 🟢 GREEN: PERSONAL BEST • 🟡 YELLOW: SLOWER) */}
          {(() => {
            const sectorBests = computeSessionSectorBests(raceState);
            const s1Status = getSectorColorStatus(1, currentDriver?.s1, currentDriver?.id, sectorBests);
            const s2Status = getSectorColorStatus(2, currentDriver?.s2, currentDriver?.id, sectorBests);
            const s3Status = getSectorColorStatus(3, currentDriver?.s3, currentDriver?.id, sectorBests);
            const s1Styles = getSectorBadgeStyles(s1Status);
            const s2Styles = getSectorBadgeStyles(s2Status);
            const s3Styles = getSectorBadgeStyles(s3Status);

            return (
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className={`p-2 rounded-xl border ${s1Styles.bg} ${s1Styles.border} transition-colors`}>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span>SECTOR 1</span>
                    <span className="text-[9px] font-bold">
                      {s1Status === 'PURPLE' ? '🟣 FAST' : s1Status === 'GREEN' ? '🟢 PB' : '🟡'}
                    </span>
                  </div>
                  <span className={`text-sm font-mono-racing ${s1Styles.text}`}>
                    {currentDriver?.s1 ? `${currentDriver.s1.toFixed(2)}s` : '--'}
                  </span>
                </div>

                <div className={`p-2 rounded-xl border ${s2Styles.bg} ${s2Styles.border} transition-colors`}>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span>SECTOR 2</span>
                    <span className="text-[9px] font-bold">
                      {s2Status === 'PURPLE' ? '🟣 FAST' : s2Status === 'GREEN' ? '🟢 PB' : '🟡'}
                    </span>
                  </div>
                  <span className={`text-sm font-mono-racing ${s2Styles.text}`}>
                    {currentDriver?.s2 ? `${currentDriver.s2.toFixed(2)}s` : '--'}
                  </span>
                </div>

                <div className={`p-2 rounded-xl border ${s3Styles.bg} ${s3Styles.border} transition-colors`}>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span>SECTOR 3</span>
                    <span className="text-[9px] font-bold">
                      {s3Status === 'PURPLE' ? '🟣 FAST' : s3Status === 'GREEN' ? '🟢 PB' : '🟡'}
                    </span>
                  </div>
                  <span className={`text-sm font-mono-racing ${s3Styles.text}`}>
                    {currentDriver?.s3 ? `${currentDriver.s3.toFixed(2)}s` : '--'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Official Timing Status Banner (Locked to Driver - Controlled by Marshals / Race Director) */}
        {currentDriver?.status === 'FINISHED' || (raceState?.session === 'RACE' && (currentDriver?.lapsCompleted || 0) >= (raceState?.totalLaps || 12)) ? (
          <div className="w-full mb-3 bg-zinc-900 border border-amber-500/50 text-amber-400 font-racing font-bold text-sm tracking-wider py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg select-none">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>🏁 CHEQUERED FLAG • RACE COMPLETED ({currentDriver?.lapsCompleted}/{raceState?.totalLaps} LAPS)</span>
          </div>
        ) : (
          <div className="w-full mb-3 bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono py-3 px-4 rounded-2xl flex items-center justify-between shadow-lg select-none">
            <div className="flex items-center gap-2 font-racing font-bold text-sm text-white">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>LAP {currentDriver?.lapsCompleted || 0} / {raceState?.totalLaps || 12}</span>
            </div>
            <div className="text-[11px] text-right font-mono">
              <span className="text-amber-400 font-bold block">🔒 LAP SETTING LOCKED</span>
              <span className="text-zinc-500 text-[10px]">Controlled by Track Marshal / Beacon</span>
            </div>
          </div>
        )}

        {/* Quick Driver Radio Callouts & Tactical Chats */}
        <div className="space-y-2 mt-auto pt-2">
          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <MessageSquare className="w-3.5 h-3.5" />
              QUICK CHATS TO PIT WALL
            </span>
            <span className="text-zinc-500">TAP TO TRANSMIT</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { text: 'Copy', label: 'COPY (ACK)', color: 'border-emerald-500/50 hover:bg-emerald-950/40 text-emerald-300' },
              { text: 'Box This Lap', label: 'BOX THIS LAP', color: 'border-amber-500/50 hover:bg-amber-950/40 text-amber-300' },
              { text: 'Tyres Good', label: 'TYRES OK', color: 'border-zinc-700 hover:bg-zinc-800 text-zinc-200' },
              { text: 'Pushing Hard', label: 'PUSHING HARD', color: 'border-red-500/50 hover:bg-red-950/40 text-red-300' },
              { text: 'What is my gap to leader?', label: 'GAP TO LEADER?', color: 'border-cyan-500/50 hover:bg-cyan-950/40 text-cyan-300' },
              { text: 'Conserving energy / pacing', label: 'SAVING PACE', color: 'border-zinc-700 hover:bg-zinc-800 text-zinc-200' },
              { text: 'Loud and clear radio check', label: 'RADIO CHECK OK', color: 'border-purple-500/50 hover:bg-purple-950/40 text-purple-300' },
              { text: 'Track clear, maximum speed', label: 'TRACK CLEAR', color: 'border-emerald-500/50 hover:bg-emerald-950/40 text-emerald-300' },
            ].map((item) => (
              <button
                key={item.text}
                onClick={() => sendQuickReply(item.text)}
                className={`py-3.5 px-3 rounded-2xl border bg-zinc-950/90 active:scale-95 font-racing font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-lg transition-all ${item.color}`}
              >
                <span className="text-sm font-bold tracking-wide">{item.label}</span>
                <span className="text-[10px] font-mono opacity-60 truncate">"{item.text}"</span>
              </button>
            ))}
          </div>

          {quickReplySent && (
            <div className="text-center text-xs font-mono text-emerald-400 py-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-center gap-1.5 animate-pulse">
              <Check className="w-4 h-4" />
              <span>Transmitted to Pit Wall: "{quickReplySent}"</span>
            </div>
          )}
        </div>

        {/* Live Conversation Transcript Box (Recent transmissions) */}
        {recentTeamTranscripts.length > 0 && (
          <div className="my-2 bg-zinc-950/90 border border-zinc-800 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1 text-emerald-400">
                <MessageSquare className="w-3 h-3 text-emerald-400" />
                RADIO CONVERSATION TRANSCRIPT
              </span>
              <span>LIVE</span>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {recentTeamTranscripts.map((t) => (
                <div key={t.id} className="leading-tight flex items-start gap-1.5">
                  <span className={`text-[10px] px-1 rounded uppercase font-bold shrink-0 ${
                    t.senderRole === 'driver' ? 'text-emerald-400 bg-emerald-950' : 'text-cyan-400 bg-cyan-950'
                  }`}>
                    {t.senderRole === 'driver' ? 'YOU' : 'ENG'}:
                  </span>
                  <span className="text-zinc-300">"{t.transcript}"</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
