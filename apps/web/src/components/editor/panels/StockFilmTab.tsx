import React, { useState, useEffect, useRef } from "react";
import { Search, Video, Play, Pause, Plus, Loader2, RefreshCw, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import { toast } from "../../../stores/notification-store";

export interface StockFilmItem {
  id: number;
  video_id: number;
  title: string;
  description?: string;
  video_url: string;
  stream_url: string;
  preview_url: string;
  duration?: string | number;
  file_size?: string;
  format?: string;
  category?: string;
  is_premium?: boolean;
}

const STOCK_FILM_API_BASE = "https://stock.cineworm.org/api/v1/film-stock";

export const StockFilmTab: React.FC = () => {
  const [videos, setVideos] = useState<StockFilmItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  // Video preview playback state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  const project = useProjectStore((s) => s.project);
  const importMedia = useProjectStore((s) => s.importMedia);

  const fetchStockVideos = async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      let url = STOCK_FILM_API_BASE;
      if (query) {
        url += `?search=${encodeURIComponent(query)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      let list: StockFilmItem[] = [];
      if (data && Array.isArray(data.FILM_STOCK_LIST)) {
        list = data.FILM_STOCK_LIST;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }

      setVideos(list);
    } catch (err: any) {
      console.error("Failed to fetch film stock videos:", err);
      setError(err?.message || "Could not connect to Film Stock library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockVideos(searchQuery);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockVideos(searchQuery);
  };

  const toggleVideoPreview = (id: number) => {
    const vidEl = videoRefs.current[id];
    if (!vidEl) return;

    if (playingId === id) {
      vidEl.pause();
      setPlayingId(null);
    } else {
      if (playingId !== null && videoRefs.current[playingId]) {
        videoRefs.current[playingId]?.pause();
      }
      vidEl.play().catch(() => {});
      setPlayingId(id);
    }
  };

  // Download video file & import directly into Project Media Library
  const handleImportToProject = async (item: StockFilmItem) => {
    const formatExt = item.format || "mp4";
    const fileName = `${item.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.${formatExt}`;

    const alreadyExists = project.mediaLibrary.items.some(
      (m) =>
        m.name === fileName ||
        m.name === item.title ||
        (m.metadata && (m.metadata as any).stockFilmId === item.id)
    );

    if (alreadyExists) {
      setImportedIds((prev) => new Set(prev).add(item.id));
      toast.info("Already in Project", `"${item.title}" is already in your Media library.`);
      return;
    }

    setImportingId(item.id);
    try {
      const res = await fetch(item.stream_url || item.video_url);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const blob = await res.blob();
      const mimeType = blob.type || (formatExt === "mov" ? "video/quicktime" : "video/mp4");
      const file = new File([blob], fileName, { type: mimeType });

      const result = await importMedia(file, {
        originalUrl: item.stream_url || item.video_url,
        stockMetadata: { stockFilmId: item.id },
      });
      if (!result.success) {
        const errorMsg = typeof result.error === "string" ? result.error : result.error?.message || "Failed to decode video file";
        throw new Error(errorMsg);
      }

      setImportedIds((prev) => new Set(prev).add(item.id));
      toast.success("Imported to Project", `"${item.title}" is ready in your Media library!`);
    } catch (err: any) {
      console.error("Failed to import film stock video:", err);
      toast.error("Import Failed", `Could not import "${item.title}": ${err?.message || "Network error"}`);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-text-primary text-xs font-sans pb-28">
      {/* Search Input Bar */}
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5 bg-background-tertiary/40 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
          <Search size={12} className="absolute left-2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search film stock clips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-5 py-1 bg-background-tertiary border border-border/80 rounded-md text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                fetchStockVideos("");
              }}
              className="absolute right-1.5 text-text-muted hover:text-text-primary text-xs"
            >
              ×
            </button>
          )}
        </form>
        <button
          onClick={() => fetchStockVideos(searchQuery)}
          className="p-1 rounded bg-background-tertiary hover:bg-background-elevated border border-border/80 text-text-muted hover:text-text-primary transition-colors"
          title="Refresh library"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter Category Pills Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/60 bg-background-tertiary/20 overflow-x-auto scrollbar-none whitespace-nowrap shrink-0">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-all ${
            activeFilter === "all"
              ? "bg-primary text-black font-semibold shadow-sm"
              : "text-text-muted hover:text-text-primary bg-background-elevated/50 hover:bg-background-elevated"
          }`}
        >
          All Clips
        </button>
        <button
          onClick={() => setActiveFilter("gdrive")}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-all ${
            activeFilter === "gdrive"
              ? "bg-primary text-black font-semibold shadow-sm"
              : "text-text-muted hover:text-text-primary bg-background-elevated/50 hover:bg-background-elevated"
          }`}
        >
          <HardDrive size={10} />
          <span>GDrive Stock</span>
        </button>
      </div>

      {/* Film Stock Video Grid Content */}
      <div className="flex-1 overflow-y-auto p-2 pb-36">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-text-muted">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span>Loading Film Stock library...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-center p-3">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-red-400 font-medium text-xs">Connection Error</span>
            <span className="text-text-muted text-[10px] max-w-[200px]">{error}</span>
            <button
              onClick={() => fetchStockVideos(searchQuery)}
              className="px-2 py-1 mt-1 bg-background-elevated border border-border/80 hover:border-primary/50 text-text-primary rounded text-[10px] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-text-muted text-center p-3">
            <Video size={24} className="opacity-40" />
            <span>No Film Stock video clips found</span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  fetchStockVideos("");
                }}
                className="text-xs text-primary underline mt-0.5"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {videos.map((item) => {
              const isPlaying = playingId === item.id;
              const isImporting = importingId === item.id;
              const isImported = importedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-lg border transition-all flex flex-col justify-between overflow-hidden ${
                    isPlaying
                      ? "bg-primary/10 border-primary/50 shadow-sm"
                      : "bg-background-tertiary/60 hover:bg-background-tertiary border-border/80 hover:border-primary/40"
                  }`}
                >
                  {/* Video Thumbnail Canvas */}
                  <div className="relative aspect-video bg-black/80 overflow-hidden flex items-center justify-center">
                    <video
                      ref={(el) => { videoRefs.current[item.id] = el; }}
                      src={item.stream_url}
                      preload="metadata"
                      onEnded={() => setPlayingId(null)}
                      className="w-full h-full object-cover"
                    />

                    {/* Play/Pause Preview Overlay Button */}
                    <button
                      onClick={() => toggleVideoPreview(item.id)}
                      className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors"
                      title={isPlaying ? "Pause Preview" : "Preview Video"}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
                          isPlaying
                            ? "bg-primary text-black shadow-primary/30"
                            : "bg-background-elevated/90 border border-border text-text-primary hover:text-primary"
                        }`}
                      >
                        {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                      </div>
                    </button>

                    <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 border border-white/10 rounded text-[8px] text-white font-mono">
                      {item.format?.toUpperCase() || "MP4"}
                    </span>
                  </div>

                  {/* Video Info Details */}
                  <div className="p-2 space-y-1">
                    <span className="font-semibold text-[11px] text-text-primary truncate block" title={item.title}>
                      {item.title}
                    </span>

                    <div className="flex items-center justify-between text-[9.5px] text-text-muted">
                      <span>{item.file_size || "GDrive"}</span>
                      <span className="px-1 py-0.2 rounded text-[8.5px] font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400">
                        GDrive
                      </span>
                    </div>

                    {/* Download & Import to Media Library Button */}
                    <button
                      onClick={() => handleImportToProject(item)}
                      disabled={isImporting}
                      className={`w-full mt-1.5 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                        isImported
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-primary hover:bg-primary/90 text-black shadow-sm active:scale-98"
                      }`}
                      title="Download & Import into Media Library"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : isImported ? (
                        <>
                          <CheckCircle2 size={11} />
                          <span>Added to Media</span>
                        </>
                      ) : (
                        <>
                          <Plus size={11} strokeWidth={2.5} />
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
      </div>
    </div>
  );
};
