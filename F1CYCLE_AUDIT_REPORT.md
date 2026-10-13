# f1Cycle audit and formal redesign plan

Audit date: 11 October 2026  
Live site reviewed: https://f1cycle.netlify.app/  
Source reviewed: the current `/home/ubuntu/f1cycle-work` project

## What the app does today

The live root page is a public-style broadcast view. It shows the F1-style broadcast header, race lap counter, track status, main feed, director program feed, classification table, event/steward area, team communications, and track-camera areas. The app is designed as a set of role-specific screens selected by query parameter.

The available app routes are:

| Role or screen | URL pattern | Main purpose |
|---|---|---|
| Public TV / broadcast | `/` or `?app=stream` | Main broadcast, timing tower, race graphics, camera program feed |
| Video Director | `?app=director` | Switch camera angles, choose program feed, toggle broadcast overlays, publish director notes |
| Camera operator | `?app=camera` | Start a phone camera, select camera station, send snapshots, report hazards, use camera radio |
| Official timekeeper | `?app=timer` or `?app=stopwatch` | Select a rider, start flying laps, record sectors, finish laps, manage the session countdown |
| Race Control | `?app=control` | Create races, register riders, control sessions, flags, lights, laps, penalties, and race events |
| Team radio / pit wall | `?app=radio` with `&team=TEAM_ID` | Team radio, speech transcription, pit-wall actions, flying-lap requests |
| Rider cockpit | `?app=cockpit` with `&team=TEAM_ID` | Rider HUD, telemetry, radio and pit information |
| Circuit map | `?app=circuit` | Circuit and track information |
| Organizer guide | `?app=guide` | Help and operating instructions |

The client is React 19 with TypeScript, Vite, Tailwind CSS, Lucide icons, Motion, WebRTC, and browser speech recognition. The server is Express with the `ws` WebSocket package. The server keeps rooms and race state in process memory. It exposes `/api/race-state` and `/api/ice-servers`, and serves the built client in production. There is no Firebase dependency and no Firebase Realtime Database configuration in the project.

Race state is synchronized by WebSocket messages. Video is intended to travel peer-to-peer through WebRTC. JPEG camera frames are the fallback path. Authentication is currently a client-side passcode screen backed by `sessionStorage`; it is not server-enforced authorization. A Render restart therefore loses the in-memory race state and active room data.

The live page rendered the main broadcast and classification areas successfully. The browser audit environment already had a session unlocked, so the deployed page did not display a passcode prompt during that visit. The source still contains passcode gates for the station screens. The root public broadcast is intentionally rendered separately from the locked station screens.

## Teams, PINs, and links that actually exist

The application currently contains five built-in team configurations. Team links are generated from the current race roster on the main app page. They use the current site origin and query parameters; for example, the pattern is `https://f1cycle.netlify.app/?app=radio&team=team-redbull` or `https://f1cycle.netlify.app/?app=cockpit&team=team-redbull`.

| Team | Code / PIN | Link pattern | Notes |
|---|---:|---|---|
| Oracle Red Bull Racing | `1111` | `https://f1cycle.netlify.app/?app=radio&team=team-redbull` or `?app=cockpit&team=team-redbull` | Built-in team ID `team-redbull`, number 1 |
| Scuderia Ferrari | `2222` | `https://f1cycle.netlify.app/?app=radio&team=team-ferrari` or `?app=cockpit&team=team-ferrari` | Built-in team ID `team-ferrari`, number 16 |
| McLaren F1 Team | `3333` | `https://f1cycle.netlify.app/?app=radio&team=team-mclaren` or `?app=cockpit&team=team-mclaren` | Built-in team ID `team-mclaren`, number 4 |
| Mercedes-AMG F1 | `4444` | `https://f1cycle.netlify.app/?app=radio&team=team-mercedes` or `?app=cockpit&team=team-mercedes` | Built-in team ID `team-mercedes`, number 44 |
| Aston Martin F1 | `5555` | `https://f1cycle.netlify.app/?app=radio&team=team-aston` or `?app=cockpit&team=team-aston` | Built-in team ID `team-aston`, number 14 |

Station PINs are:

| Station | URL | PIN | Purpose |
|---|---|---:|---|
| Race Control | `?app=control` | `9999` | Race Director and steward controls |
| Video Director | `?app=director` | `8888` | Camera switching and broadcast graphics |
| Official Timer | `?app=timer` | `7777` | Lap and sector timing |
| Camera Station | `?app=camera` | `5555` | Phone camera broadcast |
| Organizer bypass | Any locked station or team screen | `0000` | Universal client-side bypass |

For newly registered custom teams, the current implementation accepts organizer PIN `0000`, but it does not create a unique team join PIN. A custom roster team can produce a link using its generated driver ID, but there is no secure, server-generated invitation token. Marshal-specific join codes, spectator-specific codes, and separate admin invitation links are **not found**.

## Main issues that can block a real race

The most important issue is authorization. The passcodes are shipped in the browser JavaScript and the server accepts state-changing WebSocket messages without validating the user role or station PIN. Anyone who knows the message format can attempt to change race state. Client-side passcodes are suitable for a friendly volunteer event, not for secure official results.

The second issue is persistence. Race state, rooms, clients, lap history, flags, and results are held in server memory. A Render restart, sleep cycle, crash, or redeploy can lose the active race. There is no durable results database or export service.

The third issue is registration. Custom drivers can be entered by Race Control, but teams do not receive unique join codes or a server-issued invitation. The built-in team IDs and fixed PINs are predictable and are not tied to a particular race.

The fourth issue is timer authority. The client now updates the visible session timer immediately and synchronizes the action to the server, which improves button responsiveness. However, the server countdown uses a one-second interval and does not expose an authoritative start timestamp for the session countdown. A reconnecting client can briefly show a different value until the next state update.

The fifth issue is race safety. There are flag, safety-car, VSC, lights, hazard, and pit actions, but GPS tracking, marshal-post status, SOS escalation, geofencing, and emergency contact workflows are not found.

The sixth issue is championship scoring. Live positions, laps, intervals, fastest-lap data, and winners exist. A durable F1 points table for drivers and constructors, season history, result export, and steward-approved result locking are not found.

The seventh issue is mobile and operational complexity. The app exposes many capabilities in the guide and link-distribution areas. The main broadcast has a strong visual broadcast style, but the control tools contain many dense cards, icon buttons, and technical labels. A first-time volunteer can easily use the wrong control or miss whether an action was accepted.

## Prioritized change list

### High priority

**1. Add server-side role authorization and race-scoped invitation tokens.** The server should issue a short-lived signed token after an organizer creates a race. Team links should contain a random invitation token, not a predictable team ID. Every state-changing WebSocket action should be checked against the token, role, and race ID.

**2. Add durable race persistence.** Store race configuration, qualifying attempts, laps, penalties, flags, and final results in a free-tier-compatible database or append-only export layer. At minimum, write periodic JSON snapshots to durable storage and recover the active race after a Render restart. Do not store video in the database.

**3. Make the server clock authoritative.** Add `sessionStartedAt`, `sessionPausedAt`, and an action sequence number to the race state. Clients should render from the server timestamp instead of decrementing an independently initialized integer. Continue to update the button UI optimistically, then reconcile with the authoritative sequence number.

**4. Formalize the race lifecycle.** Keep the existing `IDLE → ACTIVE → FINISHED` rule, but add explicit states for registration, practice, qualifying, grid locked, race live, red flag, finished, and podium. Prevent invalid actions based on state and show a clear reason to the operator.

**5. Add qualifying attempts and automatic grid generation.** Store every completed qualifying lap per rider, identify the best valid attempt, record invalidated attempts, and generate a locked grid sorted by best qualifying time before the race starts.

### Medium priority

**6. Add official result and points management.** Calculate the requested F1-style points system of 25, 18, 15, 12, 10, 8, 6, 4, 2, and 1. Add fastest-lap rules as an explicit configuration, constructor/team totals, season standings, and CSV/JSON export.

**7. Add structured marshal and safety workflows.** Provide marshal-post registration, track-sector status, incident reports, SOS escalation, acknowledgement state, and a visible emergency contact card. GPS should be opt-in and should not be presented as a replacement for normal event safety procedures.

**8. Improve offline tolerance.** Queue non-conflicting marshal reports locally with an idempotency key. Do not allow an offline client to silently overwrite official results. Show `Offline`, `Queued`, `Acknowledged`, or `Rejected` for every queued action.

**9. Improve WebRTC operational controls.** Keep peer-to-peer video and the JPEG fallback. Add a visible camera connection state, last-frame timestamp, viewer count, bitrate, resolution, and fallback reason. Keep the existing free ICE configuration optional and never relay video through the Render server.

### Low priority

**10. Add event branding and configuration.** Allow the organizer to set event name, circuit name, colours, logo, class, lap distance, and points rules instead of keeping Metro Jazz labels in the UI.

**11. Add report and broadcast exports.** Generate a final classification, qualifying grid, incident log, lap history, and team radio transcript export after the event.

**12. Add accessibility and localization polish.** Add keyboard focus styles, ARIA labels, plain-language help, larger touch targets, reduced-motion support, and an optional Hindi/English language toggle.

## Formal role-based layout proposal

### Public spectator / TV view

Use a read-only top bar with event name, session, race status, connection state, and a single `How to watch` action. The page should contain one primary broadcast panel, a compact timing tower, a flag/status banner, and a collapsible event log. Hide all race-control, camera, team, and timing write actions. The spectator view should never expose admin controls merely because a query parameter is changed.

### Team / rider view

Use a team header showing team name, rider number, connection status, and race session. The main cards should be `Current position`, `Lap and gap`, `Team radio`, `Pit request`, and `Safety / SOS`. Put one large primary action on each state: `Request pit`, `Send radio`, or `Send SOS`. Hide flags, race creation, driver editing, camera switching, and result deletion.

### Marshal / camera view

Use a simple status-first layout: `Camera status`, `Assigned sector`, `Connection`, `Start camera`, `Stop camera`, `Report incident`, and `Contact Race Control`. The camera button should be large and persistent. Hazard reporting should use a short form with sector, category, severity, and optional note. The page should show the last successful frame time and whether WebRTC or snapshot fallback is active.

### Race Director / Admin view

Use a left navigation with `Race setup`, `Qualifying`, `Grid`, `Race control`, `Results`, `Teams`, and `Settings`. The main panel should show a large state indicator: `Registration`, `Qualifying`, `Grid locked`, `Race live`, `Red flag`, or `Finished`. Put only the valid actions for the current state in the primary action area. Destructive actions such as reset timer, delete lap, invalidate result, end race, and abandon race require confirmation and an explanation field.

### Qualifying / timer view

Use a rider selector at the top, followed by a large timer, sector buttons, and a clear `Submit qualifying lap` action. Show the rider's previous attempts below the timer. The best valid attempt should be visually distinct. Do not mix session countdown controls with flying-lap controls without separate headings.

### Teams and links view

Show one card per registered team with team name, rider number, status, invitation link, and a `Regenerate invitation` action. Display a one-time PIN or token only when the organizer explicitly requests it. Do not display unused built-in teams when a race has a custom roster.

## UI elements that currently cause confusion

The app combines broadcast presentation, organizer documentation, station launch links, and live operations in the same broad experience. The dispatch area is useful for setup but is visually dense. A role-based landing screen would make the first action clearer.

The terms `Director`, `Timer`, `Camera`, `Radio`, `Cockpit`, and `Control` are meaningful to an experienced operator but not to a new volunteer. Add a one-line description under every role and use labels such as `Broadcast Director`, `Official Timekeeper`, `Track Camera Marshal`, and `Race Director`.

Several controls use icons beside short labels or icon-only reset/lock actions. Every icon-only action should receive a visible text label on mobile or an always-visible tooltip. Reset and delete actions should use confirmation dialogs.

The session countdown and flying-lap stopwatch are different timers but are displayed close to one another. Separate them into `Official session clock` and `Rider qualifying stopwatch`, each with its own status and help text.

The team link cards currently depend on the current roster, which is correct for custom races, but the app still contains built-in team assumptions in several places. A single server-provided roster should be used for all team menus, radio permissions, cockpit links, and team dashboards.

The main public view shows a professional broadcast treatment, but technical labels such as bitrate, camera quality, and multi-cam status should be placed behind an optional `Technical details` panel for spectators. Operators can keep them visible in Director mode.

## Implementation plan

Phase 1 should harden the current architecture without adding a paid service: introduce server-side action authorization, random race and invitation IDs, an authoritative timer timestamp, durable result export, and explicit race state transitions. Keep WebRTC peer-to-peer and retain JPEG snapshots only as an opt-in fallback.

Phase 2 should implement qualifying attempts, grid lock, points, standings, steward approvals, incident reports, marshal sectors, and reconnect recovery. Add automated tests for illegal actions, duplicate submissions, reconnects, timer pause/resume, and race restart recovery.

Phase 3 should apply the role-based navigation and formal design system. Use one shared roster and permissions object so the UI and server enforce the same capabilities. Add mobile layout tests at narrow widths and keyboard/accessibility checks. Keep race data in the server-owned local record and keep all camera media peer-to-peer.

## Evidence and limitations

The current source was inspected directly in `src/App.tsx`, `src/utils/security.ts`, `src/services/radioEngine.ts`, `src/components/RaceControlPortal.tsx`, `src/components/RaceSetupModal.tsx`, `src/components/CameraStation.tsx`, and `server.ts`. The deployed Netlify page was opened in a real browser and its public broadcast content was observed. Full browser automation of every protected control was not possible from the static page extraction alone because the browser session did not expose interactive element indexes; the source-level route and action inventory was therefore used for the protected screens.

## References

[1]: https://f1cycle.netlify.app/ "Live f1Cycle broadcast application"
[2]: https://github.com/ "Repository hosting is not specified in the deployed application"
