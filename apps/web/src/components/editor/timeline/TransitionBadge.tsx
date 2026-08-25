import React, { useState, useRef, useEffect, useCallback } from "react";
import { Shuffle, X, Plus, Minus, Clock, Trash2 } from "lucide-react";
import type { Transition, Track } from "@openreel/core";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { toast } from "../../../stores/notification-store";

interface TransitionBadgeProps {
  transition: Transition;
  track: Track;
  pixelsPerSecond: number;
  onSelectClip: (clipId: string, addToSelection: boolean) => void;
}

export const TransitionBadge: React.FC<TransitionBadgeProps> = ({
  transition,
  track,
  pixelsPerSecond,
  onSelectClip,
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
  const [dragDuration, setDragDuration] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const clipA = transition.clipAId ? track.clips.find((c) => c.id === transition.clipAId) : null;
  const clipB = transition.clipBId ? track.clips.find((c) => c.id === transition.clipBId) : null;

  if (!clipA && !clipB) return null;

  const isIn = transition.placement === "in" || (!clipA && !!clipB);
  const isOut = transition.placement === "out" || (!!clipA && !clipB);

  // Maximum allowed duration based on clip lengths
  const maxDuration = isIn && clipB
    ? clipB.duration
    : isOut && clipA
    ? clipA.duration
    : clipA && clipB
    ? Math.min(clipA.duration, clipB.duration) * 2
    : 10;

  const currentDuration = dragDuration !== null ? dragDuration : transition.duration;

  let leftPx = 0;
  let widthPx = Math.max(36, currentDuration * pixelsPerSecond);
  let label: string = transition.type;
  let targetClipId = "";

  if (isIn && clipB) {
    targetClipId = clipB.id;
    leftPx = clipB.startTime * pixelsPerSecond;
    widthPx = Math.min(clipB.duration * pixelsPerSecond, Math.max(32, currentDuration * pixelsPerSecond));
    label = `▶ ${transition.type} (In)`;
  } else if (isOut && clipA) {
    targetClipId = clipA.id;
    const clipWidth = clipA.duration * pixelsPerSecond;
    widthPx = Math.min(clipWidth, Math.max(32, currentDuration * pixelsPerSecond));
    leftPx = (clipA.startTime + clipA.duration) * pixelsPerSecond - widthPx;
    label = `${transition.type} (Out) ◀`;
  } else if (clipA && clipB) {
    targetClipId = clipA.id;
    const cutTime = clipA.startTime + clipA.duration;
    widthPx = Math.max(36, currentDuration * pixelsPerSecond);
    leftPx = cutTime * pixelsPerSecond - widthPx / 2;
    label = transition.type;
  } else {
    return null;
  }

  // Handle outside clicks to close popover
  useEffect(() => {
    if (!showPopover) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [showPopover]);

  // Handle timeline drag resize on left / right edge
  const handleResizeStart = (edge: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(edge);
    const startX = e.clientX;
    const initialDuration = transition.duration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / pixelsPerSecond;

      let newDur = initialDuration;
      if (isIn) {
        newDur = edge === "right" ? initialDuration + deltaSeconds : initialDuration - deltaSeconds;
      } else if (isOut) {
        newDur = edge === "left" ? initialDuration - deltaSeconds : initialDuration + deltaSeconds;
      } else {
        // Between transition: expand symmetrically
        newDur = edge === "right" ? initialDuration + deltaSeconds * 2 : initialDuration - deltaSeconds * 2;
      }

      const clamped = Math.max(0.1, Math.min(maxDuration, Math.round(newDur * 10) / 10));
      setDragDuration(clamped);
      useProjectStore.getState().updateClipTransition(transition.id, { duration: clamped });
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      setDragDuration(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const updateDuration = useCallback((newDuration: number) => {
    const clamped = Math.max(0.1, Math.min(maxDuration, Math.round(newDuration * 100) / 100));
    useProjectStore.getState().updateClipTransition(transition.id, { duration: clamped });
  }, [maxDuration, transition.id]);

  const stepDuration = (delta: number) => {
    const next = Math.max(0.1, Math.min(maxDuration, Math.round((transition.duration + delta) * 10) / 10));
    updateDuration(next);
  };

  return (
    <>
      <div
        ref={badgeRef}
        key={`trans-${transition.id}`}
        style={{
          left: `${leftPx}px`,
          width: `${widthPx}px`,
          top: "4px",
          bottom: "4px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (targetClipId) {
            onSelectClip(targetClipId, false);
            useUIStore.getState().select({ id: targetClipId, type: "clip" });
          }
          setShowPopover((prev) => !prev);
        }}
        className={`group/trans absolute z-30 flex items-center justify-between px-1 text-white rounded-md shadow-lg border cursor-pointer backdrop-blur-md select-none transition-all ${
          showPopover ? "ring-2 ring-white shadow-xl scale-[1.03]" : "hover:brightness-110"
        } ${
          isIn
            ? "bg-gradient-to-r from-blue-600/90 via-blue-500/95 to-cyan-500/90 border-cyan-300/70"
            : isOut
            ? "bg-gradient-to-r from-purple-600/90 via-fuchsia-500/95 to-pink-500/90 border-pink-300/70"
            : "bg-gradient-to-r from-emerald-600/90 via-emerald-500/95 to-teal-500/90 border-emerald-300/70"
        }`}
        title={`Transition: ${label} (${transition.duration.toFixed(1)}s) - Drag edges to resize duration, click for settings`}
      >
        {/* Left Resize Drag Handle */}
        <div
          onMouseDown={handleResizeStart("left")}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 active:bg-white/60 transition-colors z-40 rounded-l"
          title="Drag to adjust transition duration"
        />

        {/* Transition Icon & Title & Duration Badge */}
        <div className="flex items-center gap-1.5 overflow-hidden pointer-events-none px-1">
          <Shuffle size={11} className="shrink-0 text-white animate-pulse" />
          <span className="text-[9px] font-bold tracking-tight capitalize truncate">
            {transition.type}
          </span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-black/40 text-white font-bold shrink-0">
            {currentDuration.toFixed(1)}s
          </span>
        </div>

        {/* Quick Remove Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            useProjectStore.getState().removeClipTransition(transition.id);
            toast.success("Transition Removed");
          }}
          className="opacity-0 group-hover/trans:opacity-100 hover:bg-black/50 rounded p-0.5 transition-opacity text-white hover:text-red-200 shrink-0 z-40"
          title="Remove Transition"
        >
          <X size={11} />
        </button>

        {/* Right Resize Drag Handle */}
        <div
          onMouseDown={handleResizeStart("right")}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/40 active:bg-white/60 transition-colors z-40 rounded-r"
          title="Drag to adjust transition duration"
        />

        {/* Live Dragging Duration Tooltip */}
        {isResizing && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-primary border border-primary/50 text-[10px] font-bold font-mono rounded shadow-xl pointer-events-none whitespace-nowrap z-50 animate-in fade-in">
            {currentDuration.toFixed(1)}s
          </div>
        )}
      </div>

      {/* Floating Transition Duration Quick Settings Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          style={{
            left: `${Math.max(10, leftPx + widthPx / 2 - 110)}px`,
            bottom: "48px",
          }}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 w-56 p-3 bg-background-secondary/95 backdrop-blur-md border border-border rounded-xl shadow-2xl space-y-2.5 text-text-primary animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Shuffle size={13} className="text-primary" />
              <span className="text-xs font-bold capitalize">
                {transition.type} {isIn ? "(In)" : isOut ? "(Out)" : ""}
              </span>
            </div>
            <button
              onClick={() => setShowPopover(false)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {/* Stepper Duration Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                <Clock size={12} className="text-primary" />
                Duration
              </span>
              <span className="text-xs font-mono font-bold text-primary">
                {transition.duration.toFixed(1)}s
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepDuration(-0.1)}
                disabled={transition.duration <= 0.1}
                className="w-8 h-8 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border flex items-center justify-center text-text-primary hover:text-primary transition-all disabled:opacity-40 active:scale-95 shadow-sm"
                title="Decrease duration by 0.1s"
              >
                <Minus size={14} />
              </button>

              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={maxDuration}
                  value={transition.duration}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) updateDuration(val);
                  }}
                  className="w-full h-8 text-center text-xs font-mono font-bold bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono pointer-events-none">
                  s
                </span>
              </div>

              <button
                onClick={() => stepDuration(0.1)}
                disabled={transition.duration >= maxDuration}
                className="w-8 h-8 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border flex items-center justify-center text-text-primary hover:text-primary transition-all disabled:opacity-40 active:scale-95 shadow-sm"
                title="Increase duration by 0.1s"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0.1"
              max={Math.min(maxDuration, 5.0)}
              step="0.05"
              value={transition.duration}
              onChange={(e) => updateDuration(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-background-tertiary rounded-lg appearance-none cursor-pointer accent-primary mt-1"
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {[0.3, 0.5, 1.0, 1.5, 2.0, 3.0]
              .filter((dur) => dur <= maxDuration)
              .map((dur) => (
                <button
                  key={dur}
                  onClick={() => updateDuration(dur)}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                    Math.abs(transition.duration - dur) < 0.05
                      ? "bg-primary text-black shadow-sm"
                      : "bg-background-tertiary text-text-secondary hover:text-text-primary hover:bg-background-elevated border border-border/80"
                  }`}
                >
                  {dur.toFixed(1)}s
                </button>
              ))}
          </div>

          {/* Delete Transition Button */}
          <button
            onClick={() => {
              useProjectStore.getState().removeClipTransition(transition.id);
              setShowPopover(false);
              toast.success("Transition Removed");
            }}
            className="w-full py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 size={12} />
            <span>Remove Transition</span>
          </button>
        </div>
      )}
    </>
  );
};
