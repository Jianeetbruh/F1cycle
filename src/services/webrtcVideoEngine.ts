// High-performance WebRTC Video Streaming Engine for f1Cycle
// Delivers silky-smooth 30-60 FPS live video between camera volunteer phones and viewers (Director & TV Stream)
import { radioEngine } from './radioEngine';

export interface WebRTCVideoStats {
  fps: number | null;
  width: number | null;
  height: number | null;
  bitrateKbps: number | null;
  jitterBufferDelayMs: number | null;
  packetsLost: number | null;
  qualityLimitationReason: string | null;
  rttMs: number | null;
  connectionState: RTCPeerConnectionState | 'disconnected' | 'none';
}

const configuredIceServers = (() => {
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS_JSON as string | undefined;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as RTCIceServer[] : [];
  } catch {
    console.warn('Ignoring invalid VITE_ICE_SERVERS_JSON');
    return [];
  }
})();

const ICE_SERVERS: RTCIceServer[] = [
  ...configuredIceServers,
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: ['stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
  { urls: ['stun:openrelay.metered.ca:80'] },
];

interface BroadcasterPeer {
  viewerClientId: string;
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

interface ViewerFeed {
  cameraId: string;
  pc: RTCPeerConnection | null;
  remoteStream: MediaStream | null;
  callbacks: Map<string, (stream: MediaStream | null) => void>;
  pendingCandidates: RTCIceCandidateInit[];
  isConnecting: boolean;
  broadcasterClientId: string | null;
}

class WebRTCVideoEngine {
  // Broadcaster state: cameraId -> { stream, peers: Map<viewerClientId, BroadcasterPeer> }
  private activeStreams: Map<string, MediaStream> = new Map();
  private broadcasterPeers: Map<string, Map<string, BroadcasterPeer>> = new Map();
  private announceIntervals: Map<string, number> = new Map();

  // Viewer state: cameraId -> ViewerFeed (Multiplexed single peer connection per camera)
  private viewerFeeds: Map<string, ViewerFeed> = new Map();
  private statsCache: Map<string, { timestamp: number; bytes: number }> = new Map();

  private cleanupRawListener: (() => void) | null = null;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    this.cleanupRawListener = radioEngine.onRawMessage((msg) => {
      this.handleSignalingMessage(msg);
    });
  }

  // =========================================================================
  // BROADCASTER METHODS (Camera Station)
  // =========================================================================

  /**
   * Publish a camera's MediaStream (from phone camera or canvas.captureStream)
   */
  publishCamera(cameraId: string, stream: MediaStream): () => void {
    this.activeStreams.set(cameraId, stream);
    if (!this.broadcasterPeers.has(cameraId)) {
      this.broadcasterPeers.set(cameraId, new Map());
    }

    // Immediately deliver to any local viewer feeds in the same tab/session
    const localFeed = this.viewerFeeds.get(cameraId);
    if (localFeed) {
      localFeed.remoteStream = stream;
      localFeed.callbacks.forEach((cb) => cb(stream));
    }

    // Announce to all viewers that this camera is live on WebRTC
    const sendAnnounce = () => {
      radioEngine.sendRaw({
        type: 'webrtc:camera_announce',
        cameraId,
        fromClientId: radioEngine.getClientId(),
      });
    };

    sendAnnounce();

    // Clear prior announce interval if any
    if (this.announceIntervals.has(cameraId)) {
      window.clearInterval(this.announceIntervals.get(cameraId)!);
    }
    // Periodic heartbeat so newly opened viewer tabs hook up immediately
    const interval = window.setInterval(sendAnnounce, 2500);
    this.announceIntervals.set(cameraId, interval);

    // Cleanup function when camera stops
    return () => {
      this.unpublishCamera(cameraId);
    };
  }

  unpublishCamera(cameraId: string) {
    if (this.announceIntervals.has(cameraId)) {
      window.clearInterval(this.announceIntervals.get(cameraId)!);
      this.announceIntervals.delete(cameraId);
    }

    const peers = this.broadcasterPeers.get(cameraId);
    if (peers) {
      peers.forEach((peer) => {
        try {
          peer.pc.close();
        } catch (e) {
          console.warn('Error closing peer pc', e);
        }
      });
      peers.clear();
      this.broadcasterPeers.delete(cameraId);
    }
    this.activeStreams.delete(cameraId);

    radioEngine.sendRaw({
      type: 'webrtc:camera_closed',
      cameraId,
      fromClientId: radioEngine.getClientId(),
    });
  }

  // =========================================================================
  // SUBSCRIBER / VIEWER METHODS (Video Director & Main Stream)
  // =========================================================================

  /**
   * Subscribe to live WebRTC video for a camera angle.
   * Multiplexed: only ONE RTCPeerConnection is opened per camera, shared across all components.
   */
  subscribeCamera(cameraId: string, onStream: (stream: MediaStream | null) => void): () => void {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let feed = this.viewerFeeds.get(cameraId);
    if (!feed) {
      feed = {
        cameraId,
        pc: null,
        remoteStream: null,
        callbacks: new Map(),
        pendingCandidates: [],
        isConnecting: false,
        broadcasterClientId: null,
      };
      this.viewerFeeds.set(cameraId, feed);
    }

    feed.callbacks.set(subId, onStream);

    // 1. If stream is already active locally in this tab, deliver immediately!
    if (this.activeStreams.has(cameraId)) {
      const localStream = this.activeStreams.get(cameraId)!;
      onStream(localStream);
      return () => {
        feed?.callbacks.delete(subId);
      };
    }

    // 2. If remoteStream is already established, deliver immediately!
    if (feed.remoteStream && feed.remoteStream.active && feed.remoteStream.getVideoTracks().length > 0) {
      onStream(feed.remoteStream);
    }

    // 3. Request feed if not already connected
    if (!feed.remoteStream || !feed.remoteStream.active) {
      this.requestFeed(cameraId);
    }

    return () => {
      const currentFeed = this.viewerFeeds.get(cameraId);
      if (currentFeed) {
        currentFeed.callbacks.delete(subId);
        onStream(null);

        // If no more listeners for this camera, close peer connection to save bandwidth
        if (currentFeed.callbacks.size === 0) {
          if (currentFeed.pc) {
            try {
              currentFeed.pc.close();
            } catch (e) {}
            currentFeed.pc = null;
          }
          currentFeed.remoteStream = null;
          currentFeed.pendingCandidates = [];
          this.viewerFeeds.delete(cameraId);
        }
      }
    };
  }

  private requestFeed(cameraId: string) {
    radioEngine.sendRaw({
      type: 'webrtc:request_feed',
      cameraId,
      viewerClientId: radioEngine.getClientId(),
    });
  }

  async getStats(cameraId: string): Promise<WebRTCVideoStats | null> {
    const pc = this.viewerFeeds.get(cameraId)?.pc;
    if (!pc || pc.connectionState === 'closed') return null;
    const report = await pc.getStats();
    let inbound: any = null;
    let candidatePair: any = null;
    let remoteInbound: any = null;
    report.forEach((entry: any) => {
      if (entry.type === 'inbound-rtp' && (entry.kind === 'video' || entry.mediaType === 'video')) inbound = entry;
      if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated) candidatePair = entry;
      if (entry.type === 'remote-inbound-rtp' && (entry.kind === 'video' || entry.mediaType === 'video')) remoteInbound = entry;
    });
    const now = performance.now();
    const previous = this.statsCache.get(cameraId);
    this.statsCache.set(cameraId, { timestamp: now, bytes: inbound?.bytesReceived ?? 0 });
    const bitrateKbps = previous && inbound
      ? Math.max(0, ((inbound.bytesReceived - previous.bytes) * 8) / ((now - previous.timestamp) / 1000) / 1000)
      : null;
    return {
      fps: inbound?.framesPerSecond ?? null,
      width: inbound?.frameWidth ?? null,
      height: inbound?.frameHeight ?? null,
      bitrateKbps,
      jitterBufferDelayMs: inbound?.jitterBufferDelay && inbound?.jitterBufferEmittedCount
        ? (inbound.jitterBufferDelay / inbound.jitterBufferEmittedCount) * 1000
        : null,
      packetsLost: inbound?.packetsLost ?? null,
      qualityLimitationReason: remoteInbound?.qualityLimitationReason ?? null,
      rttMs: candidatePair?.currentRoundTripTime != null
        ? candidatePair.currentRoundTripTime * 1000
        : (remoteInbound?.roundTripTime != null ? remoteInbound.roundTripTime * 1000 : null),
      connectionState: pc.connectionState || 'none',
    };
  }

  // =========================================================================
  // SIGNALING DISPATCHER
  // =========================================================================

  private async handleSignalingMessage(msg: any) {
    const myClientId = radioEngine.getClientId();

    // 1. Broadcaster receives a request for video feed from a viewer
    if (msg.type === 'webrtc:request_feed') {
      const { cameraId, viewerClientId, fromClientId } = msg;
      const targetViewer = viewerClientId || fromClientId;
      if (!targetViewer || targetViewer === myClientId) return;

      const localStream = this.activeStreams.get(cameraId);
      if (!localStream) return;

      await this.createBroadcasterPeer(cameraId, targetViewer, localStream);
    }

    // 2. Viewer receives camera announcement: request feed if we have listeners
    if (msg.type === 'webrtc:camera_announce') {
      const { cameraId, fromClientId } = msg;
      if (fromClientId === myClientId) return;

      const feed = this.viewerFeeds.get(cameraId);
      if (feed && feed.callbacks.size > 0 && (!feed.remoteStream || !feed.remoteStream.active)) {
        radioEngine.sendRaw({
          type: 'webrtc:request_feed',
          cameraId,
          targetClientId: fromClientId,
          viewerClientId: myClientId,
        });
      }
    }

    // 3. Viewer receives SDP offer from camera broadcaster
    if (msg.type === 'webrtc:video_offer') {
      const { cameraId, offer, fromClientId, targetClientId } = msg;
      if (targetClientId && targetClientId !== myClientId) return;

      await this.handleViewerOffer(cameraId, fromClientId, offer);
    }

    // 4. Broadcaster receives SDP answer from viewer
    if (msg.type === 'webrtc:video_answer') {
      const { cameraId, answer, fromClientId, targetClientId } = msg;
      if (targetClientId && targetClientId !== myClientId) return;

      const peers = this.broadcasterPeers.get(cameraId);
      const peer = peers?.get(fromClientId);
      if (peer && peer.pc) {
        try {
          if (peer.pc.signalingState !== 'stable') {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Drain any pending ICE candidates
            if (peer.pendingCandidates.length > 0) {
              for (const c of peer.pendingCandidates) {
                try {
                  await peer.pc.addIceCandidate(new RTCIceCandidate(c));
                } catch {}
              }
              peer.pendingCandidates = [];
            }
          }
        } catch (e) {
          console.warn('Error setting remote description on broadcaster', e);
        }
      }
    }

    // 5. ICE candidate exchange
    if (msg.type === 'webrtc:video_ice') {
      const { cameraId, candidate, fromClientId, targetClientId } = msg;
      if (targetClientId && targetClientId !== myClientId) return;
      if (!candidate) return;

      // Check if we are broadcaster
      const peers = this.broadcasterPeers.get(cameraId);
      const broadcasterPeer = peers?.get(fromClientId);
      if (broadcasterPeer) {
        if (!broadcasterPeer.pc.remoteDescription) {
          broadcasterPeer.pendingCandidates.push(candidate);
        } else {
          try {
            await broadcasterPeer.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate on broadcaster', e);
          }
        }
        return;
      }

      // Check if we are viewer
      const feed = this.viewerFeeds.get(cameraId);
      if (feed && feed.pc) {
        if (!feed.pc.remoteDescription) {
          feed.pendingCandidates.push(candidate);
        } else {
          try {
            await feed.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate on viewer', e);
          }
        }
      }
    }

    // 6. Camera closed
    if (msg.type === 'webrtc:camera_closed') {
      const { cameraId } = msg;
      const feed = this.viewerFeeds.get(cameraId);
      if (feed) {
        feed.remoteStream = null;
        feed.callbacks.forEach((cb) => cb(null));
      }
    }
  }

  // =========================================================================
  // PEER CONNECTION CREATION
  // =========================================================================

  private async createBroadcasterPeer(cameraId: string, viewerClientId: string, stream: MediaStream) {
    let peers = this.broadcasterPeers.get(cameraId);
    if (!peers) {
      peers = new Map();
      this.broadcasterPeers.set(cameraId, peers);
    }

    // Close any previous peer connection for this viewer
    const existing = peers.get(viewerClientId);
    if (existing) {
      try {
        existing.pc.close();
      } catch (e) {}
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    const broadcasterPeer: BroadcasterPeer = {
      viewerClientId,
      pc,
      pendingCandidates: [],
    };
    peers.set(viewerClientId, broadcasterPeer);

    // Add local video tracks to peer connection
    stream.getTracks().forEach((track) => {
      try {
        track.contentHint = 'motion';
        const sender = pc.addTrack(track, stream);
        const parameters = sender.getParameters();
        parameters.degradationPreference = 'maintain-framerate';
        parameters.encodings = [{
          ...(parameters.encodings?.[0] || {}),
          maxBitrate: 1_800_000,
          maxFramerate: 30,
          scaleResolutionDownBy: 1,
        }];
        void sender.setParameters(parameters).catch(() => undefined);
      } catch (e) {
        console.warn('Error adding track to broadcaster peer', e);
      }
    });

    // Send ICE candidates to viewer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        radioEngine.sendRaw({
          type: 'webrtc:video_ice',
          cameraId,
          targetClientId: viewerClientId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peers?.delete(viewerClientId);
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      radioEngine.sendRaw({
        type: 'webrtc:video_offer',
        cameraId,
        targetClientId: viewerClientId,
        offer,
      });
    } catch (err) {
      console.warn('Broadcaster offer generation failed', err);
    }
  }

  private async handleViewerOffer(cameraId: string, broadcasterClientId: string, offer: RTCSessionDescriptionInit) {
    let feed = this.viewerFeeds.get(cameraId);
    if (!feed || feed.callbacks.size === 0) return;

    if (feed.pc) {
      try {
        feed.pc.close();
      } catch (e) {}
      feed.pc = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });
    feed.pc = pc;
    feed.broadcasterClientId = broadcasterClientId;
    feed.pendingCandidates = [];

    pc.getReceivers().forEach((receiver: any) => {
      if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = 80;
    });

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      feed!.remoteStream = remoteStream;
      feed!.callbacks.forEach((cb) => cb(remoteStream));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        radioEngine.sendRaw({
          type: 'webrtc:video_ice',
          cameraId,
          targetClientId: broadcasterClientId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (feed && feed.pc === pc) {
          feed.remoteStream = null;
          feed.callbacks.forEach((cb) => cb(null));
          // Attempt feed recovery if callbacks still waiting
          if (feed.callbacks.size > 0) {
            setTimeout(() => this.requestFeed(cameraId), 1500);
          }
        }
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain any pending ICE candidates received before remoteDescription was set
      if (feed.pendingCandidates.length > 0) {
        for (const c of feed.pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
        feed.pendingCandidates = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      radioEngine.sendRaw({
        type: 'webrtc:video_answer',
        cameraId,
        targetClientId: broadcasterClientId,
        answer,
      });
    } catch (err) {
      console.warn('Viewer answer generation failed', err);
    }
  }
}

export const webrtcVideoEngine = new WebRTCVideoEngine();
