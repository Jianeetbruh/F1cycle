import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { securityEngine, STATION_PASSCODES, TEAM_PASSCODES } from '../utils/security';
import { soundEffects } from '../utils/audioFx';

interface PasscodeLockModalProps {
  type: 'station' | 'team';
  targetId: string;
  onUnlocked: () => void;
}

export const PasscodeLockModal: React.FC<PasscodeLockModalProps> = ({
  type,
  targetId,
  onUnlocked,
}) => {
  const [passcode, setPasscode] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const stationConfig = type === 'station' ? STATION_PASSCODES[targetId] : null;
  const teamConfig = type === 'team' ? TEAM_PASSCODES[targetId] : null;

  const title = type === 'station'
    ? (stationConfig?.name || 'Restricted Station')
    : (teamConfig?.name || 'Team Radio Channel');

  const subtitle = type === 'station'
    ? (stationConfig?.description || 'Official Credential Required')
    : `Secure Team Telemetry & Radio Channel (Car #${teamConfig?.number || '?'})`;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    soundEffects.unlockAudio();

    if (!passcode.trim()) {
      setErrorMsg('PLEASE ENTER PASSCODE');
      return;
    }

    setIsSubmitting(true);
    const success = type === 'station'
      ? await securityEngine.unlockStation(targetId, passcode)
      : await securityEngine.unlockTeam(targetId, passcode);
    setIsSubmitting(false);

    if (success) {
      soundEffects.playRadioChirp();
      setErrorMsg(null);
      onUnlocked();
    } else {
      setErrorMsg('INCORRECT PASSCODE • ACCESS DENIED');
      soundEffects.playWarningHorn();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      setPasscode('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const [isShaking, setIsShaking] = useState<boolean>(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex items-center justify-center p-4">
      <div className={`w-full max-w-md bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden transition-transform ${
        isShaking ? 'translate-x-1 duration-75 ring-2 ring-red-600 animate-pulse' : ''
      }`}>
        {/* Subtle accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            backgroundColor: teamConfig?.color || (type === 'station' ? '#e11d48' : '#38bdf8'),
          }}
        />

        {/* Header Icon & Title */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg bg-zinc-900 border border-zinc-700">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold block">
              FIA PADDOCK SECURITY • RESTRICTED ACCESS
            </span>
            <h2 className="font-racing font-bold text-xl sm:text-2xl text-white">
              {title}
            </h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Passcode input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-zinc-400 mb-1.5 block text-center">
              ENTER {type === 'team' ? 'TEAM' : 'STATION'} PASSCODE
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                inputMode="numeric"
                autoFocus
                maxLength={8}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••"
                className="w-full bg-zinc-900 border-2 border-zinc-700 focus:border-amber-400 text-center font-mono-racing tracking-widest text-3xl py-3 px-12 rounded-2xl text-white outline-none shadow-inner transition-all placeholder:text-zinc-600"
              />
              <KeyRound className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="p-2 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={showPass ? 'Hide Passcode' : 'Show Passcode'}
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-2 text-xs font-mono text-red-400 text-center flex items-center justify-center gap-1.5 bg-red-950/60 border border-red-800/80 py-2 px-3 rounded-xl animate-bounce">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-bold">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Keypad Quick Numbers */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => {
                  soundEffects.unlockAudio();
                  if (passcode.length < 8) setPasscode(prev => prev + digit);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-100 font-mono-racing font-bold text-lg py-2.5 rounded-xl border border-zinc-800 transition-colors"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPasscode('')}
              className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 text-xs font-mono py-2.5 rounded-xl border border-zinc-800"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.unlockAudio();
                if (passcode.length < 8) setPasscode(prev => prev + '0');
              }}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-mono-racing font-bold text-lg py-2.5 rounded-xl border border-zinc-800"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPasscode(prev => prev.slice(0, -1))}
              className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 text-xs font-mono py-2.5 rounded-xl border border-zinc-800"
            >
              ⌫ DEL
            </button>
          </div>

          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-racing font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>{isSubmitting ? 'VERIFYING…' : 'AUTHENTICATE & UNLOCK'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.location.search || window.location.pathname !== '/') {
                  window.location.href = window.location.origin;
                } else {
                  window.location.reload();
                }
              }}
              className="w-full bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-mono text-xs py-2 rounded-xl border border-zinc-800 transition-colors"
            >
              ← Return to Main Public Broadcast
            </button>
          </div>
        </form>

        <div className="text-center text-[10px] font-mono text-zinc-500">
          FIA FOM OFFICIAL PADDOCK ACCESS CONTROL SYSTEM
        </div>
      </div>
    </div>
  );
};
