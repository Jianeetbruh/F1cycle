
## 2026-10-10 — Race lifecycle and roster management

- New races now start with an empty grid; the Race Director must add and name drivers and teams before launch.
- Added authoritative `IDLE → ACTIVE → FINISHED` race status. The server rejects creation of another race while one is active. A chequered flag, race winner, or transition to the podium marks the race finished.
- Race setup now explains why a new race is blocked and validates that every registered driver has a name and team.
- Team Radio and Driver Cockpit links are generated from the current race roster. A three-driver race now produces exactly three team links in each section instead of five fixed links.
- Custom roster teams now receive private server-generated join codes; no PINs are embedded in the client.
