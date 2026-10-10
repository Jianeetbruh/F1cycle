// f1Cycle Real-time Engine: Radio, Speech-to-Text, Timer & Camera Angles
import { soundEffects } from '../utils/audioFx';

export interface DriverState {
  id: string;
  number: number;
  name: string;
  team: string;
  color: string;
  bikeType: string;
  tyreCompound: 'SOFT' | 'MEDIUM' | 'HARD' | 'WET';
  lapsCompleted: number;
  currentLapTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  gap: string;
  interval: string;
  speedKmh: number;
  cadenceRpm: number;
  tyreWearPercent: number;
  pitStops: number;
  status: 'TRACK' | 'PIT' | 'OUT' | 'DNF' | 'FINISHED';
  penaltySeconds: number;
  isDriverOnline: boolean;
  isEngineerOnline: boolean;
  photoUrl?: string;
}

export interface LiveTimerState {
  isActive: boolean;
  driverId: string;
  driverName: string;
  driverNumber: number;
  teamColor: string;
  startTimestamp: number | null;
  currentElapsedMs: number;
  s1Time: number | null;
  s2Time: number | null;
  s3Time: number | null;
  deltaToPole: number | null;
  isProvisionalPole: boolean;
  status: 'OUT_LAP' | 'FLYING_LAP' | 'IN_LAP' | 'COMPLETED';
}

export interface CameraAngle {
  id: string;
  name: string;
  location: string;
  isLive: boolean;
  operatorName: string;
  lastFrameUrl?: string;
  updatedAt: number;
}

export interface RadioTranscript {
  id: string;
  teamId: string;
  senderRole: 'driver' | 'engineer';
  senderName: string;
  driverNumber: number;
  teamColor: string;
  transcript: string;
  timestamp: string;
  audioData?: string;
  status: 'pending' | 'on_air' | 'dismissed';
}

export interface StreamProduction {
  activeCameraId: string;
  showTimerOverlay: boolean;
  showRadioOverlay: boolean;
  showTowerOverlay: boolean;
  showTelemetryOverlay: boolean;
  showWinnerOverlay?: boolean;
  showFlagOverlay?: boolean;
  showHazardOverlay?: boolean;
  showDirectorNote?: boolean;
  directorNote: string;
  activeRadioBanner: RadioTranscript | null;
}

export interface RaceEvent {
  id: string;
  timestamp: string;
  lap: number;
  type: 'FLAG' | 'RADIO' | 'FASTEST_LAP' | 'OVERTAKE' | 'PENALTY' | 'PIT' | 'SYSTEM';
  message: string;
  team?: string;
  driverNumber?: number;
}

export interface CompletedLapRecord {
  id: string;
  lapNumber: number;
  driverId: string;
  driverName: string;
  driverNumber: number;
  team: string;
  teamColor: string;
  lapTimeSec: number;
  s1?: number | null;
  s2?: number | null;
  s3?: number | null;
  isFastestLap?: boolean;
  isPersonalBest?: boolean;
  timestamp: string;
}

export interface RaceState {
  circuitName: string;
  raceName?: string;
  isTestMode?: boolean;
  raceFormat?: 'FULL_WEEKEND' | 'QUICK_RACE' | 'TEST';
  lapLengthMeters: number;
  totalLaps: number;
  currentLap: number;
  session: 'P1' | 'P2' | 'P3' | 'Q1' | 'RACE' | 'PODIUM';
  flagStatus: 'GREEN' | 'YELLOW' | 'RED' | 'SC' | 'VSC' | 'CHEQUERED';
  safetyCarDeployed: boolean;
  vscDeployed: boolean;
  lightsStage: number;
  lightsOutTimestamp: number | null;
  sessionStartTime: number | null;
  sessionRemainingSeconds: number;
  sessionTotalSeconds?: number;
  sessionTimerRunning?: boolean;
  practiceDurationMinutes?: number;
  qualifyingDurationMinutes?: number;
  fastestLapHolder: { driverName: string; team: string; time: number } | null;
  provisionalPoleTime: number;
  raceFinished?: boolean;
  winner?: { id: string; name: string; number: number; team: string; color: string; photoUrl?: string } | null;
  drivers: DriverState[];
  events: RaceEvent[];
  lapHistory: CompletedLapRecord[];
  liveTimer: LiveTimerState;
  cameras: CameraAngle[];
  production: StreamProduction;
  transcripts: RadioTranscript[];
}

export interface RadioTransmission {
  id: string;
  senderRole: string;
  senderName: string;
  teamId: string;
  audioData?: string;
  duration?: number;
  transcript?: string;
  timestamp: string;
}

export const METERED_ICE_SERVERS: RTCIceServer[] = (() => {
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS_JSON as string | undefined;
    const parsed = raw ? JSON.parse(raw) : [];
    return [ ...(Array.isArray(parsed) ? parsed : []), { urls: 'stun:stun.l.google.com:19302' } ];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
})();

type StateListener = (state: RaceState) => void;
type RadioListener = (transmission: RadioTransmission) => void;
type PttListener = (isTalking: boolean, role: string, name: string) => void;
type StatusListener = (connected: boolean, peerOnline: boolean) => void;
type FrameListener = (cameraId: string, frameDataUrl: string) => void;
type FlagAlertListener = (flag: string, message: string, durationSec: number) => void;
type LightsListener = (stage: number) => void;
type PittedListener = (data: any) => void;

export interface OvertakeEventData {
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
}
type OvertakeListener = (data: OvertakeEventData) => void;

export interface FlyingLapRequest {
  teamId: string;
  driverId: string;
  driverName: string;
  driverNumber: number;
  engineerName: string;
  timestamp: string;
}
export type FlyingLapListener = (request: FlyingLapRequest) => void;
export type FlyingLapConfirmedListener = (data: { driverId: string; driverName: string }) => void;
export type TranscriptListener = (transcript: RadioTranscript) => void;

class RadioEngine {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Speech Recognition for live English transcription
  private recognition: any = null;
  public currentTranscript: string = '';

  private clientId: string = '';
  private roomId: string = 'societygp';
  private role: string = 'spectator';
  private teamId: string = 'team-redbull';
  private name: string = 'Participant';

  private isConnected: boolean = false;
  private isPeerOnline: boolean = false;
  private isTalkingLocal: boolean = false;
  private iceServers: RTCIceServer[] = METERED_ICE_SERVERS;

  private stateListeners: Set<StateListener> = new Set();
  private radioListeners: Set<RadioListener> = new Set();
  private pttListeners: Set<PttListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private frameListeners: Set<FrameListener> = new Set();
  private flagAlertListeners: Set<FlagAlertListener> = new Set();
  private lightsListeners: Set<LightsListener> = new Set();
  private pittedListeners: Set<PittedListener> = new Set();
  private overtakeListeners: Set<OvertakeListener> = new Set();
  private flyingLapListeners: Set<FlyingLapListener> = new Set();
  private flyingLapConfirmedListeners: Set<FlyingLapConfirmedListener> = new Set();
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private hazardListeners: Set<(hazard: any) => void> = new Set();
  private rawMessageListeners: Set<(msg: any) => void> = new Set();

  public currentRaceState: RaceState | null = null;
  public radioHistory: RadioTransmission[] = [];

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    try {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let full = '';
          for (let i = 0; i < event.results.length; ++i) {
            full += event.results[i][0].transcript + ' ';
          }
          this.currentTranscript = full.trim();
        };

        this.recognition.onerror = (e: any) => {
          console.warn('Speech recognition status:', e?.error || e);
        };
      }
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
    }
  }

  connect(roomId: string, role: string, teamId: string, name: string) {
    this.roomId = roomId || 'societygp';
    this.role = role;
    this.teamId = teamId;
    this.name = name;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn(e);
      }
    }

    const configuredServer = new URLSearchParams(window.location.search).get('server');
    const serverBase = configuredServer || (import.meta.env.VITE_SIGNAL_SERVER_URL as string | undefined);
    const serverUrl = serverBase ? new URL(serverBase, window.location.origin) : new URL(window.location.origin);
    const protocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${serverUrl.host}${serverUrl.pathname !== '/' ? serverUrl.pathname : ''}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus();

        this.send({
          type: 'join',
          roomId: this.roomId,
          role: this.role,
          teamId: this.teamId,
          name: this.name,
        });

        this.initWebRTC();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
          this.rawMessageListeners.forEach((l) => {
            try {
              l(msg);
            } catch (e) {
              console.warn('Raw message listener error', e);
            }
          });
        } catch (e) {
          console.error('Failed to parse WS msg:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WS error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isPeerOnline = false;
        this.notifyStatus();
        this.cleanupWebRTC();
        setTimeout(() => {
          if (!this.isConnected) {
            this.connect(this.roomId, this.role, this.teamId, this.name);
          }
        }, 3000);
      };
    } catch (e) {
      console.error('WS connection error:', e);
    }
  }

  private async initWebRTC() {
    this.cleanupWebRTC();
    try {
      this.pc = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 2,
      });

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.send({
            type: 'signal:ice_candidate',
            teamId: this.teamId,
            candidate: event.candidate,
          });
        }
      };

      this.pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        remoteAudio.play().catch(e => console.warn('Autoplay error', e));
      };

      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === 'connected') {
          this.isPeerOnline = true;
          this.notifyStatus();
        }
      };
    } catch (e) {
      console.warn('WebRTC init error', e);
    }
  }

  private async handleServerMessage(msg: any) {
    if (msg.type === 'init') {
      this.clientId = msg.clientId;
      if (msg.iceServers) this.iceServers = msg.iceServers;
      if (msg.raceState) {
        this.currentRaceState = msg.raceState;
        this.notifyState();
      }
    }

    if (msg.type === 'state:update') {
      this.currentRaceState = msg.raceState;
      this.notifyState();
    }

    if (msg.type === 'camera:frame_feed') {
      this.frameListeners.forEach(listener => listener(msg.cameraId, msg.frameDataUrl));
    }

    if (msg.type === 'radio:ptt_status') {
      this.pttListeners.forEach(l => l(msg.isTalking, msg.role, msg.name));
    }

    if (msg.type === 'radio:on_stream_alert') {
      soundEffects.playRadioChirp();
    }

    if (msg.type === 'flag:urgent_alert') {
      if (msg.flag === 'YELLOW') soundEffects.playWarningHorn();
      else if (msg.flag === 'SC' || msg.flag === 'VSC') soundEffects.playSafetyCarHorn();
      else soundEffects.playRadioChirp();

      if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]);
      this.flagAlertListeners.forEach(l => l(msg.flag, msg.message, msg.durationSec || 4));
    }

    if (msg.type === 'lights:update') {
      this.lightsListeners.forEach(l => l(msg.stage));
    }

    if (msg.type === 'stream:driver_pitted') {
      soundEffects.playRadioChirp();
      this.pittedListeners.forEach(l => l(msg));
    }

    if (msg.type === 'hazard:alert') {
      soundEffects.playWarningHorn();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      this.hazardListeners.forEach(l => l(msg.hazard));
    }

    if (msg.type === 'stream:overtake') {
      soundEffects.playRadioChirp();
      this.overtakeListeners.forEach(l => l(msg));
    }

    if (msg.type === 'flying_lap:requested') {
      soundEffects.playRadioChirp();
      this.flyingLapListeners.forEach(l => l(msg));
    }

    if (msg.type === 'flying_lap:confirmed') {
      soundEffects.playRadioChirp();
      this.flyingLapConfirmedListeners.forEach(l => l(msg));
    }

    if (msg.type === 'radio:transcript_incoming' || msg.type === 'production:new_transcript') {
      if (msg.transcript) {
        this.transcriptListeners.forEach(l => l(msg.transcript));
      }
    }

    if (msg.type === 'radio:audio_incoming' || msg.type === 'radio:broadcast_chatter') {
      const transmission: RadioTransmission = {
        id: msg.id || `trans_${Date.now()}`,
        senderRole: msg.senderRole,
        senderName: msg.senderName,
        teamId: msg.teamId,
        audioData: msg.audioData,
        duration: msg.duration,
        transcript: msg.transcript,
        timestamp: msg.timestamp || new Date().toLocaleTimeString(),
      };

      this.radioHistory.unshift(transmission);
      if (this.radioHistory.length > 30) this.radioHistory.pop();
      this.radioListeners.forEach(l => l(transmission));

      const isForMe = msg.teamId === this.teamId || this.role === 'spectator' || this.role === 'control' || this.role === 'director';
      if (isForMe) {
        if (msg.audioData) {
          this.playIncomingRadioClip(msg.audioData, msg.transcript);
        } else if (msg.transcript) {
          soundEffects.speakRadioPhrase(msg.transcript);
        }
      }
    }
  }

  playIncomingRadioClip(audioBase64: string, fallbackTranscript?: string) {
    soundEffects.unlockAudio();
    soundEffects.playRadioChirp();
    setTimeout(() => {
      const audio = new Audio(audioBase64);
      audio.volume = 1.0;
      audio.onended = () => soundEffects.playRadioEnd();
      audio.onerror = () => {
        soundEffects.playRadioEnd();
        if (fallbackTranscript) {
          soundEffects.speakRadioPhrase(fallbackTranscript);
        }
      };
      audio.play().catch(e => {
        console.warn('Audio playback error', e);
        if (fallbackTranscript) {
          soundEffects.speakRadioPhrase(fallbackTranscript);
        }
      });
    }, 180);
  }

  // Push to talk with English Speech-to-Text Transcription
  async startPTT(): Promise<boolean> {
    if (this.isTalkingLocal) return true;
    this.isTalkingLocal = true;
    this.currentTranscript = '';

    if ('vibrate' in navigator) navigator.vibrate(50);
    soundEffects.playRadioChirp();

    this.send({
      type: 'radio:ptt_status',
      isTalking: true,
    });

    // Start browser Speech Recognition
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // already started or busy
      }
    }

    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      }

      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.warn('Microphone permission error:', err);
      return false;
    }
  }

  stopPTT() {
    if (!this.isTalkingLocal) return;
    this.isTalkingLocal = false;

    if ('vibrate' in navigator) navigator.vibrate(30);
    soundEffects.playRadioEnd();

    this.send({
      type: 'radio:ptt_status',
      isTalking: false,
    });

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }

    const finalTranscript = this.currentTranscript.trim() || `${this.role.toUpperCase()} transmission`;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            this.send({
              type: 'radio:voice_chunk',
              teamId: this.teamId,
              audioData: base64Audio,
              duration: audioBlob.size,
              transcript: finalTranscript,
            });
            this.send({
              type: 'radio:transcript',
              text: finalTranscript,
              audioData: base64Audio,
            });
          };
        } else {
          // If audio blob was empty, transmit transcript immediately
          this.send({
            type: 'radio:voice_chunk',
            teamId: this.teamId,
            transcript: finalTranscript,
            duration: 1200,
          });
          this.send({
            type: 'radio:transcript',
            text: finalTranscript,
          });
        }
      };
      this.mediaRecorder.stop();
    } else {
      // In case mediaRecorder wasn't active, transmit transcript fallback
      this.send({
        type: 'radio:voice_chunk',
        teamId: this.teamId,
        transcript: finalTranscript,
        duration: 1200,
      });
      this.send({
        type: 'radio:transcript',
        text: finalTranscript,
      });
    }
  }

  // Send a manual or predefined transcript to the stream
  sendManualTranscript(text: string) {
    this.send({
      type: 'radio:transcript',
      text,
    });
  }

  // Canned radio callout
  sendCannedRadioCall(phrase: string) {
    soundEffects.speakRadioPhrase(phrase);
    this.send({
      type: 'radio:voice_chunk',
      teamId: this.teamId,
      transcript: phrase,
      duration: 1500,
    });
    this.send({
      type: 'radio:transcript',
      text: phrase,
    });
  }

  // Lap Timekeeper Actions
  startFlyingLap(driverId: string) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'timer:action',
      action: 'START_FLYING_LAP',
      payload: { driverId },
    });
  }

  splitSector1(timeSec: number) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'timer:action',
      action: 'SPLIT_SECTOR_1',
      payload: { time: timeSec },
    });
  }

  splitSector2(timeSec: number) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'timer:action',
      action: 'SPLIT_SECTOR_2',
      payload: { time: timeSec },
    });
  }

  finishLap(totalLapTimeSec: number, s3Sec: number) {
    soundEffects.playFastestLapFanfare();
    this.send({
      type: 'timer:action',
      action: 'FINISH_LAP',
      payload: { lapTimeSec: totalLapTimeSec, s3: s3Sec },
    });
  }

  resetTimer() {
    this.send({
      type: 'timer:action',
      action: 'RESET_TIMER',
      payload: {},
    });
  }

  setTimerDriver(driverId: string) {
    this.send({
      type: 'timer:action',
      action: 'SET_DRIVER',
      payload: { driverId },
    });
  }

  // Flying Lap Team -> Timekeeper Handshake
  requestFlyingLap(teamId: string, driverId: string, driverName: string, driverNumber: number, engineerName: string) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'flying_lap:request',
      teamId,
      driverId,
      driverName,
      driverNumber,
      engineerName,
    });
  }

  onFlyingLapRequest(listener: FlyingLapListener) {
    this.flyingLapListeners.add(listener);
    return () => this.flyingLapListeners.delete(listener);
  }

  onFlyingLapConfirmed(listener: FlyingLapConfirmedListener) {
    this.flyingLapConfirmedListeners.add(listener);
    return () => this.flyingLapConfirmedListeners.delete(listener);
  }

  onTranscript(listener: TranscriptListener) {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  // Camera Actions
  sendCameraFrame(cameraId: string, frameDataUrl: string, operatorName?: string, location?: string, cameraName?: string) {
    if (this.isSocketBusy()) {
      return; // Drop stale frame to prevent socket lag and buffer queueing
    }
    this.send({
      type: 'camera:frame_update',
      cameraId,
      frameDataUrl,
      operatorName,
      location,
      cameraName,
    });
  }

  updateCameraInfo(cameraId: string, name: string, location: string, operatorName?: string) {
    this.send({
      type: 'camera:update_info',
      cameraId,
      name,
      location,
      operatorName,
    });
  }

  // Video Director / Angle Switcher Actions
  switchCamera(cameraId: string) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'production:action',
      action: 'SWITCH_CAMERA',
      payload: { cameraId },
    });
  }

  toggleOverlay(
    overlayName: 'timer' | 'radio' | 'tower' | 'telemetry' | 'winner' | 'flag' | 'hazard' | 'directorNote',
    value: boolean
  ) {
    this.send({
      type: 'production:action',
      action: 'TOGGLE_OVERLAY',
      payload: { overlayName, value },
    });
  }

  setAllOverlays(value: boolean) {
    this.send({
      type: 'production:action',
      action: 'SET_ALL_OVERLAYS',
      payload: { value },
    });
  }

  putRadioOnStream(transcriptId: string) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'production:action',
      action: 'PUT_RADIO_ON_STREAM',
      payload: { transcriptId },
    });
  }

  dismissRadioBanner() {
    this.send({
      type: 'production:action',
      action: 'DISMISS_RADIO_BANNER',
      payload: {},
    });
  }

  setDirectorNote(note: string) {
    this.send({
      type: 'production:action',
      action: 'SET_DIRECTOR_NOTE',
      payload: { note },
    });
  }

  // Camera Marshal Track Hazard Report to Race Director
  reportTrackHazard(
    cameraId: string,
    hazardType: string,
    description?: string,
    location?: string,
    cameraName?: string,
    operatorName?: string
  ) {
    soundEffects.playWarningHorn();
    this.send({
      type: 'camera:hazard_report',
      cameraId,
      cameraName,
      location,
      hazardType,
      description,
      operatorName,
    });
  }

  onTrackHazard(cb: (hazard: any) => void): () => void {
    this.hazardListeners.add(cb);
    return () => {
      this.hazardListeners.delete(cb);
    };
  }

  // Race Director tap-to-speak broadcast to all stations
  sendDirectorBroadcast(text: string, audioData?: string) {
    soundEffects.playRadioChirp();
    this.send({
      type: 'radio:audio_clip',
      transcript: `[RACE DIRECTOR] ${text}`,
      audioData,
      duration: 3,
    });
  }

  // Race Control
  sendRaceAction(action: string, payload: any) {
    this.send({
      type: 'race:action',
      action,
      payload,
    });
  }

  sendTelemetry(speedKmh: number, cadenceRpm: number) {
    this.send({
      type: 'telemetry:live',
      speedKmh,
      cadenceRpm,
    });
  }

  // Race Control helpers
  updateDriver(driverId: string, updates: { name?: string; number?: number; team?: string; bikeType?: string; color?: string; photoUrl?: string }) {
    this.sendRaceAction('UPDATE_DRIVER', { driverId, ...updates });
  }

  removeDriver(driverId: string) {
    this.sendRaceAction('REMOVE_DRIVER', { driverId });
  }

  addDriver(driver: DriverState) {
    this.sendRaceAction('ADD_DRIVER', { driver });
  }

  removeLapTime(driverId: string, lapRecordId?: string) {
    soundEffects.playRadioChirp();
    this.sendRaceAction('REMOVE_LAP', { driverId, lapRecordId });
  }

  setTotalLaps(totalLaps: number) {
    this.sendRaceAction('SET_TOTAL_LAPS', { totalLaps });
  }

  markDriverPitted(driverId: string) {
    this.sendRaceAction('DRIVER_PITTED', { driverId });
  }

  recordFinishLinePass(driverId: string) {
    this.sendRaceAction('PASS_FINISH_LINE', { driverId });
  }

  overtakeDriver(driverId: string, location?: string) {
    this.sendRaceAction('OVERTAKE_DRIVER', { driverId, location });
  }

  startSessionTimer(durationMinutes?: number) {
    soundEffects.playRadioChirp();
    this.sendRaceAction('START_SESSION_TIMER', { durationMinutes });
  }

  pauseSessionTimer() {
    soundEffects.playRadioChirp();
    this.sendRaceAction('PAUSE_SESSION_TIMER', {});
  }

  resetSessionTimer(durationMinutes?: number) {
    soundEffects.playRadioChirp();
    this.sendRaceAction('RESET_SESSION_TIMER', { durationMinutes });
  }

  advanceSession() {
    soundEffects.playRadioChirp();
    this.sendRaceAction('ADVANCE_SESSION', {});
  }

  createNewRace(config: {
    raceName: string;
    isTestMode: boolean;
    format: 'FULL_WEEKEND' | 'QUICK_RACE' | 'TEST';
    totalLaps?: number;
    drivers?: any[];
    practiceDurationMinutes?: number;
    qualifyingDurationMinutes?: number;
  }) {
    soundEffects.playRadioChirp();
    this.sendRaceAction('CREATE_NEW_RACE', config);
  }

  sendRaw(data: object) {
    this.send(data);
  }

  isSocketBusy(): boolean {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount > 64 * 1024);
  }

  getClientId(): string {
    return this.clientId;
  }

  onRawMessage(cb: (msg: any) => void): () => void {
    this.rawMessageListeners.add(cb);
    return () => {
      this.rawMessageListeners.delete(cb);
    };
  }

  private send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private cleanupWebRTC() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {
        console.warn(e);
      }
      this.pc = null;
    }
  }

  // Listeners
  onRaceState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    if (this.currentRaceState) cb(this.currentRaceState);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  onRadio(cb: RadioListener): () => void {
    this.radioListeners.add(cb);
    return () => {
      this.radioListeners.delete(cb);
    };
  }

  onPTT(cb: PttListener): () => void {
    this.pttListeners.add(cb);
    return () => {
      this.pttListeners.delete(cb);
    };
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.isConnected, this.isPeerOnline);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  onCameraFrame(cb: FrameListener): () => void {
    this.frameListeners.add(cb);
    return () => {
      this.frameListeners.delete(cb);
    };
  }

  onFlagAlert(cb: FlagAlertListener): () => void {
    this.flagAlertListeners.add(cb);
    return () => {
      this.flagAlertListeners.delete(cb);
    };
  }

  onLightsAlert(cb: LightsListener): () => void {
    this.lightsListeners.add(cb);
    return () => {
      this.lightsListeners.delete(cb);
    };
  }

  onDriverPitted(cb: PittedListener): () => void {
    this.pittedListeners.add(cb);
    return () => {
      this.pittedListeners.delete(cb);
    };
  }

  onOvertake(cb: OvertakeListener): () => void {
    this.overtakeListeners.add(cb);
    return () => {
      this.overtakeListeners.delete(cb);
    };
  }

  private notifyState() {
    if (this.currentRaceState) {
      this.stateListeners.forEach(l => l(this.currentRaceState!));
    }
  }

  private notifyStatus() {
    this.statusListeners.forEach(l => l(this.isConnected, this.isPeerOnline));
  }
}

export const radioEngine = new RadioEngine();
