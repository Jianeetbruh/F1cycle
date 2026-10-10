import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Tv,
  Smartphone,
  Radio as RadioIcon,
  Flag,
  Shield,
  HelpCircle,
  Award,
  Users,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Camera,
  Layers,
  Clock,
  Play,
  Maximize2
} from 'lucide-react';

interface OrganizerGuideProps {
  onSelectTab: (tab: string) => void;
}

export const OrganizerGuide: React.FC<OrganizerGuideProps> = ({ onSelectTab }) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-950/80 via-zinc-900 to-zinc-950 border border-red-800/50 rounded-3xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-red-400 mb-2 font-bold tracking-widest uppercase">
            <span>🏁 THE OFFICIAL SOCIETY GRAND PRIX PLAYBOOK</span>
          </div>
          <h1 className="font-racing font-bold text-3xl md:text-5xl text-white tracking-wide">
            Master Race Organization Blueprint
          </h1>
          <p className="text-zinc-300 text-sm md:text-base mt-2 max-w-3xl leading-relaxed">
            The complete operational checklist, volunteer role assignments, device configurations, and race-day running order to host an authentic Formula 1 cycling event in your housing society or neighborhood.
          </p>
        </div>

        {/* Section 1: The Volunteer Apps Suite */}
        <div className="space-y-4">
          <h2 className="font-racing font-bold text-2xl text-white flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-red-500" />
            <span>The 7 Web Apps (All Built Into This Platform)</span>
          </h2>
          <p className="text-zinc-400 text-sm">
            You do not need to install separate software. Simply share the platform link with volunteers and participants, adding the relevant role parameter (or use the navigation buttons below):
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* App 1: Driver Cockpit */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase">
                    RIDER PHONE (?app=cockpit)
                  </span>
                  <button
                    onClick={() => onSelectTab('cockpit')}
                    className="text-xs font-racing font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  1. Driver Cockpit HUD
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Mounted on the rider's bicycle handlebar. Features GPS speed, rev lights, lap time readouts, real-time flag alarms, and a massive <strong>Push-to-Talk</strong> button with automatic English speech transcription.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Cyclist on bike with single earphone mic
              </div>
            </div>

            {/* App 2: Pit Wall */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold uppercase">
                    PIT BENCH (?app=pitwall)
                  </span>
                  <button
                    onClick={() => onSelectTab('radio')}
                    className="text-xs font-racing font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  2. Pit Wall Engineer Portal
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  For each rider's strategist friend. Two-way PTT audio radio with rider, tactical canned soundboard ("Box Box Box", "Push Now"), pit window calculator, and confirm pit stop button.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Team Strategist at pit station
              </div>
            </div>

            {/* App 3: Race Control */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold uppercase">
                    HOST DESK (?app=control)
                  </span>
                  <button
                    onClick={() => onSelectTab('control')}
                    className="text-xs font-racing font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  3. Race Control Tower
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Operates the <strong>5 Red Lights Launch Gantry</strong> (broadcasts live across every volunteer's phone), clicks <strong>"CROSS LINE (COUNT LAP)"</strong> as riders pass, marks <strong>"PITTED"</strong> to tell stream, and issues flags.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Race Director / Head Host
              </div>
            </div>

            {/* App 4: Stream */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase">
                    TV / PROJECTOR (?app=stream)
                  </span>
                  <button
                    onClick={() => onSelectTab('stream')}
                    className="text-xs font-racing font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  4. Main Broadcast Stream (TV)
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Projected in the society clubhouse or lawn. Features <strong>Fullscreen Mode (Press F)</strong>, live F1 timing tower, qualifying lap timer overlay, team radio pop-ups with sound, and pit lane alerts.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Clubhouse TV, parents, spectators
              </div>
            </div>

            {/* App 5: Camera Phone */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold uppercase">
                    MARSHAL PHONE (?app=camera)
                  </span>
                  <button
                    onClick={() => onSelectTab('camera')}
                    className="text-xs font-racing font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  5. Trackside Camera Feed
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Volunteers stand at key corners (Hairpin, Swimming pool chicane, Finish line) with phone cameras pointed at the track. Streams live video frames directly into the broadcast room.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Volunteer Marshals with tripods/hands
              </div>
            </div>

            {/* App 6: Video Director & Timer */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold uppercase">
                    PRODUCER (?app=director or ?app=timer)
                  </span>
                  <button
                    onClick={() => onSelectTab('timer')}
                    className="text-xs font-racing font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h3 className="font-racing font-bold text-base text-white">
                  6. Timekeeper & Lap History Log
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Used during Q1 flying shootout for sector splits. Includes the new <strong>Lap History Display</strong> that automatically logs every completed lap in a scrollable table with purple fastest-lap badges.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-zinc-500">
                User: Timekeeper / Official Scorer
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Step-by-Step Race Day Running Order */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6">
          <h2 className="font-racing font-bold text-2xl md:text-3xl text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-red-500" />
            <span>Grand Prix Day: Step-by-Step Running Order</span>
          </h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-racing font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-red-950/50">
                1
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-racing font-bold text-lg text-white">
                  Pre-Race Setup & Equipment Check (60 Minutes Before)
                </h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                  <li>• <strong>Track Marking:</strong> Use chalk or cones to mark the Finish Line Gantry, Pit Lane Entry/Exit boxes, and apex kerbs at sharp bends.</li>
                  <li>• <strong>Big Screen Setup:</strong> Open <code className="text-red-400">?app=stream</code> on the clubhouse laptop/TV and press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">F</kbd> for Fullscreen mode.</li>
                  <li>• <strong>Volunteer Camera Positions:</strong> Position 2-3 volunteers with phones running <code className="text-blue-400">?app=camera</code> at the Main Gate Hairpin and Finish Line.</li>
                  <li>• <strong>Driver Setup:</strong> Mount rider phones onto bike handlebars with <code className="text-emerald-400">?app=cockpit</code> open and pair Bluetooth earphones.</li>
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-racing font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-red-950/50">
                2
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-racing font-bold text-lg text-white">
                  Practice Sessions: P1, P2, P3 (20 Minutes)
                </h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                  <li>• In <strong>Race Control</strong>, click the <strong>"P1"</strong> session button.</li>
                  <li>• Riders take slow laps around the society loop to test radio push-to-talk speech transcription with their pit wall strategists.</li>
                  <li>• Corner marshals practice waving yellow flags to ensure everyone respects safety rules.</li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-racing font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-red-950/50">
                3
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-racing font-bold text-lg text-white">
                  Q1 Qualifying Shootout (1-Lap Flying Shootout for Pole)
                </h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                  <li>• In <strong>Race Control</strong>, switch session to <strong>"Q1"</strong>.</li>
                  <li>• Each cyclist is released individually: 1 Out-Lap, 1 Maximum Effort Flying Lap, and 1 In-Lap.</li>
                  <li>• The Timekeeper uses <code className="text-purple-400">?app=timer</code> to stamp Sector 1, Sector 2, and Finish.</li>
                  <li>• The fastest driver wins <strong>Pole Position (P1)</strong> on the starting grid!</li>
                  <li>• Every qualifying lap automatically archives into the <strong>Lap History Table</strong>.</li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-racing font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-red-950/50">
                4
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-racing font-bold text-lg text-white">
                  The Grand Prix Main Race (10 to 15 Laps)
                </h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                  <li>• Switch session to <strong>"RACE"</strong>. Bikes line up on their chalk grid marks.</li>
                  <li>• <strong>5 Red Lights Launch:</strong> Race Director clicks Start Sequence. 5 red pods illuminate on <strong>EVERY volunteer phone</strong> with beeps... <em>LIGHTS OUT AND AWAY WE GO!</em></li>
                  <li>• <strong>Counting Laps:</strong> No stopwatch timer needed during the race! As each rider crosses the finish line, the Race Director simply clicks <strong className="text-emerald-400">"🏁 CROSS FINISH LINE (COUNT LAP)"</strong>. The app automatically increments laps and calculates standings.</li>
                  <li>• <strong>Pit Stops:</strong> Around Lap 5-7, riders take their mandatory pit stop (drink water / dismount). The Director or Pit Wall clicks <strong className="text-amber-400">"🟡 PITTED (TELL STREAM)"</strong> to broadcast the official F1 pit stop graphic on the TV!</li>
                </ul>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white font-racing font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-red-950/50">
                5
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-racing font-bold text-lg text-white">
                  Chequered Flag, Podium Ceremony & Confetti
                </h3>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                  <li>• When the leader finishes the final lap, the Race Director clicks <strong>"CHEQUERED FLAG"</strong>.</li>
                  <li>• Switch session to <strong>"PODIUM"</strong>: Plays the podium fanfare on stream and displays 1st, 2nd, and 3rd trophies alongside the DHL Fastest Lap award!</li>
                  <li>• In the Timer App, click <strong>"COPY LOG"</strong> on the Lap History Table to paste the full official race classification into your society WhatsApp group!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Track Safety & Society Ground Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <h3 className="font-racing font-bold text-lg text-white mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Society Safety Guidelines</span>
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">1.</span>
                <span><strong>Single Earphone Rule:</strong> Cyclists must keep one ear uncovered so they can hear ambient society sounds, horns, and pedestrian warnings.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                <span><strong>Pedestrian Right-of-Way:</strong> If a resident crosses the road, corner marshals whistle immediately and the Race Director deploys the Yellow Flag or VSC.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">3.</span>
                <span><strong>Helmets Mandatory:</strong> All riders must wear fastened cycling helmets.</span>
              </li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <h3 className="font-racing font-bold text-lg text-white mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span>Host Pro-Tips for Extra Fun</span>
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">★</span>
                <span><strong>Bluetooth Speaker at Pit Lane:</strong> Connect a Bluetooth speaker to the Main Stream device to broadcast team radios and the 5-red-lights beeps across the entire lawn!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">★</span>
                <span><strong>Soda Champagne:</strong> Shake up cheap sparkling apple juice or carbonated soda for the podium spray!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">★</span>
                <span><strong>Double-Check WiFi:</strong> Ensure volunteer phones are connected to society clubhouse WiFi or mobile 4G/5G hotspots.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
