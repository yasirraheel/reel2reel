import React, { useRef, useState, useEffect, useCallback } from "react";
import { Image, X } from "lucide-react";
import type { Clip, Track, TransitionType } from "@openreel/core";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { useTimelineStore } from "../../../stores/timeline-store";
import {
  calculateSnap,
  generateWaveformPath,
  generateCapcutSpectrumBars,
  getClipStyle,
} from "./utils";
import { ClipContextMenu } from "./ClipContextMenu";
import { ContextMenu, ContextMenuTrigger } from "@openreel/ui";
import { toast } from "../../../stores/notification-store";
import { getTransitionBridge } from "../../../bridges/transition-bridge";
import type { VideoEffectType } from "../../../bridges/effects-bridge";
import {
  EFFECT_DRAG_MIME,
  TRANSITION_DRAG_MIME,
} from "../panels/EffectsTransitionsPanel";

interface ClipComponentProps {
  clip: Clip;
  track: Track;
  allTracks: Track[];
  pixelsPerSecond: number;
  isSelected: boolean;
  trackHeights: Map<string, number>;
  timelineRef: React.RefObject<HTMLDivElement>;
  onSelect: (clipId: string, addToSelection: boolean) => void;
  onMoveClip: (
    clipId: string,
    newStartTime: number,
    targetTrackId?: string,
  ) => void;
  onSnapIndicator: (time: number | null) => void;
  onTrimClip?: (
    clipId: string,
    edge: "left" | "right",
    newTime: number,
  ) => void;
}

const AUTO_SCROLL_THRESHOLD = 80;
const AUTO_SCROLL_SPEED = 10;
const DRAG_THRESHOLD = 5;

const InteractiveKeyframeMarker: React.FC<{
  kf: import("@openreel/core").Keyframe;
  clip: import("@openreel/core").Clip;
  pixelsPerSecond: number;
}> = ({ kf, clip, pixelsPerSecond }) => {
  const { updateClipKeyframes } = useProjectStore();
  const { select, deselect, selectedItems } = useUIStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedItems.some((s) => s.type === "keyframe" && s.id === kf.id);

  const relativeTime = kf.time - clip.startTime;
  if (relativeTime < 0 || relativeTime > clip.duration) return null;
  const posPercent = (relativeTime / clip.duration) * 100;

  const handleDelete = () => {
    deselect(kf.id);
    const updated = (clip.keyframes || []).filter((k) => k.id !== kf.id);
    updateClipKeyframes(clip.id, updated);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const addToSelection = e.shiftKey || e.metaKey || e.ctrlKey;
    select({ type: "keyframe", id: kf.id }, addToSelection);
    setIsDragging(true);
    setHasMoved(false);
    setDragStartX(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      if (Math.abs(deltaX) > 2) {
        setHasMoved(true);
        const deltaTime = deltaX / pixelsPerSecond;
        const newTime = Math.max(clip.startTime, Math.min(clip.startTime + clip.duration, kf.time + deltaTime));
        const updated = (clip.keyframes || []).map((k) => (k.id === kf.id ? { ...k, time: newTime } : k));
        updateClipKeyframes(clip.id, updated.sort((a, b) => a.time - b.time));
        setDragStartX(e.clientX);
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStartX, pixelsPerSecond, clip, kf, updateClipKeyframes]);

  // Outside click to dismiss context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [contextMenu]);

  return (
    <>
      {/* 28px Enlarged Hit Target Container for Easy Cursor Hover & Click */}
      <div
        className="keyframe-marker absolute bottom-0 w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto z-[100] group/kf"
        style={{ left: `${posPercent}%`, marginLeft: "-14px" }}
        onMouseDownCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleMouseDown(e);
        }}
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDoubleClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!hasMoved) handleDelete();
        }}
        onContextMenuCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        title={`Keyframe: ${kf.property} @ ${kf.time.toFixed(2)}s • Drag to move • Double-click to delete`}
      >
        {/* Visible Diamond Graphic */}
        <div
          className={`w-3.5 h-3.5 bg-yellow-400 rotate-45 border border-yellow-600 transition-all shadow-md ${
            isDragging ? "scale-150 z-50 shadow-xl" : "group-hover/kf:scale-125 group-hover/kf:z-40"
          } ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-black z-40 bg-amber-300 border-white scale-125" : ""}`}
        />
      </div>

      {/* Floating time badge & delete button when selected */}
      {isSelected && (
        <div
          className="absolute z-[110] flex flex-col items-center gap-0.5 pointer-events-auto"
          style={{
            left: `${posPercent}%`,
            bottom: "24px",
            transform: "translateX(-50%)",
          }}
        >
          <span className="text-[8px] text-white bg-background-secondary/95 px-1.5 py-0.5 rounded whitespace-nowrap border border-yellow-500/60 shadow-lg font-mono">
            {kf.time.toFixed(2)}s
          </span>
          <button
            onMouseDownCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete();
            }}
            className="w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-md border border-red-600 transition-colors"
            title="Delete keyframe"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] min-w-[130px] bg-background-secondary border border-border rounded-lg shadow-2xl overflow-hidden py-1 pointer-events-auto"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-medium border-b border-border mb-1">
            Keyframe • {kf.time.toFixed(2)}s
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
            onMouseDownCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
              handleDelete();
            }}
          >
            <X size={11} />
            Delete Keyframe
          </button>
        </div>
      )}
    </>
  );
};

export const ClipComponent: React.FC<ClipComponentProps> = ({
  clip,
  track,
  allTracks,
  pixelsPerSecond,
  isSelected,
  trackHeights,
  timelineRef,
  onSelect,
  onMoveClip,
  onSnapIndicator,
  onTrimClip,
}) => {
  const { getMediaItem } = useProjectStore();
  const { snapSettings } = useUIStore();
  const effectApplicationClipId = useUIStore(
    (state) => state.effectApplicationClipId,
  );
  const effectApplicationLabel = useUIStore(
    (state) => state.effectApplicationLabel,
  );
  const { playheadPosition } = useTimelineStore();
  const mediaItem = getMediaItem(clip.mediaId);
  const [isDragging, setIsDragging] = useState(false);
  const [isPendingDrag, setIsPendingDrag] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragYOffset, setDragYOffset] = useState(0);
  const [isInvalidDrop, setIsInvalidDrop] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimEdge, setTrimEdge] = useState<"left" | "right" | null>(null);

  // Audio Volume & Fade Drag State
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const [, setIsAdjustingFade] = useState<"in" | "out" | null>(null);

  const currentVolume = clip.volume ?? 1.0;
  const fadeIn = clip.fade?.fadeIn ?? 0;
  const fadeOut = clip.fade?.fadeOut ?? 0;

  // Position of Volume line (0.0 to 2.0 mapped to 90% to 10% vertical position)
  const volumeRatio = Math.max(0, Math.min(2.0, currentVolume));
  const volumeLineYPercent = 100 - (volumeRatio / 2.0) * 80 - 10;

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAdjustingVolume(true);

    const startY = e.clientY;
    const startVol = currentVolume;
    const trackHeight = trackHeights.get(track.id) || 48;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // Upwards movement increases volume
      const volDelta = (deltaY / (trackHeight * 0.7)) * 1.5;
      const newVol = Math.max(0, Math.min(2.5, startVol + volDelta));
      useProjectStore.getState().updateClipVolume(clip.id, newVol);
    };

    const handleMouseUp = () => {
      setIsAdjustingVolume(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleFadeMouseDown = (fadeType: "in" | "out") => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAdjustingFade(fadeType);

    const startX = e.clientX;
    const initialFadeIn = fadeIn;
    const initialFadeOut = fadeOut;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / pixelsPerSecond;
      if (fadeType === "in") {
        const newFadeIn = Math.max(0, Math.min(clip.duration - fadeOut - 0.1, initialFadeIn + deltaX));
        useProjectStore.getState().updateClipFade(clip.id, { fadeIn: newFadeIn });
      } else {
        const newFadeOut = Math.max(0, Math.min(clip.duration - fadeIn - 0.1, initialFadeOut - deltaX));
        useProjectStore.getState().updateClipFade(clip.id, { fadeOut: newFadeOut });
      }
    };

    const handleMouseUp = () => {
      setIsAdjustingFade(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  // Snapshot of every additional selected clip at drag start. Multi-clip
  // drag applies the same time delta to each entry so they stay locked
  // together as the dragged clip moves.
  const multiDragSnapshotRef = useRef<
    Array<{ clipId: string; startTime: number; trackId: string }>
  >([]);
  const trimStartRef = useRef<{
    mouseX: number;
    startTime: number;
    duration: number;
  }>({
    mouseX: 0,
    startTime: clip.startTime,
    duration: clip.duration,
  });
  const dragStartRef = useRef<{ mouseY: number; clipY: number; scrollTop: number }>({
    mouseY: 0,
    clipY: 0,
    scrollTop: 0,
  });
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingDropRef = useRef<{ time: number; targetTrackId?: string }>({ time: 0 });
  const dragPendingRef = useRef<{ active: boolean; startX: number; startY: number }>({
    active: false,
    startX: 0,
    startY: 0,
  });
  const clipRef = useRef<HTMLDivElement>(null);
  const moveCommitRafRef = useRef<number | null>(null);
  const pendingCommitRef = useRef<(() => void) | null>(null);

  // Drag-drop highlight state: "effect" when an effect is hovered over
  // the clip body, "transition-left" / "transition-right" when a
  // transition is hovered over one of the clip's edges.
  const [dragHover, setDragHover] = useState<
    "effect" | "transition-left" | "transition-right" | null
  >(null);

  const left = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;

  const isVideo = track.type === "video";
  const isAudio = track.type === "audio";
  const isImage = track.type === "image";
  const clipStyle = getClipStyle(track.type);

  const isKeyframeTarget = (e: Event | React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    return Boolean(target?.closest(".keyframe-marker"));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || isKeyframeTarget(e)) return;
    if (isDragging || isPendingDrag) return;
    e.stopPropagation();
    onSelect(clip.id, e.shiftKey || e.metaKey);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isKeyframeTarget(e)) return;
    if (track.locked || isTrimming) return;
    e.stopPropagation();

    const rect = clipRef.current?.parentElement?.getBoundingClientRect();
    const clipRect = clipRef.current?.getBoundingClientRect();
    if (!rect || !clipRect) return;

    const clickX = e.clientX - rect.left;
    const clipStartX = clip.startTime * pixelsPerSecond;
    setDragOffset(clickX - clipStartX);

    dragStartRef.current = {
      mouseY: e.clientY,
      clipY: clipRect.top - rect.top,
      scrollTop: timelineRef.current?.scrollTop || 0,
    };
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    dragPendingRef.current = { active: true, startX: e.clientX, startY: e.clientY };
    setDragYOffset(0);
    setIsInvalidDrop(false);
    setIsPendingDrag(true);

    // If this clip is part of a multi-selection, snapshot the other
    // selected clips' start positions so we can drag them as a group.
    const selectedIds = useUIStore.getState().getSelectedClipIds();
    if (selectedIds.length > 1 && selectedIds.includes(clip.id)) {
      const snapshot: Array<{ clipId: string; startTime: number; trackId: string }> = [];
      for (const t of allTracks) {
        for (const c of t.clips) {
          if (c.id === clip.id) continue;
          if (!selectedIds.includes(c.id)) continue;
          if (t.locked) continue;
          snapshot.push({ clipId: c.id, startTime: c.startTime, trackId: t.id });
        }
      }
      multiDragSnapshotRef.current = snapshot;
    } else {
      multiDragSnapshotRef.current = [];
    }
  };

  // ── Drag-drop: effects & transitions from the assets panel ────
  // The asset cards set custom MIME types so we know which mode to use.
  // For effects the drop hits anywhere on the clip body. For transitions
  // we treat the outer ~25% of the clip's width as an "edge zone" — the
  // closer edge wins, and we map left edge → incoming, right edge →
  // outgoing transition.
  const readDragKind = (e: React.DragEvent): "effect" | "transition" | null => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.some((t) => t.toLowerCase() === EFFECT_DRAG_MIME.toLowerCase())) return "effect";
    if (types.some((t) => t.toLowerCase() === TRANSITION_DRAG_MIME.toLowerCase())) return "transition";
    if (types.includes("text/plain")) {
      return "transition";
    }
    return null;
  };

  const computeTransitionEdge = useCallback(
    (e: React.DragEvent): "transition-left" | "transition-right" => {
      const rect = clipRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return "transition-right";
      const ratio = (e.clientX - rect.left) / rect.width;
      return ratio < 0.5 ? "transition-left" : "transition-right";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const kind = readDragKind(e);
      if (kind === null && !e.dataTransfer.types.includes("text/plain")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      if (kind === "effect") {
        setDragHover("effect");
      } else {
        setDragHover(computeTransitionEdge(e));
      }
    },
    [computeTransitionEdge],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when the pointer actually exits the clip — dragleave
    // fires on every child too.
    const related = e.relatedTarget as Node | null;
    if (!related || !clipRef.current?.contains(related)) {
      setDragHover(null);
    }
  }, []);

  const applyTransitionAt = useCallback(
    (transitionType: TransitionType, edge: "left" | "right") => {
      const projectState = useProjectStore.getState();
      const tracks = projectState.project.timeline.tracks;
      const owningTrack = tracks.find((t) =>
        t.clips.some((c) => c.id === clip.id),
      );
      if (!owningTrack) return;
      const sortedClips = [...owningTrack.clips].sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime - b.startTime;
        return a.id.localeCompare(b.id);
      });
      const idx = sortedClips.findIndex((c) => c.id === clip.id);
      const currentClip = sortedClips[idx];
      const previousClip = idx > 0 ? sortedClips[idx - 1] : undefined;
      const nextClip =
        idx < sortedClips.length - 1 ? sortedClips[idx + 1] : undefined;

      const bridge = getTransitionBridge();
      if (!bridge.isInitialized()) {
        bridge.initialize();
      }
      const defaultParams = bridge.getDefaultParams(transitionType);

      let targetClipA: Clip | null = null;
      let targetClipB: Clip | null = null;
      let placement: "in" | "out" | "between" = "between";

      if (edge === "left") {
        const gap = previousClip
          ? Math.abs(currentClip.startTime - (previousClip.startTime + previousClip.duration))
          : 999;
        if (previousClip && gap <= 0.08) {
          targetClipA = previousClip;
          targetClipB = currentClip;
          placement = "between";
        } else {
          // Beginning (In) Transition on this clip
          targetClipA = null;
          targetClipB = currentClip;
          placement = "in";
        }
      } else {
        const gap = nextClip
          ? Math.abs(nextClip.startTime - (currentClip.startTime + currentClip.duration))
          : 999;
        if (nextClip && gap <= 0.08) {
          targetClipA = currentClip;
          targetClipB = nextClip;
          placement = "between";
        } else {
          // Ending (Out) Transition on this clip
          targetClipA = currentClip;
          targetClipB = null;
          placement = "out";
        }
      }

      const duration = Math.min(1.0, currentClip.duration);
      const result =
        placement === "in"
          ? bridge.createInTransition(currentClip, transitionType, duration, defaultParams)
          : placement === "out"
          ? bridge.createOutTransition(currentClip, transitionType, duration, defaultParams)
          : bridge.createTransition(targetClipA, targetClipB, transitionType, duration, defaultParams, "between");

      if (result.success && result.transitionId) {
        const transition = bridge.getTransition(result.transitionId);
        if (transition) {
          projectState.addClipTransition(transition);
          toast.success(
            placement === "in"
              ? "In-Transition Applied"
              : placement === "out"
              ? "Out-Transition Applied"
              : "Transition Applied",
            `${transitionType} • ${duration.toFixed(1)}s`,
          );
          return;
        }
      }
      toast.error(
        "Transition failed",
        result.error || "Could not create transition",
      );
    },
    [clip.id],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setDragHover(null);

      const tryParse = <T,>(s: string | null): T | null => {
        if (!s) return null;
        try {
          return JSON.parse(s) as T;
        } catch {
          return null;
        }
      };

      const effectPayload = tryParse<{ effectType: VideoEffectType }>(
        e.dataTransfer.getData(EFFECT_DRAG_MIME) || null,
      );
      const transitionPayload = tryParse<{ transitionType: TransitionType }>(
        e.dataTransfer.getData(TRANSITION_DRAG_MIME) || null,
      );
      const text = e.dataTransfer.getData("text/plain");
      const isEffectByText = text.startsWith("effect:");
      const isTransitionByText = text.startsWith("transition:");

      const effectType =
        effectPayload?.effectType ??
        (isEffectByText ? (text.slice(7) as VideoEffectType) : null);
      const transitionType =
        transitionPayload?.transitionType ??
        (isTransitionByText ? (text.slice(11) as TransitionType) : null);

      if (!effectType && !transitionType) {
        // Not for us — let the timeline's outer drop handler take it.
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (effectType) {
        const result = useProjectStore.getState().addVideoEffect(clip.id, effectType);
        if (result) {
          toast.success("Effect applied", `${effectType} added`);
          // Auto-select the clip so the user sees the new effect in
          // the inspector.
          useUIStore.getState().select({ id: clip.id, type: "clip" });
        } else {
          toast.error("Effect failed", "Could not apply effect");
        }
        return;
      }

      if (transitionType) {
        const edge = computeTransitionEdge(e).endsWith("left") ? "left" : "right";
        applyTransitionAt(transitionType, edge);
      }
    },
    [clip.id, applyTransitionAt, computeTransitionEdge],
  );

  const handleTrimMouseDown =
    (edge: "left" | "right") => (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (track.locked || !onTrimClip) return;
      e.stopPropagation();
      setIsTrimming(true);
      setTrimEdge(edge);
      trimStartRef.current = {
        mouseX: e.clientX,
        startTime: clip.startTime,
        duration: clip.duration,
      };
      document.body.style.cursor = "ew-resize";
    };

  useEffect(() => {
    if (!isPendingDrag) return;

    const handlePendingMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragPendingRef.current.startX;
      const dy = e.clientY - dragPendingRef.current.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= DRAG_THRESHOLD) {
        dragPendingRef.current.active = false;
        setIsPendingDrag(false);
        setIsDragging(true);
      }
    };

    const handlePendingMouseUp = (e: MouseEvent) => {
      dragPendingRef.current.active = false;
      setIsPendingDrag(false);
      if (isKeyframeTarget(e)) return;
      onSelect(clip.id, e.shiftKey || e.metaKey);
    };

    window.addEventListener("mousemove", handlePendingMouseMove);
    window.addEventListener("mouseup", handlePendingMouseUp);

    return () => {
      window.removeEventListener("mousemove", handlePendingMouseMove);
      window.removeEventListener("mouseup", handlePendingMouseUp);
    };
  }, [isPendingDrag, clip.id, onSelect]);

  useEffect(() => {
    if (!isDragging) return;

    // Wrap the entire drag in a single history group so undo collapses
    // all the per-frame moves (and any companion clips) into one step.
    const projectStore = useProjectStore.getState();
    projectStore.beginHistoryGroup(
      multiDragSnapshotRef.current.length > 0 ? "Move clips" : "Move clip",
    );

    let animationFrameId: number | null = null;

    const scrollLoop = () => {
      if (!timelineRef.current) {
        animationFrameId = requestAnimationFrame(scrollLoop);
        return;
      }

      const timeline = timelineRef.current;
      const timelineRect = timeline.getBoundingClientRect();
      const mouseY = mousePositionRef.current.y;
      const timelineTop = timelineRect.top;
      const timelineBottom = timelineRect.bottom;
      const canScrollUp = timeline.scrollTop > 0;
      const canScrollDown = timeline.scrollTop < timeline.scrollHeight - timeline.clientHeight;

      const distanceFromTop = mouseY - timelineTop;
      const distanceFromBottom = timelineBottom - mouseY;

      if (distanceFromTop < AUTO_SCROLL_THRESHOLD && canScrollUp) {
        timeline.scrollTop -= AUTO_SCROLL_SPEED;
      } else if (distanceFromBottom < AUTO_SCROLL_THRESHOLD && canScrollDown) {
        timeline.scrollTop += AUTO_SCROLL_SPEED;
      }

      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);

    const flushPendingCommit = () => {
      moveCommitRafRef.current = null;
      const commit = pendingCommitRef.current;
      pendingCommitRef.current = null;
      commit?.();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current.x = e.clientX;
      mousePositionRef.current.y = e.clientY;

      const rect = clipRef.current?.parentElement?.getBoundingClientRect();
      const timelineRect = timelineRef.current?.getBoundingClientRect();
      if (!rect || !timelineRect) return;

      const x = e.clientX - rect.left - dragOffset;
      const rawTime = Math.max(0, x / pixelsPerSecond);

      const dragSnapSettings = { ...snapSettings, snapToPlayhead: false };
      const snapResult = calculateSnap(
        rawTime,
        clip.id,
        allTracks,
        playheadPosition,
        dragSnapSettings,
        pixelsPerSecond,
        clip.duration,
      );
      const currentScrollTop = timelineRef.current?.scrollTop || 0;
      const scrollDelta = currentScrollTop - dragStartRef.current.scrollTop;
      const yDelta = (e.clientY - dragStartRef.current.mouseY) + scrollDelta;
      setDragYOffset(yDelta);

      const scrollTop = timelineRef.current?.scrollTop || 0;
      const mouseY = e.clientY - timelineRect.top + scrollTop;
      let targetTrackId: string | undefined;
      let hoveredTrackType: string | undefined;
      let cumulativeY = 0;

      for (const t of allTracks) {
        const height = trackHeights.get(t.id) || 60;
        if (mouseY >= cumulativeY && mouseY < cumulativeY + height) {
          hoveredTrackType = t.type;
          if (t.type === track.type && t.id !== track.id) {
            targetTrackId = t.id;
          }
          break;
        }
        cumulativeY += height;
      }

      // Add a deadzone to prevent accidental drops outside the tracks
      const dragThreshold = 30; // pixels
      const isOverDifferentTrackType = hoveredTrackType !== undefined && hoveredTrackType !== track.type;
      
      const isSignificantlyOut = mouseY < -dragThreshold || mouseY > cumulativeY + dragThreshold;
      setIsInvalidDrop(isOverDifferentTrackType || isSignificantlyOut);

      // If they drag significantly out of the track area, it might mean they want to cancel or aren't targeting a track.
      if (isSignificantlyOut) {
        targetTrackId = undefined; // Force it to stay on current track if out of bounds
      }

      pendingDropRef.current = { time: snapResult.time, targetTrackId };

      // Coalesce store commits to one per animation frame. A fast mouse
      // fires many mousemove events between frames; dispatching moveClip on
      // each one deep-clones the project and re-renders the whole editor
      // dozens of extra times per frame, which is what made sustained
      // dragging lag and eventually exhaust memory. We keep the latest move
      // in a ref and flush it once per frame.
      const moveTime = snapResult.time;
      const baseStartTime = clip.startTime;
      const companions = multiDragSnapshotRef.current;
      pendingCommitRef.current = () => {
        onMoveClip(clip.id, moveTime, undefined);
        // Move every companion clip in the multi-selection by the same
        // delta. Cross-track moves of the primary don't take any
        // companions along — that gets too lossy when they live on tracks
        // of a different type — but same-track drags stay locked.
        if (companions.length > 0) {
          const deltaTime = moveTime - baseStartTime;
          for (const snap of companions) {
            const newStart = Math.max(0, snap.startTime + deltaTime);
            onMoveClip(snap.clipId, newStart, undefined);
          }
        }
      };
      if (moveCommitRafRef.current === null) {
        moveCommitRafRef.current = requestAnimationFrame(flushPendingCommit);
      }

      onSnapIndicator(snapResult.snapped && snapResult.snapPoint ? snapResult.snapPoint.time : null);
    };

    let groupClosed = false;
    const closeGroup = () => {
      if (groupClosed) return;
      groupClosed = true;
      projectStore.endHistoryGroup();
    };

    const handleMouseUp = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      // Flush any move queued for the next frame so the clip settles at the
      // final dragged position instead of one frame behind.
      if (moveCommitRafRef.current !== null) {
        cancelAnimationFrame(moveCommitRafRef.current);
        moveCommitRafRef.current = null;
      }
      const pendingCommit = pendingCommitRef.current;
      pendingCommitRef.current = null;
      pendingCommit?.();

      const { time, targetTrackId } = pendingDropRef.current;
      if (targetTrackId) {
        onMoveClip(clip.id, time, targetTrackId);
      }

      setIsDragging(false);
      setDragYOffset(0);
      setIsInvalidDrop(false);
      onSnapIndicator(null);
      multiDragSnapshotRef.current = [];
      closeGroup();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (moveCommitRafRef.current !== null) {
        cancelAnimationFrame(moveCommitRafRef.current);
        moveCommitRafRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      closeGroup();
    };
  }, [
    isDragging,
    dragOffset,
    pixelsPerSecond,
    clip.id,
    track.id,
    track.type,
    allTracks,
    trackHeights,
    timelineRef,
    playheadPosition,
    snapSettings,
    onMoveClip,
    onSnapIndicator,
  ]);

  useEffect(() => {
    if (!isTrimming || !trimEdge || !onTrimClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartRef.current.mouseX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (trimEdge === "left") {
        const newStartTime = Math.max(
          0,
          trimStartRef.current.startTime + deltaTime,
        );
        const maxStartTime =
          trimStartRef.current.startTime + trimStartRef.current.duration - 0.1;
        const clampedStartTime = Math.min(newStartTime, maxStartTime);
        onTrimClip(clip.id, "left", clampedStartTime);
      } else {
        const newEndTime =
          trimStartRef.current.startTime +
          trimStartRef.current.duration +
          deltaTime;
        const minEndTime = trimStartRef.current.startTime + 0.1;
        const clampedEndTime = Math.max(newEndTime, minEndTime);
        onTrimClip(clip.id, "right", clampedEndTime);
      }
    };

    const handleMouseUp = () => {
      setIsTrimming(false);
      setTrimEdge(null);
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimming, trimEdge, clip.id, pixelsPerSecond, onTrimClip]);

  const thumbnailCount = Math.max(1, Math.floor(width / 60));
  const clipName = mediaItem?.name || clip.mediaId.slice(0, 8);

  const isInteracting = isDragging || isTrimming;
  const isApplyingEffect = effectApplicationClipId === clip.id;
  
  const trackHeight = trackHeights.get(clip.trackId) || 60;
  const isCompact = trackHeight <= 32;
  const customColor = clip.metadata?.color as string | undefined;
  const customLabel = clip.metadata?.label as string | undefined;
  const displayLabel = customLabel || clipName;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={clipRef}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`group absolute top-1 bottom-1 rounded-lg overflow-hidden shadow-sm ${
            isDragging
              ? `cursor-grabbing z-50 ${isInvalidDrop ? "opacity-50 ring-2 ring-red-500 border-red-500" : "opacity-90 shadow-xl"}`
              : "cursor-grab"
          } ${
            isSelected && !isDragging
              ? isApplyingEffect
                ? "ring-2 ring-amber-400 border-amber-300 z-10"
                : "ring-2 ring-primary border-primary z-10"
              : !isDragging ? "border-opacity-30 hover:border-opacity-60 hover:brightness-110" : ""
          } ${clipStyle.bg} border ${clipStyle.border} ${
            track.locked ? "cursor-not-allowed opacity-60" : ""
          }`}
          style={{
            transform: isDragging
              ? `translate(${left}px, ${dragYOffset}px)`
              : `translateX(${left}px)`,
            width: `${width}px`,
            willChange: isInteracting ? 'transform, width' : 'auto',
            transition: isInteracting ? 'none' : 'opacity 150ms, box-shadow 150ms',
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
      {isApplyingEffect && (
        <>
          <div className="absolute -inset-px rounded-lg border border-amber-300/80 shadow-[0_0_18px_rgba(251,191,36,0.55)] pointer-events-none animate-pulse" />
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.08)_28%,rgba(251,191,36,0.28)_50%,rgba(255,255,255,0.08)_72%,transparent_100%)] pointer-events-none animate-pulse" />
          <div className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-amber-200 pointer-events-none">
            {effectApplicationLabel ?? "Applying effect"}
          </div>
        </>
      )}

      {/* Drag-drop hover indicators for effects/transitions */}
      {dragHover === "effect" && (
        <div className="absolute inset-0 ring-2 ring-accent ring-inset rounded-lg bg-accent/15 pointer-events-none z-20" />
      )}
      {dragHover === "transition-left" && (
        <div className="absolute inset-y-0 left-0 w-1/3 pointer-events-none z-20 bg-gradient-to-r from-accent/60 to-transparent">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
        </div>
      )}
      {dragHover === "transition-right" && (
        <div className="absolute inset-y-0 right-0 w-1/3 pointer-events-none z-20 bg-gradient-to-l from-accent/60 to-transparent">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent" />
        </div>
      )}

      {isCompact && (
        <div 
          className={`absolute inset-0 pointer-events-none rounded-lg opacity-80 ${customColor || (isVideo ? "bg-green-600" : isAudio ? "bg-blue-600" : isImage ? "bg-purple-600" : "bg-slate-600")}`} 
        />
      )}

      {!isCompact && isVideo &&
        (mediaItem?.filmstripThumbnails?.length || mediaItem?.thumbnailUrl) && (
          <div className="absolute inset-0 flex pointer-events-none">
            {mediaItem?.filmstripThumbnails &&
            mediaItem.filmstripThumbnails.length > 0
              ? Array.from({ length: thumbnailCount }).map((_, i) => {
                  const localTime = (i / Math.max(1, thumbnailCount - 1)) * clip.duration;
                  const sourceTime = (clip.inPoint || 0) + localTime;
                  const sourceProgress = sourceTime / Math.max(0.1, mediaItem.metadata.duration || 10);
                  const thumbIndex = Math.min(
                    Math.floor(
                      sourceProgress * mediaItem.filmstripThumbnails!.length,
                    ),
                    mediaItem.filmstripThumbnails!.length - 1,
                  );
                  const thumb = mediaItem.filmstripThumbnails![thumbIndex];
                  return (
                    <div
                      key={i}
                      className="flex-1 h-full bg-cover bg-center opacity-70"
                      style={{
                        backgroundImage: `url(${thumb.url})`,
                        borderRight:
                          i < thumbnailCount - 1
                            ? "1px solid rgba(0,0,0,0.2)"
                            : "none",
                      }}
                    />
                  );
                })
              : Array.from({ length: thumbnailCount }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full bg-cover bg-center opacity-60"
                    style={{
                      backgroundImage: `url(${mediaItem.thumbnailUrl})`,
                      borderRight:
                        i < thumbnailCount - 1
                          ? "1px solid rgba(0,0,0,0.2)"
                          : "none",
                    }}
                  />
                ))}
          </div>
        )}

      {!isCompact && isVideo && !mediaItem?.thumbnailUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 pointer-events-none" />
      )}

      {!isCompact && isImage && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-500/10 flex items-center justify-center pointer-events-none">
          {mediaItem?.thumbnailUrl ? (
            <img
              src={mediaItem.thumbnailUrl}
              alt={clipName}
              className="h-full object-cover opacity-60"
            />
          ) : (
            <Image size={24} className="text-purple-400/50" />
          )}
        </div>
      )}

      <div className="w-full h-full flex flex-col justify-end px-2 pb-1 relative z-10 pointer-events-none">
        <span className="text-[10px] text-white font-medium drop-shadow-md truncate relative z-10 px-1 py-0.5 rounded leading-none max-w-[80%] whitespace-nowrap overflow-hidden">
          {displayLabel}
        </span>
      </div>

      {/* ── CapCut Professional Audio Spectrum & Interactive Volume Level Line ── */}
      {!isCompact && isAudio && (
        <div className="absolute inset-0 overflow-hidden select-none bg-[#0c213d] rounded-sm">
          {/* Spectrum Bar Waveform Canvas / SVG */}
          <div className="absolute inset-0 px-1 py-1 pointer-events-none flex items-center">
            {mediaItem?.waveformData ? (
              <svg
                className="w-full h-full"
                preserveAspectRatio="none"
                viewBox={`0 0 ${Math.max(10, width)} 44`}
              >
                {generateCapcutSpectrumBars(mediaItem.waveformData, width, 44).map((bar, idx) => (
                  <g key={idx}>
                    {/* Main Bar (CapCut Cyan/Blue) */}
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={2}
                      height={bar.barHeight}
                      rx={0.5}
                      fill={bar.isPeak ? "#38bdf8" : "#0284c7"}
                    />
                    {/* Peak Cap Tip (CapCut Red/Orange tip for loud audio peaks) */}
                    {bar.isPeak && (
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={2}
                        height={Math.min(3, bar.barHeight * 0.25)}
                        rx={0.5}
                        fill="#ef4444"
                      />
                    )}
                  </g>
                ))}
              </svg>
            ) : (
              /* Synthetic Dense Bar Spectrum Fallback */
              <svg
                className="w-full h-full"
                preserveAspectRatio="none"
                viewBox={`0 0 ${Math.max(10, width)} 44`}
              >
                {Array.from({ length: Math.max(1, Math.floor(width / 3.2)) }).map((_, i) => {
                  const pseudoVal = Math.sin(i * 0.4) * 0.4 + Math.cos(i * 0.9) * 0.3 + 0.5;
                  const barH = Math.max(4, pseudoVal * 32);
                  const isPeak = pseudoVal > 0.82;
                  return (
                    <g key={i}>
                      <rect
                        x={i * 3.2}
                        y={(44 - barH) / 2}
                        width={2}
                        height={barH}
                        rx={0.5}
                        fill={isPeak ? "#38bdf8" : "#0284c7"}
                      />
                      {isPeak && (
                        <rect
                          x={i * 3.2}
                          y={(44 - barH) / 2}
                          width={2}
                          height={2.5}
                          rx={0.5}
                          fill="#ef4444"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Fade-in & Fade-out Shading Overlay */}
          {fadeIn > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/40 border-r border-white/20 pointer-events-none"
              style={{ width: `${(fadeIn / clip.duration) * 100}%` }}
            />
          )}
          {fadeOut > 0 && (
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/40 border-l border-white/20 pointer-events-none"
              style={{ width: `${(fadeOut / clip.duration) * 100}%` }}
            />
          )}

          {/* Horizontal CapCut Interactive Volume Level Line */}
          <div
            className="absolute left-0 right-0 h-4 -mt-2 group/vol z-20 cursor-ns-resize flex items-center"
            style={{ top: `${volumeLineYPercent}%` }}
            onMouseDown={handleVolumeMouseDown}
          >
            {/* White Volume Line */}
            <div
              className={`w-full h-[1.5px] transition-colors ${
                isAdjustingVolume
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  : "bg-white/80 group-hover/vol:bg-white group-hover/vol:h-[2px]"
              }`}
            />

            {/* Fade In Circular Handle Dot */}
            <div
              onMouseDown={handleFadeMouseDown("in")}
              className="absolute left-0 w-3 h-3 -ml-1 bg-white border border-slate-800 rounded-full cursor-ew-resize hover:scale-125 transition-transform z-30 shadow-md flex items-center justify-center"
              style={{ left: `${(fadeIn / clip.duration) * 100}%` }}
              title={`Fade In: ${fadeIn.toFixed(2)}s`}
            >
              <div className="w-1 h-1 rounded-full bg-slate-900" />
            </div>

            {/* Fade Out Circular Handle Dot */}
            <div
              onMouseDown={handleFadeMouseDown("out")}
              className="absolute right-0 w-3 h-3 -mr-1 bg-white border border-slate-800 rounded-full cursor-ew-resize hover:scale-125 transition-transform z-30 shadow-md flex items-center justify-center"
              style={{ right: `${(fadeOut / clip.duration) * 100}%` }}
              title={`Fade Out: ${fadeOut.toFixed(2)}s`}
            >
              <div className="w-1 h-1 rounded-full bg-slate-900" />
            </div>

            {/* Floating Volume Tooltip on Drag */}
            {isAdjustingVolume && (
              <div className="absolute left-1/2 -top-6 -translate-x-1/2 px-2 py-0.5 bg-slate-900/90 text-white text-[10px] font-mono rounded shadow-lg border border-slate-700 whitespace-nowrap pointer-events-none z-40">
                Volume: {Math.round(currentVolume * 100)}% (
                {(20 * Math.log10(Math.max(0.001, currentVolume))).toFixed(1)} dB)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video clip audio waveform overlay */}
      {!isCompact && isVideo && mediaItem?.waveformData && (
        <div className="absolute inset-x-0 bottom-0 h-1/3 flex items-end opacity-30 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
            <path
              d={generateWaveformPath(mediaItem.waveformData, 100)}
              stroke="currentColor"
              className="text-green-300"
              fill="none"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {clip.keyframes && clip.keyframes.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-4 flex items-center pointer-events-none z-30 overflow-visible">
          {clip.keyframes.map((kf) => (
            <InteractiveKeyframeMarker
              key={kf.id}
              kf={kf}
              clip={clip}
              pixelsPerSecond={pixelsPerSecond}
            />
          ))}
        </div>
      )}

      {isSelected && (
        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" />
      )}

      {(isVideo || isImage || isAudio) && onTrimClip && (
        <>
          <div
            onMouseDown={handleTrimMouseDown("left")}
            className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 flex items-center justify-center transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } ${isSelected ? "bg-primary" : isAudio ? "hover:bg-blue-400/50" : isVideo ? "hover:bg-green-400/50" : "hover:bg-purple-400/50"}`}
            style={{ borderRadius: "6px 0 0 6px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isSelected && (
              <div className="w-0.5 h-3 bg-primary-foreground/80 rounded-full" />
            )}
          </div>
          <div
            onMouseDown={handleTrimMouseDown("right")}
            className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 flex items-center justify-center transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } ${isSelected ? "bg-primary" : isAudio ? "hover:bg-blue-400/50" : isVideo ? "hover:bg-green-400/50" : "hover:bg-purple-400/50"}`}
            style={{ borderRadius: "0 6px 6px 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isSelected && (
              <div className="w-0.5 h-3 bg-primary-foreground/80 rounded-full" />
            )}
          </div>
        </>
      )}

        </div>
      </ContextMenuTrigger>
      <ClipContextMenu clip={clip} track={track} />
    </ContextMenu>
  );
};
