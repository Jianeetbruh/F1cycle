# Deployment

## Architecture

Netlify serves the Vite client. Render runs only the Express/WebSocket signalling hub. Camera video is sent directly from the camera browser to each viewer with WebRTC; the Render process never relays video. JPEG snapshots are sent only as the existing opt-in fallback path.

## Render signalling service

Use a free Web Service with the project root as the service root:

```text
Build command: npm install
Start command: NODE_ENV=production npm start
Health check: /health
```

Render supplies `PORT`; `server.ts` honors it. The service must be reachable over HTTPS/WSS for real phones.

The server uses a local asynchronous race store. It writes the active race, audit events, snapshots, and private team-code hashes to `RACE_DATA_DIR` without blocking WebSocket broadcasts or timer updates. The file writes are atomic and serialized per room, so the race-control behavior stays smooth without Firebase or another database account.

**Important hosting note:** Render's free filesystem is temporary. The local record protects against ordinary process errors and keeps the app self-contained, but a Render restart/redeploy can remove the files. Export JSON and CSV from Race Control before and after an official event. If restart-survival becomes mandatory, use a persistent-disk host or add a database adapter later; the UI and store interface are intentionally separated for that change.

## Netlify client

Use:

```text
Build command: npm run build
Publish directory: dist
```

Set `VITE_SIGNAL_SERVER_URL` to the Render HTTPS URL, for example `https://f1cycle-signal.onrender.com`. The client converts it to `wss://` automatically. A camera link may override it with `?server=https://f1cycle-signal.onrender.com`.

## Optional free ICE/TURN configuration

The app works with public STUN defaults for permissive networks. For strict mobile NATs, a free Metered Open Relay configuration may be supplied as `VITE_ICE_SERVERS_JSON`. TURN only helps peers establish a connection; the application server still does not relay video.

## Debugging a live device

Append `&debug=1` to a Director or TV URL. Each camera tile reports actual inbound FPS, resolution, bitrate, RTT, jitter-buffer delay, packets lost, quality limitation reason, and connection state. The visible `WEBRTC` badge confirms the native video element is playing; `LIVE CAM` indicates the JPEG fallback.

## Test checklist

1. Open the camera URL over HTTPS and enter the camera PIN.
2. Start the camera and verify the local preview advances.
3. Open the Director URL and verify the active program tile advances.
4. Open `/` and verify the TV program feed advances.
5. Check `?debug=1` for `connected`, non-zero FPS, negotiated dimensions, and zero/low packet loss.
6. Test Android Chrome and iOS Safari on separate mobile networks. Confirm camera permission, screen lock/background behavior, HTTPS, and strict-NAT connectivity. If WebRTC cannot connect, wait at least five seconds and confirm JPEG snapshots appear.
7. Verify `/health` returns `ready: true` and `persistence: "local-file"`.

The repository's Chromium test validates fake media and local signalling. It does not replace physical Android/iOS and carrier-network testing.

## Race data and authentication setup

The app keeps the current race in memory for fast broadcasts and mirrors it asynchronously to JSON files under `RACE_DATA_DIR`. The local record includes the full race state, append-only audit events, labeled qualifying/race snapshots, and private team join-code hashes. No Firebase project, service account, Firestore rules, or external database is required.

Keep these backend variables on Render only:

```text
RACE_DATA_DIR=./data/races
SESSION_SECRET=<long random secret>
ADMIN_PIN_HASH=<salt$hash>
MARSHAL_PIN_HASH=<salt$hash>
TEAM_PIN_HASH=<salt$hash>
ALLOWED_ORIGIN=https://f1cycle.netlify.app
```

Generate PIN hashes locally without saving the original PIN in the repository:

```bash
npx tsx scripts/hash-pin.ts YOUR_ADMIN_PIN
npx tsx scripts/hash-pin.ts YOUR_MARSHAL_PIN
npx tsx scripts/hash-pin.ts YOUR_TEAM_PIN
```

The Race Control header contains **EXPORT JSON** and **EXPORT CSV**. These endpoints require an authenticated admin session and export the current official race state and classification.

Use UptimeRobot or cron-job.org to request `https://YOUR-SERVICE.onrender.com/health` every five minutes. The free Render service can still cold-start after idle time. For an important race, wake it at least 15 minutes before the start and confirm `ready: true`, or use a no-sleep host/plan for race day.

## Backup and recovery checklist

1. Create a test race and register at least two riders and teams.
2. Record qualifying times and confirm the order is visible.
3. Start the race and record laps for multiple riders.
4. Change the flag, add a penalty, and confirm the event log updates.
5. Export JSON and CSV before restarting or redeploying.
6. If the local file is still present, restart the Render process and confirm the active race reloads.
7. If the host clears its free filesystem, import/recreate the race from the exported backup using the existing Race Control workflow.
8. Confirm clients reconnect and receive the current full state.
9. Confirm unauthenticated WebSocket joins and unauthenticated API exports are rejected.
10. Confirm repeated invalid PIN attempts receive HTTP 429 after the configured limit.
