import React, { useState, useEffect, useRef } from 'react';
import { Flag, AlertTriangle, ShieldAlert, Car, X, Zap } from 'lucide-react';
import { radioEngine } from '../services/radioEngine';
import { soundEffects } from '../utils/audioFx';

export const FlagAlertOverlay: React.FC = () => {
  // Flag alert state
  const [alert, setAlert] = useState<{
    show: boolean;
    flag: string;
    message: string;
    durationSec: number;
  } | null>(null);

  // 5 Red Lights sequence state (displayed across every volunteer's device!)
  const [lightsStage, setLightsStage] = useState<number>(0);
  const [showLightsGantry, setShowLightsGantry] = useState<boolean>(false);

  const [progressWidth, setProgressWidth] = useState<number>(100);
  const timerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const lightsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Listen for Flag alerts (Yellow flag, Red flag, SC)
    const unsubFlag = radioEngine.onFlagAlert((flag, message, durationSec) => {
      showAlert(flag, message, durationSec || 4);
    });

    // 1b. Also listen on race state updates for flag changes
    let prevFlag = radioEngine.currentRaceState?.flagStatus || 'GREEN';
    const unsubState = radioEngine.onRaceState((state) => {
      if (state && state.flagStatus && state.flagStatus !== prevFlag) {
        prevFlag = state.flagStatus;
        const msg = state.flagStatus === 'YELLOW'
          ? 'YELLOW FLAG • CAUTION IN SECTOR • NO OVERTAKING'
          : state.flagStatus === 'RED'
          ? 'RED FLAG • SESSION SUSPENDED • RETURN TO PIT LANE'
          : state.flagStatus === 'SC'
          ? 'SAFETY CAR DEPLOYED • MAINTAIN DELTA POSITIVE'
          : state.flagStatus === 'VSC'
          ? 'VIRTUAL SAFETY CAR • REDUCE PACE'
          : state.flagStatus === 'CHEQUERED'
          ? 'CHEQUERED FLAG • RACE FINISH'
          : 'TRACK CLEAR • GREEN FLAG';
        showAlert(state.flagStatus, msg, 4);
      }
    });

    // 2. Listen for 5 Red Lights sequence from Race Director
    const unsubLights = radioEngine.onLightsAlert((stage) => {
      setLightsStage(stage);
      setShowLightsGantry(true);

      if (stage >= 1 && stage <= 5) {
        soundEffects.playRedLightBeep();
      } else if (stage === 6) {
        soundEffects.playLightsOutGo();
        // Auto-close 2.5 seconds after Lights Out
        if (lightsTimerRef.current) clearTimeout(lightsTimerRef.current);
        lightsTimerRef.current = window.setTimeout(() => {
          setShowLightsGantry(false);
          setLightsStage(0);
        }, 2500);
      }
    });

    return () => {
      unsubFlag();
      unsubState();
      unsubLights();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (lightsTimerRef.current) clearTimeout(lightsTimerRef.current);
    };
  }, []);

  const showAlert = (flag: string, message: string, durationSec: number = 4) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    soundEffects.unlockAudio();

    // Automated Voice Broadcast for Race Flags
    if (flag === 'YELLOW') {
      soundEffects.playWarningHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Yellow flag. Yellow flag. Sector caution, reduce speed, no overtaking.");
      }, 350);
    } else if (flag === 'RED') {
      soundEffects.playSafetyCarHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Red flag. Red flag. Session suspended. Return slowly to the pit lane immediately.");
      }, 350);
    } else if (flag === 'SC') {
      soundEffects.playSafetyCarHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Safety car deployed. Safety car deployed. Reduce pace, no overtaking.");
      }, 350);
    } else if (flag === 'VSC') {
      soundEffects.playWarningHorn();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Virtual safety car deployed. Reduce pace, maintain positive delta.");
      }, 350);
    } else if (flag === 'GREEN') {
      soundEffects.playRadioChirp();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Green flag. Track is clear, racing resumed.");
      }, 350);
    } else if (flag === 'CHEQUERED') {
      soundEffects.playLightsOutGo();
      setTimeout(() => {
        soundEffects.speakRadioPhrase("Chequered flag! That is the chequered flag, race is finished!");
      }, 350);
    }

    setAlert({
      show: true,
      flag,
      message,
      durationSec,
    });
    setProgressWidth(100);

    const startTime = Date.now();
    const durationMs = durationSec * 1000;

    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingRatio = Math.max(0, 1 - elapsed / durationMs);
      setProgressWidth(remainingRatio * 100);
    }, 40);

    // Auto-dismiss exactly after 4 seconds
    timerRef.current = window.setTimeout(() => {
      setAlert(null);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, durationMs);
  };

  const handleDismissAlert = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setAlert(null);
  };

  const handleDismissLights = () => {
    if (lightsTimerRef.current) clearTimeout(lightsTimerRef.current);
    setShowLightsGantry(false);
    setLightsStage(0);
  };

  // =========================================================================
  // VIEW 1: 5 RED LIGHTS START SEQUENCE (Shown on EVERY volunteer's device)
  // =========================================================================
  if (showLightsGantry && lightsStage > 0) {
    const isLightsOut = lightsStage === 6;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-150">
        <div className="w-full max-w-xl bg-zinc-950 border-4 border-red-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative select-none">
          <button
            onClick={handleDismissLights}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-xs font-mono uppercase tracking-widest text-red-500 font-bold mb-2">
            OFFICIAL RACE START LAUNCH SEQUENCE
          </div>

          <h2 className="font-racing font-black text-2xl sm:text-3xl text-white mb-6">
            {isLightsOut ? '🏁 LIGHTS OUT AND AWAY WE GO!' : 'STANDBY FOR RACE START'}
          </h2>

          {/* 5 Gantry Light Pods */}
          <div className="bg-black/95 border-2 border-zinc-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-inner flex justify-center">
            <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-md w-full">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isLit = !isLightsOut && idx < lightsStage;
                return (
                  <div
                    key={idx}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-7 h-7 sm:w-12 sm:h-12 rounded-full transition-all duration-75 border-2 ${
                        isLit
                          ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/90 scale-105 animate-pulse'
                          : isLightsOut
                          ? 'bg-zinc-900 border-zinc-800'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    />
                    <div
                      className={`w-7 h-7 sm:w-12 sm:h-12 rounded-full transition-all duration-75 border-2 ${
                        isLit
                          ? 'bg-red-600 border-red-400 shadow-lg shadow-red-500/90 scale-105 animate-pulse'
                          : isLightsOut
                          ? 'bg-zinc-900 border-zinc-800'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-sm font-mono font-bold">
            {isLightsOut ? (
              <span className="text-emerald-400 text-lg sm:text-xl animate-bounce">
                🟢 GO! GO! GO! RACE IS LIVE!
              </span>
            ) : (
              <span className="text-red-400 animate-pulse">
                HOLD POSITION... WATCH THE RED LIGHTS
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: 4-SECOND URGENT FLAG POPUP (Yellow, Red, SC, etc.)
  // =========================================================================
  if (!alert?.show) return null;

  const isYellow = alert.flag === 'YELLOW';
  const isRed = alert.flag === 'RED';
  const isSC = alert.flag === 'SC' || alert.flag === 'VSC';
  const isChequered = alert.flag === 'CHEQUERED';

  const getStyle = () => {
    if (isYellow) {
      return {
        bg: 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-500/80',
        badge: 'bg-black text-yellow-400',
        title: '⚠️ YELLOW FLAG DEPLOYED',
        sub: 'RACE DIRECTOR ORDER: CAUTION IN SECTOR',
        desc: 'Reduce speed immediately. Hazard reported on track. Strictly no overtaking!',
        progressBar: 'bg-black',
      };
    }
    if (isRed) {
      return {
        bg: 'bg-red-600 text-white border-red-400 shadow-red-600/80',
        badge: 'bg-black text-red-400',
        title: '🛑 RED FLAG - SESSION SUSPENDED',
        sub: 'RACE DIRECTOR ORDER: DANGER ON TRACK',
        desc: 'All cyclists reduce speed and return to pit lane immediately!',
        progressBar: 'bg-white',
      };
    }
    if (isSC) {
      return {
        bg: 'bg-amber-500 text-black border-amber-300 shadow-amber-500/80',
        badge: 'bg-black text-amber-400',
        title: '🚗 SAFETY CAR DEPLOYED (SC)',
        sub: 'RACE DIRECTOR ORDER: PACED LAP',
        desc: 'Follow the safety bike. Strictly no overtaking!',
        progressBar: 'bg-black',
      };
    }
    if (isChequered) {
      return {
        bg: 'bg-zinc-100 text-black border-zinc-300 shadow-white/50',
        badge: 'bg-black text-white',
        title: '🏁 CHEQUERED FLAG - FINISH!',
        sub: 'SESSION COMPLETED',
        desc: 'Race finished! Cool down lap to pit lane.',
        progressBar: 'bg-black',
      };
    }
    return {
      bg: 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/80',
      badge: 'bg-black text-emerald-400',
      title: '🟢 TRACK CLEAR - GREEN FLAG',
      sub: 'RACE DIRECTOR ORDER',
      desc: 'Track is clear. Full race pace resumed.',
      progressBar: 'bg-white',
    };
  };

  const style = getStyle();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg border-4 rounded-3xl p-6 shadow-2xl relative overflow-hidden select-none animate-bounce duration-300 ${style.bg}`}
      >
        {/* Animated Top Progress Bar (shrinks over 4 seconds) */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-black/20">
          <div
            className={`h-full transition-all duration-75 ${style.progressBar}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={handleDismissAlert}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-current transition-colors"
          title="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${style.badge}`}>
            <Flag className="w-8 h-8 animate-pulse" />
          </div>

          <div className="flex-1 pr-4">
            <div className="text-xs font-mono font-bold tracking-widest uppercase opacity-90">
              {style.sub}
            </div>
            <h2 className="font-racing font-black text-2xl sm:text-3xl leading-tight mt-0.5 tracking-wide">
              {style.title}
            </h2>
            <p className="text-sm font-semibold mt-2 leading-relaxed opacity-95">
              {alert.message || style.desc}
            </p>
          </div>
        </div>

        {/* Bottom 4s auto-close notice */}
        <div className="mt-4 pt-3 border-t border-black/20 flex items-center justify-between text-xs font-mono font-bold">
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>AUTO-CLOSING IN 4 SECONDS...</span>
          </span>
          <button
            onClick={handleDismissAlert}
            className="underline underline-offset-2 hover:opacity-80"
          >
            DISMISS NOW
          </button>
        </div>
      </div>
    </div>
  );
};
