import React, { useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, RotateCcw, Volume2 } from "lucide-react";
import { LabeledSlider } from "@openreel/ui";
import { useProjectStore } from "../../../stores/project-store";

export interface FadeSectionProps {
  clipId: string;
  type?: "video" | "audio" | "image";
  showVolume?: boolean;
}

export const FadeSection: React.FC<FadeSectionProps> = ({
  clipId,
  type = "video",
  showVolume = false,
}) => {
  const getClip = useProjectStore((state) => state.getClip);
  const updateClipFade = useProjectStore((state) => state.updateClipFade);
  const updateClipVolume = useProjectStore((state) => state.updateClipVolume);

  const clip = getClip(clipId);
  const duration = clip?.duration || 5;
  const maxFade = useMemo(() => {
    return Math.max(0.5, Math.min(Math.round((duration / 2) * 10) / 10, 10));
  }, [duration]);

  const fadeIn = clip?.fade?.fadeIn ?? 0;
  const fadeOut = clip?.fade?.fadeOut ?? 0;
  const volume = clip?.volume ?? 1;

  const handleFadeInChange = useCallback(
    (val: number) => {
      const rounded = Math.round(val * 100) / 100;
      updateClipFade(clipId, { fadeIn: rounded });
    },
    [clipId, updateClipFade],
  );

  const handleFadeOutChange = useCallback(
    (val: number) => {
      const rounded = Math.round(val * 100) / 100;
      updateClipFade(clipId, { fadeOut: rounded });
    },
    [clipId, updateClipFade],
  );

  const handleReset = useCallback(() => {
    updateClipFade(clipId, { fadeIn: 0, fadeOut: 0 });
  }, [clipId, updateClipFade]);

  const handleApplyPreset = useCallback(
    (seconds: number) => {
      const clamped = Math.min(seconds, maxFade);
      updateClipFade(clipId, { fadeIn: clamped, fadeOut: clamped });
    },
    [clipId, maxFade, updateClipFade],
  );

  const hasFade = fadeIn > 0 || fadeOut > 0;

  // SVG Curve visualization coordinates (width 240, height 28)
  const svgWidth = 240;
  const svgHeight = 28;
  const inWidth = duration > 0 ? (fadeIn / duration) * svgWidth : 0;
  const outWidth = duration > 0 ? (fadeOut / duration) * svgWidth : 0;

  return (
    <div className="space-y-3">
      {/* Header with Quick Reset */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-text-secondary tracking-wide uppercase">
            {type === "audio" ? "Audio Fade" : "Video Fade"}
          </span>
          {hasFade && (
            <span className="px-1.5 py-0.2 bg-primary/20 text-primary text-[9px] font-medium rounded-full border border-primary/30">
              Active
            </span>
          )}
        </div>
        {hasFade && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
            title="Reset both fade in and fade out to 0s"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>

      {/* Optional Volume Control (for Audio tab) */}
      {showVolume && (
        <div className="space-y-2 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary flex items-center gap-1">
              <Volume2 size={12} className="text-text-muted" /> Volume
            </span>
            <span className="text-[10px] font-mono text-text-primary">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <LabeledSlider
            label="Volume Level"
            value={Math.round(volume * 100)}
            onChange={(val) => updateClipVolume(clipId, val / 100)}
            min={0}
            max={200}
            step={1}
            unit="%"
            defaultValue={100}
          />
        </div>
      )}

      {/* Real-time Visual Fade Curve Preview */}
      <div className="bg-background-tertiary/70 rounded border border-border/50 p-2 select-none">
        <div className="flex items-center justify-between text-[9px] text-text-muted mb-1 font-mono">
          <span>In: {fadeIn.toFixed(2)}s</span>
          <span className="text-[8px] tracking-wider uppercase opacity-70">Fade Curve</span>
          <span>Out: {fadeOut.toFixed(2)}s</span>
        </div>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-7 overflow-visible rounded bg-background/50 border border-border/30"
        >
          {/* Subtle grid background */}
          <line
            x1="0"
            y1={svgHeight / 2}
            x2={svgWidth}
            y2={svgHeight / 2}
            stroke="currentColor"
            strokeDasharray="2,4"
            className="text-border/40"
            strokeWidth="0.5"
          />

          {/* Shaded Area under curve */}
          <polygon
            points={`
              0,${svgHeight}
              ${Math.min(inWidth, svgWidth - outWidth)},4
              ${Math.max(inWidth, svgWidth - outWidth)},4
              ${svgWidth},${svgHeight}
            `}
            className="fill-primary/20"
          />

          {/* Fade In Ramp line */}
          <line
            x1="0"
            y1={svgHeight - 2}
            x2={Math.min(inWidth, svgWidth - outWidth)}
            y2="4"
            className={fadeIn > 0 ? "stroke-primary" : "stroke-text-muted/40"}
            strokeWidth={fadeIn > 0 ? "2" : "1"}
            strokeLinecap="round"
          />

          {/* Sustained Top Line */}
          <line
            x1={Math.min(inWidth, svgWidth - outWidth)}
            y1="4"
            x2={Math.max(inWidth, svgWidth - outWidth)}
            y2="4"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Fade Out Ramp line */}
          <line
            x1={Math.max(inWidth, svgWidth - outWidth)}
            y1="4"
            x2={svgWidth}
            y2={svgHeight - 2}
            className={fadeOut > 0 ? "stroke-primary" : "stroke-text-muted/40"}
            strokeWidth={fadeOut > 0 ? "2" : "1"}
            strokeLinecap="round"
          />

          {/* Fade in dot handle */}
          {fadeIn > 0 && (
            <circle
              cx={Math.min(inWidth, svgWidth - outWidth)}
              cy="4"
              r="3"
              className="fill-white stroke-primary stroke-[1.5]"
            />
          )}

          {/* Fade out dot handle */}
          {fadeOut > 0 && (
            <circle
              cx={Math.max(inWidth, svgWidth - outWidth)}
              cy="4"
              r="3"
              className="fill-white stroke-primary stroke-[1.5]"
            />
          )}
        </svg>
      </div>

      {/* Fade In Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-secondary flex items-center gap-1">
            <TrendingUp size={11} className="text-emerald-400" /> Fade in
          </span>
          <span className="font-mono text-text-primary text-[10px] bg-background-tertiary px-1.5 py-0.5 rounded border border-border/40">
            {fadeIn.toFixed(2)}s
          </span>
        </div>
        <LabeledSlider
          label="Fade in Duration"
          value={fadeIn}
          onChange={handleFadeInChange}
          min={0}
          max={maxFade}
          step={0.05}
          unit="s"
          defaultValue={0}
        />
      </div>

      {/* Fade Out Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-secondary flex items-center gap-1">
            <TrendingDown size={11} className="text-amber-400" /> Fade out
          </span>
          <span className="font-mono text-text-primary text-[10px] bg-background-tertiary px-1.5 py-0.5 rounded border border-border/40">
            {fadeOut.toFixed(2)}s
          </span>
        </div>
        <LabeledSlider
          label="Fade out Duration"
          value={fadeOut}
          onChange={handleFadeOutChange}
          min={0}
          max={maxFade}
          step={0.05}
          unit="s"
          defaultValue={0}
        />
      </div>

      {/* CapCut One-Click Quick Presets */}
      <div className="pt-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] text-text-muted">Presets:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleReset()}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                fadeIn === 0 && fadeOut === 0
                  ? "bg-primary text-white border-primary"
                  : "bg-background-tertiary text-text-secondary border-border/50 hover:bg-background-secondary"
              }`}
            >
              0s
            </button>
            {[0.5, 1.0, 2.0].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handleApplyPreset(sec)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                  Math.abs(fadeIn - sec) < 0.05 && Math.abs(fadeOut - sec) < 0.05
                    ? "bg-primary text-white border-primary"
                    : "bg-background-tertiary text-text-secondary border-border/50 hover:bg-background-secondary"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
