import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  Search,
  X,
  Video,
  Music2,
  Type,
  Palette,
  Wand2,
  Layers,
  Zap,
  Square,
  Move,
  Focus,
  Clock,
  Eye,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shuffle,
  Volume2,
  Mic,
  Box,
} from "lucide-react";
import { Dialog, DialogContent, Input } from "@openreel/ui";
import { useUIStore } from "../../stores/ui-store";

interface SearchItem {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  keywords: string[];
  icon: React.ElementType;
  description: string;
  sectionId: string;
  clipTypes: Array<"video" | "audio" | "text" | "shape" | "image">;
}

const SEARCHABLE_EFFECTS: SearchItem[] = [
  {
    id: "transform",
    name: "Transform",
    category: "video",
    subCategory: "position",
    keywords: ["position", "scale", "rotate", "move", "resize", "transform"],
    icon: Move,
    description: "Position, scale, and rotate the clip",
    sectionId: "transform",
    clipTypes: ["video", "image", "text", "shape"],
  },
  {
    id: "crop",
    name: "Crop",
    category: "video",
    subCategory: "position",
    keywords: ["crop", "cut", "trim", "frame", "aspect"],
    icon: Focus,
    description: "Crop and frame the clip",
    sectionId: "crop",
    clipTypes: ["video", "image"],
  },
  {
    id: "speed",
    name: "Speed Control",
    category: "video",
    subCategory: "time",
    keywords: ["speed", "slow", "fast", "time", "duration", "playback"],
    icon: Clock,
    description: "Control playback speed and time remapping",
    sectionId: "speed",
    clipTypes: ["video", "audio"],
  },
  {
    id: "video-effects",
    name: "Video Effects",
    category: "video",
    subCategory: "effects",
    keywords: [
      "brightness",
      "contrast",
      "saturation",
      "blur",
      "sharpen",
      "vignette",
      "effects",
    ],
    icon: Sliders,
    description: "Brightness, contrast, saturation, blur, sharpen",
    sectionId: "video-effects",
    clipTypes: ["video", "image"],
  },
  {
    id: "color-grading",
    name: "Color Grading",
    category: "video",
    subCategory: "color",
    keywords: [
      "color",
      "grade",
      "wheels",
      "curves",
      "lut",
      "hsl",
      "exposure",
      "temperature",
    ],
    icon: Palette,
    description: "Color wheels, curves, LUTs, and HSL adjustments",
    sectionId: "color-grading",
    clipTypes: ["video", "image"],
  },
  {
    id: "green-screen",
    name: "Green Screen",
    category: "video",
    subCategory: "chroma",
    keywords: ["green", "screen", "chroma", "key", "background", "remove"],
    icon: Eye,
    description: "Chroma key for green/blue screen removal",
    sectionId: "green-screen",
    clipTypes: ["video", "image"],
  },
  {
    id: "background-removal",
    name: "Background Removal",
    category: "ai",
    subCategory: "ai-bg",
    keywords: ["background", "remove", "ai", "mask", "cutout", "person"],
    icon: Wand2,
    description: "AI-powered background removal",
    sectionId: "background-removal",
    clipTypes: ["video", "image"],
  },
  {
    id: "masking",
    name: "Masking",
    category: "video",
    subCategory: "masking",
    keywords: ["mask", "shape", "feather", "reveal", "hide", "vignette"],
    icon: Layers,
    description: "Shape masks to reveal or hide areas",
    sectionId: "masking",
    clipTypes: ["video", "image"],
  },
  {
    id: "motion-tracking",
    name: "Motion Tracking",
    category: "video",
    subCategory: "tracking",
    keywords: ["motion", "track", "follow", "pin", "stabilize"],
    icon: Move,
    description: "Track motion and attach elements",
    sectionId: "motion-tracking",
    clipTypes: ["video"],
  },
  {
    id: "pip",
    name: "Picture-in-Picture",
    category: "video",
    subCategory: "pip",
    keywords: ["pip", "picture", "overlay", "corner", "position"],
    icon: Square,
    description: "Position clips as picture-in-picture overlays",
    sectionId: "pip",
    clipTypes: ["video", "image"],
  },
  {
    id: "blending",
    name: "Blend Mode",
    category: "video",
    subCategory: "blend",
    keywords: ["blend", "mode", "multiply", "screen", "overlay", "opacity"],
    icon: Layers,
    description: "Blend modes and opacity controls",
    sectionId: "blending",
    clipTypes: ["video", "image"],
  },
  {
    id: "transform-3d",
    name: "3D Transform",
    category: "video",
    subCategory: "3d",
    keywords: ["3d", "perspective", "rotate", "flip", "tilt"],
    icon: Move,
    description: "3D rotation and perspective effects",
    sectionId: "transform-3d",
    clipTypes: ["video", "image"],
  },
  {
    id: "keyframes",
    name: "Keyframes",
    category: "animation",
    subCategory: "keyframes",
    keywords: ["keyframe", "animate", "animation", "ease", "interpolate"],
    icon: Zap,
    description: "Animate properties over time",
    sectionId: "keyframes",
    clipTypes: ["video", "image", "text", "shape"],
  },
  {
    id: "transitions",
    name: "Transitions",
    category: "animation",
    subCategory: "transitions",
    keywords: ["transition", "fade", "dissolve", "wipe", "slide"],
    icon: Shuffle,
    description: "Clip-to-clip transitions",
    sectionId: "transitions",
    clipTypes: ["video", "image"],
  },
  {
    id: "motion-presets",
    name: "Motion Presets",
    category: "animation",
    subCategory: "presets",
    keywords: ["motion", "preset", "zoom", "pan", "shake", "bounce"],
    icon: Zap,
    description: "Pre-built motion animations",
    sectionId: "motion-presets",
    clipTypes: ["video", "image"],
  },
  {
    id: "audio-effects",
    name: "Audio Effects",
    category: "audio",
    subCategory: "effects",
    keywords: [
      "audio",
      "eq",
      "equalizer",
      "compressor",
      "reverb",
      "delay",
      "sound",
    ],
    icon: Volume2,
    description: "EQ, compressor, reverb, and sound controls",
    sectionId: "audio-effects",
    clipTypes: ["audio", "video"],
  },
  {
    id: "audio-ducking",
    name: "Audio Ducking",
    category: "audio",
    subCategory: "ducking",
    keywords: ["duck", "ducking", "voice", "music", "fade", "auto"],
    icon: Music2,
    description: "Auto-duck music under voiceover or speech",
    sectionId: "audio-ducking",
    clipTypes: ["audio", "video"],
  },
  {
    id: "stock-music",
    name: "Stock Music & SFX",
    category: "audio",
    subCategory: "stock",
    keywords: ["music", "stock", "sound", "effects", "sfx", "audio"],
    icon: Music2,
    description: "Browse royalty-free stock music and audio clips",
    sectionId: "audios",
    clipTypes: ["audio"],
  },
  {
    id: "voiceover-tts",
    name: "Voiceover & TTS",
    category: "audio",
    subCategory: "tts",
    keywords: ["voice", "speech", "tts", "text to speech", "record", "mic"],
    icon: Mic,
    description: "Record voiceover or generate AI text-to-speech",
    sectionId: "audios",
    clipTypes: ["audio"],
  },
  {
    id: "text-properties",
    name: "Text Properties",
    category: "text",
    subCategory: "styling",
    keywords: ["text", "font", "size", "color", "style", "typography"],
    icon: Type,
    description: "Font, size, color, and text styling",
    sectionId: "text-properties",
    clipTypes: ["text"],
  },
  {
    id: "text-animation",
    name: "Text Animation",
    category: "text",
    subCategory: "animation",
    keywords: ["text", "animate", "typewriter", "fade", "slide", "bounce"],
    icon: Type,
    description: "Animate text with built-in presets",
    sectionId: "text-animation",
    clipTypes: ["text"],
  },
  {
    id: "shape-properties",
    name: "Shape Properties",
    category: "shapes",
    subCategory: "2d",
    keywords: ["shape", "fill", "stroke", "corner", "radius", "shadow"],
    icon: Square,
    description: "Shape fill, stroke, and styling effects",
    sectionId: "shape-properties",
    clipTypes: ["shape"],
  },
  {
    id: "3d-mesh",
    name: "3D Mesh Objects",
    category: "shapes",
    subCategory: "3d-mesh",
    keywords: ["3d", "mesh", "cube", "sphere", "torus", "cylinder", "object"],
    icon: Box,
    description: "Add 3D cubes, spheres, cones, and meshes",
    sectionId: "graphics",
    clipTypes: ["shape"],
  },
  {
    id: "ai-gen",
    name: "AI Media Generator",
    category: "ai",
    subCategory: "ai-gen",
    keywords: ["ai", "generate", "image", "video", "prompt", "create"],
    icon: Sparkles,
    description: "Generate images and clips using AI prompts",
    sectionId: "ai",
    clipTypes: ["video", "image"],
  },
];

interface MainCategory {
  id: string;
  name: string;
  icon?: React.ElementType;
}

const MAIN_CATEGORIES: MainCategory[] = [
  { id: "all", name: "All" },
  { id: "video", name: "Video & Effects", icon: Video },
  { id: "audio", name: "Audio", icon: Music2 },
  { id: "text", name: "Text", icon: Type },
  { id: "animation", name: "Animation", icon: Zap },
  { id: "shapes", name: "Graphics & Shapes", icon: Square },
  { id: "ai", name: "AI Tools", icon: Wand2 },
];

const SUB_CATEGORIES: Record<string, Array<{ id: string; name: string }>> = {
  video: [
    { id: "all", name: "All Video" },
    { id: "effects", name: "Video Effects" },
    { id: "color", name: "Color & LUTs" },
    { id: "chroma", name: "Green Screen" },
    { id: "masking", name: "Masking" },
    { id: "tracking", name: "Motion Tracking" },
    { id: "pip", name: "Picture-in-Picture" },
    { id: "blend", name: "Blend Modes" },
    { id: "3d", name: "3D Transforms" },
    { id: "position", name: "Position & Crop" },
    { id: "time", name: "Speed & Time" },
  ],
  audio: [
    { id: "all", name: "All Audio" },
    { id: "effects", name: "Effects & EQ" },
    { id: "ducking", name: "Audio Ducking" },
    { id: "stock", name: "Stock Music & SFX" },
    { id: "tts", name: "Voiceover & Speech" },
  ],
  text: [
    { id: "all", name: "All Text" },
    { id: "styling", name: "Typography & Style" },
    { id: "animation", name: "Text Animations" },
  ],
  animation: [
    { id: "all", name: "All Animation" },
    { id: "keyframes", name: "Keyframe Motion" },
    { id: "transitions", name: "Transitions" },
    { id: "presets", name: "Motion Presets" },
  ],
  shapes: [
    { id: "all", name: "All Graphics" },
    { id: "2d", name: "2D Shapes" },
    { id: "3d-mesh", name: "3D Mesh Objects" },
  ],
  ai: [
    { id: "all", name: "All AI Tools" },
    { id: "ai-bg", name: "Background Removal" },
    { id: "ai-gen", name: "Asset Generation" },
  ],
};

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const subCatScrollRef = useRef<HTMLDivElement>(null);

  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const { selectedItems, setPanelVisible } = useUIStore();

  const selectedClipType = useMemo(() => {
    const clipItem = selectedItems.find(
      (item) =>
        item.type === "clip" ||
        item.type === "text-clip" ||
        item.type === "shape-clip",
    );
    if (!clipItem) return null;
    if (clipItem.type === "text-clip") return "text";
    if (clipItem.type === "shape-clip") return "shape";
    return "video";
  }, [selectedItems]);

  const updateScrollButtons = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setShowLeftScroll(el.scrollLeft > 5);
    setShowRightScroll(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  const handleScrollCat = (direction: "left" | "right") => {
    const el = catScrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -180 : 180;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const activeSubCategories = useMemo(() => {
    return SUB_CATEGORIES[selectedCategory] || [];
  }, [selectedCategory]);

  const filteredEffects = useMemo(() => {
    let effects = SEARCHABLE_EFFECTS;

    if (selectedClipType) {
      effects = effects.filter((e) =>
        e.clipTypes.includes(
          selectedClipType as "video" | "audio" | "text" | "shape" | "image",
        ),
      );
    }

    if (selectedCategory !== "all") {
      effects = effects.filter((e) => e.category === selectedCategory);
    }

    if (selectedSubCategory !== "all" && selectedCategory !== "all") {
      effects = effects.filter((e) => e.subCategory === selectedSubCategory);
    }

    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(" ");
      effects = effects.filter((e) => {
        const searchText = [
          e.name,
          e.description,
          ...e.keywords,
          e.category,
          e.subCategory ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return searchTerms.every((term) => searchText.includes(term));
      });
    }

    return effects;
  }, [query, selectedCategory, selectedSubCategory, selectedClipType]);

  const handleSelect = useCallback(
    (effect: SearchItem) => {
      setPanelVisible("inspector", true);

      setTimeout(() => {
        const sectionElement = document.querySelector(
          `[data-section-id="${effect.sectionId}"]`,
        );
        if (sectionElement) {
          sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });

          const button = sectionElement.querySelector("button");
          if (button) {
            button.click();
          }

          sectionElement.classList.add(
            "ring-2",
            "ring-primary",
            "ring-offset-2",
          );
          setTimeout(() => {
            sectionElement.classList.remove(
              "ring-2",
              "ring-primary",
              "ring-offset-2",
            );
          }, 2000);
        }
      }, 100);

      onClose();
    },
    [onClose, setPanelVisible],
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory, selectedSubCategory]);

  useEffect(() => {
    updateScrollButtons();
  }, [updateScrollButtons, isOpen, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredEffects.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filteredEffects[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredEffects[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filteredEffects, selectedIndex, handleSelect]);

  useEffect(() => {
    if (listRef.current && filteredEffects[selectedIndex]) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex, filteredEffects]);

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 top-[15vh] translate-y-0 bg-background-secondary border-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background-secondary">
          <Search size={18} className="text-text-muted shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              selectedClipType
                ? `Search effects for ${selectedClipType} clip...`
                : "Search all effects, tools, and categories..."
            }
            className="flex-1 bg-transparent border-0 text-text-primary focus-visible:ring-0 text-sm placeholder:text-text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded hover:bg-background-tertiary text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-background-tertiary border border-border">
            <span className="text-[10px] text-text-muted font-mono">ESC</span>
          </div>
        </div>

        {/* Scrollable Categories Bar */}
        <div className="relative border-b border-border bg-background-tertiary/40">
          {showLeftScroll && (
            <button
              onClick={() => handleScrollCat("left")}
              className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-background-secondary via-background-secondary/90 to-transparent text-text-muted hover:text-text-primary flex items-center justify-center"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div
            ref={catScrollRef}
            onScroll={updateScrollButtons}
            className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none whitespace-nowrap scroll-smooth"
          >
            {MAIN_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSubCategory("all");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    isSelected
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-background-elevated"
                  }`}
                >
                  {Icon && <Icon size={13} className="shrink-0" />}
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {showRightScroll && (
            <button
              onClick={() => handleScrollCat("right")}
              className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-background-secondary via-background-secondary/90 to-transparent text-text-muted hover:text-text-primary flex items-center justify-center"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Dynamic Sub-categories Bar (Revealed when a main category with subcategories is selected) */}
        {activeSubCategories.length > 0 && (
          <div
            ref={subCatScrollRef}
            className="flex items-center gap-1.5 px-4 py-2 border-b border-border/60 bg-background-tertiary/20 overflow-x-auto scrollbar-none whitespace-nowrap"
          >
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mr-1 shrink-0">
              Filter:
            </span>
            {activeSubCategories.map((sub) => {
              const isSubSelected = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(sub.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 ${
                    isSubSelected
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-text-muted hover:text-text-secondary hover:bg-background-tertiary"
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Results List */}
        <div ref={listRef} className="max-h-[48vh] overflow-y-auto">
          {filteredEffects.length === 0 ? (
            <div className="py-12 text-center">
              <Search
                size={32}
                className="mx-auto mb-3 text-text-muted opacity-40"
              />
              <p className="text-sm font-medium text-text-secondary">
                No matching effects or tools found
              </p>
              <p className="text-xs text-text-muted mt-1">
                Try picking a different category tab or clear your search terms
              </p>
              {(selectedCategory !== "all" || selectedSubCategory !== "all") && (
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedSubCategory("all");
                    setQuery("");
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  Reset Category Filters
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredEffects.map((effect, index) => {
                const Icon = effect.icon;
                const isSelected = index === selectedIndex;
                const categoryObj = MAIN_CATEGORIES.find(
                  (c) => c.id === effect.category,
                );

                return (
                  <button
                    key={effect.id}
                    onClick={() => handleSelect(effect)}
                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-all ${
                      isSelected
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-background-tertiary border-l-2 border-transparent"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-background-tertiary text-text-secondary"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isSelected ? "text-primary" : "text-text-primary"
                          }`}
                        >
                          {effect.name}
                        </span>
                        <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-background-tertiary border border-border/50">
                          {categoryObj?.name || effect.category}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {effect.description}
                      </p>
                    </div>
                    <div className="text-[10px] text-text-muted shrink-0">
                      ↵ to select
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="px-4 py-2 border-t border-border bg-background-tertiary/50 flex items-center justify-between">
          <div className="text-[10px] text-text-muted">
            {filteredEffects.length} item
            {filteredEffects.length !== 1 ? "s" : ""} available
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchModal;

