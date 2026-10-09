# Changelog

## 2026-10-09 — WebRTC live-feed reliability pass

### Root causes found

- **The requested local server command ignored `PORT=3111`.** `server.ts` always listened on port 3000, so the camera URL’s `server=http://localhost:3111` could not connect.
- **The camera URL did not control the client WebSocket endpoint.** `radioEngine.connect()` always used the Vite page origin, so a separate Render/Express signalling service could not be selected.
- **The browser video path had no observable receiver metrics.** There was no `getStats()` surface, so the UI could not distinguish a smooth WebRTC stream from a snapshot fallback.
- **Sender and receiver media policy was not explicit in this archive.** Track content hint, max bitrate/framerate, degradation preference, and receiver jitter target were not applied.
- **Committed Metered relay credentials were present.** These were removed. Video remains peer-to-peer; optional TURN is supplied at deploy time through free Open Relay credentials.

### Changes

- `PORT` is now read from `process.env.PORT` with a 3000 fallback.
- `?server=https://...` and `VITE_SIGNAL_SERVER_URL` now select the signalling endpoint; `http` is converted to `ws` and `https` to `wss`.
- Added `VITE_ICE_SERVERS_JSON` / `ICE_SERVERS_JSON` support. Defaults are public STUN endpoints; TURN is optional and never carries video through the app server.
- Broadcaster senders use `contentHint=motion`, `maintain-framerate`, 30 fps, 1.8 Mbps maximum bitrate, and no scale-down. Viewers request an 80 ms jitter-buffer target when supported.
- Added a `?debug=1` overlay to every `SmoothVideoCanvas` with connection state, FPS, resolution, bitrate, RTT, jitter-buffer delay, packets lost, and quality limitation reason.
- Existing JPEG snapshots remain an opt-in fallback and are not used as a server video relay.
- Updated dependency resolution so a clean `npm install` succeeds with Vite 8 and compatible esbuild.

### Measurements

| Scenario | Before evidence | After evidence |
|---|---|---|
| Install/build | `npm install` failed with `ERESOLVE`: Vite 8.3 required esbuild `^0.27 || ^0.28`, archive requested `^0.25` | Clean `npm install`, `npx tsc --noEmit`, and `npm run build` pass. |
| Signalling port | `PORT=3111` still bound the server to 3000; `curl localhost:3111` returned connection refused | `PORT=3111` served successfully; `curl` returned HTTP 200. |
| Director program feed | No stats surface existed in the archive | Playwright fake-camera run: video playing and advancing, 20 fps, 960×540, 477–506 kbps, 0–1 ms RTT, 7 ms jitter-buffer delay, 0 packets lost, `connected`. |
| TV program feed | No stats surface existed in the archive | Playwright fake-camera run: video playing and advancing, 20 fps, 480–640×270–360, 254–315 kbps, 1 ms RTT, 7–8 ms jitter-buffer delay, 0 packets lost, `connected`. |
| Director thumbnails | No stats surface existed in the archive | Five thumbnail elements remained mounted; the active camera connected and rendered. Inactive cameras stayed in `waiting` until a camera publishes, avoiding unnecessary fake connections. |
| Degraded browser network | No measured degraded-network behavior | CDP run at 1.5 Mbps / 100 ms / 2% configured loss retained a playing video for 20 seconds. Measured samples remained `connected`, 20 fps, 640×360 through 1280×720, with snapshot text/fallback available. This is not a real-radio/mobile packet-loss proof because localhost WebRTC may use a direct host candidate and CDP network shaping is not equivalent to an RF network. |

### Test limitations

- Real Android Chrome and iOS Safari devices were **not available in this sandbox**, so HTTPS handset capture, camera permission UX, backgrounding behavior, and mobile NAT traversal remain to be tested on physical devices.
- The Playwright run used Chromium fake media flags and local direct peers. It validates rendering, signalling, and stats plumbing, not carrier-network quality.
- The repository does not claim that 60 fps is guaranteed: the fake Chromium camera delivered 20 fps, and the debug overlay reports the actual negotiated value.
