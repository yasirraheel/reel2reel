import type { LucideIcon } from "lucide-react";
import { Move, Palette, Wand2, Volume2, Gauge, Film, Sparkles, Type, Settings } from "lucide-react";

export type InspectorTabId =
  | "transform"
  | "color"
  | "effects"
  | "audio"
  | "speed"
  | "animate"
  | "ai"
  | "style"
  | "properties";

export type InspectorClipType =
  | "video"
  | "image"
  | "audio"
  | "text"
  | "shape"
  | "svg"
  | "sticker";

export interface InspectorTabDef {
  id: InspectorTabId;
  label: string;
  icon: LucideIcon;
}

export const TAB_DEFS: Record<InspectorTabId, InspectorTabDef> = {
  transform: { id: "transform", label: "Transform", icon: Move },
  color: { id: "color", label: "Color", icon: Palette },
  effects: { id: "effects", label: "Effects", icon: Wand2 },
  audio: { id: "audio", label: "Audio", icon: Volume2 },
  speed: { id: "speed", label: "Speed", icon: Gauge },
  animate: { id: "animate", label: "Animate", icon: Film },
  ai: { id: "ai", label: "AI", icon: Sparkles },
  style: { id: "style", label: "Style", icon: Type },
  properties: { id: "properties", label: "Properties", icon: Settings },
};

const TABS_BY_CLIP_TYPE: Record<InspectorClipType, InspectorTabId[]> = {
  video: ["properties", "transform", "color", "effects", "audio", "speed", "animate", "ai"],
  image: ["properties", "transform", "color", "effects", "speed", "animate", "ai"],
  audio: ["properties", "audio", "ai"],
  text: ["properties", "transform", "style", "effects", "animate"],
  shape: ["properties", "transform", "style", "effects", "animate"],
  svg: ["properties", "transform", "style", "effects", "animate"],
  sticker: ["properties", "transform", "effects", "animate"],
};

export function getTabIdsForClipType(
  clipType: InspectorClipType | null,
): InspectorTabId[] {
  if (!clipType) return [];
  return TABS_BY_CLIP_TYPE[clipType];
}

export function getTabsForClipType(
  clipType: InspectorClipType | null,
): InspectorTabDef[] {
  return getTabIdsForClipType(clipType).map((id) => TAB_DEFS[id]);
}
