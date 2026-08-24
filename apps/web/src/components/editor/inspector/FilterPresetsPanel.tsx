import React, { useState, useCallback, useMemo } from "react";
import { Film, Camera, Moon, Palette, Wand2, Check } from "lucide-react";
import { Slider } from "@openreel/ui";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { toast } from "../../../stores/notification-store";
import {
  FILTER_PRESETS,
  FILTER_CATEGORIES,
  getPresetsByCategory,
  type FilterPreset,
  type FilterCategory,
} from "@openreel/core";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cinematic: Film,
  vintage: Camera,
  mood: Moon,
  color: Palette,
  stylized: Wand2,
};

interface PresetCardProps {
  preset: FilterPreset;
  isApplied: boolean;
  onApply: () => void;
}

const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  isApplied,
  onApply,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onApply}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full p-3.5 rounded-xl border-2 transition-all text-left shadow-sm ${
        isApplied
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border bg-background-tertiary hover:border-primary/60 hover:bg-background-elevated"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              {preset.name}
            </span>
            {isApplied && <Check size={14} className="text-primary stroke-[2.5]" />}
          </div>
          <p className="text-[10.5px] text-text-muted mt-1 font-medium">
            {preset.description}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        {preset.effects.slice(0, 3).map((effect, index) => (
          <span
            key={index}
            className="px-2 py-0.5 text-[9.5px] font-semibold bg-background-secondary border border-border rounded-md text-text-secondary"
          >
            {effect.type}
          </span>
        ))}
        {preset.effects.length > 3 && (
          <span className="px-2 py-0.5 text-[9.5px] font-semibold bg-background-secondary border border-border rounded-md text-text-secondary">
            +{preset.effects.length - 3}
          </span>
        )}
      </div>
      {isHovered && !isApplied && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-tertiary/90 backdrop-blur-xs rounded-xl">
          <span className="text-xs text-primary font-bold">
            Click to Apply
          </span>
        </div>
      )}
    </button>
  );
};

interface FilterPresetsPanelProps {
  clipId?: string;
}

export const FilterPresetsPanel: React.FC<FilterPresetsPanelProps> = ({
  clipId,
}) => {
  const selectedClipIds = useUIStore((state) => state.getSelectedClipIds());
  const addVideoEffect = useProjectStore((state) => state.addVideoEffect);
  const getVideoEffects = useProjectStore((state) => state.getVideoEffects);
  const removeVideoEffect = useProjectStore((state) => state.removeVideoEffect);

  const [selectedCategory, setSelectedCategory] =
    useState<FilterCategory>("cinematic");
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [intensityValue, setIntensityValue] = useState(100);

  const targetClipId = clipId || selectedClipIds[0];
  const presets = useMemo(
    () => getPresetsByCategory(selectedCategory),
    [selectedCategory],
  );

  const handleApplyPreset = useCallback(
    (preset: FilterPreset) => {
      if (!targetClipId) return;

      const existingEffects = getVideoEffects(targetClipId);
      existingEffects.forEach((effect) => {
        removeVideoEffect(targetClipId, effect.id);
      });

      preset.effects.forEach((filterEffect) => {
        addVideoEffect(targetClipId, filterEffect.type, filterEffect.params);
      });

      setAppliedPresetId(preset.id);
      toast.success("Filter Applied", `${preset.name} preset applied`);
    },
    [targetClipId, addVideoEffect, getVideoEffects, removeVideoEffect],
  );

  const handleClearEffects = useCallback(() => {
    if (!targetClipId) return;

    const existingEffects = getVideoEffects(targetClipId);
    existingEffects.forEach((effect) => {
      removeVideoEffect(targetClipId, effect.id);
    });

    setAppliedPresetId(null);
    toast.info("Effects Cleared");
  }, [targetClipId, getVideoEffects, removeVideoEffect]);

  if (!targetClipId) {
    return (
      <div className="p-6 text-center">
        <Palette size={32} className="mx-auto mb-2 text-text-muted opacity-60" />
        <p className="text-xs text-text-muted font-medium">
          Select a video clip to apply filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 pb-36">
      <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/30 shadow-sm">
        <Palette size={20} className="text-primary" />
        <div>
          <span className="text-xs font-bold text-text-primary">
            Filter Presets
          </span>
          <p className="text-[10.5px] text-text-muted">One-click cinematic color grades</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] || Palette;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as FilterCategory)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                selectedCategory === category.id
                  ? "bg-primary text-black font-bold"
                  : "bg-background-tertiary text-text-secondary hover:text-text-primary hover:bg-background-elevated"
              }`}
            >
              <Icon size={14} />
              {category.name}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5 overflow-y-auto">
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isApplied={appliedPresetId === preset.id}
            onApply={() => handleApplyPreset(preset)}
          />
        ))}
      </div>

      {appliedPresetId && (
        <div className="space-y-3.5 p-3.5 bg-background-tertiary rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Intensity</span>
            <span className="text-xs font-mono font-bold text-text-primary">
              {intensityValue}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[intensityValue]}
            onValueChange={(value) => setIntensityValue(value[0])}
          />
          <button
            onClick={handleClearEffects}
            className="w-full py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/30"
          >
            Remove All Effects
          </button>
        </div>
      )}

      <p className="text-[10px] text-text-muted text-center font-medium">
        {FILTER_PRESETS.length} presets across {FILTER_CATEGORIES.length}{" "}
        categories
      </p>
    </div>
  );
};

export default FilterPresetsPanel;
