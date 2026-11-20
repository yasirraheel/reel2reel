import React, { useCallback, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { LabeledSlider } from "@openreel/ui";
import { useProjectStore } from "../../../stores/project-store";
import type { VideoEffectType } from "../../../bridges/effects-bridge";

type BasicCorrection = {
  type: Extract<VideoEffectType, "brightness" | "contrast" | "saturation">;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
};

const CONTROLS: BasicCorrection[] = [
  { type: "brightness", label: "Brightness", min: -100, max: 100, defaultValue: 0 },
  { type: "contrast", label: "Contrast", min: 0, max: 200, defaultValue: 100, unit: "%" },
  { type: "saturation", label: "Saturation", min: 0, max: 200, defaultValue: 100, unit: "%" },
];

interface BasicColorCorrectionSectionProps {
  clipId: string;
}

export const BasicColorCorrectionSection: React.FC<BasicColorCorrectionSectionProps> = ({
  clipId,
}) => {
  const { getVideoEffects, addVideoEffect, updateVideoEffect, removeVideoEffect } =
    useProjectStore();
  const modifiedAt = useProjectStore((state) => state.project.modifiedAt);

  const effects = useMemo(
    () => getVideoEffects(clipId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipId, getVideoEffects, modifiedAt],
  );

  const getEffect = useCallback(
    (type: BasicCorrection["type"]) => effects.find((effect) => effect.type === type),
    [effects],
  );

  const toSliderValue = (control: BasicCorrection, value: number) =>
    control.type === "brightness" ? value : value * 100;

  const fromSliderValue = (control: BasicCorrection, value: number) =>
    control.type === "brightness" ? value : value / 100;

  const handleChange = useCallback(
    (control: BasicCorrection, sliderValue: number) => {
      const effect = getEffect(control.type);
      const value = fromSliderValue(control, sliderValue);
      if (effect) {
        updateVideoEffect(clipId, effect.id, { value });
      } else {
        addVideoEffect(clipId, control.type, { value });
      }
    },
    [addVideoEffect, clipId, getEffect, updateVideoEffect],
  );

  const resetControl = useCallback(
    (control: BasicCorrection) => {
      const effect = getEffect(control.type);
      if (effect) removeVideoEffect(clipId, effect.id);
    },
    [clipId, getEffect, removeVideoEffect],
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-text-muted leading-snug">
        Adjust the selected clip&apos;s basic image tone without searching through effects.
      </p>
      {CONTROLS.map((control) => {
        const effect = getEffect(control.type);
        const storedValue = (effect?.params.value as number | undefined) ??
          (control.type === "brightness" ? 0 : 1);
        const sliderValue = toSliderValue(control, storedValue);

        return (
          <div key={control.type} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <LabeledSlider
                label={control.label}
                value={sliderValue}
                onChange={(value) => handleChange(control, value)}
                min={control.min}
                max={control.max}
                unit={control.unit}
                className="flex-1"
              />
              {effect && (
                <button
                  type="button"
                  onClick={() => resetControl(control)}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                  title={`Reset ${control.label}`}
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BasicColorCorrectionSection;
