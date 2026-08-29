import React from "react";
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
                    })
                  }
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 transition-colors"
                  title="Reset transform to default full size"
                >
                  <RotateCcw size={10} /> Reset Transform
                </button>
              </div>
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
                min={0}
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
                min={0}
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
