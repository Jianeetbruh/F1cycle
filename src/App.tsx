import React, { useState, useEffect } from 'react';
import {
  Tv,
  Camera,
  Timer,
  Radio as RadioIcon,
  Video,
  Smartphone,
  Flag,
  Map,
  BookOpen,
  Share2,
  ExternalLink,
  Wifi,
  WifiOff,
  X,
  Layers,
  Check,
  Sparkles,
  Lock,
  ChevronDown,
  Shield
} from 'lucide-react';
import { MainBroadcastStream } from './components/MainBroadcastStream';
import { VideoDirectorStation } from './components/VideoDirectorStation';
import { LapTimerStation } from './components/LapTimerStation';
import { CameraStation } from './components/CameraStation';
import { PitWallPortal } from './components/PitWallPortal';
import { DriverCockpit } from './components/DriverCockpit';
import { RaceControlPortal } from './components/RaceControlPortal';
import { CircuitMap } from './components/CircuitMap';
import { OrganizerGuide } from './components/OrganizerGuide';
import { radioEngine, RaceState } from './services/radioEngine';
import { securityEngine } from './utils/security';

import { FlagAlertOverlay } from './components/FlagAlertOverlay';

export type AppTab =
  | 'stream'
  | 'director'
  | 'timer'
  | 'camera'
  | 'radio'
  | 'cockpit'
  | 'control'
  | 'circuit'
  | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('stream');
  const [teamId, setTeamId] = useState<string>('team-redbull');
  const [raceState, setRaceState] = useState<RaceState | null>(radioEngine.currentRaceState);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showAppsModal, setShowAppsModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    // Detect dedicated route from pathname or query param
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const appParam = params.get('app') || params.get('role');
    const teamParam = params.get('team');

    let resolvedTab: AppTab = 'stream';

    if (path.includes('/camera') || appParam === 'camera') resolvedTab = 'camera';
    else if (path.includes('/timer') || appParam === 'timer' || appParam === 'stopwatch') resolvedTab = 'timer';
    else if (path.includes('/director') || appParam === 'director' || appParam === 'angle') resolvedTab = 'director';
    else if (path.includes('/radio') || appParam === 'radio' || appParam === 'pitwall') resolvedTab = 'radio';
    else if (path.includes('/cockpit') || appParam === 'cockpit' || appParam === 'driver') resolvedTab = 'cockpit';
    else if (path.includes('/control') || appParam === 'control') resolvedTab = 'control';
    else if (path.includes('/circuit') || appParam === 'circuit') resolvedTab = 'circuit';
    else if (path.includes('/guide') || appParam === 'guide') resolvedTab = 'guide';
    else if (path.includes('/stream') || appParam === 'stream' || appParam === 'broadcast') resolvedTab = 'stream';

    setActiveTab(resolvedTab);

    if (teamParam) setTeamId(teamParam);

    const unsubState = radioEngine.onRaceState(setRaceState);
    const unsubStatus = radioEngine.onStatus((connected) => setIsConnected(connected));

    return () => {
      unsubState();
      unsubStatus();
    };
  }, []);

  const flagStatus = raceState?.flagStatus || 'GREEN';

  const getStandaloneLink = (tabName: string, extraTeam?: string) => {
    const base = window.location.origin + window.location.pathname;
    let url = `${base}?app=${tabName}`;
    if (extraTeam) url += `&team=${extraTeam}`;
    return url;
  };

  const copyToClipboard = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // =========================================================================
  // STRICT DECOUPLING: STANDALONE APP VIEWS
  // If the user opened a dedicated link (e.g. Camera, Timer, Director, Radio, Cockpit)
  // render ONLY that app with floating return button to stream
  // =========================================================================

  const renderBackPill = () => (
    <div className="fixed top-2.5 right-2.5 z-50">
      <button
        onClick={() => {
          if (activeTab === 'control' || activeTab === 'director' || activeTab === 'timer' || activeTab === 'camera') {
            securityEngine.lockStation(activeTab);
          }
          if (activeTab === 'radio' || activeTab === 'cockpit') {
            securityEngine.lockTeam(teamId);
          }
          setActiveTab('stream');
        }}
        className="bg-black/90 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-racing font-bold border border-zinc-700 backdrop-blur-md shadow-2xl flex items-center gap-1.5 transition-all active:scale-95"
        title="Lock & Return to Main Stream"
      >
        <span>← MAIN STREAM (LOCK)</span>
      </button>
    </div>
  );

  if (activeTab === 'camera') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <CameraStation />
      </>
    );
  }

  if (activeTab === 'timer') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <LapTimerStation />
      </>
    );
  }

  if (activeTab === 'director') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <VideoDirectorStation />
      </>
    );
  }

  if (activeTab === 'radio') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <PitWallPortal
          teamId={teamId}
          engineerName="Race Engineer"
          onSwitchTeam={setTeamId}
        />
      </>
    );
  }

  if (activeTab === 'cockpit') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <DriverCockpit
          teamId={teamId}
          driverName="Driver"
          onSwitchTeam={setTeamId}
        />
      </>
    );
  }

  if (activeTab === 'control') {
    return (
      <>
        {renderBackPill()}
        <FlagAlertOverlay />
        <RaceControlPortal />
      </>
    );
  }

  // =========================================================================
  // MAIN f1Cycle WEBSITE / BROADCAST STREAM EXPERIENCE
  // Rendered when on root / or /stream: Shows the public stream, circuit map,
  // guide, and the standalone volunteer link distributor.
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col font-sans">
      <FlagAlertOverlay />
      {/* Top Main Stream Header */}
      <header className="bg-[#0b0d13] border-b border-[#1b1f2e] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Logo & Circuit Title */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('stream')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="bg-[#e10600] text-white px-2 py-0.5 rounded-sm text-xs font-black font-racing tracking-tight">F1</span>
              <span className="font-racing font-bold text-base text-white tracking-wider">WORLD CHAMPIONSHIP</span>
            </div>

            {/* Flag Status Pill */}
            <div
              className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded flex items-center gap-1.5 border ${
                flagStatus === 'GREEN'
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400'
                  : flagStatus === 'SC'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : flagStatus === 'VSC'
                  ? 'bg-orange-950/80 border-orange-500 text-orange-300'
                  : flagStatus === 'RED'
                  ? 'bg-red-950/80 border-red-500 text-red-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>{flagStatus === 'GREEN' ? 'TRACK CLEAR' : `${flagStatus} FLAG`}</span>
            </div>
          </div>

          {/* Navigation for Spectators & Host Guide */}
          <nav className="flex items-center gap-1 bg-[#07080c] p-1 rounded-lg border border-[#1b1f2e]">
            <button
              onClick={() => setActiveTab('stream')}
              className={`px-3 py-1 rounded text-xs font-racing font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'stream'
                  ? 'bg-[#e10600] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>LIVE BROADCAST</span>
            </button>

            <button
              onClick={() => setActiveTab('circuit')}
              className={`px-3 py-1 rounded text-xs font-racing font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'circuit'
                  ? 'bg-[#e10600] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>CIRCUIT MAP</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1 rounded text-xs font-racing font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'guide'
                  ? 'bg-[#e10600] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>OFFICIAL GUIDE</span>
            </button>
          </nav>

          {/* Standalone Volunteer App Links Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAppsModal(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-racing font-bold flex items-center gap-1.5 border border-zinc-700 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>DISPATCH APPS</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 bg-[#0e1017] border border-[#202538] px-2.5 py-1 rounded text-xs font-mono">
              {isConnected ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  WS LIVE
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> OFFLINE
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Stream Viewer or Guide */}
      <main className="flex-1">
        {activeTab === 'stream' && <MainBroadcastStream />}
        {activeTab === 'circuit' && <CircuitMap />}
        {activeTab === 'guide' && (
          <OrganizerGuide onSelectTab={(tab) => setActiveTab(tab as any)} />
        )}
      </main>

      {/* Standalone Volunteer App Links Modal */}
      {showAppsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAppsModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>STANDALONE DECOUPLED WEB APPS</span>
              </div>
              <h3 className="font-racing font-bold text-2xl text-white mt-0.5">
                Send Direct Links to Volunteers & Cyclists
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Each link opens a <strong>dedicated standalone web app</strong> with zero navigation bars or other app distractions:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. Camera App */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-purple-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> 1. Camera Volunteer App
                    </span>
                    <span className="bg-purple-950 border border-purple-800 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      PASSCODE PROTECTED
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Standalone camera viewfinder. Streams live track video from volunteer phone to clubhouse TV and director.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={getStandaloneLink('camera')}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 text-xs"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(getStandaloneLink('camera'), 'camera')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl font-mono text-center flex items-center justify-center gap-1.5 transition-all ${
                      copiedLink === 'camera'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {copiedLink === 'camera' ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{copiedLink === 'camera' ? 'Copied Link!' : 'Copy Camera Link'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Timer App */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5" /> 2. Stopwatch Timer App
                    </span>
                    <span className="bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      PASSCODE PROTECTED
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Dedicated flying lap stopwatch for the timekeeper. Live running millisecond counter & sector split buttons.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={getStandaloneLink('timer')}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 text-xs"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(getStandaloneLink('timer'), 'timer')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl font-mono text-center flex items-center justify-center gap-1.5 transition-all ${
                      copiedLink === 'timer'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {copiedLink === 'timer' ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{copiedLink === 'timer' ? 'Copied Link!' : 'Copy Timer Link'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Video Angle Guy */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" /> 3. Video Angle Switcher
                    </span>
                    <span className="bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      PASSCODE PROTECTED
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Multi-cam grid of all track angles. Switch camera on stream & put radio speech transcripts on air.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={getStandaloneLink('director')}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 text-xs"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(getStandaloneLink('director'), 'director')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl font-mono text-center flex items-center justify-center gap-1.5 transition-all ${
                      copiedLink === 'director'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {copiedLink === 'director' ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{copiedLink === 'director' ? 'Copied Link!' : 'Copy Director Link'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Race Control */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-red-500 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" /> 4. Race Control Tower
                    </span>
                    <span className="bg-red-950 border border-red-800 text-red-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      PASSCODE PROTECTED
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Operate the official FIA 5 Red Lights Start Sequence, deploy Safety Car, and manage penalties.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={getStandaloneLink('control')}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-700 text-zinc-300 text-xs"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(getStandaloneLink('control'), 'control')}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl font-mono text-center flex items-center justify-center gap-1.5 transition-all ${
                      copiedLink === 'control'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {copiedLink === 'control' ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{copiedLink === 'control' ? 'Copied Link!' : 'Copy Control Link'}</span>
                  </button>
                </div>
              </div>

              {/* 5. Team Radio Walkie-Talkie */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between md:col-span-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <RadioIcon className="w-3.5 h-3.5" /> 5. Team Radio (Race Engineer Pit Wall)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      SECURED BY TEAM PASSCODE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    Two-way encrypted radio for Race Engineers with live speech-to-text transcript. Select team to copy link:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-2">
                    {[
                      { id: 'team-redbull', name: 'Red Bull #1', color: '#3671C6' },
                      { id: 'team-ferrari', name: 'Ferrari #16', color: '#E80020' },
                      { id: 'team-mclaren', name: 'McLaren #4', color: '#FF8000' },
                      { id: 'team-mercedes', name: 'Mercedes #44', color: '#27F4D2' },
                      { id: 'team-aston', name: 'Aston Martin #14', color: '#229971' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => copyToClipboard(getStandaloneLink('radio', t.id), `radio_${t.id}`)}
                        className="bg-zinc-900 hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-800 text-left transition-all hover:border-zinc-600 flex flex-col"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-white">
                          <span className="truncate">{t.name}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 mt-1">
                          {copiedLink === `radio_${t.id}` ? '✓ Copied Link!' : 'Copy Team Link'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6. Driver Cockpit HUD */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between md:col-span-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-red-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> 6. Cyclist Driver Cockpit (Steering Wheel Mount)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      SECURED BY TEAM PASSCODE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    Handlebar mount HUD for cyclist. Speedometer, shift lights, PTT radio button, and lap timer:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-2">
                    {[
                      { id: 'team-redbull', name: 'Red Bull #1', color: '#3671C6' },
                      { id: 'team-ferrari', name: 'Ferrari #16', color: '#E80020' },
                      { id: 'team-mclaren', name: 'McLaren #4', color: '#FF8000' },
                      { id: 'team-mercedes', name: 'Mercedes #44', color: '#27F4D2' },
                      { id: 'team-aston', name: 'Aston Martin #14', color: '#229971' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => copyToClipboard(getStandaloneLink('cockpit', t.id), `cockpit_${t.id}`)}
                        className="bg-zinc-900 hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-800 text-left transition-all hover:border-zinc-600 flex flex-col"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-white">
                          <span className="truncate">{t.name}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 mt-1">
                          {copiedLink === `cockpit_${t.id}` ? '✓ Copied Link!' : 'Copy Cockpit Link'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
