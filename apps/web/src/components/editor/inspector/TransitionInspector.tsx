import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Plus,
  Minus,
  Clock,
} from "lucide-react";
import {
  getTransitionBridge,
  type TransitionTypeInfo,
} from "../../../bridges/transition-bridge";
import type { Transition, Clip } from "@openreel/core";
import type { TransitionType } from "@openreel/core";
import { toast } from "../../../stores/notification-store";
import { LabeledSlider, Switch } from "@openreel/ui";

const TransitionSlider = LabeledSlider;

/**
 * Direction Selector Component
 */
const DirectionSelector: React.FC<{
  value: string;
  onChange: (direction: string) => void;
  options?: string[];
}> = ({ value, onChange, options = ["left", "right", "up", "down"] }) => {
  const directionIcons: Record<string, React.ReactNode> = {
    left: <ArrowLeft size={14} />,
    right: <ArrowRight size={14} />,
    up: <ArrowUp size={14} />,
    down: <ArrowDown size={14} />,
  };

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-text-secondary">Direction</span>
      <div className="grid grid-cols-4 gap-1">
        {options.map((dir) => (
          <button
            key={dir}
            onClick={() => onChange(dir)}
            className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
              value === dir
                ? "bg-primary/20 border-primary text-primary"
                : "bg-background-tertiary border-border text-text-secondary hover:text-text-primary"
            }`}
            title={dir.charAt(0).toUpperCase() + dir.slice(1)}
          >
            {directionIcons[dir] || dir}
          </button>
        ))}
      </div>
    </div>
  );
};

const Toggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-text-secondary">{label}</span>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
);

/**
 * Transition Preview Animation Component
 */
const TransitionPreview: React.FC<{
  type: TransitionType;
  isPlaying: boolean;
}> = ({ type, isPlaying }) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!isPlaying) {
      setProgress(0);
      return;
    }

    const duration = 1000;
    const startTime = Date.now();
    let animationFrame: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setTimeout(() => setProgress(0), 200);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  const getTransitionStyle = (): {
    clipA: React.CSSProperties;
    clipB: React.CSSProperties;
  } => {
    const p = progress;
    switch (type) {
      case "crossfade":
        return {
          clipA: { opacity: 1 - p },
          clipB: { opacity: p },
        };
      case "wipe":
        return {
          clipA: { clipPath: `inset(0 ${p * 100}% 0 0)` },
          clipB: { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` },
        };
      case "slide":
        return {
          clipA: { transform: `translateX(${-p * 100}%)` },
          clipB: { transform: `translateX(${(1 - p) * 100}%)` },
        };
      case "push":
        return {
          clipA: { transform: `translateX(${-p * 100}%)` },
          clipB: { transform: `translateX(${(1 - p) * 100}%)` },
        };
      case "zoom":
        return {
          clipA: { transform: `scale(${1 + p * 2})`, opacity: 1 - p },
          clipB: { transform: `scale(${2 - p})`, opacity: p },
        };
      case "dipToBlack":
        return {
          clipA: { opacity: p < 0.5 ? 1 - p * 2 : 0 },
          clipB: { opacity: p > 0.5 ? (p - 0.5) * 2 : 0 },
        };
      case "dipToWhite":
        return {
          clipA: { opacity: p < 0.5 ? 1 - p * 2 : 0 },
          clipB: { opacity: p > 0.5 ? (p - 0.5) * 2 : 0 },
        };
      default:
        return { clipA: {}, clipB: {} };
    }
  };

  const styles = getTransitionStyle();
  const dipColor = type === "dipToWhite" ? "bg-white" : "bg-black";

  return (
    <div className="relative w-full h-8 rounded overflow-hidden bg-background-secondary mb-2">
      <div
        className="absolute inset-0 bg-primary/20"
        style={{ ...styles.clipA, transition: "none" }}
      />
      <div
        className="absolute inset-0 bg-green-500/30"
        style={{ ...styles.clipB, transition: "none" }}
      />
      {(type === "dipToBlack" || type === "dipToWhite") && (
        <div
          className={`absolute inset-0 ${dipColor}`}
          style={{
            opacity: progress < 0.5 ? progress * 2 : (1 - progress) * 2,
            transition: "none",
          }}
        />
      )}
    </div>
  );
};

/**
 * Transition Type Card Component with Preview
 */
const TransitionTypeCard: React.FC<{
  typeInfo: TransitionTypeInfo;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ typeInfo, isSelected, onSelect }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`p-3 rounded-lg border transition-all text-left ${
        isSelected
          ? "bg-primary/20 border-primary"
          : "bg-background-tertiary border-border hover:border-text-secondary"
      }`}
    >
      <TransitionPreview
        type={typeInfo.type}
        isPlaying={isHovered || isSelected}
      />
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-[10px] font-medium ${
            isSelected ? "text-primary" : "text-text-primary"
          }`}
        >
          {typeInfo.name}
        </span>
        {isSelected && <Check size={12} className="text-primary" />}
      </div>
      <p className="text-[9px] text-text-muted">{typeInfo.description}</p>
    </button>
  );
};

/**
 * TransitionInspector Props
 */
interface TransitionInspectorProps {
  clipA?: Clip | null;
  clipB?: Clip | null;
  transition?: Transition;
  onTransitionCreate?: (transition: Transition) => void;
  onTransitionUpdate?: (
    transitionId: string,
    updates: Partial<Transition>,
  ) => void;
  onTransitionRemove?: (transitionId: string) => void;
}

/**
 * TransitionInspector Component
 *
 * - 12.1: Display available transition types
 * - 12.2: Apply transition with specified duration
 * - 12.3: Update blend timing when duration is adjusted
 */
export const TransitionInspector: React.FC<TransitionInspectorProps> = ({
  clipA = null,
  clipB = null,
  transition,
  onTransitionCreate,
  onTransitionUpdate,
  onTransitionRemove,
}) => {
  const bridge = getTransitionBridge();
  const transitionTypes = useMemo(
    () => bridge.getAvailableTransitionTypes(),
    [],
  );

  // Local state for creating new transitions
  const [selectedType, setSelectedType] = useState<TransitionType>(
    transition?.type || "crossfade",
  );
  const [duration, setDuration] = useState<number>(transition?.duration || 1.0);
  const [params, setParams] = useState<Record<string, unknown>>(
    transition?.params || bridge.getDefaultParams(selectedType),
  );

  useEffect(() => {
    const nextType = transition?.type || "crossfade";
    setSelectedType(nextType);
    setDuration(transition?.duration || 1.0);
    setParams(transition?.params || bridge.getDefaultParams(nextType));
  }, [bridge, clipA?.id, clipB?.id, transition]);

  // Validate transition
  const validation = useMemo(() => {
    if (!bridge.isInitialized()) {
      bridge.initialize();
    }
    return bridge.validateTransition(clipA, clipB, duration);
  }, [clipA, clipB, duration]);

  // Handle type change
  const handleTypeChange = useCallback(
    (type: TransitionType) => {
      setSelectedType(type);
      const defaultParams = bridge.getDefaultParams(type);
      setParams(defaultParams);

      if (transition) {
        onTransitionUpdate?.(transition.id, { type, params: defaultParams });
      }
    },
    [transition, onTransitionUpdate],
  );

  // Handle duration change
  const handleDurationChange = useCallback(
    (newDuration: number) => {
      const clampedDuration = validation.maxDuration
        ? Math.min(newDuration, validation.maxDuration)
        : newDuration;
      setDuration(clampedDuration);

      if (transition) {
        onTransitionUpdate?.(transition.id, { duration: clampedDuration });
      }
    },
    [transition, validation.maxDuration, onTransitionUpdate],
  );

  // Handle param change
  const handleParamChange = useCallback(
    (key: string, value: unknown) => {
      const newParams = { ...params, [key]: value };
      setParams(newParams);

      if (transition) {
        onTransitionUpdate?.(transition.id, { params: newParams });
      }
    },
    [params, transition, onTransitionUpdate],
  );

  // Handle create transition
  const handleCreate = useCallback(() => {
    const result =
      !clipA && clipB
        ? bridge.createInTransition(clipB, selectedType, duration, params)
        : clipA && !clipB
        ? bridge.createOutTransition(clipA, selectedType, duration, params)
        : bridge.createTransition(
            clipA,
            clipB,
            selectedType,
            duration,
            params,
            "between",
          );

    if (result.success && result.transitionId) {
      const newTransition = bridge.getTransition(result.transitionId);
      if (newTransition) {
        onTransitionCreate?.(newTransition);
        toast.success(
          "Transition Applied",
          `${selectedType} transition added (${duration}s)`,
        );
      }
    } else {
      toast.error(
        "Transition Failed",
        result.error || "Could not apply transition",
      );
    }
  }, [clipA, clipB, selectedType, duration, params, onTransitionCreate]);

  // Handle remove transition
  const handleRemove = useCallback(() => {
    if (transition) {
      bridge.removeTransition(transition.id);
      onTransitionRemove?.(transition.id);
      toast.success("Transition Removed");
    }
  }, [transition, onTransitionRemove]);

  // Render type-specific parameters
  const renderTypeParams = () => {
    switch (selectedType) {
      case "wipe":
        return (
          <>
            <DirectionSelector
              value={(params.direction as string) || "left"}
              onChange={(dir) => handleParamChange("direction", dir)}
              options={["left", "right", "up", "down"]}
            />
            <TransitionSlider
              label="Softness"
              value={((params.softness as number) || 0) * 100}
              onChange={(v) => handleParamChange("softness", v / 100)}
              min={0}
              max={100}
              unit="%"
            />
          </>
        );

      case "slide":
        return (
          <>
            <DirectionSelector
              value={(params.direction as string) || "left"}
              onChange={(dir) => handleParamChange("direction", dir)}
            />
            <Toggle
              label="Push Out"
              value={(params.pushOut as boolean) || false}
              onChange={(v) => handleParamChange("pushOut", v)}
            />
          </>
        );

      case "push":
        return (
          <DirectionSelector
            value={(params.direction as string) || "left"}
            onChange={(dir) => handleParamChange("direction", dir)}
          />
        );

      case "zoom":
        return (
          <TransitionSlider
            label="Scale"
            value={(params.scale as number) || 2}
            onChange={(v) => handleParamChange("scale", v)}
            min={1.1}
            max={4}
            step={0.1}
            unit="x"
          />
        );

      case "dipToBlack":
      case "dipToWhite":
        return (
          <TransitionSlider
            label="Hold Duration"
            value={(params.holdDuration as number) || 0.1}
            onChange={(v) => handleParamChange("holdDuration", v)}
            min={0}
            max={1}
            step={0.05}
            unit="s"
          />
        );

      case "crossfade":
      default:
        return null;
    }
  };

  const selectedTypeInfo = transitionTypes.find((t) => t.type === selectedType);

  return (
    <div className="space-y-4">
      {/* Clip Info */}
      <div className="flex items-center gap-2 p-2 bg-background-tertiary rounded-lg border border-border">
        {clipA && (
          <div className="flex-1 text-center">
            <p className="text-[9px] text-text-muted">From</p>
            <p className="text-[10px] text-text-primary truncate">
              {clipA.id.substring(0, 12)}...
            </p>
          </div>
        )}
        {clipA && clipB && <ArrowRight size={14} className="text-text-muted" />}
        {clipB && (
          <div className="flex-1 text-center">
            <p className="text-[9px] text-text-muted">{clipA ? "To" : "Target Clip"}</p>
            <p className="text-[10px] text-text-primary truncate">
              {clipB.id.substring(0, 12)}...
            </p>
          </div>
        )}
        {!clipB && clipA && (
          <div className="flex-1 text-center">
            <p className="text-[9px] text-text-muted">Target Clip (Out)</p>
            <p className="text-[10px] text-text-primary truncate">
              {clipA.id.substring(0, 12)}...
            </p>
          </div>
        )}
      </div>

      {/* Validation Warning */}
      {validation.warning && (
        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-[10px] text-yellow-500">{validation.warning}</p>
        </div>
      )}

      {/* Transition Type Selector */}
      <div className="space-y-2">
        <span className="text-[10px] text-text-secondary font-medium">
          Transition Type
        </span>
        <div className="grid grid-cols-2 gap-2">
          {transitionTypes.map((typeInfo) => (
            <TransitionTypeCard
              key={typeInfo.type}
              typeInfo={typeInfo}
              isSelected={selectedType === typeInfo.type}
              onSelect={() => handleTypeChange(typeInfo.type)}
            />
          ))}
        </div>
      </div>

      {/* Enhanced Duration Stepper, Numeric Input, Slider & Presets */}
      <div className="space-y-2 p-2.5 bg-background-secondary rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-text-secondary flex items-center gap-1.5">
            <Clock size={12} className="text-primary" />
            Transition Duration
          </span>
          <span className="text-xs font-mono font-bold text-primary">
            {duration.toFixed(1)}s
          </span>
        </div>

        {/* Stepper + Direct Input */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleDurationChange(Math.max(0.1, Math.round((duration - 0.1) * 10) / 10))}
            disabled={duration <= 0.1}
            className="w-8 h-8 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border flex items-center justify-center text-text-primary hover:text-primary transition-all disabled:opacity-40 active:scale-95 shadow-sm shrink-0"
            title="Decrease duration by 0.1s"
          >
            <Minus size={13} />
          </button>

          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max={validation.maxDuration || 10}
              value={duration}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) handleDurationChange(val);
              }}
              className="w-full h-8 text-center text-xs font-mono font-bold bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono pointer-events-none">
              s
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleDurationChange(Math.min(validation.maxDuration || 10, Math.round((duration + 0.1) * 10) / 10))}
            disabled={validation.maxDuration !== undefined && duration >= validation.maxDuration}
            className="w-8 h-8 rounded-lg bg-background-tertiary hover:bg-background-elevated border border-border flex items-center justify-center text-text-primary hover:text-primary transition-all disabled:opacity-40 active:scale-95 shadow-sm shrink-0"
            title="Increase duration by 0.1s"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Duration Slider */}
        <input
          type="range"
          min="0.1"
          max={validation.maxDuration || 5}
          step="0.05"
          value={duration}
          onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-background-tertiary rounded-lg appearance-none cursor-pointer accent-primary mt-1"
        />

        {/* Quick Preset Buttons */}
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          {[0.3, 0.5, 1.0, 1.5, 2.0, 3.0]
            .filter((d) => !validation.maxDuration || d <= validation.maxDuration)
            .map((presetSec) => (
              <button
                key={presetSec}
                type="button"
                onClick={() => handleDurationChange(presetSec)}
                className={`px-2 py-1 rounded-md text-[9.5px] font-mono font-bold transition-all ${
                  Math.abs(duration - presetSec) < 0.05
                    ? "bg-primary text-black shadow-sm"
                    : "bg-background-tertiary text-text-secondary hover:text-text-primary hover:bg-background-elevated border border-border/80"
                }`}
              >
                {presetSec.toFixed(1)}s
              </button>
            ))}
        </div>
      </div>

      {/* Type-specific Parameters */}
      {selectedTypeInfo?.hasCustomParams && (
        <div className="space-y-3 pt-2 border-t border-border">
          <span className="text-[10px] text-text-secondary font-medium">
            Parameters
          </span>
          {renderTypeParams()}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {transition ? (
          <button
            onClick={handleRemove}
            className="flex-1 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
          >
            <X size={12} />
            Remove Transition
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!validation.valid}
            className={`flex-1 py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-1 ${
              validation.valid
                ? "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                : "bg-background-tertiary border border-border text-text-muted cursor-not-allowed"
            }`}
          >
            <Check size={12} />
            Apply Transition
          </button>
        )}
      </div>

      {/* Error Message */}
      {!validation.valid && validation.error && (
        <p className="text-[10px] text-red-400 text-center">
          {validation.error}
        </p>
      )}
    </div>
  );
};

export default TransitionInspector;
