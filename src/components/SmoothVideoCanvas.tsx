import React, { useRef, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { webrtcVideoEngine, WebRTCVideoStats } from '../services/webrtcVideoEngine';
import { radioEngine } from '../services/radioEngine';

interface SmoothVideoCanvasProps {
  cameraId?: string;
  mediaStream?: MediaStream | null;
  frameDataUrl?: string;
  fallbackLabel?: string;
  className?: string;
  showBadge?: boolean;
  mirror?: boolean;
}

export const SmoothVideoCanvas: React.FC<SmoothVideoCanvasProps> = ({
  cameraId,
  mediaStream: propMediaStream,
  frameDataUrl: propFrameDataUrl,
  fallbackLabel = 'STANDBY FEED',
  className = 'w-full h-full object-cover',
  showBadge = true,
  mirror = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalStream, setInternalStream] = useState<MediaStream | null>(null);
  const [internalFrame, setInternalFrame] = useState<string | null>(null);
  const [hasWebRtcVideo, setHasWebRtcVideo] = useState<boolean>(false);
  const [hasReceivedFrame, setHasReceivedFrame] = useState<boolean>(false);
  const [stats, setStats] = useState<WebRTCVideoStats | null>(null);
  const imageLoaderRef = useRef<HTMLImageElement | null>(null);
  const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';

  useEffect(() => {
    if (!debugEnabled || !cameraId) return;
    let disposed = false;
    const poll = async () => {
      const next = await webrtcVideoEngine.getStats(cameraId);
      if (!disposed && next) setStats(next);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [cameraId, debugEnabled]);

  // Subscribe to WebRTC & frame feed if cameraId is provided and no mediaStream passed
  useEffect(() => {
    if (!cameraId) return;

    let unsubWebRtc = () => {};
    if (propMediaStream === undefined) {
      unsubWebRtc = webrtcVideoEngine.subscribeCamera(cameraId, (stream) => {
        setInternalStream(stream);
      });
    }

    const unsubFrame = radioEngine.onCameraFrame((camId, dataUrl) => {
      if (camId === cameraId) {
        setInternalFrame(dataUrl);
      }
    });

    return () => {
      unsubWebRtc();
      unsubFrame();
    };
  }, [cameraId, propMediaStream]);

  const activeStream = propMediaStream !== undefined ? propMediaStream : internalStream;
  const activeFrameUrl = propFrameDataUrl || internalFrame;

  // Bind WebRTC MediaStream directly to HTML5 video element for hardware 60fps playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (activeStream && activeStream.getVideoTracks().length > 0) {
      video.srcObject = activeStream;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setHasWebRtcVideo(true);
        }).catch((err) => {
          console.warn('Autoplay error on WebRTC stream', err);
        });
      }

      const handlePlaying = () => {
        setHasWebRtcVideo(true);
      };

      const handleLoadedData = () => {
        setHasWebRtcVideo(true);
      };

      video.addEventListener('playing', handlePlaying);
      video.addEventListener('loadeddata', handleLoadedData);

      const handleTrackEnd = () => {
        setHasWebRtcVideo(false);
      };

      activeStream.getVideoTracks().forEach(t => t.addEventListener('ended', handleTrackEnd));

      return () => {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('loadeddata', handleLoadedData);
        activeStream.getVideoTracks().forEach(t => t.removeEventListener('ended', handleTrackEnd));
      };
    } else {
      video.srcObject = null;
      setHasWebRtcVideo(false);
    }
  }, [activeStream]);

  // Zero-flicker double-buffered frame drawing to canvas
  useEffect(() => {
    if (!activeFrameUrl || hasWebRtcVideo) return;

    if (!imageLoaderRef.current) {
      imageLoaderRef.current = new Image();
    }
    const img = imageLoaderRef.current;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 360;
      }

      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasReceivedFrame(true);
      }
    };

    img.src = activeFrameUrl;
  }, [activeFrameUrl, hasWebRtcVideo]);

  const hasAnyFeed = hasWebRtcVideo || hasReceivedFrame || !!activeFrameUrl;

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black select-none">
      {/* 1. Standby placeholder if no feed yet */}
      {!hasAnyFeed && (
        <div className={`flex flex-col items-center justify-center bg-zinc-950 text-zinc-600 font-mono text-xs ${className}`}>
          <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center mb-1">
            <div className="w-2 h-2 rounded-full bg-zinc-700 animate-ping" />
          </div>
          <span>{fallbackLabel}</span>
        </div>
      )}

      {/* 2. Zero-flicker Hardware Canvas for fallback snapshot frames */}
      <canvas
        ref={canvasRef}
        className={`${className} absolute inset-0 transition-opacity duration-200 ${
          hasWebRtcVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          display: !hasWebRtcVideo && hasAnyFeed ? 'block' : 'none',
        }}
      />

      {/* 3. Native Hardware WebRTC Video Player (Silky Smooth 30-60 FPS) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted
        className={`${className} absolute inset-0 transition-opacity duration-150 ${
          hasWebRtcVideo ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
        }`}
        style={{
          objectFit: 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none',
        }}
      />

      {debugEnabled && cameraId && (
        <div className="absolute top-1 right-1 z-30 rounded bg-black/85 border border-white/20 px-1.5 py-1 text-[9px] leading-3 font-mono text-lime-200 pointer-events-none">
          <div>RTC {stats?.connectionState || 'waiting'}</div>
          <div>{stats?.fps != null ? `${stats.fps.toFixed(1)} fps` : '— fps'} · {stats?.width && stats?.height ? `${stats.width}×${stats.height}` : '—'}</div>
          <div>{stats?.bitrateKbps != null ? `${Math.round(stats.bitrateKbps)} kbps` : '— kbps'} · RTT {stats?.rttMs != null ? `${Math.round(stats.rttMs)} ms` : '—'}</div>
          <div>J {stats?.jitterBufferDelayMs != null ? `${Math.round(stats.jitterBufferDelayMs)} ms` : '—'} · loss {stats?.packetsLost ?? '—'}</div>
          {stats?.qualityLimitationReason && <div>limit {stats.qualityLimitationReason}</div>}
        </div>
      )}

      {/* Live status badge */}
      {showBadge && hasAnyFeed && (
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none">
          {hasWebRtcVideo ? (
            <span className="bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md backdrop-blur-sm font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>WEBRTC 60FPS SMOOTH</span>
            </span>
          ) : (
            <span className="bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              <span>LIVE CAM</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
