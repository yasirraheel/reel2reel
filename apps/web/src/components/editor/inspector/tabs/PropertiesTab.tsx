import React, { useCallback } from "react";
import { InspectorSection } from "../shell/InspectorSection";
import { useProjectStore } from "../../../../stores/project-store";

export interface PropertiesTabProps {
  clipId: string;
  metadata: Record<string, unknown> | undefined;
  onUpdateMetadata: (update: Record<string, unknown>) => void;
}

const TRACK_COLORS = [
  { value: "bg-red-500", label: "Red" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-yellow-500", label: "Yellow" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-slate-500", label: "Slate" },
];

export const PropertiesTab: React.FC<PropertiesTabProps> = ({
  clipId,
  metadata,
  onUpdateMetadata,
}) => {
  const { getTextClip, updateTextContent, project } = useProjectStore();

  const textClip = React.useMemo(
    () => getTextClip(clipId),
    [clipId, getTextClip, project.modifiedAt],
  );

  const currentLabel = (metadata?.label as string) || "";
  const currentColor = (metadata?.color as string) || "";
  const text = textClip?.text || "";

  const handleTextChange = useCallback(
    (newText: string) => {
      updateTextContent(clipId, newText);
    },
    [clipId, updateTextContent],
  );

  return (
    <div className="space-y-4">
      {textClip && (
        <InspectorSection title="Text Content" sectionId="text-content" defaultOpen>
          <div className="space-y-1">
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Enter text..."
              className="w-full h-20 bg-background-tertiary border border-border rounded px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-primary resize-none"
              style={{ fontFamily: textClip.style?.fontFamily }}
            />
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Clip Properties" sectionId="properties" defaultOpen>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary">Custom Label</label>
            <input
              type="text"
              value={currentLabel}
              placeholder="Default clip name"
              onChange={(e) => onUpdateMetadata({ label: e.target.value })}
              className="w-full bg-background-tertiary border border-border rounded px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary">Track Color</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              <button
                onClick={() => onUpdateMetadata({ color: "" })}
                className={`h-6 rounded border border-border flex items-center justify-center text-[9px] text-text-secondary transition-colors ${!currentColor ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              >
                Auto
              </button>
              {TRACK_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onUpdateMetadata({ color: color.value })}
                  className={`h-6 rounded border border-border/50 transition-all ${color.value} ${currentColor === color.value ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.02]" : "hover:scale-[1.05]"}`}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>
      </InspectorSection>
    </div>
  );
};
