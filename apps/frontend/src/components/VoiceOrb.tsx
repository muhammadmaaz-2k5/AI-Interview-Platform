import * as React from "react";

interface VoiceOrbProps {
  volume: number; // Expects a float value from 0 to 1
  isMuted?: boolean;
  status: "idle" | "speaking" | "listening" | "disconnected";
}

export function VoiceOrb({ volume, isMuted = false, status }: VoiceOrbProps) {
  // Dynamically calculate scales based on audio volume
  const scale = 1 + (isMuted ? 0 : volume * 0.9);
  const glowOpacity = 0.15 + (isMuted ? 0 : volume * 0.7);

  // Status-based colors
  const statusColors = {
    idle: "from-zinc-700 to-zinc-800 border-zinc-600 text-zinc-400 shadow-zinc-950/40",
    speaking: "from-purple-600 to-indigo-600 border-purple-400 text-white shadow-purple-500/20",
    listening: "from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-emerald-500/20",
    disconnected: "from-rose-800 to-zinc-900 border-rose-700 text-rose-400 shadow-rose-950/20",
  };

  const ringColors = {
    idle: "bg-zinc-700/10",
    speaking: "bg-purple-500/15",
    listening: "bg-emerald-500/15",
    disconnected: "bg-rose-500/10",
  };

  const orbStatus = isMuted ? "idle" : status;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center mx-auto">
      {/* Outer pulsing ring 3 (Glow) */}
      <div
        className={`absolute w-52 h-52 rounded-full blur-2xl transition-all duration-100 ${ringColors[orbStatus]}`}
        style={{
          transform: `scale(${scale * 1.45})`,
          opacity: glowOpacity,
        }}
      />

      {/* Outer pulsing ring 2 */}
      <div
        className={`absolute w-44 h-44 rounded-full blur-xl transition-all duration-100 ${ringColors[orbStatus]}`}
        style={{
          transform: `scale(${scale * 1.25})`,
        }}
      />

      {/* Outer pulsing ring 1 */}
      <div
        className={`absolute w-36 h-36 rounded-full blur-md transition-all duration-100 ${ringColors[orbStatus]}`}
        style={{
          transform: `scale(${scale * 1.1})`,
        }}
      />

      {/* Center sphere */}
      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-100 shadow-2xl border bg-gradient-to-tr ${statusColors[orbStatus]}`}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {/* Core sphere design element */}
        <div className="relative w-20 h-20 rounded-full bg-zinc-950/40 flex items-center justify-center border border-white/5">
          <div
            className={`w-6 h-6 rounded-full transition-all duration-200 ${
              orbStatus === "speaking"
                ? "bg-purple-300 shadow-[0_0_15px_#a78bfa] animate-pulse"
                : orbStatus === "listening"
                ? "bg-emerald-300 shadow-[0_0_15px_#34d399] animate-ping"
                : "bg-zinc-600"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
