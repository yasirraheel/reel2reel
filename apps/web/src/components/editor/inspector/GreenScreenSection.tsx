import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Video, Pipette, RefreshCw, Eye, EyeOff, Layers } from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import { useEngineStore } from "../../../stores/engine-store";
import type { RGB, ChromaKeySettings } from "@openreel/core";

import { toast } from "../../../stores/notification-store";

interface GreenScreenSectionProps {
  clipId: string;
}

const ColorPreview: React.FC<{ color: RGB; onClick?: () => void }> = ({
  color,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-8 h-8 rounded-lg border-2 border-border hover:border-primary transition-colors"
    style={{
      backgroundColor: `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`,
    }}
    title="Click to pick color from video"
  />
);

const ControlSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, onChange, min = 0, max = 1, step = 0.01 }) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-secondary">{label}</span>
        <span className="text-[10px] font-mono text-text-primary bg-background-tertiary px-1.5 py-0.5 rounded border border-border">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="relative h-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="absolute inset-0 bg-background-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-sm pointer-events-none"
          style={{ left: `calc(${percentage}% - 5px)` }}
        />
      </div>
    </div>
  );
};

const ColorPresetButton: React.FC<{
  color: RGB;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ color, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] transition-colors ${
      isActive
        ? "bg-primary text-white"
        : "bg-background-tertiary text-text-muted hover:text-text-primary"
    }`}
  >
    <div
      className="w-3 h-3 rounded-sm border border-border"
      style={{
        backgroundColor: `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`,
      }}
    />
    {label}
  </button>
);

const COLOR_PRESETS: { color: RGB; label: string }[] = [
  { color: { r: 0, g: 1, b: 0 }, label: "Green" },
  { color: { r: 0, g: 0, b: 1 }, label: "Blue" },
  { color: { r: 1, g: 0, b: 1 }, label: "Magenta" },
  { color: { r: 0, g: 1, b: 1 }, label: "Cyan" },
];

export const GreenScreenSection: React.FC<GreenScreenSectionProps> = ({
  clipId,
}) => {
  const project = useProjectStore((state) => state.project);
  const getChromaKeyEngine = useEngineStore(
    (state) => state.getChromaKeyEngine,
  );

  const [isPickingColor, setIsPickingColor] = useState(false);
  const [chromaKeyEngine, setChromaKeyEngine] =
    useState<import("@openreel/core").ChromaKeyEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadEngine = async () => {
      const engine = await getChromaKeyEngine();
      if (!cancelled) {
        setChromaKeyEngine(engine);
      }
    };
    loadEngine();
    return () => {
      cancelled = true;
    };
  }, [getChromaKeyEngine]);

  const settings = useMemo<ChromaKeySettings>(() => {
    const clip = project.timeline.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === clipId);
    const chromaEffect = clip?.effects?.find((e) => e.type === "chromaKey");

    if (chromaKeyEngine) {
      let engineSettings = chromaKeyEngine.getSettings(clipId);
      if (!engineSettings && chromaEffect) {
        const params = chromaEffect.params as any;
        engineSettings = {
          enabled: chromaEffect.enabled !== false,
          keyColor: params?.keyColor || { r: 0, g: 1, b: 0 },
          tolerance: params?.tolerance ?? 0.3,
          edgeSoftness: params?.edgeSoftness ?? 0.1,
          spillSuppression: params?.spillSuppression ?? 0.5,
        };
        chromaKeyEngine.setSettings(clipId, engineSettings);
      }
      if (engineSettings) return engineSettings;
    }

    if (chromaEffect) {
      const params = chromaEffect.params as any;
      return {
        enabled: chromaEffect.enabled !== false,
        keyColor: params?.keyColor || { r: 0, g: 1, b: 0 },
        tolerance: params?.tolerance ?? 0.3,
        edgeSoftness: params?.edgeSoftness ?? 0.1,
        spillSuppression: params?.spillSuppression ?? 0.5,
      };
    }

    return {
      enabled: false,
      keyColor: { r: 0, g: 1, b: 0 },
      tolerance: 0.3,
      edgeSoftness: 0.1,
      spillSuppression: 0.5,
    };
  }, [chromaKeyEngine, clipId, project]);

  const updateChromaKeyInProject = useCallback(
    (newSettings: ChromaKeySettings) => {
      if (chromaKeyEngine) {
        chromaKeyEngine.setSettings(clipId, newSettings);
      }
      useProjectStore.setState((state) => {
        let clipFound = false;
        const tracks = state.project.timeline.tracks.map((track) => {
          const clipIdx = track.clips.findIndex((c) => c.id === clipId);
          if (clipIdx === -1) return track;

          clipFound = true;
          const clip = track.clips[clipIdx];
          const existingEffects = clip.effects || [];
          const effectIdx = existingEffects.findIndex((e) => e.type === "chromaKey");

          const chromaEffect = {
            id: effectIdx >= 0 ? existingEffects[effectIdx].id : `chroma-${clipId}`,
            type: "chromaKey",
            name: "Chroma Key",
            enabled: newSettings.enabled,
            params: {
              keyColor: newSettings.keyColor,
              tolerance: newSettings.tolerance,
              edgeSoftness: newSettings.edgeSoftness,
              spillSuppression: newSettings.spillSuppression,
            },
          };

          const newEffects = [...existingEffects];
          if (effectIdx >= 0) {
            newEffects[effectIdx] = chromaEffect as any;
          } else {
            newEffects.push(chromaEffect as any);
          }

          const newClips = [...track.clips];
          newClips[clipIdx] = { ...clip, effects: newEffects };
          return { ...track, clips: newClips };
        });

        if (!clipFound) return state;

        return {
          project: {
            ...state.project,
            modifiedAt: Date.now(),
            timeline: {
              ...state.project.timeline,
              tracks,
            },
          },
        };
      });
    },
    [chromaKeyEngine, clipId],
  );

  const handleToggleEnabled = useCallback(() => {
    updateChromaKeyInProject({ ...settings, enabled: !settings.enabled });
  }, [settings, updateChromaKeyInProject]);

  const handleSetKeyColor = useCallback(
    (color: RGB) => {
      updateChromaKeyInProject({ ...settings, keyColor: color });
    },
    [settings, updateChromaKeyInProject],
  );

  const handlePickColor = useCallback(async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          const hex: string = result.sRGBHex;
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;
          handleSetKeyColor({ r, g, b });
          toast.success("Key Color Selected", `Picked color ${hex}`);
          return;
        }
      } catch {
        return;
      }
    }
    setIsPickingColor((prev) => !prev);
  }, [handleSetKeyColor]);

  const handleSetTolerance = useCallback(
    (value: number) => {
      updateChromaKeyInProject({ ...settings, tolerance: value });
    },
    [settings, updateChromaKeyInProject],
  );

  const handleSetEdgeSoftness = useCallback(
    (value: number) => {
      updateChromaKeyInProject({ ...settings, edgeSoftness: value });
    },
    [settings, updateChromaKeyInProject],
  );

  const handleSetSpillSuppression = useCallback(
    (value: number) => {
      updateChromaKeyInProject({ ...settings, spillSuppression: value });
    },
    [settings, updateChromaKeyInProject],
  );

  const handleResetToDefaults = useCallback(() => {
    updateChromaKeyInProject({
      enabled: true,
      keyColor: { r: 0, g: 1, b: 0 },
      tolerance: 0.3,
      edgeSoftness: 0.1,
      spillSuppression: 0.5,
    });
  }, [updateChromaKeyInProject]);



  const isActiveColor = (preset: RGB) =>
    Math.abs(settings.keyColor.r - preset.r) < 0.1 &&
    Math.abs(settings.keyColor.g - preset.g) < 0.1 &&
    Math.abs(settings.keyColor.b - preset.b) < 0.1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
        <Video size={16} className="text-green-400" />
        <div className="flex-1">
          <span className="text-[11px] font-medium text-text-primary">
            Green Screen
          </span>
          <p className="text-[9px] text-text-muted">
            Remove background color from video
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`p-1.5 rounded transition-colors ${
            settings.enabled
              ? "bg-green-500/30 text-green-400"
              : "bg-background-tertiary text-text-muted hover:text-text-primary"
          }`}
          title={settings.enabled ? "Disable chroma key" : "Enable chroma key"}
        >
          {settings.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-primary">
                Key Color
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePickColor}
                  className={`p-1.5 rounded transition-colors ${
                    isPickingColor
                      ? "bg-primary text-white"
                      : "bg-background-tertiary text-text-muted hover:text-text-primary"
                  }`}
                  title="Pick color from video"
                >
                  <Pipette size={12} />
                </button>
                <ColorPreview color={settings.keyColor} />
              </div>
            </div>

            {isPickingColor && (
              <div className="p-2 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="text-[9px] text-primary text-center">
                  Click on the video preview to pick a color
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {COLOR_PRESETS.map((preset) => (
                <ColorPresetButton
                  key={preset.label}
                  color={preset.color}
                  label={preset.label}
                  isActive={isActiveColor(preset.color)}
                  onClick={() => handleSetKeyColor(preset.color)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <ControlSlider
              label="Tolerance"
              value={settings.tolerance}
              onChange={handleSetTolerance}
            />

            <ControlSlider
              label="Edge Softness"
              value={settings.edgeSoftness}
              onChange={handleSetEdgeSoftness}
            />

            <ControlSlider
              label="Spill Suppression"
              value={settings.spillSuppression}
              onChange={handleSetSpillSuppression}
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={handleResetToDefaults}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] text-text-secondary hover:text-text-primary bg-background-tertiary rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              Reset to Defaults
            </button>
          </div>

          <div className="flex items-center gap-2 p-2 bg-background-tertiary rounded-lg">
            <Layers size={12} className="text-text-muted" />
            <p className="text-[9px] text-text-muted flex-1">
              Place video clips below this one to use as background
            </p>
          </div>
        </>
      )}

      {!settings.enabled && (
        <div className="text-center py-4">
          <Video
            size={24}
            className="mx-auto mb-2 text-text-muted opacity-50"
          />
          <p className="text-[10px] text-text-muted">
            Enable to remove background color
          </p>
          <button
            onClick={handleToggleEnabled}
            className="mt-2 px-4 py-1.5 text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
          >
            Enable Green Screen
          </button>
        </div>
      )}
    </div>
  );
};

export default GreenScreenSection;
