import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '25mb' }));

// Video is always peer-to-peer. Optional free Metered Open Relay credentials
// may be supplied as ICE_SERVERS_JSON; the server never relays media.
const configuredIceServers = (() => {
  try {
    const parsed = process.env.ICE_SERVERS_JSON ? JSON.parse(process.env.ICE_SERVERS_JSON) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('Ignoring invalid ICE_SERVERS_JSON');
    return [];
  }
})();
export const ICE_SERVERS = [
  ...configuredIceServers,
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
];

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
  raceStatus: 'IDLE' | 'ACTIVE' | 'FINISHED';
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

const defaultDrivers: DriverState[] = [];

const defaultCameras: CameraAngle[] = [
  {
    id: 'cam-1',
    name: 'Camera 1',
    location: 'Finish Straight',
    isLive: false,
    operatorName: 'Camera Operator 1',
    updatedAt: Date.now(),
  },
  {
    id: 'cam-2',
    name: 'Camera 2',
    location: 'Corner 1',
    isLive: false,
    operatorName: 'Camera Operator 2',
    updatedAt: Date.now(),
  },
  {
    id: 'cam-3',
    name: 'Camera 3',
    location: 'Corner 2',
    isLive: false,
    operatorName: 'Camera Operator 3',
    updatedAt: Date.now(),
  },
  {
    id: 'cam-4',
    name: 'Camera 4',
    location: 'Corner 3',
    isLive: false,
    operatorName: 'Camera Operator 4',
    updatedAt: Date.now(),
  },
  {
    id: 'cam-5',
    name: 'Camera 5',
    location: 'Corner 4',
    isLive: false,
    operatorName: 'Camera Operator 5',
    updatedAt: Date.now(),
  },
];

interface RoomData {
  id: string;
  raceState: RaceState;
  clients: Map<string, { ws: WebSocket; role: string; teamId: string; name: string }>;
}

const rooms = new Map<string, RoomData>();

function getOrCreateRoom(roomId: string = 'societygp'): RoomData {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      raceState: {
        circuitName: 'Metro Jazz Circuit',
        raceName: 'Metro Jazz Grand Prix',
        isTestMode: false,
        raceFormat: 'FULL_WEEKEND',
        raceStatus: 'IDLE',
        lapLengthMeters: 480,
        totalLaps: 12,
        currentLap: 1,
        session: 'P1',
        flagStatus: 'GREEN',
        safetyCarDeployed: false,
        vscDeployed: false,
        lightsStage: 0,
        lightsOutTimestamp: null,
        sessionStartTime: Date.now(),
        sessionRemainingSeconds: 1800,
        sessionTotalSeconds: 1800,
        sessionTimerRunning: false,
        practiceDurationMinutes: 30,
        qualifyingDurationMinutes: 15,
        fastestLapHolder: null,
        provisionalPoleTime: 0,
        drivers: JSON.parse(JSON.stringify(defaultDrivers)),
        events: [
          {
            id: 'evt-init',
            timestamp: new Date().toLocaleTimeString(),
            lap: 1,
            type: 'SYSTEM',
            message: 'f1Cycle Hub Live. Metro Jazz Grand Prix ready on Metro Jazz Circuit.',
          },
        ],
        lapHistory: [],
        liveTimer: {
          isActive: false,
          driverId: '',
          driverName: '',
          driverNumber: 0,
          teamColor: '#71717a',
          startTimestamp: null,
          currentElapsedMs: 0,
          s1Time: null,
          s2Time: null,
          s3Time: null,
          deltaToPole: null,
          isProvisionalPole: false,
          status: 'OUT_LAP',
        },
        cameras: JSON.parse(JSON.stringify(defaultCameras)),
        production: {
          activeCameraId: 'cam-1',
          showTimerOverlay: true,
          showRadioOverlay: true,
          showTowerOverlay: true,
          showTelemetryOverlay: true,
          showWinnerOverlay: true,
          showFlagOverlay: true,
          showHazardOverlay: true,
          showDirectorNote: true,
          directorNote: 'RACE SESSION UNDERWAY • METRO JAZZ GRAND PRIX',
          activeRadioBanner: null,
        },
        transcripts: [],
      },
      clients: new Map(),
    });
  }
  return rooms.get(roomId)!;
}

// REST Endpoints
app.get('/api/ice-servers', (_req, res) => {
  res.json({ iceServers: ICE_SERVERS });
});

app.get('/api/race-state', (req, res) => {
  const roomId = (req.query.room as string) || 'societygp';
  const room = getOrCreateRoom(roomId);
  res.json(room.raceState);
});

function broadcastToRoom(room: RoomData, message: object, excludeClientId?: string) {
  const payload = JSON.stringify(message);
  for (const [clientId, client] of room.clients.entries()) {
    if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastToTeam(room: RoomData, teamId: string, message: object, excludeClientId?: string) {
  const payload = JSON.stringify(message);
  for (const [clientId, client] of room.clients.entries()) {
    if (client.teamId === teamId && clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// WebSocket Connection Handling
wss.on('connection', (ws: WebSocket) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let currentRoomId = 'societygp';
  let clientRole = 'spectator';
  let clientTeamId = '';
  let clientName = 'Anonymous';

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        currentRoomId = msg.roomId || 'societygp';
        clientRole = msg.role || 'spectator';
        clientTeamId = msg.teamId || '';
        clientName = msg.name || 'Participant';

        const room = getOrCreateRoom(currentRoomId);
        room.clients.set(clientId, { ws, role: clientRole, teamId: clientTeamId, name: clientName });

        if (clientTeamId) {
          const d = room.raceState.drivers.find(drv => drv.id === clientTeamId);
          if (d) {
            if (clientRole === 'driver') d.isDriverOnline = true;
            if (clientRole === 'engineer') d.isEngineerOnline = true;
          }
        }

        ws.send(JSON.stringify({
          type: 'init',
          clientId,
          iceServers: ICE_SERVERS,
          raceState: room.raceState,
        }));

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      const room = getOrCreateRoom(currentRoomId);

      // WebRTC Signaling (for video and audio peer connections)
      if (
        msg.type.startsWith('signal:') ||
        msg.type.startsWith('webrtc:')
      ) {
        const targetClientId = msg.targetClientId;
        if (targetClientId && room.clients.has(targetClientId)) {
          const target = room.clients.get(targetClientId)!;
          if (target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              ...msg,
              fromClientId: clientId,
              fromRole: clientRole,
              fromTeamId: clientTeamId,
            }));
          }
        } else if (msg.teamId) {
          broadcastToTeam(room, msg.teamId, {
            ...msg,
            fromClientId: clientId,
            fromRole: clientRole,
            fromTeamId: clientTeamId,
          }, clientId);
        } else {
          // Broadcast signaling to all peers (for cameras / video director)
          broadcastToRoom(room, {
            ...msg,
            fromClientId: clientId,
            fromRole: clientRole,
          }, clientId);
        }
      }

      // Live Timer / Stopwatch Controls (From the Lap Timekeeper)
      if (msg.type === 'timer:action') {
        const { action, payload } = msg;

        if (action === 'START_FLYING_LAP') {
          room.raceState.liveTimer.isActive = true;
          room.raceState.liveTimer.driverId = payload.driverId;
          const drv = room.raceState.drivers.find(d => d.id === payload.driverId);
          if (drv) {
            room.raceState.liveTimer.driverName = drv.name;
            room.raceState.liveTimer.driverNumber = drv.number;
            room.raceState.liveTimer.teamColor = drv.color;
          }
          room.raceState.liveTimer.startTimestamp = Date.now();
          room.raceState.liveTimer.currentElapsedMs = 0;
          room.raceState.liveTimer.s1Time = null;
          room.raceState.liveTimer.s2Time = null;
          room.raceState.liveTimer.s3Time = null;
          room.raceState.liveTimer.deltaToPole = null;
          room.raceState.liveTimer.isProvisionalPole = false;
          room.raceState.liveTimer.status = 'FLYING_LAP';

          room.raceState.events.unshift({
            id: `evt-fly-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'SYSTEM',
            message: `FLYING LAP STARTED: ${room.raceState.liveTimer.driverName} on flying lap!`,
          });
        }

        if (action === 'SPLIT_SECTOR_1') {
          room.raceState.liveTimer.s1Time = payload.time;
          // Calculate delta against pole lap S1 (assuming baseline ~12.4s)
          const delta = +(payload.time - 12.31).toFixed(3);
          room.raceState.liveTimer.deltaToPole = delta;
        }

        if (action === 'SPLIT_SECTOR_2') {
          room.raceState.liveTimer.s2Time = payload.time;
          const s1 = room.raceState.liveTimer.s1Time || 12.31;
          const totalS1S2 = s1 + payload.time;
          const poleS1S2 = 12.31 + 14.12;
          room.raceState.liveTimer.deltaToPole = +(totalS1S2 - poleS1S2).toFixed(3);
        }

        if (action === 'FINISH_LAP') {
          const totalLapTime = payload.lapTimeSec;
          room.raceState.liveTimer.isActive = false;
          room.raceState.liveTimer.status = 'COMPLETED';
          room.raceState.liveTimer.currentElapsedMs = Math.round(totalLapTime * 1000);

          const drv = room.raceState.drivers.find(d => d.id === room.raceState.liveTimer.driverId);
          if (drv) {
            // Strictly cap at totalLaps in RACE session. Cannot exceed race distance!
            if (room.raceState.session === 'RACE' && drv.lapsCompleted >= room.raceState.totalLaps) {
              drv.lapsCompleted = room.raceState.totalLaps;
              drv.status = 'FINISHED';
              broadcastToRoom(room, { type: 'state:update', raceState: room.raceState });
              return;
            }

            drv.lapsCompleted += 1;
            drv.lastLapTime = totalLapTime;
            drv.s1 = room.raceState.liveTimer.s1Time;
            drv.s2 = room.raceState.liveTimer.s2Time;
            drv.s3 = payload.s3;

            if (!drv.bestLapTime || totalLapTime < drv.bestLapTime) {
              drv.bestLapTime = totalLapTime;
            }

            // In RACE, check if this driver completed the full race
            let isRaceWinner = false;
            if (room.raceState.session === 'RACE' && drv.lapsCompleted >= room.raceState.totalLaps) {
              drv.lapsCompleted = room.raceState.totalLaps;
              drv.status = 'FINISHED';

              if (room.raceState.flagStatus !== 'CHEQUERED') {
                isRaceWinner = true;
                room.raceState.flagStatus = 'CHEQUERED';
                room.raceState.raceFinished = true;
                room.raceState.raceStatus = 'FINISHED';
                room.raceState.winner = {
                  id: drv.id,
                  name: drv.name,
                  number: drv.number,
                  team: drv.team,
                  color: drv.color,
                };

                broadcastToRoom(room, {
                  type: 'flag:urgent_alert',
                  flag: 'CHEQUERED',
                  durationSec: 8,
                  message: `🏁 CHEQUERED FLAG! #${drv.number} ${drv.name} WINS THE RACE!`,
                });
              }
            } else if (room.raceState.session === 'RACE') {
              drv.status = 'TRACK';
            }

            if (drv.lapsCompleted > room.raceState.currentLap && drv.lapsCompleted <= room.raceState.totalLaps) {
              room.raceState.currentLap = drv.lapsCompleted;
            }

            // Check if Provisional Pole
            if (totalLapTime < room.raceState.provisionalPoleTime) {
              room.raceState.provisionalPoleTime = totalLapTime;
              room.raceState.liveTimer.isProvisionalPole = true;
              room.raceState.fastestLapHolder = {
                driverName: drv.name,
                team: drv.team,
                time: totalLapTime,
              };

              room.raceState.events.unshift({
                id: `evt-pole-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                lap: drv.lapsCompleted,
                type: 'FASTEST_LAP',
                message: `PROVISIONAL POLE POSITION! ${drv.name} goes fastest with ${totalLapTime.toFixed(3)}s!`,
              });
            }

            // Automatically log completed lap into lapHistory
            if (!room.raceState.lapHistory) room.raceState.lapHistory = [];
            const isPersonalBest = !drv.bestLapTime || totalLapTime <= drv.bestLapTime;
            const isRaceFastest = !room.raceState.fastestLapHolder || totalLapTime <= room.raceState.fastestLapHolder.time;
            const lapRecord: CompletedLapRecord = {
              id: `lap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              lapNumber: drv.lapsCompleted,
              driverId: drv.id,
              driverName: drv.name,
              driverNumber: drv.number,
              team: drv.team,
              teamColor: drv.color,
              lapTimeSec: totalLapTime,
              s1: room.raceState.liveTimer.s1Time,
              s2: room.raceState.liveTimer.s2Time,
              s3: payload.s3,
              isFastestLap: isRaceFastest,
              isPersonalBest,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            room.raceState.lapHistory.unshift(lapRecord);
            if (room.raceState.lapHistory.length > 200) room.raceState.lapHistory.pop();
          }

          recalculateStandings(room.raceState);
        }

        if (action === 'RESET_TIMER') {
          room.raceState.liveTimer.isActive = false;
          room.raceState.liveTimer.startTimestamp = null;
          room.raceState.liveTimer.currentElapsedMs = 0;
          room.raceState.liveTimer.s1Time = null;
          room.raceState.liveTimer.s2Time = null;
          room.raceState.liveTimer.s3Time = null;
          room.raceState.liveTimer.status = 'OUT_LAP';
        }

        if (action === 'SET_DRIVER') {
          const drv = room.raceState.drivers.find(d => d.id === payload.driverId);
          if (drv) {
            room.raceState.liveTimer.driverId = drv.id;
            room.raceState.liveTimer.driverName = drv.name;
            room.raceState.liveTimer.driverNumber = drv.number;
            room.raceState.liveTimer.teamColor = drv.color;
            room.raceState.liveTimer.status = 'OUT_LAP';

            // Broadcast confirmation back to the team pit wall!
            broadcastToTeam(room, drv.id, {
              type: 'flying_lap:confirmed',
              driverId: drv.id,
              driverName: drv.name,
            });

            room.raceState.events.unshift({
              id: `evt-prime-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              lap: drv.lapsCompleted,
              type: 'SYSTEM',
              message: `TIMEKEEPER SIGNAL: #${drv.number} ${drv.name} primed on timing gantry for flying lap!`,
            });
          }
        }

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // Camera Angle updates from camera phones
      if (msg.type === 'camera:frame_update') {
        const { cameraId, frameDataUrl, operatorName, location, cameraName } = msg;
        const cam = room.raceState.cameras.find(c => c.id === cameraId);
        if (cam) {
          cam.lastFrameUrl = frameDataUrl;
          cam.isLive = true;
          cam.updatedAt = Date.now();
          if (operatorName) cam.operatorName = operatorName;
          if (location) cam.location = location;
          if (cameraName) cam.name = cameraName;
        }

        // Broadcast to Video Director and viewers
        broadcastToRoom(room, {
          type: 'camera:frame_feed',
          cameraId,
          frameDataUrl,
          location,
          cameraName,
        }, clientId);
      }

      // Camera Operator custom location and name setup
      if (msg.type === 'camera:update_info') {
        const { cameraId, name, location, operatorName } = msg;
        let cam = room.raceState.cameras.find(c => c.id === cameraId);
        if (!cam) {
          cam = {
            id: cameraId,
            name: name || `Camera ${cameraId}`,
            location: location || 'Custom Location',
            isLive: true,
            operatorName: operatorName || 'Camera Volunteer',
            updatedAt: Date.now(),
          };
          room.raceState.cameras.push(cam);
        } else {
          if (name) cam.name = name;
          if (location) cam.location = location;
          if (operatorName) cam.operatorName = operatorName;
          cam.updatedAt = Date.now();
        }

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // Video Director / Angle Guy Controls
      if (msg.type === 'production:action') {
        const { action, payload } = msg;

        if (action === 'SWITCH_CAMERA') {
          room.raceState.production.activeCameraId = payload.cameraId;
          room.raceState.events.unshift({
            id: `evt-cam-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'SYSTEM',
            message: `BROADCAST: Director switched program feed to ${payload.cameraId.toUpperCase()}`,
          });
        }

        if (action === 'TOGGLE_OVERLAY') {
          const { overlayName, value } = payload;
          if (overlayName === 'timer') room.raceState.production.showTimerOverlay = value;
          if (overlayName === 'radio') room.raceState.production.showRadioOverlay = value;
          if (overlayName === 'tower') room.raceState.production.showTowerOverlay = value;
          if (overlayName === 'telemetry') room.raceState.production.showTelemetryOverlay = value;
          if (overlayName === 'winner') room.raceState.production.showWinnerOverlay = value;
          if (overlayName === 'flag') room.raceState.production.showFlagOverlay = value;
          if (overlayName === 'hazard') room.raceState.production.showHazardOverlay = value;
          if (overlayName === 'directorNote') room.raceState.production.showDirectorNote = value;
        }

        if (action === 'SET_ALL_OVERLAYS') {
          const { value } = payload;
          room.raceState.production.showTimerOverlay = value;
          room.raceState.production.showRadioOverlay = value;
          room.raceState.production.showTowerOverlay = value;
          room.raceState.production.showTelemetryOverlay = value;
          room.raceState.production.showWinnerOverlay = value;
          room.raceState.production.showFlagOverlay = value;
          room.raceState.production.showHazardOverlay = value;
          room.raceState.production.showDirectorNote = value;
        }

        if (action === 'PUT_RADIO_ON_STREAM') {
          const { transcriptId } = payload;
          const tr = room.raceState.transcripts.find(t => t.id === transcriptId);
          if (tr) {
            tr.status = 'on_air';
            room.raceState.production.activeRadioBanner = tr;
            room.raceState.production.showRadioOverlay = true;

            // Broadcast to everyone
            broadcastToRoom(room, {
              type: 'radio:on_stream_alert',
              transcript: tr,
            });
          }
        }

        if (action === 'DISMISS_RADIO_BANNER') {
          room.raceState.production.activeRadioBanner = null;
        }

        if (action === 'SET_DIRECTOR_NOTE') {
          room.raceState.production.directorNote = payload.note;
        }

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // Camera Operator Track Hazard Report to Race Director
      if (msg.type === 'camera:hazard_report') {
        const { cameraId, cameraName, location, hazardType, description, operatorName } = msg;
        const hazardItem = {
          id: `haz-${Date.now()}`,
          cameraId: cameraId || 'cam-unknown',
          cameraName: cameraName || cameraId,
          location: location || 'Track Corner',
          hazardType: hazardType || 'TRACK HAZARD',
          description: description || 'Hazard reported by camera operator',
          operatorName: operatorName || 'Camera Volunteer',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        room.raceState.events.unshift({
          id: hazardItem.id,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          lap: room.raceState.currentLap,
          type: 'FLAG',
          message: `⚠️ HAZARD REPORT [${hazardItem.location}]: ${hazardItem.hazardType} reported by ${hazardItem.operatorName}`,
        });

        // Broadcast urgent alert to Race Director and all stations
        broadcastToRoom(room, {
          type: 'hazard:alert',
          hazard: hazardItem,
        });

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // Real-time Speech-to-Text English Transcription from Team Radio
      if (msg.type === 'radio:transcript') {
        const drv = room.raceState.drivers.find(d => d.id === clientTeamId);
        const transcriptItem: RadioTranscript = {
          id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          teamId: clientTeamId,
          senderRole: clientRole === 'driver' ? 'driver' : 'engineer',
          senderName: clientName,
          driverNumber: drv?.number || 1,
          teamColor: drv?.color || '#E80020',
          transcript: msg.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          audioData: msg.audioData,
          status: 'pending',
        };

        room.raceState.transcripts.unshift(transcriptItem);
        if (room.raceState.transcripts.length > 40) room.raceState.transcripts.pop();

        // Broadcast to team members immediately
        broadcastToTeam(room, clientTeamId, {
          type: 'radio:transcript_incoming',
          transcript: transcriptItem,
        });

        // Broadcast to Video Director so the Angle Guy can put it in stream!
        broadcastToRoom(room, {
          type: 'production:new_transcript',
          transcript: transcriptItem,
        });

        // Also add to race control events
        room.raceState.events.unshift({
          id: `evt-trans-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          lap: room.raceState.currentLap,
          type: 'RADIO',
          message: `RADIO [${drv?.name || clientTeamId}]: "${msg.text}"`,
        });

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // Voice Audio chunk fallback
      if (msg.type === 'radio:voice_chunk' || msg.type === 'radio:audio_clip') {
        const audioPayload = {
          id: `radio_${Date.now()}`,
          senderRole: clientRole,
          senderName: clientName,
          teamId: clientTeamId,
          audioData: msg.audioData,
          duration: msg.duration,
          transcript: msg.transcript || '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        broadcastToTeam(room, clientTeamId, {
          ...audioPayload,
          type: 'radio:audio_incoming',
        }, clientId);

        broadcastToRoom(room, {
          ...audioPayload,
          type: 'radio:broadcast_chatter',
        }, clientId);

        // Record into raceState.transcripts dialogue log
        if (msg.transcript && msg.transcript.trim()) {
          const drv = room.raceState.drivers.find(d => d.id === clientTeamId);
          const transcriptItem: RadioTranscript = {
            id: audioPayload.id,
            teamId: clientTeamId,
            senderRole: clientRole === 'driver' ? 'driver' : 'engineer',
            senderName: clientName || (clientRole === 'driver' ? drv?.name || 'Driver' : 'Race Engineer'),
            driverNumber: drv?.number || 1,
            teamColor: drv?.color || '#ef4444',
            transcript: msg.transcript.trim(),
            timestamp: audioPayload.timestamp,
            audioData: msg.audioData,
            status: 'pending',
          };
          if (!room.raceState.transcripts) room.raceState.transcripts = [];
          room.raceState.transcripts.unshift(transcriptItem);
          if (room.raceState.transcripts.length > 50) room.raceState.transcripts.pop();

          broadcastToTeam(room, clientTeamId, {
            type: 'radio:transcript_incoming',
            transcript: transcriptItem,
          });
          broadcastToRoom(room, {
            type: 'production:new_transcript',
            transcript: transcriptItem,
          });
        }
      }

      // Flying lap request from Team Pit Wall to Timekeeper
      if (msg.type === 'flying_lap:request') {
        const { teamId, driverId, driverName, driverNumber, engineerName } = msg;
        const targetTeamId = teamId || clientTeamId;
        const drv = room.raceState.drivers.find(d => d.id === (driverId || targetTeamId));
        const payload = {
          teamId: targetTeamId,
          driverId: drv?.id || driverId || targetTeamId,
          driverName: drv?.name || driverName || 'Driver',
          driverNumber: drv?.number || driverNumber || 1,
          engineerName: engineerName || clientName || 'Race Engineer',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        // Broadcast flying lap request to Timekeeper and Director
        broadcastToRoom(room, {
          type: 'flying_lap:requested',
          ...payload,
        });

        room.raceState.events.unshift({
          id: `evt-flyreq-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          lap: drv?.lapsCompleted || room.raceState.currentLap,
          type: 'RADIO',
          message: `FLYING LAP REQUEST: ${payload.driverName} (#${payload.driverNumber}) is on an out-lap and starting flying lap soon!`,
        });

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }

      // PTT Status
      if (msg.type === 'radio:ptt_status') {
        broadcastToTeam(room, clientTeamId, {
          type: 'radio:ptt_status',
          isTalking: msg.isTalking,
          role: clientRole,
          name: clientName,
        }, clientId);
      }

      // Race actions (Flags, sessions, penalties)
      if (msg.type === 'race:action') {
        const { action, payload } = msg;

        if (action === 'SET_FLAG') {
          room.raceState.flagStatus = payload.flag;
          if (payload.flag === 'CHEQUERED') {
            room.raceState.raceFinished = true;
            room.raceState.raceStatus = 'FINISHED';
          }
          if (payload.flag === 'SC') {
            room.raceState.safetyCarDeployed = true;
            room.raceState.vscDeployed = false;
          } else if (payload.flag === 'VSC') {
            room.raceState.vscDeployed = true;
            room.raceState.safetyCarDeployed = false;
          } else if (payload.flag === 'GREEN') {
            room.raceState.safetyCarDeployed = false;
            room.raceState.vscDeployed = false;
          }

          room.raceState.events.unshift({
            id: `evt-flag-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'FLAG',
            message: `RACE CONTROL: Flag status changed to ${payload.flag}`,
          });

          // Broadcast 4-second urgent screen overlay to ALL volunteer devices
          broadcastToRoom(room, {
            type: 'flag:urgent_alert',
            flag: payload.flag,
            durationSec: 4,
            message:
              payload.flag === 'YELLOW'
                ? 'YELLOW FLAG • CAUTION IN SECTOR • NO OVERTAKING'
                : payload.flag === 'RED'
                ? 'RED FLAG • SESSION SUSPENDED • RETURN TO PIT LANE'
                : payload.flag === 'SC'
                ? 'SAFETY CAR DEPLOYED • MAINTAIN DELTA POSITIVE'
                : payload.flag === 'VSC'
                ? 'VIRTUAL SAFETY CAR • REDUCE PACE'
                : payload.flag === 'CHEQUERED'
                ? 'CHEQUERED FLAG • RACE FINISH'
                : 'TRACK CLEAR • GREEN FLAG',
          });
        }

        if (action === 'SET_TOTAL_LAPS') {
          const laps = Math.max(1, parseInt(payload.totalLaps, 10) || 12);
          room.raceState.totalLaps = laps;

          // Check if any drivers in race session already completed this new total
          if (room.raceState.session === 'RACE') {
            let hasLeaderFinished = false;
            room.raceState.drivers.forEach((drv, idx) => {
              if (drv.lapsCompleted >= laps) {
                drv.lapsCompleted = laps;
                drv.status = 'FINISHED';
                if (idx === 0) hasLeaderFinished = true;
              }
            });

            if (hasLeaderFinished && room.raceState.flagStatus !== 'CHEQUERED') {
              room.raceState.flagStatus = 'CHEQUERED';
              room.raceState.raceFinished = true;
                room.raceState.raceStatus = 'FINISHED';
              const leader = room.raceState.drivers[0];
              room.raceState.winner = {
                id: leader.id,
                name: leader.name,
                number: leader.number,
                team: leader.team,
                color: leader.color,
                photoUrl: leader.photoUrl,
              };
              broadcastToRoom(room, {
                type: 'flag:urgent_alert',
                flag: 'CHEQUERED',
                durationSec: 8,
                message: `🏁 CHEQUERED FLAG! #${leader.number} ${leader.name} WINS THE RACE!`,
              });
            }
            recalculateStandings(room.raceState);
          }

          room.raceState.events.unshift({
            id: `evt-laps-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'SYSTEM',
            message: `Race Director changed total race laps to ${laps} laps.`,
          });
        }

        if (action === 'UPDATE_DRIVER') {
          const { driverId, name, number, team, bikeType, color } = payload;
          const drv = room.raceState.drivers.find(d => d.id === driverId);
          if (drv) {
            if (name !== undefined) drv.name = name.trim();
            if (number !== undefined) drv.number = parseInt(number, 10) || drv.number;
            if (team !== undefined) drv.team = team.trim();
            if (bikeType !== undefined) drv.bikeType = bikeType.trim();
            if (color !== undefined) drv.color = color;
            recalculateStandings(room.raceState);
          }
        }

        if (action === 'REMOVE_DRIVER') {
          const { driverId } = payload;
          const index = room.raceState.drivers.findIndex(d => d.id === driverId);
          if (index !== -1) {
            const removed = room.raceState.drivers.splice(index, 1)[0];
            room.raceState.events.unshift({
              id: `evt-rmv-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              lap: room.raceState.currentLap,
              type: 'SYSTEM',
              message: `Race Director removed driver #${removed.number} ${removed.name} from the race grid.`,
            });
            recalculateStandings(room.raceState);
          }
        }

        if (action === 'ADD_DRIVER') {
          const { driver } = payload;
          if (driver && !room.raceState.drivers.some(d => d.id === driver.id)) {
            room.raceState.drivers.push(driver);
            recalculateStandings(room.raceState);
          }
        }

        if (action === 'SET_SESSION') {
          room.raceState.session = payload.session;
        }

        if (action === 'TRIGGER_LIGHTS_STAGE') {
          room.raceState.lightsStage = payload.stage;
          if (payload.stage === 6) {
            room.raceState.flagStatus = 'GREEN';
            room.raceState.lightsOutTimestamp = Date.now();
            room.raceState.sessionStartTime = Date.now();
          }

          // Broadcast 5 Red Lights sequence to ALL volunteer devices
          broadcastToRoom(room, {
            type: 'lights:update',
            stage: payload.stage,
          });
        }

        if (action === 'DRIVER_PITTED') {
          const { driverId } = payload;
          const drv = room.raceState.drivers.find(d => d.id === driverId);
          if (drv) {
            drv.status = 'PIT';
            drv.pitStops = (drv.pitStops || 0) + 1;

            const eventMsg = `PIT STOP: #${drv.number} ${drv.name} entered pit lane (Stop ${drv.pitStops})`;
            room.raceState.events.unshift({
              id: `evt-pit-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              lap: drv.lapsCompleted,
              type: 'PIT',
              message: eventMsg,
              team: drv.team,
              driverNumber: drv.number,
            });

            // Broadcast pitted banner to stream and all devices
            broadcastToRoom(room, {
              type: 'stream:driver_pitted',
              driverId: drv.id,
              driverName: drv.name,
              driverNumber: drv.number,
              team: drv.team,
              color: drv.color,
              pitStops: drv.pitStops,
            });
          }
        }

        if (action === 'PASS_FINISH_LINE' || action === 'RECORD_LAP') {
          const { driverId, lapTimeSec } = payload;
          const drv = room.raceState.drivers.find(d => d.id === driverId);
          if (drv) {
            // 1. In RACE session, cap at totalLaps. Cannot exceed race distance!
            if (room.raceState.session === 'RACE' && drv.lapsCompleted >= room.raceState.totalLaps) {
              drv.status = 'FINISHED';
              broadcastToRoom(room, { type: 'state:update', raceState: room.raceState });
              return; // Already completed full race!
            }

            drv.lapsCompleted += 1;

            // 2. Check if driver has now reached the final lap in RACE
            let isRaceWinner = false;
            if (room.raceState.session === 'RACE' && drv.lapsCompleted >= room.raceState.totalLaps) {
              drv.lapsCompleted = room.raceState.totalLaps;
              drv.status = 'FINISHED';

              // If chequered flag hasn't been thrown, this rider is the WINNER!
              if (room.raceState.flagStatus !== 'CHEQUERED') {
                isRaceWinner = true;
                room.raceState.flagStatus = 'CHEQUERED';
                room.raceState.raceFinished = true;
                room.raceState.raceStatus = 'FINISHED';
                room.raceState.winner = {
                  id: drv.id,
                  name: drv.name,
                  number: drv.number,
                  team: drv.team,
                  color: drv.color,
                  photoUrl: drv.photoUrl,
                };

                // Broadcast celebratory chequered flag alert to all devices
                broadcastToRoom(room, {
                  type: 'flag:urgent_alert',
                  flag: 'CHEQUERED',
                  durationSec: 8,
                  message: `🏁 CHEQUERED FLAG! #${drv.number} ${drv.name} WINS THE RACE!`,
                });
              }
            } else {
              drv.status = 'TRACK';
            }

            const lapTime = lapTimeSec || +(Math.random() * 5 + 36.2).toFixed(3);
            drv.lastLapTime = lapTime;
            if (!drv.bestLapTime || lapTime < drv.bestLapTime) {
              drv.bestLapTime = lapTime;
            }

            if (drv.lapsCompleted > room.raceState.currentLap && drv.lapsCompleted <= room.raceState.totalLaps) {
              room.raceState.currentLap = drv.lapsCompleted;
            }

            // Check if Fastest Lap of the race
            const isPersonalBest = !drv.bestLapTime || lapTime <= drv.bestLapTime;
            const isRaceFastest = !room.raceState.fastestLapHolder || lapTime < room.raceState.fastestLapHolder.time;
            if (isRaceFastest) {
              room.raceState.fastestLapHolder = {
                driverName: drv.name,
                team: drv.team,
                time: lapTime,
              };
            }

            const s1 = payload.s1 !== undefined ? payload.s1 : +(lapTime * 0.32).toFixed(2);
            const s2 = payload.s2 !== undefined ? payload.s2 : +(lapTime * 0.38).toFixed(2);
            const s3 = payload.s3 !== undefined ? payload.s3 : +(lapTime * 0.30).toFixed(2);
            drv.s1 = s1;
            drv.s2 = s2;
            drv.s3 = s3;

            // Log completed lap into lapHistory
            if (!room.raceState.lapHistory) room.raceState.lapHistory = [];
            const lapRecord: CompletedLapRecord = {
              id: `lap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              lapNumber: drv.lapsCompleted,
              driverId: drv.id,
              driverName: drv.name,
              driverNumber: drv.number,
              team: drv.team,
              teamColor: drv.color,
              lapTimeSec: lapTime,
              s1,
              s2,
              s3,
              isFastestLap: isRaceFastest,
              isPersonalBest,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            room.raceState.lapHistory.unshift(lapRecord);
            if (room.raceState.lapHistory.length > 200) room.raceState.lapHistory.pop();

            // Automatic overtake detection on line crossing
            const prevIndex = room.raceState.drivers.findIndex(d => d.id === driverId);

            if (isRaceWinner) {
              room.raceState.events.unshift({
                id: `evt-win-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                lap: drv.lapsCompleted,
                type: 'FLAG',
                message: `🏁 RACE WINNER! #${drv.number} ${drv.name} takes the CHEQUERED FLAG to win!`,
              });
            } else if (drv.status === 'FINISHED') {
              room.raceState.events.unshift({
                id: `evt-fin-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                lap: drv.lapsCompleted,
                type: 'SYSTEM',
                message: `🏁 #${drv.number} ${drv.name} crosses the finish line to complete the race!`,
              });
            } else {
              room.raceState.events.unshift({
                id: `evt-lap-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                lap: drv.lapsCompleted,
                type: 'SYSTEM',
                message: `LAP ${drv.lapsCompleted}: #${drv.number} ${drv.name} crosses finish line (${lapTime}s)`,
              });
            }

            recalculateStandings(room.raceState);

            const newIndex = room.raceState.drivers.findIndex(d => d.id === driverId);
            if (newIndex < prevIndex) {
              const overtaken = room.raceState.drivers[newIndex + 1];
              if (overtaken) {
                // Log overtake event
                room.raceState.events.unshift({
                  id: `evt-ot-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  lap: drv.lapsCompleted,
                  type: 'OVERTAKE',
                  message: `OVERTAKE! #${drv.number} ${drv.name} takes P${newIndex + 1} from #${overtaken.number} ${overtaken.name}!`,
                });

                // Broadcast overtake graphic to stream
                broadcastToRoom(room, {
                  type: 'stream:overtake',
                  overtaker: {
                    id: drv.id,
                    name: drv.name,
                    number: drv.number,
                    team: drv.team,
                    color: drv.color,
                    newPosition: newIndex + 1,
                  },
                  overtaken: {
                    id: overtaken.id,
                    name: overtaken.name,
                    number: overtaken.number,
                    team: overtaken.team,
                    color: overtaken.color,
                  },
                  location: 'at Finish Straight',
                });
              }
            }
          }
        }

        // Manual Overtake Trigger (from Race Director or Corner Marshal report)
        if (action === 'OVERTAKE_DRIVER') {
          const { driverId, location } = payload;
          const currentIndex = room.raceState.drivers.findIndex(d => d.id === driverId);
          if (currentIndex > 0) {
            const overtaken = room.raceState.drivers[currentIndex - 1];
            const overtaker = room.raceState.drivers[currentIndex];

            // Ensure overtaker has at least the same laps as overtaken
            if (overtaker.lapsCompleted < overtaken.lapsCompleted) {
              overtaker.lapsCompleted = overtaken.lapsCompleted;
            }

            // Swap positions directly in the standings array
            room.raceState.drivers[currentIndex - 1] = overtaker;
            room.raceState.drivers[currentIndex] = overtaken;

            // Recalculate gaps and positions while preserving this new track order!
            recalculateStandings(room.raceState, true);

            // Log event
            room.raceState.events.unshift({
              id: `evt-ot-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              lap: overtaker.lapsCompleted || room.raceState.currentLap,
              type: 'OVERTAKE',
              message: `OVERTAKE! #${overtaker.number} ${overtaker.name} moves up to P${currentIndex} past #${overtaken.number} ${overtaken.name}!`,
            });

            // Broadcast official F1 TV lower-third graphic to stream
            broadcastToRoom(room, {
              type: 'stream:overtake',
              overtaker: {
                id: overtaker.id,
                name: overtaker.name,
                number: overtaker.number,
                team: overtaker.team,
                color: overtaker.color,
                newPosition: currentIndex,
              },
              overtaken: {
                id: overtaken.id,
                name: overtaken.name,
                number: overtaken.number,
                team: overtaken.team,
                color: overtaken.color,
              },
              location: location || 'on track',
            });
          }
        }

        if (action === 'RESET_WEEKEND') {
          room.raceState.drivers = JSON.parse(JSON.stringify(defaultDrivers));
          room.raceState.currentLap = 1;
          room.raceState.session = 'P1';
          room.raceState.flagStatus = 'GREEN';
          room.raceState.lightsStage = 0;
          room.raceState.fastestLapHolder = null;
          room.raceState.provisionalPoleTime = 0;
          room.raceState.liveTimer.isActive = false;
          room.raceState.transcripts = [];
          room.raceState.lapHistory = [];
          room.raceState.production.activeRadioBanner = null;
        }

        // Race Director Invalidate / Remove Lap Time
        if (action === 'REMOVE_LAP') {
          const { driverId, lapRecordId } = payload;
          const drv = room.raceState.drivers.find(d => d.id === driverId);
          if (drv) {
            if (lapRecordId && room.raceState.lapHistory) {
              const recordIndex = room.raceState.lapHistory.findIndex(l => l.id === lapRecordId);
              if (recordIndex !== -1) {
                room.raceState.lapHistory.splice(recordIndex, 1);
              }
            } else if (room.raceState.lapHistory) {
              const recordIndex = room.raceState.lapHistory.findIndex(l => l.driverId === driverId);
              if (recordIndex !== -1) {
                room.raceState.lapHistory.splice(recordIndex, 1);
              }
            }

            // Decrement laps completed safely
            if (drv.lapsCompleted > 0) {
              drv.lapsCompleted -= 1;
            }

            // If driver had status FINISHED, revert to TRACK if lapsCompleted < totalLaps
            if (drv.status === 'FINISHED' && drv.lapsCompleted < room.raceState.totalLaps) {
              drv.status = 'TRACK';
            }

            // Recalculate bestLapTime and lastLapTime from remaining lap records
            const driverLaps = (room.raceState.lapHistory || []).filter(l => l.driverId === driverId);
            if (driverLaps.length > 0) {
              drv.lastLapTime = driverLaps[0].lapTimeSec;
              drv.bestLapTime = Math.min(...driverLaps.map(l => l.lapTimeSec));
            } else {
              drv.lastLapTime = null;
              drv.bestLapTime = null;
              drv.s1 = null;
              drv.s2 = null;
              drv.s3 = null;
            }

            // If winner was this driver and now completed < totalLaps, revert race finished
            if (room.raceState.winner?.id === driverId && drv.lapsCompleted < room.raceState.totalLaps) {
              room.raceState.raceFinished = false;
              room.raceState.winner = null;
              if (room.raceState.flagStatus === 'CHEQUERED') {
                room.raceState.flagStatus = 'GREEN';
              }
            }

            // Recalculate fastest lap holder across all drivers
            const allLaps = room.raceState.lapHistory || [];
            if (allLaps.length > 0) {
              const fastest = allLaps.reduce((prev, curr) => curr.lapTimeSec < prev.lapTimeSec ? curr : prev, allLaps[0]);
              room.raceState.fastestLapHolder = {
                driverName: fastest.driverName,
                team: fastest.team,
                time: fastest.lapTimeSec,
              };
            } else {
              room.raceState.fastestLapHolder = null;
            }

            room.raceState.events.unshift({
              id: `evt-remlap-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              lap: drv.lapsCompleted,
              type: 'SYSTEM',
              message: `Race Director invalidated / removed lap time for #${drv.number} ${drv.name}. Laps completed: ${drv.lapsCompleted}.`,
            });

            recalculateStandings(room.raceState);
          }
        }

        if (action === 'CREATE_NEW_RACE') {
          const { raceName, isTestMode, format, totalLaps, drivers } = payload;
          if (room.raceState.raceStatus === 'ACTIVE') {
            broadcastToRoom(room, {
              type: 'race:action_rejected',
              action,
              reason: 'Finish the current race before creating another race.',
            });
            return;
          }
          const laps = Math.max(1, parseInt(totalLaps, 10) || 12);
          const name = (raceName && raceName.trim()) || (isTestMode ? 'Metro Jazz Free Test' : 'Metro Jazz Grand Prix');

          room.raceState.raceName = name;
          room.raceState.circuitName = 'Metro Jazz Circuit';
          room.raceState.isTestMode = !!isTestMode;
          room.raceState.raceFormat = format || (isTestMode ? 'TEST' : 'FULL_WEEKEND');
          room.raceState.raceStatus = 'ACTIVE';
          room.raceState.totalLaps = laps;
          room.raceState.currentLap = 1;
          room.raceState.session = format === 'QUICK_RACE' ? 'RACE' : 'P1';
          room.raceState.flagStatus = 'GREEN';
          room.raceState.safetyCarDeployed = false;
          room.raceState.vscDeployed = false;
          room.raceState.lightsStage = 0;
          room.raceState.lightsOutTimestamp = null;
          room.raceState.sessionStartTime = Date.now();
          room.raceState.raceFinished = false;
          room.raceState.winner = null;

          // Fresh driver state (using custom drivers with uploaded photos if provided)
          if (Array.isArray(drivers) && drivers.length > 0) {
            const teamColors = ['#E80020', '#3671C6', '#FF8000', '#27F4D2', '#229971', '#900000', '#52E252', '#6CD3BF'];
            room.raceState.drivers = drivers.map((d: any, idx: number) => ({
              id: d.id || `team-driver-${idx + 1}`,
              number: parseInt(d.number, 10) || (idx + 1),
              name: (d.name && d.name.trim()) || `Driver ${idx + 1}`,
              team: (d.team && d.team.trim()) || `Team ${idx + 1}`,
              color: d.color || teamColors[idx % teamColors.length],
              bikeType: d.bikeType || 'Road Bike',
              tyreCompound: 'MEDIUM',
              lapsCompleted: 0,
              currentLapTime: 0,
              lastLapTime: null,
              bestLapTime: null,
              s1: null,
              s2: null,
              s3: null,
              gap: idx === 0 ? 'LEADER' : `P${idx + 1}`,
              interval: '-',
              speedKmh: 0,
              cadenceRpm: 0,
              tyreWearPercent: 100,
              pitStops: 0,
              status: 'TRACK',
              penaltySeconds: 0,
              isDriverOnline: false,
              isEngineerOnline: false,
              photoUrl: d.photoUrl || undefined,
            }));
          } else {
            room.raceState.drivers = JSON.parse(JSON.stringify(defaultDrivers));
          }

          room.raceState.liveTimer.isActive = false;
          room.raceState.transcripts = [];
          room.raceState.lapHistory = [];
          room.raceState.production.activeRadioBanner = null;
          room.raceState.production.showWinnerOverlay = true;
          room.raceState.production.showFlagOverlay = true;
          room.raceState.production.showHazardOverlay = true;

          // Clean, simple camera locations: Finish Straight, Corner 1, Corner 2, Corner 3, Corner 4
          room.raceState.cameras = JSON.parse(JSON.stringify(defaultCameras));

          const eventMsg = isTestMode
            ? `🟡 FREE TEST SESSION STARTED: ${name} on Metro Jazz Circuit (Session is not saved to official championship).`
            : `🏁 NEW OFFICIAL RACE CREATED: ${name} on Metro Jazz Circuit (${format === 'QUICK_RACE' ? 'Quick Race' : 'Full Weekend'}). Practice 1 Begins!`;

          const practiceMins = payload.practiceDurationMinutes ? parseInt(payload.practiceDurationMinutes, 10) : 30;
          const qualMins = payload.qualifyingDurationMinutes ? parseInt(payload.qualifyingDurationMinutes, 10) : 15;
          room.raceState.practiceDurationMinutes = practiceMins;
          room.raceState.qualifyingDurationMinutes = qualMins;
          room.raceState.sessionRemainingSeconds = (format === 'QUICK_RACE' ? 0 : practiceMins * 60);
          room.raceState.sessionTotalSeconds = room.raceState.sessionRemainingSeconds;
          room.raceState.sessionTimerRunning = false;

          room.raceState.events.unshift({
            id: `evt-race-init-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: 1,
            type: 'SYSTEM',
            message: eventMsg,
          });
        }

        // Session Timer Controls (Practice 1, 2, 3, Qualifying)
        if (action === 'START_SESSION_TIMER') {
          const { durationMinutes } = payload || {};
          if (durationMinutes && typeof durationMinutes === 'number' && durationMinutes > 0) {
            room.raceState.sessionRemainingSeconds = durationMinutes * 60;
            room.raceState.sessionTotalSeconds = durationMinutes * 60;
          } else if (!room.raceState.sessionRemainingSeconds || room.raceState.sessionRemainingSeconds <= 0) {
            const defaultMins = room.raceState.session === 'Q1'
              ? (room.raceState.qualifyingDurationMinutes || 15)
              : (room.raceState.practiceDurationMinutes || 30);
            room.raceState.sessionRemainingSeconds = defaultMins * 60;
            room.raceState.sessionTotalSeconds = defaultMins * 60;
          }
          room.raceState.sessionTimerRunning = true;
          room.raceState.events.unshift({
            id: `evt-timer-start-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'SYSTEM',
            message: `Official session countdown timer started for ${room.raceState.session} (${Math.round(room.raceState.sessionRemainingSeconds / 60)} minutes).`,
          });
        }

        if (action === 'PAUSE_SESSION_TIMER') {
          room.raceState.sessionTimerRunning = false;
        }

        if (action === 'RESET_SESSION_TIMER') {
          const { durationMinutes } = payload || {};
          const mins = durationMinutes || (
            room.raceState.session === 'Q1'
              ? (room.raceState.qualifyingDurationMinutes || 15)
              : (room.raceState.practiceDurationMinutes || 30)
          );
          room.raceState.sessionRemainingSeconds = mins * 60;
          room.raceState.sessionTotalSeconds = mins * 60;
          room.raceState.sessionTimerRunning = false;
        }

        // Weekend Event Progression (P1 -> P2 -> P3 -> Q1 -> RACE -> PODIUM)
        if (action === 'ADVANCE_SESSION') {
          const current = room.raceState.session;
          let nextSession: 'P1' | 'P2' | 'P3' | 'Q1' | 'RACE' | 'PODIUM' = 'P2';
          let nextName = 'Practice 2';

          if (current === 'P1') {
            nextSession = 'P2';
            nextName = 'Practice 2 (FP2)';
          } else if (current === 'P2') {
            nextSession = 'P3';
            nextName = 'Practice 3 (FP3)';
          } else if (current === 'P3') {
            nextSession = 'Q1';
            nextName = 'Qualifying Shootout (Q1)';
          } else if (current === 'Q1') {
            nextSession = 'RACE';
            nextName = 'Grand Prix Main Race';
          } else if (current === 'RACE') {
            nextSession = 'PODIUM';
            nextName = 'Podium & Trophy Ceremony';
            room.raceState.raceFinished = true;
                room.raceState.raceStatus = 'FINISHED';
          }

          room.raceState.session = nextSession;
          room.raceState.sessionTimerRunning = false;

          if (nextSession === 'P2' || nextSession === 'P3') {
            const pMins = room.raceState.practiceDurationMinutes || 30;
            room.raceState.sessionRemainingSeconds = pMins * 60;
            room.raceState.sessionTotalSeconds = pMins * 60;
          } else if (nextSession === 'Q1') {
            const qMins = room.raceState.qualifyingDurationMinutes || 15;
            room.raceState.sessionRemainingSeconds = qMins * 60;
            room.raceState.sessionTotalSeconds = qMins * 60;
          } else if (nextSession === 'RACE') {
            // Reset driver laps for main Grand Prix race start
            room.raceState.currentLap = 1;
            room.raceState.flagStatus = 'GREEN';
            room.raceState.lightsStage = 0;
            room.raceState.raceFinished = false;
            room.raceState.winner = null;
            room.raceState.drivers.forEach((d) => {
              d.lapsCompleted = 0;
              d.status = 'TRACK';
            });
          }

          room.raceState.events.unshift({
            id: `evt-adv-sess-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lap: room.raceState.currentLap,
            type: 'SYSTEM',
            message: `WEEKEND EVENT ADVANCED: Starting ${nextName}!`,
          });

          broadcastToRoom(room, {
            type: 'flag:urgent_alert',
            flag: 'GREEN',
            durationSec: 4,
            message: `🏁 NEW EVENT: ${nextName.toUpperCase()} NOW COMMENCING!`,
          });
        }

        broadcastToRoom(room, {
          type: 'state:update',
          raceState: room.raceState,
        });
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const room = rooms.get(currentRoomId);
    if (room) {
      room.clients.delete(clientId);
      broadcastToRoom(room, { type: 'state:update', raceState: room.raceState });
    }
  });
});

function recalculateStandings(raceState: RaceState, preserveTrackOrder: boolean = false) {
  if (!preserveTrackOrder) {
    if (raceState.session === 'Q1' || raceState.session.startsWith('P')) {
      raceState.drivers.sort((a, b) => {
        const aTime = a.bestLapTime || 9999;
        const bTime = b.bestLapTime || 9999;
        return aTime - bTime;
      });
    } else {
      // In RACE: only change positions if a driver has completed more laps!
      // If equal laps, preserve the existing track order (which reflects overtakes)!
      raceState.drivers.sort((a, b) => {
        if (b.lapsCompleted !== a.lapsCompleted) {
          return b.lapsCompleted - a.lapsCompleted;
        }
        return 0;
      });
    }
  }

  // Update gaps, intervals, and positions for all drivers
  raceState.drivers.forEach((drv, index) => {
    if (index === 0) {
      drv.gap = 'LEADER';
      drv.interval = 'LEADER';
    } else {
      drv.gap = `P${index + 1}`;
      if (raceState.session === 'RACE') {
        const prevDrv = raceState.drivers[index - 1];
        const lapDiff = (prevDrv?.lapsCompleted || 0) - drv.lapsCompleted;
        if (lapDiff > 0) {
          drv.interval = `+${lapDiff} LAP`;
        } else {
          drv.interval = '-';
        }
      } else {
        // Qualifying / Practice sessions: show lap time or delta to best
        drv.interval = drv.bestLapTime ? `${drv.bestLapTime.toFixed(2)}s` : '--';
      }
    }
  });
}

// Ticker interval to countdown running session timers every second
setInterval(() => {
  for (const [, room] of rooms.entries()) {
    if (room.raceState.sessionTimerRunning && room.raceState.sessionRemainingSeconds > 0) {
      room.raceState.sessionRemainingSeconds -= 1;
      if (room.raceState.sessionRemainingSeconds <= 0) {
        room.raceState.sessionRemainingSeconds = 0;
        room.raceState.sessionTimerRunning = false;
        room.raceState.events.unshift({
          id: `evt-time-expired-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          lap: room.raceState.currentLap,
          type: 'SYSTEM',
          message: `🏁 TIME EXPIRED: Chequered flag for ${room.raceState.session} session!`,
        });
        broadcastToRoom(room, {
          type: 'flag:urgent_alert',
          flag: 'CHEQUERED',
          durationSec: 6,
          message: `🏁 TIME EXPIRED: ${room.raceState.session} SESSION ENDED!`,
        });
      }
      broadcastToRoom(room, {
        type: 'state:update',
        raceState: room.raceState,
      });
    }
  }
}, 1000);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`f1Cycle Hub Server running at http://localhost:${PORT}`);
  });
}

startServer();
