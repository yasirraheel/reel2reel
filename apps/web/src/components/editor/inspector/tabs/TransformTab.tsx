import React from "react";
import { useProjectStore } from "../../../../stores/project-store";
import { Diamond, RotateCcw } from "lucide-react";
import type { Clip, FitMode, Transform } from "@openreel/core";
import { LabeledSlider } from "@openreel/ui";
import {
  CropSection,
  AlignmentSection,
  BlendingSection,
  Transform3DSection,
  FadeSection,
} from "../";
import { InspectorSection } from "../shell/InspectorSection";

interface TransformTabClip {
  id: string;
  mediaId: string;
}

export interface TransformTabProps {
  clipId: string;
  clipType: string | null;
  selectedClip: TransformTabClip | null;
  showTransformControls: boolean;
  showVideoControls: boolean;
  transform: Transform;
  handleTransformChange: (changes: Partial<Transform>) => void;
  keyframeEnabled?: Record<string, boolean>;
  hasKeyframeAtPlayhead?: Record<string, boolean>;
  hasAnyKeyframes?: Record<string, boolean>;
  onToggleKeyframe: (property: string) => void;
}

export const TransformTab: React.FC<TransformTabProps> = ({
  clipId,
  clipType,
  selectedClip,
  showTransformControls,
  showVideoControls,
  transform,
  handleTransformChange,
  keyframeEnabled,
  hasKeyframeAtPlayhead,
  hasAnyKeyframes,
  onToggleKeyframe,
}) => {
  const timelineClip = useProjectStore(state => state.project.timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId));
  const trimClip = useProjectStore(state => state.trimClip);
  const mediaDuration = useProjectStore(state => state.project.mediaLibrary.items.find(item => item.id === timelineClip?.mediaId)?.metadata.duration);
  const keyframeButton = (property: string) => {
    const atPlayhead = hasKeyframeAtPlayhead?.[property];
    const hasAny = hasAnyKeyframes?.[property] || keyframeEnabled?.[property];

    let colorClass = "text-text-muted hover:text-accent";
    let titleText = "Add keyframe at playhead";

    if (atPlayhead) {
      colorClass = "text-accent bg-accent/25 ring-1 ring-accent/40";
      titleText = "Remove keyframe at playhead";
    } else if (hasAny) {
      colorClass = "text-accent/80 hover:text-accent bg-accent/10";
      titleText = "Add keyframe at playhead";
    }

    return (
      <button
        type="button"
        onClick={() => onToggleKeyframe(property)}
        className={`p-1 rounded transition-all duration-150 flex items-center justify-center ${colorClass}`}
        title={titleText}
        aria-label={titleText}
      >
        <Diamond size={13} fill={atPlayhead ? "currentColor" : "none"} />
      </button>
    );
  };
  return (
    <>
      {showTransformControls && (
        <>
          <InspectorSection title="Transform" sectionId="transform">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <span className="text-[11px] font-medium text-text-secondary">Transform Controls</span>
                <button
                  type="button"
                  onClick={() =>
                    handleTransformChange({
                      position: { x: 0, y: 0 },
                      scale: { x: 1, y: 1 },
                      rotation: 0,
                      opacity: 1,
                      borderRadius: 0,
                      corners: undefined,
                    })
                  }
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 transition-colors"
                  title="Reset transform to default full size"
                >
                  <RotateCcw size={10} /> Reset Transform
                </button>
              </div>
              {timelineClip && (clipType === "video" || clipType === "audio") && <div className="grid grid-cols-2 gap-2">
                {(["inPoint", "outPoint"] as const).map(edge => <label key={edge} className="text-xs">
                  {edge === "inPoint" ? "Source In (s)" : "Source Out (s)"}
                  <input key={timelineClip[edge]} type="number" step="0.01" defaultValue={timelineClip[edge].toFixed(2)}
                    className="w-full bg-background-tertiary border border-border rounded p-1"
                    onBlur={event => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      const next = edge === "inPoint" ? Math.max(0, Math.min(value, timelineClip.outPoint - 0.05)) : Math.max(timelineClip.inPoint + 0.05, Math.min(value, mediaDuration || Infinity));
                      void trimClip(clipId, edge === "inPoint" ? next : undefined, edge === "outPoint" ? next : undefined);
                    }} />
                </label>)}
              </div>}
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y"] as const).map(axis => <button type="button" key={axis}
                  className="py-2 rounded bg-background-tertiary border border-border text-xs"
                  aria-pressed={transform.scale[axis] < 0}
                  onClick={() => handleTransformChange({ scale: { ...transform.scale, [axis]: -(transform.scale[axis] || 1) } })}>
                  Flip {axis === "x" ? "Horizontal" : "Vertical"}
                </button>)}
              </div>
              <details className="space-y-2">
                <summary className="text-xs cursor-pointer">Four Corner Transform</summary>
                <p className="text-[10px] text-text-secondary">Move each corner independently (% of clip size).</p>
                <svg viewBox="-0.4 -0.4 1.8 1.8" className="w-full h-40 bg-background-tertiary rounded" aria-label="Drag the four clip corners">
                  <polygon fill="rgba(59,130,246,0.2)" stroke="#60a5fa" strokeWidth="0.01" points={(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).map(corner => {
                    const offset = transform.corners?.[corner] ?? {x:0,y:0};
                    return [(corner.includes("Right") ? 1 : 0)+offset.x, (corner.includes("bottom") ? 1 : 0)+offset.y].join(",");
                  }).join(" ")} />
                  {(["topLeft", "topRight", "bottomLeft", "bottomRight"] as const).map(corner => {
                    const baseX = corner.includes("Right") ? 1 : 0, baseY = corner.includes("bottom") ? 1 : 0;
                    const offset = transform.corners?.[corner] ?? {x:0,y:0};
                    return <circle key={corner} cx={baseX+offset.x} cy={baseY+offset.y} r="0.04" fill="#fff" stroke="#3b82f6" strokeWidth="0.015"
                      className="cursor-move" style={{touchAction:"none"}}
                      onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
                      onPointerMove={event => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                        const svg = event.currentTarget.ownerSVGElement!;
                        const matrix = svg.getScreenCTM();
                        if (!matrix) return;
                        const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
                        const corners = transform.corners ?? {topLeft:{x:0,y:0},topRight:{x:0,y:0},bottomLeft:{x:0,y:0},bottomRight:{x:0,y:0}};
                        handleTransformChange({corners:{...corners,[corner]:{x:Math.max(-1,Math.min(1,point.x-baseX)),y:Math.max(-1,Math.min(1,point.y-baseY))}}});
                      }}
                      onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} />;
                  })}
                </svg>
                {(["topLeft", "topRight", "bottomLeft", "bottomRight"] as const).map(corner =>
                  <div key={corner} className="space-y-1">
                    <span className="text-[10px] capitalize">{corner.replace(/([A-Z])/g, " $1")}</span>
                    {(["x", "y"] as const).map(axis => <LabeledSlider key={axis}
                      label={axis.toUpperCase()} value={(transform.corners?.[corner]?.[axis] ?? 0) * 100}
                      min={-100} max={100} step={1} unit="%" defaultValue={0}
                      onChange={value => {
                        const corners = transform.corners ?? { topLeft: {x:0,y:0}, topRight: {x:0,y:0}, bottomLeft: {x:0,y:0}, bottomRight: {x:0,y:0} };
                        handleTransformChange({ corners: { ...corners, [corner]: { ...corners[corner], [axis]: value / 100 } } });
                      }} />)}
                  </div>)}
                <button type="button" className="text-xs text-accent" onClick={() => handleTransformChange({ corners: undefined })}>Reset Corners</button>
              </details>
              <LabeledSlider
                label="Position X"
                value={transform.position.x}
                onChange={(x) =>
                  handleTransformChange({
                    position: { ...transform.position, x },
                  })
                }
                min={-1920}
                max={1920}
                step={1}
                unit="px"
                defaultValue={0}
                trailingAction={keyframeButton("position.x")}
              />
              <LabeledSlider
                label="Position Y"
                value={transform.position.y}
                onChange={(y) =>
                  handleTransformChange({
                    position: { ...transform.position, y },
                  })
                }
                min={-1080}
                max={1080}
                step={1}
                unit="px"
                defaultValue={0}
                trailingAction={keyframeButton("position.y")}
              />
              <LabeledSlider
                label="Scale X"
                value={transform.scale.x * 100}
                onChange={(x) =>
                  handleTransformChange({
                    scale: { ...transform.scale, x: x / 100 },
                  })
                }
                min={-300}
                max={300}
                step={1}
                unit="%"
                defaultValue={100}
                trailingAction={keyframeButton("scale.x")}
              />
              <LabeledSlider
                label="Scale Y"
                value={transform.scale.y * 100}
                onChange={(y) =>
                  handleTransformChange({
                    scale: { ...transform.scale, y: y / 100 },
                  })
                }
                min={-300}
                max={300}
                step={1}
                unit="%"
                defaultValue={100}
                trailingAction={keyframeButton("scale.y")}
              />
              <LabeledSlider
                label="Rotation"
                value={transform.rotation}
                onChange={(rotation) => handleTransformChange({ rotation })}
                min={-180}
                max={180}
                step={1}
                unit="°"
                defaultValue={0}
                trailingAction={keyframeButton("rotation")}
              />
              <LabeledSlider
                label="Opacity"
                value={transform.opacity * 100}
                onChange={(opacity) =>
                  handleTransformChange({ opacity: opacity / 100 })
                }
                min={0}
                max={100}
                step={1}
                unit="%"
                defaultValue={100}
                trailingAction={keyframeButton("opacity")}
              />
              <LabeledSlider
                label="Border Radius"
                value={transform.borderRadius || 0}
                onChange={(borderRadius) =>
                  handleTransformChange({ borderRadius })
                }
                min={0}
                max={200}
                step={1}
                unit="px"
                defaultValue={0}
              />
              {(clipType === "image" || clipType === "video") && (
                <div className="space-y-1 pt-2 border-t border-border">
                  <span className="text-[10px] text-text-secondary">
                    Fit Mode
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["contain", "cover", "stretch"] as FitMode[]).map(
                      (mode) => {
                        const activeMode =
                          !transform.fitMode || transform.fitMode === "none"
                            ? "contain"
                            : transform.fitMode;
                        return (
                          <button
                            key={mode}
                            onClick={() =>
                              handleTransformChange({ fitMode: mode })
                            }
                            className={`py-1.5 rounded text-[9px] capitalize transition-colors ${
                              activeMode === mode
                                ? "bg-primary text-white"
                                : "bg-background-tertiary border border-border text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {mode === "contain"
                              ? "Fit"
                              : mode === "cover"
                                ? "Fill"
                                : mode}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>
          </InspectorSection>
          {(clipType === "video" || clipType === "image") && (
            <InspectorSection title="Fade" sectionId="video-fade" defaultOpen={false}>
              <FadeSection clipId={clipId} type="video" />
            </InspectorSection>
          )}
        </>
      )}

      {showVideoControls &&
        selectedClip &&
        !selectedClip.mediaId.startsWith("text-") &&
        !selectedClip.mediaId.startsWith("shape-") &&
        !selectedClip.mediaId.startsWith("svg-") &&
        !selectedClip.mediaId.startsWith("sticker-") && (
          <InspectorSection title="Crop" sectionId="crop" defaultOpen={false}>
            <CropSection clip={selectedClip as Clip} />
          </InspectorSection>
        )}

      {(clipType === "video" ||
        clipType === "image" ||
        clipType === "text" ||
        clipType === "shape" ||
        clipType === "svg" ||
        clipType === "sticker") && (
        <InspectorSection
          title="Alignment"
          sectionId="alignment"
          defaultOpen={false}
        >
          <AlignmentSection clipId={clipId} />
        </InspectorSection>
      )}

      {(clipType === "video" ||
        clipType === "image" ||
        clipType === "text" ||
        clipType === "shape" ||
        clipType === "svg" ||
        clipType === "sticker") && (
        <InspectorSection
          title="Blending"
          sectionId="blending"
          defaultOpen={false}
        >
          <BlendingSection clipId={clipId} />
        </InspectorSection>
      )}

      {(clipType === "video" ||
        clipType === "image" ||
        clipType === "text" ||
        clipType === "shape" ||
        clipType === "svg" ||
        clipType === "sticker") && (
        <InspectorSection
          title="3D Transforms"
          sectionId="transform-3d"
          defaultOpen={false}
        >
          <Transform3DSection clipId={clipId} />
        </InspectorSection>
      )}
    </>
  );
};
