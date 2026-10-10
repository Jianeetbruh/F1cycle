import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  SwitchCamera,
  Radio,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  ShieldAlert,
  Zap,
  MapPin,
  User,
  Settings,
  Flame,
  Volume2,
  Lock,
  Mic,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { radioEngine, RaceState, CameraAngle } from '../services/radioEngine';
import { webrtcVideoEngine } from '../services/webrtcVideoEngine';
import { soundEffects } from '../utils/audioFx';
import { securityEngine } from '../utils/security';
import { PasscodeLockModal } from './PasscodeLockModal';

interface CameraStationProps {
  initialCamId?: string;
}

export const CameraStation: React.FC<CameraStationProps> = ({ initialCamId = 'cam-1' }) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => securityEngine.isStationUnlocked('camera'));
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);

  // Parse query params if user visited /camera?id=cam-2 or ?name=Turn+1
  const searchParams = new URLSearchParams(window.location.search);
  const paramCamId = searchParams.get('id') || searchParams.get('cam') || initialCamId;
  const paramLocation = searchParams.get('location') || '';

  const [selectedCamId, setSelectedCamId] = useState<string>(paramCamId);
  const [cameraName, setCameraName] = useState<string>(`Camera ${paramCamId.replace('cam-', '')}`);
  const [customLocation, setCustomLocation] = useState<string>(paramLocation || 'Main Gate Hairpin');
  const [operatorName, setOperatorName] = useState<string>('Camera Operator');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [simulatedFeed, setSimulatedFeed] = useState<boolean>(false);
  const [captureRateFps, setCaptureRateFps] = useState<number>(30); // 30-60 fps smooth
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [framesSent, setFramesSent] = useState<number>(0);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true); // Video call mirror mode

  // Marshal Radio & Hazard Reporting State
  const [isRadioActive, setIsRadioActive] = useState<boolean>(false);
  const [hazardNotice, setHazardNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const wasOnAirRef = useRef<boolean>(false);

  // Sync with raceState
  useEffect(() => {
    if (!isUnlocked) return;

    radioEngine.connect('societygp', 'camera', selectedCamId, operatorName);

    const unsub = radioEngine.onRaceState((state) => {
      setRaceState(state);
      const cam = state.cameras.find(c => c.id === selectedCamId);
      if (cam) {
        if (!customLocation || customLocation === 'Location not set') {
          if (cam.location && cam.location !== 'Location not set') {
            setCustomLocation(cam.location);
          }
        }
        if (cam.name) setCameraName(cam.name);
      }

      // Check if went ON AIR -> chime beep!
      const nowOnAir = state.production.activeCameraId === selectedCamId;
      if (nowOnAir && !wasOnAirRef.current) {
        soundEffects.playRadioChirp();
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
      wasOnAirRef.current = nowOnAir;
    });

    return () => {
      unsub();
      stopCamera();
    };
  }, [selectedCamId]);

  const isOnAir = raceState?.production.activeCameraId === selectedCamId;

  // Broadcast location & camera details update
  const handleSaveLocationInfo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    radioEngine.updateCameraInfo(selectedCamId, cameraName, customLocation, operatorName);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Marshal Radio to Race Director
  const toggleCameraRadio = async () => {
    if (isRadioActive) {
      setIsRadioActive(false);
      radioEngine.stopPTT();
      soundEffects.playRadioChirp();
    } else {
      setIsRadioActive(true);
      await radioEngine.startPTT();
      soundEffects.playRadioChirp();
    }
  };

  // Report Track Hazard to Race Director
  const reportHazard = (hazardType: string, description: string) => {
    soundEffects.playWarningHorn();
    radioEngine.reportTrackHazard(
      selectedCamId,
      hazardType,
      description,
      customLocation,
      cameraName,
      operatorName
    );
    setHazardNotice(`⚠️ ${hazardType} sent directly to Race Director!`);
    setTimeout(() => setHazardNotice(null), 4000);
  };

  // Start real device camera smoothly (no lag, hardware-accelerated)
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      // Crisp 720p HD broadcast capture (natively supported across 100% of mobile & desktop cameras)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, min: 20 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn('High-res constraints rejected, falling back to basic video constraint', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track && (track as any).getCapabilities) {
        try {
          const caps = (track as any).getCapabilities();
          if ('torch' in caps) setHasTorch(true);
        } catch (e) {}
      }

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        try {
          await video.play();
        } catch {
          // If immediate autoplay was deferred by browser, wait briefly for data
          await new Promise<void>((resolve) => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
            const onReady = () => {
              video.removeEventListener('loadeddata', onReady);
              resolve();
            };
            video.addEventListener('loadeddata', onReady);
            setTimeout(resolve, 350);
          });
          try { await video.play(); } catch {}
        }
      }

      setIsStreaming(true);
      isStreamingRef.current = true;
      setSimulatedFeed(false);

      // Tell server our camera is live with custom name and location
      radioEngine.updateCameraInfo(selectedCamId, cameraName, customLocation, operatorName);

      // Publish hardware MediaStream to WebRTC Engine for silky smooth 60fps video
      webrtcVideoEngine.publishCamera(selectedCamId, stream);

      // Start efficient requestAnimationFrame processing loop for hardware-sync rendering
      runCameraProcessingLoop();
    } catch (err: any) {
      console.warn('Camera capture error:', err);
      setCameraError('Camera access unavailable or blocked. Switching to simulated track feed mode.');
      startSimulatedFeed();
    }
  };

  // High-efficiency requestAnimationFrame loop for real-time capture without thread freezing
  const runCameraProcessingLoop = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const loop = (timestamp: number) => {
      if (!isStreamingRef.current) return;

      const video = videoRef.current;
      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        !video.paused
      ) {
        // Relaxed thumbnail snapshot interval (2.5 fps): eliminates main-thread lag while WebRTC streams silky 60fps
        const targetIntervalMs = 400;
        const elapsed = timestamp - lastFrameTimeRef.current;

        if (elapsed >= targetIntervalMs) {
          lastFrameTimeRef.current = timestamp;
          captureAndSendFrame(video);
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  const stopCamera = () => {
    isStreamingRef.current = false;
    webrtcVideoEngine.unpublishCamera(selectedCamId);

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Safe, non-glitch frame capture with backpressure protection and dedicated offscreen buffer
  const captureAndSendFrame = (video: HTMLVideoElement) => {
    // Drop frame if socket buffer has backpressure or previous frame encoding is in flight
    if (radioEngine.isSocketBusy() || isCapturingRef.current) {
      return;
    }

    isCapturingRef.current = true;
    try {
      let canvas = offscreenCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        offscreenCanvasRef.current = canvas;
      }

      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!ctx) return;

      // Fast hardware downscale from camera feed
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Crisp corner HUD watermark
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, canvas.width, 28);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px Rajdhani, monospace';
      ctx.fillText(`f1Cycle LIVE • ${cameraName.toUpperCase()}`, 10, 18);

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '10px monospace';
      ctx.fillText(customLocation, 260, 18);

      // High-clarity 0.65 JPEG compression (~16KB per frame, crisp visuals)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      radioEngine.sendCameraFrame(selectedCamId, dataUrl, operatorName, customLocation, cameraName);
      setFramesSent(prev => prev + 1);
    } catch (e) {
      console.warn('Frame capture error', e);
    } finally {
      isCapturingRef.current = false;
    }
  };

  // Smooth simulated cycling track view using requestAnimationFrame for 60fps rendering
  const startSimulatedFeed = () => {
    stopCamera();
    setSimulatedFeed(true);
    setIsStreaming(true);
    isStreamingRef.current = true;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 640;
      canvas.height = 360;
    }

    // Extract live MediaStream from simulated canvas for WebRTC
    setTimeout(() => {
      const c = canvasRef.current;
      if (c && (c as any).captureStream) {
        try {
          const simStream = (c as any).captureStream(30);
          streamRef.current = simStream;
          webrtcVideoEngine.publishCamera(selectedCamId, simStream);
        } catch (e) {
          console.warn('Canvas captureStream error:', e);
        }
      }
    }, 100);

    let frame = 0;
    let lastNetworkBroadcastTime = 0;
    const networkIntervalMs = 125; // 8 fps max snapshot broadcast

    const renderLoop = (timestamp: number) => {
      if (!isStreamingRef.current) return;

      frame++;
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d', { desynchronized: true });
        if (ctx) {
          // Asphalt
          ctx.fillStyle = '#121214';
          ctx.fillRect(0, 0, c.width, c.height);

          // Curving Kerb
          for (let i = 0; i < c.width; i += 24) {
            ctx.fillStyle = (i / 24) % 2 === 0 ? '#ef4444' : '#ffffff';
            ctx.fillRect(i, 220, 24, 16);
          }

          // Moving cyclist animation
          const bikeX = (frame * 5) % (c.width + 80) - 40;
          ctx.fillStyle = '#3671C6';
          ctx.beginPath();
          ctx.arc(bikeX, 175, 14, 0, Math.PI * 2);
          ctx.fill();

          // Cyclist label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Rajdhani, sans-serif';
          ctx.fillText('🚴 #1 VER (35 km/h)', bikeX - 25, 150);

          // Watermark
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, 0, c.width, 28);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(`f1Cycle LIVE • ${cameraName.toUpperCase()}`, 10, 19);

          ctx.fillStyle = '#fbbf24';
          ctx.fillText(customLocation, 220, 19);

          // Send throttled network frame
          if (timestamp - lastNetworkBroadcastTime >= networkIntervalMs) {
            lastNetworkBroadcastTime = timestamp;
            if (!radioEngine.isSocketBusy()) {
              const dataUrl = c.toDataURL('image/jpeg', 0.65);
              radioEngine.sendCameraFrame(selectedCamId, dataUrl, operatorName, customLocation, cameraName);
              setFramesSent(prev => prev + 1);
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);
  };

  const handleLockStation = () => {
    securityEngine.lockStation('camera');
    stopCamera();
    setIsUnlocked(false);
  };

  if (!isUnlocked) {
    return (
      <PasscodeLockModal
        type="station"
        targetId="camera"
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white select-none flex flex-col justify-between transition-colors duration-200 ${
      isOnAir ? 'ring-8 ring-red-600 ring-inset' : ''
    }`}>
      {/* Top Standalone Bar */}
      <div className="bg-zinc-950/95 border-b border-zinc-800 p-3 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-mono-racing font-bold text-lg text-white shadow-lg">
            CAM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-racing font-bold text-base text-white">
                {cameraName}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-cyan-400">
                {customLocation}
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
              <span>Op: {operatorName}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500">{selectedCamId.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Tally / On Air Status Pill & Header Buttons */}
        <div className="flex items-center gap-2">
          {isOnAir ? (
            <div className="bg-red-600 text-white font-mono-racing font-bold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg shadow-red-950/80">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              <span>🔴 ON AIR PROGRAM FEED!</span>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>STANDBY FEED</span>
            </div>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300"
            title="Setup Location & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={handleLockStation}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
            title="Lock Camera Station"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 relative">
        <div className="w-full max-w-4xl aspect-video bg-zinc-950 border-2 border-zinc-800 rounded-3xl overflow-hidden relative shadow-2xl flex items-center justify-center">
          {/* Real video feed (mirror mode enabled for video-call clarity) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-transform duration-200 ${simulatedFeed || !isStreaming ? 'hidden' : 'block'}`}
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
          />

          {/* Canvas for simulated feed or capture */}
          <canvas
            ref={canvasRef}
            className={`w-full h-full object-cover ${simulatedFeed ? 'block' : 'hidden'}`}
          />

          {!isStreaming && (
            <div className="text-center p-8 space-y-3 z-10">
              <Camera className="w-16 h-16 text-zinc-600 mx-auto animate-pulse" />
              <div className="font-racing font-bold text-2xl text-white">
                Camera Stream Inactive
              </div>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Tap <strong>"Start Camera Stream"</strong> below to broadcast your phone camera live to the Video Director and main f1Cycle stream.
              </p>
            </div>
          )}

          {/* Viewfinder Overlays */}
          {isStreaming && (
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
              <div className="bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-zinc-700 text-xs font-mono flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="text-white font-bold">{cameraName}</span>
                <span className="text-zinc-400">• {customLocation}</span>
              </div>

              <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  WEBRTC 60FPS
                </span>
                <span>• {framesSent} FRAMES</span>
              </div>
            </div>
          )}

          {/* Big ON AIR Screen Flasher */}
          {isOnAir && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-600/90 text-white p-3 rounded-2xl text-center font-racing font-bold text-sm sm:text-base animate-pulse shadow-2xl flex items-center justify-center gap-2 pointer-events-none z-20">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span>YOU ARE LIVE ON STREAM! KEEP CAMERA STEADY ON CYCLISTS!</span>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="mt-3 max-w-md bg-amber-950/70 border border-amber-600/60 p-3 rounded-2xl text-xs font-mono text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Camera Controls Bar */}
      <div className="bg-zinc-950/95 border-t border-zinc-800 p-3 sm:p-5 z-20">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {!isStreaming ? (
            <button
              onClick={startCamera}
              className="flex-1 min-w-[200px] bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-racing font-bold text-base py-4 rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" />
              <span>START CAMERA STREAM</span>
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="flex-1 min-w-[200px] bg-red-600 hover:bg-red-500 active:scale-98 text-white font-racing font-bold text-base py-4 rounded-2xl shadow-xl shadow-red-950/50 flex items-center justify-center gap-2"
            >
              <VideoOff className="w-5 h-5" />
              <span>STOP STREAM</span>
            </button>
          )}

          <button
            onClick={() => {
              setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
              if (isStreaming && !simulatedFeed) startCamera();
            }}
            className="bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-200 font-racing font-bold text-sm px-5 py-4 rounded-2xl border border-zinc-700 flex items-center gap-2"
          >
            <SwitchCamera className="w-5 h-5 text-cyan-400" />
            <span>FLIP ({facingMode === 'environment' ? 'BACK' : 'FRONT'})</span>
          </button>

          <button
            onClick={() => setIsMirrored(prev => !prev)}
            className={`font-racing font-bold text-sm px-4 py-4 rounded-2xl border flex items-center gap-2 transition-all ${
              isMirrored
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
            title="Mirror like a video call"
          >
            <Layers className="w-4 h-4" />
            <span>{isMirrored ? '🪞 MIRROR ON' : 'MIRROR OFF'}</span>
          </button>

          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`font-racing font-bold text-sm px-5 py-4 rounded-2xl border flex items-center gap-2 transition-all ${
                torchOn
                  ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-500/50'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
              title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
            >
              <Zap className="w-5 h-5" />
              <span>{torchOn ? 'TORCH ON' : 'TORCH'}</span>
            </button>
          )}

          <button
            onClick={simulatedFeed ? startCamera : startSimulatedFeed}
            className="bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-amber-300 font-racing font-bold text-sm px-5 py-4 rounded-2xl border border-zinc-800 flex items-center gap-2"
          >
            <Eye className="w-5 h-5" />
            <span>{simulatedFeed ? 'REAL CAMERA' : 'SIMULATE TRACK'}</span>
          </button>
        </div>

        {/* CAMERA MARSHAL RADIO & TRACK HAZARD COMMS */}
        <div className="max-w-4xl mx-auto pt-3 border-t border-zinc-800 space-y-2 mt-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="font-racing font-bold text-xs uppercase tracking-wider text-white">
                MARSHAL RADIO & TRACK HAZARD ALERT TO RACE DIRECTOR
              </span>
            </div>
            {hazardNotice && (
              <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" /> {hazardNotice}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {/* Radio to Director Button */}
            <button
              type="button"
              onClick={toggleCameraRadio}
              className={`py-3 px-3 rounded-xl font-racing font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 border ${
                isRadioActive
                  ? 'bg-red-600 border-red-400 text-white animate-pulse'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
              }`}
            >
              <Mic className={`w-4 h-4 ${isRadioActive ? 'animate-bounce' : 'text-emerald-400'}`} />
              <span>{isRadioActive ? 'ON AIR: TAP TO FINISH' : 'RADIO TO DIRECTOR'}</span>
            </button>

            {/* Fast Track Hazard Buttons */}
            <button
              type="button"
              onClick={() => reportHazard('DEBRIS ON TRACK', `Debris spotted on racing line at ${customLocation}`)}
              className="bg-yellow-950/70 hover:bg-yellow-900 border border-yellow-700 text-yellow-300 text-xs font-mono py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <span>⚠️ DEBRIS ON TRACK</span>
            </button>

            <button
              type="button"
              onClick={() => reportHazard('RIDER INCIDENT / CRASH', `Crash or stopped rider at ${customLocation}`)}
              className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-red-300 text-xs font-mono py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>💥 CRASH / INCIDENT</span>
            </button>

            <button
              type="button"
              onClick={() => reportHazard('YELLOW FLAG REQUEST', `Marshal requesting Yellow Flag at ${customLocation}`)}
              className="bg-amber-950/70 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-mono py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>🟡 REQUEST YELLOW</span>
            </button>
          </div>
        </div>
      </div>

      {/* Volunteer Station Setup & Custom Location Modal / Drawer */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                  CAMERA MAN STATION SETUP
                </span>
                <h3 className="font-racing font-bold text-xl text-white mt-0.5">
                  Name Your Track Location
                </h3>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800 px-2 py-1 rounded-lg"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveLocationInfo} className="space-y-3">
              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  CAMERA CHANNEL / NUMBER:
                </label>
                <select
                  value={selectedCamId}
                  onChange={(e) => {
                    setSelectedCamId(e.target.value);
                    setCameraName(`Camera ${e.target.value.replace('cam-', '')}`);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="cam-1">Camera 1 (cam-1)</option>
                  <option value="cam-2">Camera 2 (cam-2)</option>
                  <option value="cam-3">Camera 3 (cam-3)</option>
                  <option value="cam-4">Camera 4 (cam-4)</option>
                  <option value="cam-5">Camera 5 (cam-5)</option>
                  <option value="cam-6">Camera 6 (cam-6)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  TRACK CORNER LOCATION:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Finish Straight',
                    'Corner 1',
                    'Corner 2',
                    'Corner 3',
                    'Corner 4',
                    'Corner 5',
                    'Corner 6',
                  ].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setCustomLocation(loc)}
                      className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                        customLocation === loc
                          ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Corner 1, Corner 2, Finish Straight"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  CAMERA OPERATOR NAME:
                </label>
                <input
                  type="text"
                  placeholder="Your Name (e.g. Samarth)"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  STREAM FRAME RATE:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { fps: 15, label: 'Fast (15 fps)' },
                    { fps: 30, label: 'Smooth (30 fps)' },
                    { fps: 60, label: 'Ultra (60 fps)' },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.fps}
                      onClick={() => setCaptureRateFps(item.fps)}
                      className={`py-2 rounded-xl text-xs font-mono border ${
                        captureRateFps === item.fps
                          ? 'bg-red-600 border-red-500 text-white font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-sm py-3 rounded-xl shadow-lg mt-2"
              >
                SAVE & SYNC TO DIRECTOR
              </button>

              {savedNotice && (
                <div className="text-center text-xs font-mono text-emerald-400">
                  ✓ Location synced with Video Director!
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
