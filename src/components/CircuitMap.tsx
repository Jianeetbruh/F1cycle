import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Flag,
  Navigation,
  Edit2,
  Save,
  Info,
  Shield,
  Layers,
  PenTool,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Eye,
  Sliders,
  Maximize2,
  Compass
} from 'lucide-react';
import { radioEngine, RaceState } from '../services/radioEngine';

export interface Point {
  x: number;
  y: number;
  name?: string;
  isFinishLine?: boolean;
}

const DEFAULT_TRACK_POINTS: Point[] = [
  { x: 120, y: 220, name: 'Finish Straight', isFinishLine: true },
  { x: 140, y: 120, name: 'Corner 1' },
  { x: 260, y: 80, name: 'Straight 1' },
  { x: 420, y: 90, name: 'Corner 2' },
  { x: 620, y: 85, name: 'Corner 3' },
  { x: 700, y: 180, name: 'Corner 4' },
  { x: 670, y: 320, name: 'Corner 5' },
  { x: 500, y: 370, name: 'Corner 6' },
  { x: 340, y: 360, name: 'Straight 2' },
  { x: 210, y: 400, name: 'Corner 7' },
];

export const CircuitMap: React.FC = () => {
  const [raceState] = useState<RaceState | null>(radioEngine.currentRaceState);

  // Load custom circuit points from localStorage or default
  const [points, setPoints] = useState<Point[]>(() => {
    try {
      const saved = localStorage.getItem('f1cycle_custom_circuit');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return DEFAULT_TRACK_POINTS;
  });

  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [isFreehand, setIsFreehand] = useState<boolean>(false);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState<boolean>(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [editPointName, setEditPointName] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [circuitName, setCircuitName] = useState<string>(
    localStorage.getItem('f1cycle_circuit_name') || raceState?.circuitName || 'Metro Jazz Circuit'
  );

  const [isClosedLoop, setIsClosedLoop] = useState<boolean>(true);
  const [animProgress, setAnimProgress] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Animated cyclist dot traveling along custom path
  useEffect(() => {
    const loop = () => {
      setAnimProgress(prev => (prev + 0.003) % 1);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Save custom circuit
  const handleSaveCircuit = () => {
    try {
      localStorage.setItem('f1cycle_custom_circuit', JSON.stringify(points));
      localStorage.setItem('f1cycle_circuit_name', circuitName);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      setIsDrawMode(false);
    } catch (e) {
      console.warn(e);
    }
  };

  // Reset to default template
  const handleResetToTemplate = (templateName: string) => {
    if (templateName === 'default') {
      setPoints(DEFAULT_TRACK_POINTS);
    } else if (templateName === 'perimeter') {
      setPoints([
        { x: 100, y: 100, name: 'Tower A', isFinishLine: true },
        { x: 700, y: 100, name: 'Tower B Gate' },
        { x: 700, y: 380, name: 'Clubhouse Garden' },
        { x: 100, y: 380, name: 'Underground Parking' },
      ]);
    } else if (templateName === 'figure8') {
      setPoints([
        { x: 120, y: 140, name: 'Gate 1', isFinishLine: true },
        { x: 380, y: 240, name: 'Central Crossing' },
        { x: 680, y: 120, name: 'Pool Loop' },
        { x: 680, y: 360, name: 'Playground Corner' },
        { x: 380, y: 240, name: 'Central Crossing Overpass' },
        { x: 120, y: 360, name: 'Parking Curve' },
      ]);
    }
  };

  // Canvas click to add or move point
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawMode || isFreehand) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 800);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 480);

    // If clicking close to an existing point, select it instead of adding
    const clickedIndex = points.findIndex(p => Math.hypot(p.x - x, p.y - y) < 22);
    if (clickedIndex !== -1) {
      setSelectedPointIndex(clickedIndex);
      setEditPointName(points[clickedIndex].name || `Corner ${clickedIndex + 1}`);
      return;
    }

    // Add new waypoint
    const newPoint: Point = {
      x,
      y,
      name: points.length === 0 ? 'Start / Finish Line' : `Corner ${points.length + 1}`,
      isFinishLine: points.length === 0,
    };

    setPoints([...points, newPoint]);
    setSelectedPointIndex(points.length);
    setEditPointName(newPoint.name || '');
  };

  // Freehand mouse / touch draw handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawMode || !isFreehand) return;
    setIsDrawingFreehand(true);

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 800);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 480);

    setPoints([{ x, y, name: 'Start / Finish Line', isFinishLine: true }]);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawMode || !isFreehand || !isDrawingFreehand) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 800);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 480);

    const last = points[points.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 25) {
      setPoints(prev => [...prev, { x, y, name: `Turn ${prev.length}` }]);
    }
  };

  const handleMouseUp = () => {
    if (isFreehand) {
      setIsDrawingFreehand(false);
    }
  };

  // Convert points to smooth SVG path string
  const generatePathString = (pts: Point[], close: boolean) => {
    if (pts.length < 2) return '';

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
    }

    if (close && pts.length > 2) {
      const last = pts[pts.length - 1];
      const first = pts[0];
      const midX = (last.x + first.x) / 2;
      const midY = (last.y + first.y) / 2;
      d += ` Q ${last.x} ${last.y}, ${midX} ${midY} Z`;
    }

    return d;
  };

  const pathD = generatePathString(points, isClosedLoop);

  // Divide path into Sectors 1, 2, 3
  const s1Points = points.slice(0, Math.ceil(points.length / 3) + 1);
  const s2Points = points.slice(Math.floor(points.length / 3), Math.ceil((points.length * 2) / 3) + 1);
  const s3Points = points.slice(Math.floor((points.length * 2) / 3));
  if (isClosedLoop && points.length > 2) {
    s3Points.push(points[0]);
  }

  const s1Path = generatePathString(s1Points, false);
  const s2Path = generatePathString(s2Points, false);
  const s3Path = generatePathString(s3Points, false);

  // Calculate position along path for animated cyclist dot
  const getBikePosition = () => {
    if (points.length < 2) return { x: 100, y: 100 };
    const totalPts = points.length;
    const exactIndex = animProgress * totalPts;
    const idx = Math.floor(exactIndex) % totalPts;
    const nextIdx = (idx + 1) % totalPts;
    const ratio = exactIndex - Math.floor(exactIndex);

    const p1 = points[idx];
    const p2 = points[nextIdx] || points[0];

    return {
      x: p1.x + (p2.x - p1.x) * ratio,
      y: p1.y + (p2.y - p1.y) * ratio,
    };
  };

  const bikePos = getBikePosition();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-6 select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Mode Toggle */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>SOCIETY CIRCUIT DESIGNER</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="text"
                value={circuitName}
                onChange={(e) => setCircuitName(e.target.value)}
                className="bg-transparent font-racing font-bold text-2xl text-white focus:outline-none border-b border-transparent focus:border-red-500"
                placeholder="Enter Circuit Name"
              />
              <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                ({points.length} CORNERS)
              </span>
            </div>
          </div>

          {/* Action Buttons: Draw Circuit / View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {!isDrawMode ? (
              <button
                onClick={() => setIsDrawMode(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-red-950/40 flex items-center gap-2"
              >
                <PenTool className="w-4 h-4" />
                <span>DRAW YOUR SOCIETY CIRCUIT</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveCircuit}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-racing font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>SAVE & FINISH DRAWING</span>
                </button>

                <button
                  onClick={() => setIsDrawMode(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs px-3 py-2.5 rounded-xl"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-500 p-3 rounded-2xl text-xs font-mono text-emerald-300 text-center flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>Custom society circuit saved successfully! All timing screens and stream will reflect your layout.</span>
          </div>
        )}

        {/* DRAW TOOLBAR (Shown when Draw Mode is Active) */}
        {isDrawMode && (
          <div className="bg-zinc-900/90 border-2 border-red-500/60 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">DRAWING METHOD:</span>
              <button
                onClick={() => setIsFreehand(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-racing font-bold transition-all ${
                  !isFreehand ? 'bg-red-600 text-white shadow-md' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                TAP TO PLACE CORNERS (RECOMMENDED)
              </button>
              <button
                onClick={() => setIsFreehand(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-racing font-bold transition-all ${
                  isFreehand ? 'bg-red-600 text-white shadow-md' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                FREEHAND PEN
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsClosedLoop(!isClosedLoop)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono border ${
                  isClosedLoop ? 'bg-emerald-950 border-emerald-600 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {isClosedLoop ? '✓ CLOSED CIRCUIT LOOP' : 'OPEN SPRINT LINE'}
              </button>

              <button
                onClick={() => {
                  if (points.length > 0) setPoints(points.slice(0, -1));
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono px-3 py-1.5 rounded-xl"
              >
                UNDO LAST CORNER
              </button>

              <button
                onClick={() => setPoints([])}
                className="bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-mono px-3 py-1.5 rounded-xl"
              >
                CLEAR ALL
              </button>
            </div>
          </div>
        )}

        {/* INTERACTIVE SVG CIRCUIT CANVAS */}
        <div className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[460px]">
          {/* Subtle Carbon Grid Background */}
          <div className="absolute inset-0 bg-carbon opacity-60"></div>

          {/* Interactive SVG Surface */}
          <svg
            ref={svgRef}
            viewBox="0 0 800 480"
            className="w-full max-w-4xl h-auto relative z-10 cursor-crosshair"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={handleSvgClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Asphalt Shadow / Wide Foundation */}
            {pathD && (
              <path
                d={pathD}
                stroke="#27272a"
                strokeWidth="34"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Asphalt Racing Surface */}
            {pathD && (
              <path
                d={pathD}
                stroke="#18181b"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Sector 1 (Green Line) */}
            {s1Path && (
              <path
                d={s1Path}
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            )}

            {/* Sector 2 (Purple Line) */}
            {s2Path && (
              <path
                d={s2Path}
                stroke="#a855f7"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            )}

            {/* Sector 3 (Yellow Line) */}
            {s3Path && (
              <path
                d={s3Path}
                stroke="#eab308"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            )}

            {/* Finish Line Checkered Kerb */}
            {points[0] && (
              <g>
                <circle cx={points[0].x} cy={points[0].y} r="16" fill="#ef4444" opacity="0.3" />
                <line
                  x1={points[0].x - 12}
                  y1={points[0].y}
                  x2={points[0].x + 12}
                  y2={points[0].y}
                  stroke="#ffffff"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                />
                <text
                  x={points[0].x + 14}
                  y={points[0].y + 4}
                  fill="#ef4444"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="Rajdhani"
                >
                  🏁 FINISH LINE
                </text>
              </g>
            )}

            {/* Corner Waypoint Pins */}
            {points.map((pt, i) => {
              const isSelected = selectedPointIndex === i;
              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPointIndex(i);
                    setEditPointName(pt.name || `Corner ${i + 1}`);
                  }}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 9 : 6}
                    fill={pt.isFinishLine ? '#ef4444' : isSelected ? '#38bdf8' : '#e4e4e7'}
                    stroke="#09090b"
                    strokeWidth="2"
                  />
                  {pt.name && (
                    <text
                      x={pt.x + 8}
                      y={pt.y - 8}
                      fill="#f4f4f5"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="Rajdhani"
                    >
                      {pt.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Animated Cyclist Dot */}
            {!isDrawMode && points.length > 2 && (
              <g>
                <circle cx={bikePos.x} cy={bikePos.y} r="8" fill="#3671C6" stroke="#ffffff" strokeWidth="2">
                  <animate attributeName="r" values="7;11;7" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <text
                  x={bikePos.x + 10}
                  y={bikePos.y + 4}
                  fill="#3671C6"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="Orbitron"
                >
                  #1 VER
                </text>
              </g>
            )}
          </svg>

          {/* Draw mode helper message */}
          {isDrawMode && (
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-red-500/80 text-xs font-mono text-red-300 z-20">
              ✏️ CLICK ANYWHERE TO PLACE CORNERS ALONG YOUR SOCIETY STREETS
            </div>
          )}

          {/* Sector Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4 z-10 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>SECTOR 1 (ACCELERATION)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>SECTOR 2 (TECHNICAL TURNS)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>SECTOR 3 (FINISH SPRINT)</span>
            </div>
          </div>
        </div>

        {/* SELECTED CORNER EDITOR DRAWER */}
        {selectedPointIndex !== null && points[selectedPointIndex] && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-racing font-bold text-base text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>CUSTOMIZE CORNER #{selectedPointIndex + 1}</span>
              </h3>
              <button
                onClick={() => setSelectedPointIndex(null)}
                className="text-xs font-mono text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Corner Name (e.g. Tower B Hairpin)"
                value={editPointName}
                onChange={(e) => setEditPointName(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={() => {
                  const updated = [...points];
                  updated[selectedPointIndex].name = editPointName.trim();
                  setPoints(updated);
                  setSelectedPointIndex(null);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-racing font-bold text-xs px-4 py-2 rounded-xl"
              >
                APPLY CORNER NAME
              </button>

              <button
                onClick={() => {
                  const updated = points.map((p, idx) => ({
                    ...p,
                    isFinishLine: idx === selectedPointIndex,
                  }));
                  setPoints(updated);
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-racing font-bold text-xs px-3 py-2 rounded-xl"
              >
                SET AS FINISH LINE 🏁
              </button>

              <button
                onClick={() => {
                  const updated = points.filter((_, idx) => idx !== selectedPointIndex);
                  setPoints(updated);
                  setSelectedPointIndex(null);
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs px-3 py-2 rounded-xl"
              >
                DELETE CORNER
              </button>
            </div>
          </div>
        )}

        {/* QUICK SOCIETY CIRCUIT TEMPLATES */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-racing font-bold text-base text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>SOCIETY CIRCUIT PRESETS</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">START FROM A TEMPLATE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => handleResetToTemplate('default')}
              className="bg-zinc-950 hover:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-800 text-left transition-all"
            >
              <div className="font-racing font-bold text-sm text-white">Classic Grand Palm Loop</div>
              <div className="text-xs text-zinc-400 mt-1">10 corners, chicane, pool curve & main straight.</div>
            </button>

            <button
              onClick={() => handleResetToTemplate('perimeter')}
              className="bg-zinc-950 hover:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-800 text-left transition-all"
            >
              <div className="font-racing font-bold text-sm text-white">Society Perimeter Ring</div>
              <div className="text-xs text-zinc-400 mt-1">Rectangular high-speed ring around building towers.</div>
            </button>

            <button
              onClick={() => handleResetToTemplate('figure8')}
              className="bg-zinc-950 hover:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-800 text-left transition-all"
            >
              <div className="font-racing font-bold text-sm text-white">Courtyard Figure-8</div>
              <div className="text-xs text-zinc-400 mt-1">Technical figure-8 crossover through central park.</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
