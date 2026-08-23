import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Eye, Check, Loader2, Plus, Zap, Lock, AlertCircle
} from "lucide-react";
import { Input, ScrollArea } from "@openreel/ui";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { toast } from "../../../stores/notification-store";

import type { TransitionType } from "@openreel/core";
import { getTransitionBridge } from "../../../bridges/transition-bridge";
import { ChunkedDownloader } from "../../../utils/chunked-downloader";

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

// ─── Effect & Transition catalogs ──────────────────────────────────
// Each item ships with a small CSS recipe used to animate the live
// preview thumbnail. The thumbnail itself comes from the user's
// currently-selected clip when available, falling back to a gradient.







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
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      const payload = JSON.stringify({ transitionType: def.type });
      e.dataTransfer.setData(TRANSITION_DRAG_MIME, payload);
      e.dataTransfer.setData("text/plain", `transition:${def.type}`);
    },
    [def.type],
  );

  const handleApplyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const projectStore = useProjectStore.getState();
    const uiStore = useUIStore.getState();
    const selectedIds = uiStore.getSelectedClipIds();
    const tracks = projectStore.project.timeline.tracks;

    let targetClipA: any = null;
    let targetClipB: any = null;

    if (selectedIds.length > 0) {
      for (const track of tracks) {
        const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        const idx = sortedClips.findIndex(c => selectedIds.includes(c.id));
        if (idx !== -1) {
          if (idx < sortedClips.length - 1) {
            targetClipA = sortedClips[idx];
            targetClipB = sortedClips[idx + 1];
            break;
          } else if (idx > 0) {
            targetClipA = sortedClips[idx - 1];
            targetClipB = sortedClips[idx];
            break;
          }
        }
      }
    }

    if (!targetClipA || !targetClipB) {
      for (const track of tracks) {
        if (track.type === "video" || track.type === "image") {
          const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
          for (let i = 0; i < sortedClips.length - 1; i++) {
            const cA = sortedClips[i];
            const cB = sortedClips[i + 1];
            const gap = Math.abs(cB.startTime - (cA.startTime + cA.duration));
            if (gap <= 0.08) {
              targetClipA = cA;
              targetClipB = cB;
              break;
            }
          }
          if (targetClipA) break;
        }
      }
    }

    if (!targetClipA || !targetClipB) {
      toast.info("No Adjacent Clips", "Drag this transition directly onto a clip boundary on the timeline.");
      return;
    }

    const bridge = getTransitionBridge();
    if (!bridge.isInitialized()) bridge.initialize();
    const defaultParams = bridge.getDefaultParams(def.type);
    const result = bridge.createTransition(targetClipA, targetClipB, def.type, 1.0, defaultParams);
    if (result.success && result.transitionId) {
      const trans = bridge.getTransition(result.transitionId);
      if (trans) {
        projectStore.addClipTransition(trans);
        toast.success("Transition Applied", `${def.label} (1.0s) added between clips`);
        return;
      }
    }
    toast.error("Could Not Apply", result.error || "Clips must be adjacent on the same track");
  }, [def.type, def.label]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title="Click 'Apply' or drag onto a clip boundary on the timeline"
      className="group relative flex flex-col items-stretch rounded-lg border border-border bg-bg-2 overflow-hidden text-left cursor-grab active:cursor-grabbing hover:border-primary transition-colors select-none"
    >
      <div className="relative aspect-video bg-bg-3 overflow-hidden">
        {def.renderPreview(progress, thumbUrl)}
        <button
          type="button"
          onClick={handleApplyClick}
          className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-primary hover:bg-primary/90 text-black font-bold text-[9px] rounded shadow-md transition-all flex items-center gap-1 z-10"
          title="Apply to selected clip or nearest adjacent cut"
        >
          <Plus size={9} />
          <span>Apply</span>
        </button>
      </div>
      <div className="px-2 py-1.5 border-t border-border flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium text-fg leading-tight truncate">
            {def.label}
          </div>
          <div className="text-[9.5px] text-fg-muted leading-tight mt-0.5 truncate">
            {def.description}
          </div>
        </div>
      </div>
    </div>
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

export const EffectsPanel: React.FC = () => {
  const sourcePreviewItem = useUIStore((s) => s.sourcePreviewItem);
  const setSourcePreviewItem = useUIStore((s) => s.setSourcePreviewItem);
  const project = useProjectStore((s) => s.project);
  const importMedia = useProjectStore((s) => s.importMedia);
  const addClipToNewTrack = useProjectStore((s) => s.addClipToNewTrack);

  const [query, setQuery] = useState("");
  const [stockEffects, setStockEffects] = useState<StockEffectItem[]>([]);
  const [loadingStock, setLoadingStock] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [importingStates, setImportingStates] = useState<Record<number, { 
    phase: "queued" | "server_downloading" | "server_converting" | "client_downloading" | "ready" | "error"; 
    progress: number; 
    downloader?: any; 
  }>>({});

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
          const convertedEffects = data.EFFECTS_LIST.filter((effect: StockEffectItem) =>
            typeof effect.effect_url === "string" && /\.mp4(?:[?#]|$)/i.test(effect.effect_url),
          );
          if (isMounted) setStockEffects(convertedEffects);
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
  };

  const startClientDownload = (item: StockEffectItem, url: string) => {
    const downloader = new ChunkedDownloader({
      url,
      onProgress: (_bytes, _total, pct) => {
        setImportingStates(prev => ({
          ...prev,
          [item.effect_id]: { ...prev[item.effect_id], phase: "client_downloading", progress: pct }
        }));
      },
      onComplete: async (blob) => {
        const file = new File([blob], `${item.title.replace(/[^a-z0-9]/gi, '_')}.mp4`, { type: "video/mp4" });
        const res = await importMedia(file, {
          originalUrl: item.effect_url || url,
          stockMetadata: { stockEffectId: item.effect_id },
        });
        if (res.success) {
          toast.success("Effect Imported", `"${item.title}" added to Project Media!`);
          setImportingStates(prev => {
            const next = { ...prev };
            delete next[item.effect_id];
            return next;
          });
        } else {
          toast.error("Import Failed", res.error ? String(res.error) : "Could not save effect.");
          setImportingStates(prev => ({
            ...prev,
            [item.effect_id]: { phase: "error", progress: 0 }
          }));
        }
      },
      onError: (_err) => {
        toast.error("Download Error", "Failed to download from server to browser.");
        setImportingStates(prev => ({
          ...prev,
          [item.effect_id]: { phase: "error", progress: 0 }
        }));
      }
    });

    setImportingStates(prev => ({
      ...prev,
      [item.effect_id]: { phase: "client_downloading", progress: 0, downloader }
    }));

    downloader.start();
  };

  const handleImportStockEffect = async (item: StockEffectItem) => {
    const alreadyExists = project.mediaLibrary.items.some(
      (m) => m.name.toLowerCase().includes(item.title.toLowerCase()) || (m.originalUrl && m.originalUrl === item.effect_url)
    );
    if (alreadyExists) {
      toast.info("Already in Project", `"${item.title}" is already in your media library.`);
      return;
    }

    // Since the backend now processes effects via Admin queues,
    // item.effect_url is already the direct MP4 on the server.
    startClientDownload(item, item.effect_url);
  };

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
        <div className="px-3 pb-28 space-y-4">

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
                {importedMediaItems.map((item) => {
                  const isPreviewing = sourcePreviewItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`group relative flex flex-col items-stretch rounded-lg border overflow-hidden text-left transition-all p-1.5 space-y-1 ${
                        isPreviewing
                          ? "border-2 border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                          : "border-emerald-500/40 bg-bg-2 hover:border-emerald-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-semibold truncate flex-1 pr-1 ${isPreviewing ? "text-primary" : "text-fg"}`}>
                          {item.name}
                        </span>
                        {isPreviewing ? (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-primary text-black font-bold shrink-0 flex items-center gap-0.5">
                            <Eye size={8} /> SELECTED
                          </span>
                        ) : (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                            Added
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSourcePreviewItem({ id: item.id, name: item.name, type: item.type, originalUrl: item.originalUrl, blob: item.blob })}
                          title="Preview in Main Player"
                          className={`flex-1 py-1 px-1.5 rounded text-[9.5px] font-medium transition-colors flex items-center justify-center gap-1 border ${
                            isPreviewing
                              ? "bg-primary text-black font-bold border-primary"
                              : "bg-bg-3 hover:bg-border text-fg border-border/80"
                          }`}
                        >
                          <Eye size={10} className={isPreviewing ? "text-black" : "text-primary"} />
                          <span>{isPreviewing ? "Selected" : "Preview"}</span>
                        </button>
                        <button
                          onClick={() => addClipToNewTrack(item.id)}
                          className="py-1 px-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[9.5px] font-semibold transition-colors flex items-center justify-center gap-1 border border-emerald-500/40"
                          title="Add to Timeline"
                        >
                          <Plus size={10} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  const isPreviewing = sourcePreviewItem?.id === `stock-effect-${effect.effect_id}`;

                  return (
                    <div
                      key={effect.effect_id}
                      className={`group relative flex flex-col justify-between rounded-lg border text-left transition-all p-2 space-y-1.5 ${
                        isPreviewing
                          ? "border-2 border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                          : "border-border bg-bg-2 hover:border-primary/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className={`text-[10.5px] font-semibold truncate ${isPreviewing ? "text-primary font-bold" : "text-fg"}`}>
                            {effect.title}
                          </div>
                          <div className="text-[9px] text-fg-muted truncate">
                            {effect.category || "General FX"}
                          </div>
                        </div>

                        {isPreviewing ? (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-primary text-black font-bold shrink-0 flex items-center gap-0.5">
                            <Eye size={8} /> SELECTED
                          </span>
                        ) : isPro ? (
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
                        {/* Stream Preview Button (Loads in Main Player) */}
                        <button
                          onClick={() => handlePreviewStockEffect(effect)}
                          title="Preview in Main Player"
                          className={`flex-1 py-1 px-1.5 rounded text-[9.5px] font-medium transition-colors flex items-center justify-center gap-1 border ${
                            isPreviewing
                              ? "bg-primary text-black font-bold border-primary shadow-sm"
                              : "bg-bg-3 hover:bg-border text-fg border-border/80"
                          }`}
                        >
                          <Eye size={10} className={isPreviewing ? "text-black" : "text-primary"} />
                          <span>{isPreviewing ? "Selected" : "Preview"}</span>
                        </button>

                        {/* Direct Download/Import Button */}
                        <button
                          onClick={() => handleImportStockEffect(effect)}
                          disabled={isImported || !!importingStates[effect.effect_id]}
                          title={isImported ? "Already in project media" : "Download & import into project media"}
                          className={`py-1 px-2 rounded text-[9.5px] font-semibold transition-all flex items-center justify-center gap-1 min-w-[70px] ${
                            isImported
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-primary text-black hover:bg-primary/90"
                          }`}
                        >
                          {importingStates[effect.effect_id] ? (
                            <>
                              <Loader2 size={10} className="animate-spin shrink-0" />
                              <span className="truncate max-w-[80px]">
                                {importingStates[effect.effect_id].phase === "client_downloading" ? `C-DL ${importingStates[effect.effect_id].progress}%` : "Importing..."}
                              </span>
                            </>
                          ) : isImported ? (
                            <>
                              <Check size={10} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus size={10} />
                              <span>Import</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
        <div className="px-3 pb-28">
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
