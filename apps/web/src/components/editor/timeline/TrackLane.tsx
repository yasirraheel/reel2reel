import React, { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Shuffle, X } from "lucide-react";
import type {
  Track,
  TextClip,
  ShapeClip,
  SVGClip,
  StickerClip,
} from "@openreel/core";
import { ClipComponent } from "./ClipComponent";
import { TextClipComponent } from "./TextClipComponent";
import { ShapeClipComponent } from "./ShapeClipComponent";
import { KeyframeTrack } from "./KeyframeTrack";
import { calculateSnap } from "./utils";
import { useTimelineStore } from "../../../stores/timeline-store";
import { useUIStore } from "../../../stores/ui-store";
import { useProjectStore } from "../../../stores/project-store";
import { toast } from "../../../stores/notification-store";

type GraphicClipUnion = ShapeClip | SVGClip | StickerClip;

interface TrackLaneProps {
  track: Track;
  allTracks: Track[];
  pixelsPerSecond: number;
  selectedClipIds: string[];
  textClips: TextClip[];
  shapeClips: GraphicClipUnion[];
  trackHeights: Map<string, number>;
  timelineRef: React.RefObject<HTMLDivElement>;
  onSelectClip: (clipId: string, addToSelection: boolean) => void;
  onDropMedia: (trackId: string, mediaId: string, startTime: number) => void;
  onMoveClip: (
    clipId: string,
    newStartTime: number,
    targetTrackId?: string,
  ) => void;
  onMoveTextClip: (clipId: string, newStartTime: number) => void;
  onSnapIndicator: (time: number | null) => void;
  onTrimClip?: (
    clipId: string,
    edge: "left" | "right",
    newTime: number,
  ) => void;
  onTrimTextClip: (
    clipId: string,
    edge: "left" | "right",
    newTime: number,
  ) => void;
  onTrimShapeClip: (
    clipId: string,
    edge: "left" | "right",
    newTime: number,
  ) => void;
  scrollX: number;
  trackHeight: number;
  onResizeTrack: (trackId: string, newHeight: number) => void;
  onKeyframeSelect?: (keyframeId: string, addToSelection: boolean) => void;
  onKeyframeMove?: (keyframeId: string, newTime: number) => void;
  onKeyframeDelete?: (keyframeId: string) => void;
  selectedKeyframeIds?: string[];
}

export const TrackLane: React.FC<TrackLaneProps> = ({
  track,
  allTracks,
  pixelsPerSecond,
  selectedClipIds,
  textClips,
  shapeClips,
  trackHeights,
  timelineRef,
  onSelectClip,
  onDropMedia,
  onMoveClip,
  onMoveTextClip,
  onSnapIndicator,
  onTrimClip,
  onTrimTextClip,
  onTrimShapeClip,
  scrollX,
  trackHeight,
  onResizeTrack,
  onKeyframeSelect,
  onKeyframeMove,
  onKeyframeDelete,
  selectedKeyframeIds = [],
}) => {
  const { isTrackExpanded, playheadPosition } = useTimelineStore();
  const isExpanded = isTrackExpanded(track.id);
  const { snapSettings } = useUIStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const laneRef = useRef<HTMLDivElement>(null);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  const clipsWithKeyframes = useMemo(() => {
    return track.clips.filter((clip) => clip.keyframes && clip.keyframes.length > 0);
  }, [track.clips]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // External OS file drop (e.g. from Windows Explorer)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const rect = laneRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left + scrollX;
        const rawTime = Math.max(0, x / pixelsPerSecond);
        const snapResult = calculateSnap(
          rawTime,
          "",
          allTracks,
          playheadPosition,
          snapSettings,
          pixelsPerSecond,
        );
        const { importMedia, addClip } = useProjectStore.getState();
        for (const file of Array.from(e.dataTransfer.files)) {
          try {
            const beforeIds = new Set(
              useProjectStore.getState().project.mediaLibrary.items.map(i => i.id)
            );
            const result = await importMedia(file);
            if (result.success) {
              const newItem = useProjectStore
                .getState()
                .project.mediaLibrary.items.find(i => !beforeIds.has(i.id));
              if (newItem) {
                await addClip(track.id, newItem.id, snapResult.time);
                toast.success(`Added to ${track.name}`, file.name);
              }
            }
          } catch (err) {
            console.error("[TrackLane] External file drop failed:", err);
          }
        }
        return;
      }

      // Internal drag from assets panel
      try {
        const rawData = e.dataTransfer.getData("application/json");
        if (!rawData) return;

        const data = JSON.parse(rawData);
        if (
          !data ||
          typeof data !== "object" ||
          typeof data.mediaId !== "string" ||
          !data.mediaId.trim()
        ) {
          return;
        }

        const rect = laneRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left + scrollX;
          const rawTime = Math.max(0, x / pixelsPerSecond);
          const snapResult = calculateSnap(
            rawTime,
            "",
            allTracks,
            playheadPosition,
            snapSettings,
            pixelsPerSecond,
          );
          onDropMedia(track.id, data.mediaId, snapResult.time);
        }
      } catch {
        // Silently ignore parse errors
      }
    },
    [track.id, track.name, pixelsPerSecond, scrollX, onDropMedia],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStartY.current = e.clientY;
      resizeStartHeight.current = trackHeight;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [trackHeight],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY.current;
      const newHeight = resizeStartHeight.current + deltaY;
      onResizeTrack(track.id, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, track.id, onResizeTrack]);

  return (
    <div className="relative">
      <div
        ref={laneRef}
        style={{ height: trackHeight }}
        className={`border-b border-border/50 relative transition-colors ${
          isDragOver
            ? "bg-primary/10 border-primary/30"
            : "bg-background-secondary/20"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {track.clips
          .filter((clip) => !textClips.some((tc) => tc.id === clip.id))
          .filter((clip) => !shapeClips.some((sc) => sc.id === clip.id))
          .map((clip) => (
            <ClipComponent
              key={clip.id}
              clip={clip}
              track={track}
              allTracks={allTracks}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedClipIds.includes(clip.id)}
              trackHeights={trackHeights}
              timelineRef={timelineRef}
              onSelect={onSelectClip}
              onMoveClip={onMoveClip}
              onSnapIndicator={onSnapIndicator}
              onTrimClip={onTrimClip}
            />
          ))}
        {textClips.map((textClip) => (
          <TextClipComponent
            key={textClip.id}
            textClip={textClip}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={selectedClipIds.includes(textClip.id)}
            onSelect={onSelectClip}
            onTrim={onTrimTextClip}
            onMoveClip={onMoveTextClip}
          />
        ))}
        {shapeClips.map((shapeClip) => (
          <ShapeClipComponent
            key={shapeClip.id}
            shapeClip={shapeClip}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={selectedClipIds.includes(shapeClip.id)}
            onSelect={onSelectClip}
            onTrim={onTrimShapeClip}
            onMoveClip={onMoveClip}
          />
        ))}
        {/* Visual Interactive Transition Badges between clips */}
        {track.transitions && track.transitions.map((transition) => {
          const clipA = track.clips.find((c) => c.id === transition.clipAId);
          const clipB = track.clips.find((c) => c.id === transition.clipBId);
          if (!clipA || !clipB) return null;

          const cutTime = clipA.startTime + clipA.duration;
          const widthPx = Math.max(34, transition.duration * pixelsPerSecond);
          const leftPx = cutTime * pixelsPerSecond - widthPx / 2;

          return (
            <div
              key={`trans-${transition.id}`}
              style={{
                left: `${leftPx}px`,
                width: `${widthPx}px`,
                top: "4px",
                bottom: "4px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectClip(clipA.id, false);
                useUIStore.getState().select({ id: clipA.id, type: "clip" });
                toast.info("Transition Selected", `${transition.type} • ${transition.duration.toFixed(1)}s (Edit in Inspector)`);
              }}
              className="group/trans absolute z-30 flex items-center justify-between px-1 bg-gradient-to-r from-emerald-600/80 via-emerald-500/90 to-emerald-600/80 hover:from-emerald-500 hover:to-emerald-500 text-white rounded shadow-md border border-emerald-300/60 cursor-pointer backdrop-blur-sm transition-all hover:scale-105"
              title={`Transition: ${transition.type} (${transition.duration}s) - Click to edit in Inspector`}
            >
              <div className="flex items-center gap-1 overflow-hidden pointer-events-none">
                <Shuffle size={10} className="shrink-0 text-white animate-pulse" />
                <span className="text-[9px] font-bold tracking-tight capitalize truncate">
                  {transition.type}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  useProjectStore.getState().removeClipTransition(transition.id);
                  toast.success("Transition Removed");
                }}
                className="opacity-0 group-hover/trans:opacity-100 hover:bg-black/40 rounded p-0.5 transition-opacity text-white hover:text-red-200"
                title="Remove Transition"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        {isDragOver && (
          <div className="absolute inset-0 border-2 border-dashed border-primary/50 rounded pointer-events-none flex items-center justify-center">
            <span className="text-xs text-primary bg-background/80 px-2 py-1 rounded">
              Drop to add clip
            </span>
          </div>
        )}
      </div>
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/50 transition-colors z-10 ${
          isResizing ? "bg-primary" : ""
        }`}
        onMouseDown={handleResizeStart}
      />
      {isExpanded && clipsWithKeyframes.length > 0 && (
        <div className="absolute left-0 right-0" style={{ top: trackHeight }}>
          {clipsWithKeyframes.map((clip) => (
            <div
              key={`keyframes-${clip.id}`}
              className="relative"
              style={{ left: clip.startTime * pixelsPerSecond }}
            >
              <KeyframeTrack
                clip={clip}
                pixelsPerSecond={pixelsPerSecond}
                onKeyframeSelect={onKeyframeSelect ?? (() => {})}
                onKeyframeMove={onKeyframeMove ?? (() => {})}
                onKeyframeDelete={onKeyframeDelete ?? (() => {})}
                selectedKeyframeIds={selectedKeyframeIds}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
