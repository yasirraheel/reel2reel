import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Eye, Check, Loader2, Plus, Zap, Lock, AlertCircle
} from "lucide-react";
import { Input, ScrollArea } from "@openreel/ui";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { toast } from "../../../stores/notification-store";
import type {
  VideoEffectType,
} from "../../../bridges/effects-bridge";
import type { TransitionType } from "@openreel/core";

export interface StockEffectItem {
  effect_id: number;
  title: string;
  description?: string;
  effect_url: string;
  category?: string;
  license_price?: string;
  is_premium?: string | boolean;
}

const STOCK_EFFECTS_API = "https://stock.cineworm.org/api/public/effects_list?api_key=com.cineworm.tv";

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const sanitizeStockFileBase = (name: string) =>
  name.replace(/[^a-zA-Z0-9_\- .]/g, "").trim() || "stock-effect";

const getExtensionFromName = (name: string): string | null => {
  const cleanName = name.split(/[?#]/)[0];
  const match = cleanName.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : null;
};

const getFilenameFromContentDisposition = (header: string | null): string | null => {
  if (!header) return null;
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
  const asciiMatch = header.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ? asciiMatch[1] : null;
};

const getGoogleDriveFileId = (url: string): string | null => {
  const match = url.match(/(?:id=|file\/d\/|\/d\/)([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
};

const detectMediaTypeFromBytes = async (blob: Blob): Promise<{ extension: string; mimeType: string } | null> => {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mimeType: "image/jpeg" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { extension: "png", mimeType: "image/png" };
  if (ascii(0, 4) === "GIF8") return { extension: "gif", mimeType: "image/gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { extension: "webp", mimeType: "image/webp" };
  if (ascii(0, 4) === "\x1a\x45\xdf\xa3") return { extension: "webm", mimeType: "video/webm" };
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    return brand === "qt  "
      ? { extension: "mov", mimeType: "video/quicktime" }
      : { extension: "mp4", mimeType: "video/mp4" };
  }
  return null;
};

const resolveEffectFileDetails = (
  item: StockEffectItem,
  blob: Blob,
  response: Response,
  detectedType?: { extension: string; mimeType: string } | null,
) => {
  const headerFileName = getFilenameFromContentDisposition(response.headers.get("content-disposition"));
  const urlFileName = decodeURIComponent(item.effect_url.split("/").pop()?.split(/[?#]/)[0] || "");
  const sourceName = headerFileName || urlFileName;
  const sourceExtension = sourceName ? getExtensionFromName(sourceName) : null;
  const blobMime = blob.type && !blob.type.includes("octet-stream") ? blob.type.split(";")[0] : "";
  const mimeType = detectedType?.mimeType || blobMime || (sourceExtension ? MIME_BY_EXTENSION[sourceExtension] : "") || "video/mp4";
  const extension = detectedType?.extension || sourceExtension || EXTENSION_BY_MIME[mimeType] || "mp4";
  const baseName = sourceName && sourceExtension
    ? sourceName.replace(new RegExp(`\\.${sourceExtension}$`, "i"), "")
    : item.title;

  return {
    fileName: `${sanitizeStockFileBase(baseName)}.${extension}`,
    mimeType,
  };
};

// ─── Effect & Transition catalogs ──────────────────────────────────
// Each item ships with a small CSS recipe used to animate the live
// preview thumbnail. The thumbnail itself comes from the user's
// currently-selected clip when available, falling back to a gradient.

type EffectCategory =
  | "Basic"
  | "Color"
  | "Blur"
  | "Creative"
  | "Stylize";

interface EffectDef {
  type: VideoEffectType;
  label: string;
  description: string;
  category: EffectCategory;
  /** Returns a CSS filter / transform / opacity string for the preview
   *  given an animation progress p in [0, 1] (or a paused 0.5 hover state). */
  previewStyle: (p: number) => React.CSSProperties;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const EFFECTS: EffectDef[] = [
  {
    type: "brightness",
    label: "Brightness",
    description: "Lift midtones and highlights",
    category: "Basic",
    previewStyle: (p) => ({ filter: `brightness(${lerp(0.9, 1.6, p)})` }),
  },
  {
    type: "contrast",
    label: "Contrast",
    description: "Punchier shadows and highlights",
    category: "Basic",
    previewStyle: (p) => ({ filter: `contrast(${lerp(0.8, 1.8, p)})` }),
  },
  {
    type: "saturation",
    label: "Saturation",
    description: "Boost or mute color intensity",
    category: "Basic",
    previewStyle: (p) => ({ filter: `saturate(${lerp(0.5, 2.0, p)})` }),
  },
  {
    type: "temperature",
    label: "Temperature",
    description: "Warm / cool color shift",
    category: "Color",
    previewStyle: (p) => ({
      filter: `sepia(${lerp(0, 0.6, p)}) hue-rotate(${lerp(-12, 12, p)}deg)`,
    }),
  },
  {
    type: "tint",
    label: "Tint",
    description: "Magenta / green color shift",
    category: "Color",
    previewStyle: (p) => ({
      filter: `hue-rotate(${lerp(0, 60, p)}deg)`,
    }),
  },
  {
    type: "hue",
    label: "Hue",
    description: "Rotate the color wheel",
    category: "Color",
    previewStyle: (p) => ({
      filter: `hue-rotate(${lerp(0, 360, p)}deg)`,
    }),
  },
  {
    type: "blur",
    label: "Blur",
    description: "Soft gaussian defocus",
    category: "Blur",
    previewStyle: (p) => ({ filter: `blur(${lerp(0, 6, p)}px)` }),
  },
  {
    type: "motion-blur",
    label: "Motion Blur",
    description: "Directional smear",
    category: "Blur",
    previewStyle: (p) => ({
      filter: `blur(${lerp(0, 3, p)}px)`,
      transform: `translateX(${lerp(0, 6, p)}px)`,
    }),
  },
  {
    type: "radial-blur",
    label: "Radial Blur",
    description: "Zoom-style radial motion",
    category: "Blur",
    previewStyle: (p) => ({
      filter: `blur(${lerp(0, 4, p)}px)`,
      transform: `scale(${lerp(1, 1.12, p)})`,
    }),
  },
  {
    type: "sharpen",
    label: "Sharpen",
    description: "Unsharp-mask edge enhance",
    category: "Creative",
    previewStyle: (p) => ({
      filter: `contrast(${lerp(1, 1.4, p)}) brightness(${lerp(1, 1.05, p)})`,
    }),
  },
  {
    type: "vignette",
    label: "Vignette",
    description: "Darkened edges for focus",
    category: "Creative",
    previewStyle: (p) => ({
      boxShadow: `inset 0 0 ${lerp(0, 50, p)}px ${lerp(0, 25, p)}px rgba(0,0,0,0.65)`,
    }),
  },
  {
    type: "grain",
    label: "Film Grain",
    description: "Analog film texture",
    category: "Creative",
    previewStyle: (p) => ({
      filter: `contrast(${lerp(1, 1.1, p)})`,
      opacity: lerp(1, 0.92, p),
    }),
  },
  {
    type: "shadow",
    label: "Drop Shadow",
    description: "Cast a soft shadow",
    category: "Stylize",
    previewStyle: (p) => ({
      filter: `drop-shadow(${lerp(0, 4, p)}px ${lerp(0, 4, p)}px ${lerp(0, 8, p)}px rgba(0,0,0,0.6))`,
    }),
  },
  {
    type: "glow",
    label: "Glow",
    description: "Bright outer halo",
    category: "Stylize",
    previewStyle: (p) => ({
      filter: `brightness(${lerp(1, 1.15, p)}) drop-shadow(0 0 ${lerp(0, 12, p)}px var(--accent))`,
    }),
  },
  {
    type: "chromatic-aberration",
    label: "Chromatic Aberration",
    description: "RGB-channel split offset",
    category: "Stylize",
    previewStyle: (p) => ({
      filter: `hue-rotate(${lerp(0, 6, p)}deg)`,
      textShadow: `${lerp(0, 2, p)}px 0 red, ${lerp(0, -2, p)}px 0 cyan`,
    }),
  },
];

const EFFECT_CATEGORIES: EffectCategory[] = [
  "Basic",
  "Color",
  "Blur",
  "Creative",
  "Stylize",
];

interface TransitionDef {
  type: TransitionType;
  label: string;
  description: string;
  /** Render the preview as two colored panels animated according to
   *  this transition's progress p in [0, 1]. */
  renderPreview: (
    p: number,
    thumbUrl: string | null,
  ) => React.ReactElement;
}

const renderThumb = (
  thumbUrl: string | null,
  style: React.CSSProperties,
  tint: string,
): React.ReactElement => (
  <div className="absolute inset-0 overflow-hidden" style={style}>
    {thumbUrl ? (
      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
    ) : (
      <div
        className="w-full h-full"
        style={{
          background: `linear-gradient(135deg, ${tint}, oklch(0.45 0.12 200))`,
        }}
      />
    )}
  </div>
);

const TRANSITIONS: TransitionDef[] = [
  {
    type: "crossfade",
    label: "Crossfade",
    description: "Smooth opacity blend",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { opacity: 1 - p }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { opacity: p }, "oklch(0.72 0.16 162)")}
      </>
    ),
  },
  {
    type: "dipToBlack",
    label: "Dip to Black",
    description: "Fade through black",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { opacity: p < 0.5 ? 1 - p * 2 : 0 }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { opacity: p >= 0.5 ? (p - 0.5) * 2 : 0 }, "oklch(0.72 0.16 162)")}
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: p < 0.5 ? p * 2 : (1 - p) * 2 }}
        />
      </>
    ),
  },
  {
    type: "dipToWhite",
    label: "Dip to White",
    description: "Fade through white",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { opacity: p < 0.5 ? 1 - p * 2 : 0 }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { opacity: p >= 0.5 ? (p - 0.5) * 2 : 0 }, "oklch(0.72 0.16 162)")}
        <div
          className="absolute inset-0 bg-white pointer-events-none"
          style={{ opacity: p < 0.5 ? p * 2 : (1 - p) * 2 }}
        />
      </>
    ),
  },
  {
    type: "wipe",
    label: "Wipe",
    description: "Hard edge sweeps across",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { clipPath: `inset(0 ${p * 100}% 0 0)` }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` }, "oklch(0.72 0.16 162)")}
      </>
    ),
  },
  {
    type: "slide",
    label: "Slide",
    description: "New clip slides in",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { transform: `translateX(${-p * 100}%)` }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { transform: `translateX(${(1 - p) * 100}%)` }, "oklch(0.72 0.16 162)")}
      </>
    ),
  },
  {
    type: "push",
    label: "Push",
    description: "Outgoing clip is shoved off",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(thumb, { transform: `translateX(${-p * 100}%)` }, "oklch(0.55 0.14 295)")}
        {renderThumb(thumb, { transform: `translateX(${(1 - p) * 100}%)` }, "oklch(0.72 0.16 162)")}
      </>
    ),
  },
  {
    type: "zoom",
    label: "Zoom",
    description: "Scale up and dissolve",
    renderPreview: (p, thumb) => (
      <>
        {renderThumb(
          thumb,
          { transform: `scale(${1 + p * 1.5})`, opacity: 1 - p },
          "oklch(0.55 0.14 295)",
        )}
        {renderThumb(
          thumb,
          { transform: `scale(${1.5 - p * 0.5})`, opacity: p },
          "oklch(0.72 0.16 162)",
        )}
      </>
    ),
  },
];

// ─── Drag payload helpers ──────────────────────────────────────────
export const EFFECT_DRAG_MIME = "application/x-openreel-effect";
export const TRANSITION_DRAG_MIME = "application/x-openreel-transition";

const PREVIEW_CYCLE_MS = 1800;

// ─── Cards ────────────────────────────────────────────────────────

const EffectCard: React.FC<{
  def: EffectDef;
  thumbUrl: string | null;
  onApply: () => void;
}> = ({ def, thumbUrl, onApply }) => {
  const [progress, setProgress] = useState(0);
  const [isHover, setIsHover] = useState(false);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isHover) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(0);
      return;
    }
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - startRef.current) % PREVIEW_CYCLE_MS;
      const t = elapsed / PREVIEW_CYCLE_MS;
      // Ping-pong so the effect intensifies then relaxes
      const eased = t < 0.5 ? t * 2 : (1 - t) * 2;
      setProgress(eased);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isHover]);

  const previewStyle = def.previewStyle(progress);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      const payload = JSON.stringify({ effectType: def.type });
      e.dataTransfer.setData(EFFECT_DRAG_MIME, payload);
      // Fallback for browsers that don't surface custom MIME types
      e.dataTransfer.setData("text/plain", `effect:${def.type}`);
    },
    [def.type],
  );

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={onApply}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title={`Drag onto a clip to apply • double-click to apply to selected clip`}
      className="group relative flex flex-col items-stretch rounded-lg border border-border bg-bg-2 overflow-hidden text-left cursor-grab active:cursor-grabbing hover:border-accent transition-colors"
    >
      <div className="relative aspect-video bg-bg-3 overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={previewStyle}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.14 295), oklch(0.72 0.16 162))",
              ...previewStyle,
            }}
          />
        )}
        <span className="absolute bottom-1 right-1 text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/55 text-white/85 backdrop-blur-sm">
          {def.category}
        </span>
      </div>
      <div className="px-2 py-1.5 border-t border-border">
        <div className="text-[10.5px] font-medium text-fg leading-tight">
          {def.label}
        </div>
        <div className="text-[9.5px] text-fg-muted leading-tight mt-0.5 line-clamp-1">
          {def.description}
        </div>
      </div>
    </button>
  );
};

const TransitionCard: React.FC<{
  def: TransitionDef;
  thumbUrl: string | null;
}> = ({ def, thumbUrl }) => {
  const [progress, setProgress] = useState(0);
  const [isHover, setIsHover] = useState(false);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isHover) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(0);
      return;
    }
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - startRef.current) % PREVIEW_CYCLE_MS;
      setProgress(elapsed / PREVIEW_CYCLE_MS);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isHover]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      const payload = JSON.stringify({ transitionType: def.type });
      e.dataTransfer.setData(TRANSITION_DRAG_MIME, payload);
      e.dataTransfer.setData("text/plain", `transition:${def.type}`);
    },
    [def.type],
  );

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title="Drag onto a clip's edge (or between two clips) to apply"
      className="group relative flex flex-col items-stretch rounded-lg border border-border bg-bg-2 overflow-hidden text-left cursor-grab active:cursor-grabbing hover:border-accent transition-colors"
    >
      <div className="relative aspect-video bg-bg-3 overflow-hidden">
        {def.renderPreview(progress, thumbUrl)}
      </div>
      <div className="px-2 py-1.5 border-t border-border">
        <div className="text-[10.5px] font-medium text-fg leading-tight">
          {def.label}
        </div>
        <div className="text-[9.5px] text-fg-muted leading-tight mt-0.5 line-clamp-1">
          {def.description}
        </div>
      </div>
    </button>
  );
};

// ─── Hook: thumbnail of the user's currently selected clip ────────

/**
 * Resolve the best available thumbnail URL from the user's current
 * selection. Falls back to the first video clip in the project, then
 * the first imported video, otherwise null (cards show gradients).
 */
const useCurrentClipThumbnail = (): string | null => {
  const project = useProjectStore((s) => s.project);
  const getSelectedClipIds = useUIStore((s) => s.getSelectedClipIds);

  return useMemo(() => {
    const selectedIds = getSelectedClipIds();
    const tracks = project.timeline.tracks;
    const mediaItems = project.mediaLibrary.items;

    const findMediaForClipId = (clipId: string): string | null => {
      for (const track of tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          const item = mediaItems.find((m) => m.id === clip.mediaId);
          if (item?.thumbnailUrl) return item.thumbnailUrl;
        }
      }
      return null;
    };

    for (const id of selectedIds) {
      const thumb = findMediaForClipId(id);
      if (thumb) return thumb;
    }

    // Fallback 1: first clip with a thumbnail
    for (const track of tracks) {
      for (const clip of track.clips) {
        const item = mediaItems.find((m) => m.id === clip.mediaId);
        if (item?.thumbnailUrl) return item.thumbnailUrl;
      }
    }

    // Fallback 2: any media item with a thumbnail
    const firstWithThumb = mediaItems.find((m) => m.thumbnailUrl);
    return firstWithThumb?.thumbnailUrl ?? null;
  }, [project, getSelectedClipIds]);
};

// ─── Main panel ───────────────────────────────────────────────────

export const EffectsPanel: React.FC = () => {
  const thumbUrl = useCurrentClipThumbnail();
  const getSelectedClipIds = useUIStore((s) => s.getSelectedClipIds);
  const setSourcePreviewItem = useUIStore((s) => s.setSourcePreviewItem);
  const addVideoEffect = useProjectStore((s) => s.addVideoEffect);
  const project = useProjectStore((s) => s.project);
  const importMedia = useProjectStore((s) => s.importMedia);
  const addClipToNewTrack = useProjectStore((s) => s.addClipToNewTrack);

  const [query, setQuery] = useState("");
  const [stockEffects, setStockEffects] = useState<StockEffectItem[]>([]);
  const [loadingStock, setLoadingStock] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Fetch Stock Effects from Server API
  useEffect(() => {
    let isMounted = true;
    const fetchStockEffects = async () => {
      setLoadingStock(true);
      setStockError(null);
      try {
        const resp = await fetch(STOCK_EFFECTS_API);
        if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
        const data = await resp.json();
        if (data && Array.isArray(data.EFFECTS_LIST)) {
          if (isMounted) setStockEffects(data.EFFECTS_LIST);
        } else {
          if (isMounted) setStockEffects([]);
        }
      } catch (err) {
        console.error("[StockEffects] Failed to fetch:", err);
        if (isMounted) setStockError("Could not load server effects.");
      } finally {
        if (isMounted) setLoadingStock(false);
      }
    };

    fetchStockEffects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter built-in preset effects
  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EFFECTS;
    return EFFECTS.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    );
  }, [query]);

  // Filter stock effects from server
  const filteredStockEffects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockEffects;
    return stockEffects.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
    );
  }, [stockEffects, query]);

  // Filter imported media items in Project Media (Imported first!)
  const importedMediaItems = useMemo(() => {
    const mediaList = project.mediaLibrary.items;
    const q = query.trim().toLowerCase();
    return mediaList.filter((item) => {
      const matchesType = item.type === "video" || item.type === "image";
      if (!matchesType) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });
  }, [project.mediaLibrary.items, query]);

  // Route preview stream to Main Player Canvas!
  const handlePreviewStockEffect = (effect: StockEffectItem) => {
    setSourcePreviewItem({
      id: `stock-effect-${effect.effect_id}`,
      name: effect.title,
      type: "video",
      originalUrl: effect.effect_url,
    });
    toast.info("Playing Preview in Main Player", `"${effect.title}"`);
  };

  // Handle direct in-memory download to project with Google Drive fallback URLs
  const handleImportStockEffect = async (item: StockEffectItem) => {
    const alreadyExists = project.mediaLibrary.items.some(
      (m) => m.name.toLowerCase().includes(item.title.toLowerCase()) || (m.originalUrl && m.originalUrl === item.effect_url)
    );
    if (alreadyExists) {
      toast.info("Already in Project", `"${item.title}" is already in your media library.`);
      return;
    }

    setImportingId(item.effect_id);
    try {
      const fileId = getGoogleDriveFileId(item.effect_url);

      const urlsToTry: string[] = [];
      if (fileId) {
        urlsToTry.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
        urlsToTry.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`);
      }
      urlsToTry.push(item.effect_url);

      let downloadedBlob: Blob | null = null;
      let downloadResponse: Response | null = null;
      for (const url of urlsToTry) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const b = await resp.blob();
            const detectedType = await detectMediaTypeFromBytes(b);
            const isHtml = b.type.includes("html");
            const isKnownMedia = Boolean(detectedType) || b.type.startsWith("video/") || b.type.startsWith("audio/");
            if (b && b.size > 0 && !isHtml && isKnownMedia) {
              downloadedBlob = b;
              downloadResponse = resp;
              break;
            }
          }
        } catch (e) {
          console.warn("[StockEffectImport] Attempt failed for URL:", url, e);
        }
      }

      if (!downloadedBlob || !downloadResponse) {
        throw new Error("Could not download a valid media file from server.");
      }

      const detectedType = await detectMediaTypeFromBytes(downloadedBlob);
      const { fileName, mimeType } = resolveEffectFileDetails(item, downloadedBlob, downloadResponse, detectedType);
      const file = new File([downloadedBlob], fileName, { type: mimeType });
      const res = await importMedia(file);
      if (res.success) {
        toast.success("Effect Imported", `"${item.title}" added to Project Media!`);
      } else {
        toast.error("Import Failed", res.error ? String(res.error) : "Could not save effect.");
      }
    } catch (err) {
      console.error("Effect download error:", err);
      toast.error("Import Error", "Failed to download effect from server. Make sure link is public.");
    } finally {
      setImportingId(null);
    }
  };

  const applyToSelection = useCallback(
    (type: VideoEffectType) => {
      const selectedIds = getSelectedClipIds();
      if (selectedIds.length === 0) {
        toast.warning(
          "No clip selected",
          "Drag the effect onto a clip in the timeline, or select a clip and double-click.",
        );
        return;
      }
      for (const id of selectedIds) {
        addVideoEffect(id, type);
      }
      toast.success(
        "Effect applied",
        `${type} added to ${selectedIds.length} clip${selectedIds.length > 1 ? "s" : ""}`,
      );
    },
    [getSelectedClipIds, addVideoEffect],
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stock effects & presets"
            className="pl-8 h-8 text-[11px] bg-bg-2 border-border"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-3 space-y-4">

          {/* 1. IMPORTED / PROJECT MEDIA EFFECTS (SHOW FIRST) */}
          {importedMediaItems.length > 0 && (
            <section className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[9.5px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                  <Check size={11} />
                  <span>Imported Project Media ({importedMediaItems.length})</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {importedMediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex flex-col items-stretch rounded-lg border border-emerald-500/40 bg-bg-2 overflow-hidden text-left hover:border-emerald-400 transition-all p-1.5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-fg truncate flex-1 pr-1">
                        {item.name}
                      </span>
                      <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                        Added
                      </span>
                    </div>
                    <button
                      onClick={() => addClipToNewTrack(item.id)}
                      className="w-full py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[9.5px] font-semibold transition-colors flex items-center justify-center gap-1 mt-1"
                    >
                      <Plus size={10} />
                      <span>Add to Timeline</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. SERVER STOCK EFFECTS LIBRARY (SHOW SECOND) */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[9.5px] uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                <Zap size={11} />
                <span>Stock Effects Library (Server)</span>
              </div>
              {loadingStock && <Loader2 size={11} className="animate-spin text-primary" />}
            </div>

            {loadingStock && (
              <div className="py-6 flex flex-col items-center justify-center text-fg-muted text-[10.5px]">
                <Loader2 size={16} className="animate-spin text-primary mb-1.5" />
                <span>Fetching stock effects from server...</span>
              </div>
            )}

            {!loadingStock && stockError && (
              <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[10.5px] flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{stockError}</span>
              </div>
            )}

            {!loadingStock && !stockError && filteredStockEffects.length === 0 && (
              <div className="p-3 rounded-lg border border-border/70 bg-bg-2 text-center text-fg-muted text-[10.5px]">
                No server stock effects found.
              </div>
            )}

            {!loadingStock && filteredStockEffects.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {filteredStockEffects.map((effect) => {
                  const isImported = project.mediaLibrary.items.some(
                    (m) => m.name.toLowerCase().includes(effect.title.toLowerCase()) || (m.originalUrl && m.originalUrl === effect.effect_url)
                  );
                  const isPro = effect.is_premium === "true" || effect.is_premium === true;

                  return (
                    <div
                      key={effect.effect_id}
                      className="group relative flex flex-col justify-between rounded-lg border border-border bg-bg-2 overflow-hidden text-left hover:border-primary/80 transition-all p-2 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold text-fg truncate">
                            {effect.title}
                          </div>
                          <div className="text-[9px] text-fg-muted truncate">
                            {effect.category || "General FX"}
                          </div>
                        </div>

                        {isPro ? (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0 flex items-center gap-0.5">
                            <Lock size={8} /> PRO
                          </span>
                        ) : (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                            FREE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 pt-1">
                        {/* Stream Preview Button (Plays directly in Main Player) */}
                        <button
                          onClick={() => handlePreviewStockEffect(effect)}
                          title="Stream preview in Main Player"
                          className="flex-1 py-1 px-1.5 rounded bg-bg-3 hover:bg-border text-fg text-[9.5px] font-medium transition-colors flex items-center justify-center gap-1 border border-border/80"
                        >
                          <Eye size={10} className="text-primary" />
                          <span>Preview</span>
                        </button>

                        {/* Direct Download/Import Button */}
                        <button
                          onClick={() => handleImportStockEffect(effect)}
                          disabled={isImported || importingId === effect.effect_id}
                          title={isImported ? "Already in project media" : "Download & import into project media"}
                          className={`py-1 px-2 rounded text-[9.5px] font-semibold transition-all flex items-center justify-center gap-1 ${
                            isImported
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-primary text-black hover:bg-primary/90"
                          }`}
                        >
                          {importingId === effect.effect_id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : isImported ? (
                            <Check size={10} />
                          ) : (
                            <Plus size={10} />
                          )}
                          <span>{isImported ? "Added" : "Import"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. BUILT-IN COLOR & FILTER PRESETS (SHOW THIRD) */}
          <section className="space-y-1.5 pt-2 border-t border-border/70">
            <div className="text-[9.5px] uppercase tracking-wider text-fg-muted font-bold">
              Built-in Preset Filters
            </div>

            {EFFECT_CATEGORIES.map((cat) => {
              const items = filteredPresets.filter((e) => e.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-fg-muted font-medium">
                    {cat}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((def) => (
                      <EffectCard
                        key={def.type}
                        def={def}
                        thumbUrl={thumbUrl}
                        onApply={() => applyToSelection(def.type)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

        </div>
      </ScrollArea>
    </div>
  );
};

export const TransitionsPanel: React.FC = () => {
  const thumbUrl = useCurrentClipThumbnail();

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRANSITIONS;
    return TRANSITIONS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transitions"
            className="pl-8 h-8 text-[11px] bg-bg-2 border-border"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((def) => (
              <TransitionCard key={def.type} def={def} thumbUrl={thumbUrl} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center text-[10.5px] text-fg-muted py-6">
              No transitions match "{query}".
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
