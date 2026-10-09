# Deployment

## Architecture

Netlify serves the Vite client. Render runs only the Express/WebSocket signalling hub. Camera video is sent directly from the camera browser to each viewer with WebRTC; the Render process never relays video. JPEG snapshots are sent only as the existing fallback path.

## Render signalling service

Use a free Web Service with the project root as the service root:

```text
Build command: npm install
Start command: NODE_ENV=production npm start
```

Render supplies `PORT`; `server.ts` now honors it. Do not hard-code 3000 in the Render service. The service must be reachable over HTTPS/WSS for real phones.

## Netlify client

Use:

```text
Build command: npm run build
Publish directory: dist
```

Set `VITE_SIGNAL_SERVER_URL` to the Render HTTPS URL, for example `https://f1cycle-signal.onrender.com`. The client converts it to `wss://` automatically. A camera link may override it with `?server=https://f1cycle-signal.onrender.com`.

## Optional free ICE/TURN configuration

The app works with public STUN defaults for permissive networks. For strict mobile NATs, create a free Metered Open Relay configuration and provide the JSON array at build/runtime configuration time:

```text
VITE_ICE_SERVERS_JSON=[{"urls":["stun:stun.relay.metered.ca:80"]},{"urls":["turn:global.relay.metered.ca:443"],"username":"...","credential":"..."}]
```

If the Render endpoint also serves ICE configuration to another client, set the corresponding server variable:

```text
ICE_SERVERS_JSON=[{"urls":["stun:stun.relay.metered.ca:80"]},{"urls":["turn:global.relay.metered.ca:443"],"username":"...","credential":"..."}]
```

Use only credentials from a free account, never commit them, and rotate them if exposed. TURN is a connectivity aid for peer establishment; the application server still does not relay video.

## Debugging a live device

Append `&debug=1` to a Director or TV URL. Each camera tile reports actual inbound FPS, resolution, bitrate, RTT, jitter-buffer delay, packets lost, quality limitation reason, and connection state. The visible `WEBRTC` badge confirms the native video element is playing; `LIVE CAM` indicates the JPEG fallback.

## Test checklist

1. Open the camera URL over HTTPS and enter `5555`.
2. Start the camera and verify the local preview advances.
3. Open the Director URL and enter `8888`; verify the active program tile advances.
4. Open `/` and verify the TV program feed advances.
5. Check `?debug=1` for `connected`, non-zero FPS, negotiated dimensions, and zero/low packet loss.
6. Test Android Chrome and iOS Safari on separate mobile networks. Confirm camera permission, screen lock/background behavior, HTTPS, and strict-NAT connectivity. If WebRTC cannot connect, wait at least five seconds and confirm JPEG snapshots appear.

The repository’s Chromium test validates fake media and local signalling. It does not replace physical Android/iOS and carrier-network testing.
