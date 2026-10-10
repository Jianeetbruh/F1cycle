import React, { useState, useEffect, useRef } from 'react';
import {
  Tv,
  Radio,
  Timer,
  Video,
  Grid,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Flag,
  Trophy,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
  Sliders,
  Eye,
  Clock,
  Gauge,
  Wifi,
  Info
} from 'lucide-react';
import { radioEngine, RaceState, CameraAngle, RadioTranscript } from '../services/radioEngine';
import { webrtcVideoEngine } from '../services/webrtcVideoEngine';
import { SmoothVideoCanvas } from './SmoothVideoCanvas';

export const MainBroadcastStream: React.FC = () => {
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [viewMode, setViewMode] = useState<'PROGRAM' | 'GRID'>('PROGRAM');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [localTimerElapsed, setLocalTimerElapsed] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timing' | 'stewards' | 'radio' | 'cams'>('timing');
  const [selectedQuality, setSelectedQuality] = useState<'1080p' | '720p' | 'auto'>('1080p');

  const [pittedAlert, setPittedAlert] = useState<{
    driverName: string;
    driverNumber: number;
    team: string;
    color: string;
    pitStops: number;
  } | null>(null);

  const [overtakeAlert, setOvertakeAlert] = useState<{
    overtaker: {
      id: string;
      name: string;
      number: number;
      team: string;
      color: string;
      newPosition: number;
    };
    overtaken: {
      id: string;
      name: string;
      number: number;
      team: string;
      color: string;
    };
    location?: string;
  } | null>(null);

  const [hazardAlert, setHazardAlert] = useState<{
    hazardType: string;
    location: string;
    description: string;
    operatorName: string;
  } | null>(null);

  // Live incoming camera frames directly from volunteer cameras
  const [liveFrames, setLiveFrames] = useState<Record<string, string>>({});
  const [activeWebRtcStream, setActiveWebRtcStream] = useState<MediaStream | null>(null);
  const [webrtcStreams, setWebrtcStreams] = useState<Record<string, MediaStream | null>>({});
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(() => raceState?.sessionRemainingSeconds ?? 1800);

  // Synchronize official session countdown timer locally for buttery-smooth seconds
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

  const animFrameRef = useRef<number | null>(null);
  const pittedTimerRef = useRef<number | null>(null);
  const overtakeTimerRef = useRef<number | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Toggle fullscreen mode on stream
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (playerContainerRef.current) {
          await playerContainerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    radioEngine.connect('societygp', 'spectator', '', 'FOM World Feed');
    const unsub = radioEngine.onRaceState(setRaceState);

    const unsubPitted = radioEngine.onDriverPitted((data) => {
      setPittedAlert(data);
      if (pittedTimerRef.current) clearTimeout(pittedTimerRef.current);
      pittedTimerRef.current = window.setTimeout(() => {
        setPittedAlert(null);
      }, 5500);
    });

    const unsubOvertake = radioEngine.onOvertake((data) => {
      setOvertakeAlert(data);
      if (overtakeTimerRef.current) clearTimeout(overtakeTimerRef.current);
      overtakeTimerRef.current = window.setTimeout(() => {
        setOvertakeAlert(null);
      }, 5500);
    });

    const unsubFrames = radioEngine.onCameraFrame((camId, frameUrl) => {
      setLiveFrames(prev => ({
        ...prev,
        [camId]: frameUrl,
      }));
    });

    const unsubHazard = radioEngine.onTrackHazard((haz) => {
      setHazardAlert(haz);
      setTimeout(() => setHazardAlert(null), 7000);
    });

    return () => {
      unsub();
      unsubPitted();
      unsubOvertake();
      unsubFrames();
      unsubHazard();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pittedTimerRef.current) clearTimeout(pittedTimerRef.current);
      if (overtakeTimerRef.current) clearTimeout(overtakeTimerRef.current);
    };
  }, []);

  // Sync running timer locally with server's startTimestamp
  useEffect(() => {
    const liveTimer = raceState?.liveTimer;
    if (liveTimer?.isActive && liveTimer.startTimestamp) {
      const updateTimer = () => {
        const diff = Date.now() - liveTimer.startTimestamp!;
        setLocalTimerElapsed(diff);
        animFrameRef.current = requestAnimationFrame(updateTimer);
      };
      animFrameRef.current = requestAnimationFrame(updateTimer);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (liveTimer && !liveTimer.isActive) {
        setLocalTimerElapsed(liveTimer.currentElapsedMs || 0);
      }
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [raceState?.liveTimer?.isActive, raceState?.liveTimer?.startTimestamp]);

  const production = raceState?.production || {
    activeCameraId: 'cam-1',
    showTimerOverlay: true,
    showRadioOverlay: true,
    showTowerOverlay: true,
    showTelemetryOverlay: true,
    directorNote: '',
    activeRadioBanner: null,
  };

  // Subscribe to live hardware-accelerated WebRTC stream for active camera
  useEffect(() => {
    const camId = production.activeCameraId || 'cam-1';
    const unsub = webrtcVideoEngine.subscribeCamera(camId, (stream) => {
      setActiveWebRtcStream(stream);
    });

    return () => {
      unsub();
      setActiveWebRtcStream(null);
    };
  }, [production.activeCameraId]);

  // Subscribe to all cameras when in GRID view mode
  useEffect(() => {
    if (viewMode !== 'GRID') return;
    const unsubs: (() => void)[] = [];
    const cams = ['cam-1', 'cam-2', 'cam-3', 'cam-4', 'cam-5'];
    cams.forEach((cid) => {
      const u = webrtcVideoEngine.subscribeCamera(cid, (stream) => {
        setWebrtcStreams(prev => ({
          ...prev,
          [cid]: stream,
        }));
      });
      unsubs.push(u);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [viewMode]);

  const activeCam = raceState?.cameras.find(c => c.id === production.activeCameraId) || raceState?.cameras[0];
  const activeCamFrame = liveFrames[activeCam?.id || ''] || activeCam?.lastFrameUrl;
  const liveTimer = raceState?.liveTimer;
  const flagStatus = raceState?.flagStatus || 'GREEN';

  // Format running milliseconds to MM:SS.mmm
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  };

  const getDriverCode = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].replace(/[^a-zA-Z]/g, '');
      if (last.length >= 3) return last.slice(0, 3).toUpperCase();
    }
    return name.slice(0, 3).toUpperCase();
  };

  const sessionUpper = (raceState?.session || 'P1').toUpperCase();
  const isPracticeOrQuali = ['P1', 'P2', 'P3', 'Q1', 'FP1', 'FP2', 'FP3', 'QUALI', 'QUALIFYING'].includes(sessionUpper);
  const isSessionTimerStarted = Boolean(
    raceState?.sessionTimerRunning ||
    (raceState?.sessionRemainingSeconds !== undefined && raceState.sessionRemainingSeconds < (raceState.sessionTotalSeconds || 1800) && raceState.sessionRemainingSeconds > 0)
  );

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
  const formattedSessionClock = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 select-none relative overflow-x-hidden flex flex-col justify-between">
      {/* FOM Official Television Broadcast Master Header */}
      <header className="bg-[#0b0d13] border-b border-[#1b1f2e] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-4">
          {/* Official FIA FOM Channel Bug */}
          <div className="flex items-center gap-2">
            <span className="bg-[#e10600] text-white px-2 py-0.5 rounded-sm text-xs font-black tracking-tight font-racing">
              FIA F1
            </span>
            <div className="leading-tight">
              <span className="font-racing font-bold text-sm text-white tracking-wider block">
                WORLD CHAMPIONSHIP
              </span>
              <span className="text-[10px] font-mono text-zinc-400 block tracking-widest uppercase">
                OFFICIAL INTERNATIONAL FEED • {raceState?.circuitName || 'MONACO GP'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden md:block" />

          {/* Session Type & Lap Counter */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold uppercase">
              {raceState?.session || 'RACE'}
            </span>
            <span className="text-zinc-500">
              LAP <strong className="text-white">{raceState?.currentLap || 1}</strong> / {raceState?.totalLaps || 12}
            </span>
          </div>
        </div>

        {/* Center / Right: Official Flag Status & Technical Diagnostics */}
        <div className="flex items-center gap-2.5">
          {/* Official FIA Flag Badge */}
          <div
            className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-2 border ${
              flagStatus === 'GREEN'
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : flagStatus === 'SC'
                ? 'bg-amber-950/90 border-amber-500 text-amber-300'
                : flagStatus === 'VSC'
                ? 'bg-orange-950/90 border-orange-500 text-orange-300'
                : flagStatus === 'RED'
                ? 'bg-red-950/90 border-red-500 text-red-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            <span className="tracking-wider">{flagStatus === 'GREEN' ? 'TRACK CLEAR' : `${flagStatus} FLAG`}</span>
          </div>

          {/* Stream Telemetry Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-[#0e1017] border border-[#202538] px-2.5 py-1 rounded text-[11px] font-mono text-zinc-400">
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              1080p50 HD
            </span>
            <span className="text-zinc-600">•</span>
            <span>5.2 Mbps</span>
            <span className="text-zinc-600">•</span>
            <span>60 FPS</span>
          </div>

          {/* Audio toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
            title={audioEnabled ? 'Mute Broadcast Audio' : 'Unmute Broadcast Audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Broadcast Stage Container */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 sm:p-4 max-w-7xl mx-auto w-full gap-4">
        {/* VIEW MODE 1: PROGRAM BROADCAST SCREEN */}
        {viewMode === 'PROGRAM' && (
          <div className="w-full flex flex-col items-center gap-3">
            <div
              ref={playerContainerRef}
              onDoubleClick={toggleFullscreen}
              className={`w-full ${
                isFullscreen
                  ? 'fixed inset-0 z-50 h-screen w-screen max-w-none rounded-none border-none bg-black'
                  : 'max-w-6xl aspect-video bg-[#050608] border border-[#1f2438] rounded-xl'
              } overflow-hidden relative shadow-2xl flex items-center justify-center`}
            >
              {/* Active Program Video Feed */}
              <SmoothVideoCanvas
                cameraId={activeCam?.id || production.activeCameraId}
                mediaStream={activeWebRtcStream}
                frameDataUrl={activeCamFrame}
                fallbackLabel={`INTERNATIONAL FEED • ${activeCam?.name || 'TRACK CAM'} STANDBY`}
                className="w-full h-full object-cover"
              />

              {/* Top-Left: FOM Official TV Broadcast Bug */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
                <div className="bg-[#0b0c10]/90 border border-white/10 backdrop-blur-md px-2.5 py-1 rounded text-xs font-mono flex items-center gap-2 shadow-lg">
                  <span className="bg-[#e10600] text-white px-1.5 py-0.2 rounded-sm text-[10px] font-black font-racing">
                    LIVE
                  </span>
                  <span className="text-white font-bold">{activeCam?.name || 'MAIN FEED'}</span>
                  <span className="text-zinc-400 text-[11px]">• {activeCam?.location || 'TRACK'}</span>
                </div>

                <div
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border backdrop-blur-md ${
                    flagStatus === 'GREEN'
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                      : flagStatus === 'SC'
                      ? 'bg-amber-950/90 border-amber-500 text-amber-300'
                      : 'bg-red-950/90 border-red-500 text-red-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>{flagStatus}</span>
                </div>
              </div>

              {/* Top-Right: Director / Stewards Note Chyron */}
              {production.showDirectorNote !== false && production.directorNote && (
                <div className="absolute top-3 right-3 z-20 bg-[#090b10]/95 backdrop-blur-md border-l-4 border-cyan-500 border-t border-r border-b border-zinc-800 px-3 py-1 rounded text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-xl">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">DIRECTOR:</span>
                  <span className="font-bold text-white">{production.directorNote}</span>
                </div>
              )}

              {/* Left Side: Authentic FOM Timing Tower Column (When enabled by Director) */}
              {production.showTowerOverlay && (
                <div className="absolute top-14 left-3 z-20 w-60 hidden md:block pointer-events-none">
                  <div className="bg-[#08090e]/92 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-2xl space-y-0.5 text-xs font-mono">
                    {/* Official FOM Session Countdown Clock (Shown Above POS / DRIVER when started for FP1, FP2, FP3, or Quali) */}
                    {isPracticeOrQuali && isSessionTimerStarted && (
                      <div className="mb-1.5 bg-[#0b0d14] border-b-2 border-red-600 rounded px-2 py-1.5 flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#e10600] text-white text-[9px] font-black px-1.5 py-0.5 rounded font-racing tracking-wider">
                            {sessionDisplayTag}
                          </span>
                          <span className="text-[10px] text-zinc-300 font-mono font-bold uppercase tracking-wider">
                            TIME
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono-racing font-bold text-xs tracking-wider">
                          <span className={`w-1.5 h-1.5 rounded-full ${raceState?.sessionTimerRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                          <span className={raceState?.sessionTimerRunning ? 'text-white' : 'text-amber-300'}>
                            {formattedSessionClock}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-zinc-400 border-b border-zinc-800/80 pb-1 font-bold uppercase tracking-wider px-1">
                      <span>POS / DRIVER</span>
                      <span>{raceState?.session === 'RACE' ? 'INTERVAL' : 'BEST'}</span>
                    </div>

                    {raceState?.drivers.slice(0, 8).map((drv, i) => {
                      const isOvertaker = overtakeAlert?.overtaker.id === drv.id;
                      const hasBestTime = drv.bestLapTime && drv.bestLapTime > 0;
                      return (
                        <div
                          key={drv.id}
                          className={`flex items-center justify-between py-1 px-1.5 rounded transition-all ${
                            isOvertaker ? 'bg-emerald-950/80 border border-emerald-500' : 'hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono-racing font-bold w-4 text-center text-xs ${i === 0 ? 'text-amber-400 font-black' : 'text-zinc-400'}`}>
                              {i + 1}
                            </span>
                            <div className="w-1 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: drv.color }} />
                            <span className="font-racing font-bold text-white text-xs tracking-wide">
                              {getDriverCode(drv.name)}
                            </span>
                            <span className="text-[11px] text-zinc-400 truncate max-w-[65px]">
                              {drv.name.split(' ')[0]}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-mono font-bold ${i === 0 ? 'text-amber-400' : 'text-zinc-300'}`}>
                              {raceState?.session === 'RACE'
                                ? (i === 0 ? 'LEADER' : (drv.interval || '-'))
                                : (hasBestTime ? `${drv.bestLapTime!.toFixed(2)}s` : '-')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CHEQUERED FLAG / GRAND PRIX WINNER OFFICIAL LOWER THIRD */}
              {production.showWinnerOverlay !== false && (raceState?.flagStatus === 'CHEQUERED' || raceState?.raceFinished) && (
                <div className="absolute top-16 left-4 right-4 z-40 flex justify-center pointer-events-none">
                  <div className="bg-[#0b0c10]/98 border-2 border-amber-400 rounded-xl p-4 sm:p-6 shadow-2xl max-w-lg w-full text-center space-y-2 backdrop-blur-md">
                    <div className="flex items-center justify-center gap-2 text-amber-400 font-racing font-bold text-xs tracking-widest uppercase">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>CHEQUERED FLAG • OFFICIAL RACE WINNER</span>
                    </div>

                    <div className="font-racing font-black text-2xl sm:text-3xl text-white tracking-wide">
                      {raceState?.winner?.name || raceState?.drivers[0]?.name}
                    </div>

                    <div className="text-xs font-mono text-zinc-300 flex items-center justify-center gap-2">
                      <span className="font-bold text-amber-400">
                        {raceState?.winner?.team || raceState?.drivers[0]?.team}
                      </span>
                      <span>•</span>
                      <span>COMPLETED {raceState?.totalLaps} LAPS</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TRACK HAZARD OFFICIAL CHYRON */}
              {production.showHazardOverlay !== false && hazardAlert && (
                <div className="absolute top-14 right-3 z-30 max-w-md w-full">
                  <div className="bg-[#0b0c10]/95 border-l-4 border-yellow-500 border border-zinc-800 rounded-lg p-3 shadow-2xl">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-yellow-400 uppercase tracking-widest mb-0.5">
                      <ShieldAlert className="w-4 h-4 text-yellow-400" />
                      <span>FIA TRACK HAZARD REPORT</span>
                    </div>
                    <div className="font-racing font-bold text-sm text-white">
                      {hazardAlert.hazardType}
                    </div>
                    <div className="text-xs text-zinc-300 font-mono mt-0.5">
                      Sector: <strong className="text-white">{hazardAlert.location}</strong> ({hazardAlert.description})
                    </div>
                  </div>
                </div>
              )}

              {/* PITTED DRIVER FORMAL BROADCAST CHYRON */}
              {pittedAlert && (
                <div className="absolute top-14 right-3 z-20">
                  <div className="bg-[#0b0c10]/95 border-l-4 border-amber-500 border border-zinc-800 rounded-lg px-3.5 py-2 shadow-2xl flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center font-mono-racing font-black text-xs text-black"
                      style={{ backgroundColor: pittedAlert.color }}
                    >
                      #{pittedAlert.driverNumber}
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                        PIT LANE • STOP #{pittedAlert.pitStops}
                      </div>
                      <div className="font-racing font-bold text-xs text-white">
                        {pittedAlert.driverName} ({pittedAlert.team})
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OVERTAKE OFFICIAL BROADCAST CHYRON */}
              {overtakeAlert && (
                <div className="absolute top-14 right-3 z-30 max-w-md w-full">
                  <div className="bg-[#0b0c10]/95 border-l-4 border-emerald-500 border border-zinc-800 rounded-lg p-3 shadow-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>POSITION CHANGE</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                        NOW P{overtakeAlert.overtaker.newPosition}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center font-mono-racing font-black text-xs text-black shrink-0"
                        style={{ backgroundColor: overtakeAlert.overtaker.color }}
                      >
                        #{overtakeAlert.overtaker.number}
                      </div>
                      <div className="text-xs">
                        <div className="font-racing font-bold text-white">
                          {overtakeAlert.overtaker.name} passed #{overtakeAlert.overtaken.number} {overtakeAlert.overtaken.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Location: {overtakeAlert.location || 'Turn 1 Apex'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BOTTOM TELEMETRY BAR: QUALIFYING FLYING LAP RUNNING CLOCK */}
              {production.showTimerOverlay && liveTimer && (
                <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-none">
                  <div className="bg-[#0b0c10]/95 border border-zinc-700/80 rounded-lg px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 max-w-2xl w-full">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center font-mono-racing font-black text-base text-black"
                        style={{ backgroundColor: liveTimer.teamColor || '#3671C6' }}
                      >
                        #{liveTimer.driverNumber}
                      </div>
                      <div>
                        <div className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase">
                          QUALIFYING FLYING LAP
                        </div>
                        <div className="font-racing font-bold text-sm text-white">
                          {liveTimer.driverName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <div className={`px-2 py-0.5 rounded border ${
                        liveTimer.s1Time !== null
                          ? 'bg-purple-950 border-purple-600 text-purple-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}>
                        S1: {liveTimer.s1Time ? `${liveTimer.s1Time.toFixed(2)}s` : '-'}
                      </div>
                      <div className={`px-2 py-0.5 rounded border ${
                        liveTimer.s2Time !== null
                          ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}>
                        S2: {liveTimer.s2Time ? `${liveTimer.s2Time.toFixed(2)}s` : '-'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[9px] font-mono text-zinc-400">RUNNING LAP</div>
                      <div className="font-mono-racing font-black text-xl text-white">
                        {formatTime(localTimerElapsed)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BOTTOM TELEMETRY CHYRON: FOM OFFICIAL TEAM RADIO GRAPHIC */}
              {production.showRadioOverlay && production.activeRadioBanner && (
                <div className="absolute bottom-16 left-3 right-3 md:right-auto md:w-96 z-30">
                  <div className="bg-[#0b0c10]/95 border-l-4 border-emerald-500 border-t border-r border-b border-zinc-800 rounded-lg p-3 shadow-2xl">
                    <div className="flex items-center justify-between mb-1.5 border-b border-zinc-800/80 pb-1">
                      <div className="flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-emerald-400" />
                        <span className="font-racing font-bold text-xs uppercase tracking-widest text-emerald-400">
                          FOM TEAM RADIO
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded">
                        TRANSMISSION
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded font-mono-racing font-bold text-xs text-black flex items-center justify-center shrink-0"
                        style={{ backgroundColor: production.activeRadioBanner.teamColor || '#E80020' }}
                      >
                        #{production.activeRadioBanner.driverNumber}
                      </div>
                      <div>
                        <div className="font-racing font-bold text-xs text-white">
                          {production.activeRadioBanner.senderName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {production.activeRadioBanner.senderRole.toUpperCase()} • TEAM CHANNEL
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs font-mono text-emerald-300 italic bg-emerald-950/30 p-2 rounded border border-emerald-800/40">
                      "{production.activeRadioBanner.transcript}"
                    </div>
                  </div>
                </div>
              )}

              {/* Player Bottom Corner Fullscreen Trigger */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-3 right-3 z-30 p-1.5 rounded bg-black/80 hover:bg-black border border-zinc-700 text-white backdrop-blur-md transition-colors"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Broadcast Control Bar directly beneath the video */}
            <div className="w-full max-w-6xl bg-[#0b0d13] border border-[#1b1f2e] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
              {/* Program vs Multi-Cam Mode Switch */}
              <div className="flex items-center gap-1.5 bg-[#07080c] p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setViewMode('PROGRAM')}
                  className="px-3 py-1.5 rounded text-xs font-racing font-bold flex items-center gap-1.5 transition-colors bg-[#e10600] text-white shadow-sm"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>DIRECTOR PROGRAM FEED</span>
                </button>

                <button
                  onClick={() => setViewMode('GRID')}
                  className="px-3 py-1.5 rounded text-xs font-racing font-bold flex items-center gap-1.5 transition-colors text-zinc-400 hover:text-white"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>MULTI-CAM MATRIX (5 ANGLES)</span>
                </button>
              </div>

              {/* Quick Camera Angle Switcher (CAM 1 - 5) */}
              <div className="flex items-center gap-1">
                {raceState?.cameras.map((cam, idx) => {
                  const isCur = cam.id === (activeCam?.id || production.activeCameraId);
                  return (
                    <button
                      key={cam.id}
                      onClick={() => radioEngine.switchCamera(cam.id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
                        isCur
                          ? 'bg-zinc-800 text-white border border-red-500'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                      title={cam.name}
                    >
                      CAM {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Quality & Fullscreen controls */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <select
                  value={selectedQuality}
                  onChange={(e) => setSelectedQuality(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-2 py-1 rounded outline-none"
                >
                  <option value="1080p">1080p60 HD</option>
                  <option value="720p">720p30</option>
                  <option value="auto">Auto Quality</option>
                </select>

                <button
                  onClick={toggleFullscreen}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1 rounded border border-zinc-800 flex items-center gap-1"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>FULLSCREEN</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 2: MULTI-CAM GRID VIEW */}
        {viewMode === 'GRID' && (
          <div className="w-full max-w-6xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#1b1f2e] pb-2">
              <h2 className="font-racing font-bold text-base text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-red-500" />
                <span>MULTI-CAM VIDEO SWITCHER MATRIX (ALL 5 ANGLES)</span>
              </h2>
              <button
                onClick={() => setViewMode('PROGRAM')}
                className="text-xs font-mono text-zinc-400 hover:text-white underline"
              >
                ← Return to Program View
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {raceState?.cameras.map((cam, idx) => {
                const isProgram = cam.id === production.activeCameraId;
                return (
                  <div
                    key={cam.id}
                    onClick={() => radioEngine.switchCamera(cam.id)}
                    className={`rounded-xl border overflow-hidden bg-[#0a0c12] cursor-pointer transition-all ${
                      isProgram
                        ? 'border-red-600 ring-2 ring-red-600/40 shadow-xl'
                        : 'border-[#1f2438] hover:border-zinc-700'
                    }`}
                  >
                    <div className="aspect-video bg-black relative flex items-center justify-center">
                      <SmoothVideoCanvas
                        cameraId={cam.id}
                        fallbackLabel={`CAM ${idx + 1} STANDBY`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-black/85 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5">
                        {isProgram ? (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            PROGRAM ON-AIR
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-bold">CAM {idx + 1}</span>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5 bg-[#0a0c12] flex items-center justify-between">
                      <div>
                        <div className="font-racing font-bold text-xs text-white">{cam.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{cam.location}</div>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                        TAP TO AIR
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Professional Broadcast Telemetry & Data Center (Below Video) */}
        <section className="w-full max-w-6xl bg-[#0b0d13] border border-[#1b1f2e] rounded-xl overflow-hidden shadow-xl mt-2">
          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-[#1b1f2e] bg-[#08090f] px-2 pt-2 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('timing')}
              className={`px-4 py-2 font-racing font-bold text-xs rounded-t-lg transition-colors border-t border-l border-r ${
                activeTab === 'timing'
                  ? 'bg-[#0b0d13] border-[#1b1f2e] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              OFFICIAL CLASSIFICATION & LIVE TIMING
            </button>
            <button
              onClick={() => setActiveTab('stewards')}
              className={`px-4 py-2 font-racing font-bold text-xs rounded-t-lg transition-colors border-t border-l border-r ${
                activeTab === 'stewards'
                  ? 'bg-[#0b0d13] border-[#1b1f2e] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              STEWARDS BULLETINS & EVENT LOG
            </button>
            <button
              onClick={() => setActiveTab('radio')}
              className={`px-4 py-2 font-racing font-bold text-xs rounded-t-lg transition-colors border-t border-l border-r ${
                activeTab === 'radio'
                  ? 'bg-[#0b0d13] border-[#1b1f2e] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              TEAM COMMS TRANSCRIPT LOG
            </button>
            <button
              onClick={() => setActiveTab('cams')}
              className={`px-4 py-2 font-racing font-bold text-xs rounded-t-lg transition-colors border-t border-l border-r ${
                activeTab === 'cams'
                  ? 'bg-[#0b0d13] border-[#1b1f2e] text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              TRACK CAMERA FEEDS ({raceState?.cameras.length || 5})
            </button>
          </div>

          <div className="p-4">
            {/* TAB 1: OFFICIAL LIVE CLASSIFICATION TABLE */}
            {activeTab === 'timing' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1b1f2e] text-[10px] text-zinc-400 uppercase tracking-wider">
                        <th className="py-2 px-2 text-center w-10">POS</th>
                        <th className="py-2 px-2 w-12 text-center">NO</th>
                        <th className="py-2 px-3">DRIVER / SQUAD</th>
                        <th className="py-2 px-2 text-center">LAPS</th>
                        <th className="py-2 px-3 text-right">BEST LAP</th>
                        <th className="py-2 px-3 text-right">LAST LAP</th>
                        <th className="py-2 px-3 text-right">INTERVAL</th>
                        <th className="py-2 px-3 text-right">GAP</th>
                        <th className="py-2 px-2 text-center">STOPS</th>
                        <th className="py-2 px-2 text-right">SPEED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#151824]">
                      {raceState?.drivers.map((drv, idx) => {
                        const hasBestTime = drv.bestLapTime && drv.bestLapTime > 0;
                        const isLeader = idx === 0;
                        const isFastestLap = raceState.fastestLapHolder?.driverName === drv.name;

                        return (
                          <tr key={drv.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="py-2.5 px-2 text-center font-mono-racing font-bold">
                              <span className={idx === 0 ? 'text-amber-400 font-black' : idx < 3 ? 'text-zinc-200' : 'text-zinc-400'}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono-racing font-bold text-black"
                                style={{ backgroundColor: drv.color }}
                              >
                                #{drv.number}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-racing font-bold text-sm text-white">
                                  {drv.name}
                                </span>
                                {isFastestLap && (
                                  <span className="bg-purple-950 text-purple-300 border border-purple-700 text-[9px] font-mono px-1 rounded font-bold">
                                    FL
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-400 font-mono block">
                                {drv.team}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-zinc-200">
                              {drv.lapsCompleted}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {hasBestTime ? (
                                <span className={isFastestLap ? 'text-purple-400 font-bold' : 'text-zinc-200'}>
                                  {drv.bestLapTime!.toFixed(3)}s
                                </span>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-zinc-300">
                              {drv.lastLapTime && drv.lastLapTime > 0 ? `${drv.lastLapTime.toFixed(3)}s` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-zinc-400 font-bold">
                              {isLeader ? '-' : (drv.interval || '-')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-zinc-300">
                              {isLeader ? 'LEADER' : (drv.gap || '-')}
                            </td>
                            <td className="py-2.5 px-2 text-center text-zinc-400">
                              {drv.pitStops}
                            </td>
                            <td className="py-2.5 px-2 text-right text-cyan-400 font-bold">
                              {drv.speedKmh} km/h
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* DHL FASTEST LAP OF SESSION BANNER */}
                {raceState?.fastestLapHolder && raceState.fastestLapHolder.time > 0 && (
                  <div className="bg-[#120a1f] border border-purple-800/60 rounded-lg p-3 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center text-white font-mono-racing font-bold text-xs">
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
                    <div className="font-mono-racing font-bold text-lg text-purple-300">
                      {raceState.fastestLapHolder.time.toFixed(3)}s
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STEWARDS BULLETINS & EVENT LOG */}
            {activeTab === 'stewards' && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {raceState?.events && raceState.events.length > 0 ? (
                  raceState.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="bg-[#090b10] p-2.5 rounded border border-[#1b1f2e] text-xs font-mono flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase">
                            {evt.type}
                          </span>
                          <span className="text-zinc-500 text-[10px]">LAP {evt.lap}</span>
                          <span className="text-zinc-600 text-[10px]">• {evt.timestamp}</span>
                        </div>
                        <div className="text-zinc-200">{evt.message}</div>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono">OFFICIAL</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500 font-mono text-xs">
                    No steward notices logged for current session.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TEAM COMMUNICATIONS TRANSCRIPT */}
            {activeTab === 'radio' && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {raceState?.transcripts && raceState.transcripts.length > 0 ? (
                  raceState.transcripts.map((t) => (
                    <div
                      key={t.id}
                      className="bg-[#090b10] p-2.5 rounded border border-[#1b1f2e] text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span className="font-bold text-emerald-400 uppercase">
                          {t.senderRole}: {t.senderName}
                        </span>
                        <span>{t.timestamp}</span>
                      </div>
                      <div className="text-zinc-200 italic">"{t.transcript}"</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500 font-mono text-xs">
                    No radio chatter or tactical quick chats logged yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: TRACK CAMERA FEEDS */}
            {activeTab === 'cams' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {raceState?.cameras.map((c, i) => (
                  <div key={c.id} className="bg-[#090b10] border border-[#1b1f2e] rounded p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-racing font-bold text-xs text-white">CAM {i + 1}: {c.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {c.isLive ? 'ONLINE' : 'STANDBY'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">{c.location}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Operator: {c.operatorName || 'Track Marshal'}</div>
                    </div>
                    <button
                      onClick={() => radioEngine.switchCamera(c.id)}
                      className="mt-3 w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono py-1 rounded border border-zinc-800 transition-colors"
                    >
                      Switch Program Feed to this Angle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Broadcast Technical Footer */}
      <footer className="bg-[#07080c] border-t border-[#1b1f2e] py-3 px-4 text-center text-xs font-mono text-zinc-500">
        FIA FORMULA 1 WORLD CHAMPIONSHIP™ BROADCAST SYSTEM • ALL TELEMETRY & MULTI-CAM STREAMS ARE TIME-SYNCED
      </footer>
    </div>
  );
};

