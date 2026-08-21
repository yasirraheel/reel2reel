import React, { useState, useEffect, useRef } from "react";
import { Search, Music, Play, Pause, Plus, Loader2, RefreshCw, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import { toast } from "../../../stores/notification-store";

export interface StockAudioItem {
  audio_id: number;
  title: string;
  description?: string;
  audio_url: string;
  duration?: string | number;
  file_size?: string;
  format?: string;
  genre?: string;
  mood?: string;
  tags?: string;
  is_premium?: string | boolean;
}

const STOCK_API_BASE = "https://stock.cineworm.org/api/v1/audio";
const STOCK_API_KEY = "com.cineworm.tv";

export const StockAudiosTab: React.FC = () => {
  const [audios, setAudios] = useState<StockAudioItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  // Audio preview playback state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const importMedia = useProjectStore((s) => s.importMedia);

  const fetchStockAudios = async (query = "", filter = "all") => {
    setLoading(true);
    setError(null);
    try {
      let url = `${STOCK_API_BASE}?api_key=${encodeURIComponent(STOCK_API_KEY)}`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }
      if (filter && filter !== "all" && filter !== "gdrive" && filter !== "stock") {
        url += `&genre=${encodeURIComponent(filter)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      let list: StockAudioItem[] = [];
      if (data && Array.isArray(data.AUDIOS_LIST)) {
        list = data.AUDIOS_LIST;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }

      // Filter by GDrive or Stock if selected
      if (filter === "gdrive") {
        list = list.filter((item) => item.genre === "GDrive Stock" || item.audio_id >= 10000);
      } else if (filter === "stock") {
        list = list.filter((item) => item.genre !== "GDrive Stock" && item.audio_id < 10000);
      }

      setAudios(list);
    } catch (err: any) {
      console.error("Failed to fetch stock audios:", err);
      setError(err?.message || "Could not connect to stock audio library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockAudios(searchQuery, activeFilter);
  }, [activeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockAudios(searchQuery, activeFilter);
  };

  // Preview Playback Handler
  const togglePlayPreview = (item: StockAudioItem) => {
    if (playingId === item.audio_id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(item.audio_url);
    audioRef.current = newAudio;

    newAudio.ontimeupdate = () => {
      if (newAudio.duration && isFinite(newAudio.duration)) {
        setPreviewProgress((newAudio.currentTime / newAudio.duration) * 100);
      }
    };

    newAudio.onended = () => {
      setPlayingId(null);
      setPreviewProgress(0);
    };

    newAudio.onerror = (e) => {
      console.warn("Preview audio playback error:", e);
      toast.error("Playback Error", `Could not stream audio for ${item.title}`);
      setPlayingId(null);
    };

    const playPromise = newAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        setPlayingId(item.audio_id);
      }).catch((err) => {
        console.warn("Autoplay prevention or user interaction needed:", err);
        setPlayingId(null);
      });
    }
  };

  const project = useProjectStore((s) => s.project);

  // Direct Import into Reel2Reel (IndexedDB)
  const handleImportToProject = async (item: StockAudioItem) => {
    const formatExt = item.format || "mp3";
    const fileName = `${item.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.${formatExt}`;

    const alreadyExists = project.mediaLibrary.items.some(
      (m) =>
        m.name === fileName ||
        m.name === item.title ||
        (m.metadata && (m.metadata as any).stockAudioId === item.audio_id)
    );

    if (alreadyExists) {
      setImportedIds((prev) => new Set(prev).add(item.audio_id));
      toast.info("Already in Project", `"${item.title}" is already in your Media library.`);
      return;
    }

    setImportingId(item.audio_id);
    try {
      const res = await fetch(item.audio_url);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const blob = await res.blob();
      const mimeType = blob.type || (formatExt === "wav" ? "audio/wav" : "audio/mpeg");

      const file = new File([blob], fileName, { type: mimeType });

      await importMedia(file);

      setImportedIds((prev) => new Set(prev).add(item.audio_id));
      toast.success("Imported to Project", `"${item.title}" is ready in your Media library!`);
    } catch (err: any) {
      console.error("Failed to import stock audio:", err);
      toast.error("Import Failed", `Could not import "${item.title}": ${err?.message || "Network error"}`);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-secondary text-text-primary text-xs select-none">
      {/* Search Input Bar */}
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5 bg-background-tertiary/40 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
          <Search size={12} className="absolute left-2 text-text-muted" />
          <input
            type="text"
            placeholder="Search audio library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-5 py-1 bg-background-tertiary border border-border/80 rounded-md text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                fetchStockAudios("", activeFilter);
              }}
              className="absolute right-1.5 text-text-muted hover:text-text-primary text-xs"
            >
              ×
            </button>
          )}
        </form>
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
          All Audio
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
        <button
          onClick={() => setActiveFilter("stock")}
          className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-all ${
            activeFilter === "stock"
              ? "bg-primary text-black font-semibold shadow-sm"
              : "text-text-muted hover:text-text-primary bg-background-elevated/50 hover:bg-background-elevated"
          }`}
        >
          Stock Music & SFX
        </button>
        <button
          onClick={() => setActiveFilter("Cinematic")}
          className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-all ${
            activeFilter === "Cinematic"
              ? "bg-primary text-black font-semibold shadow-sm"
              : "text-text-muted hover:text-text-primary bg-background-elevated/50 hover:bg-background-elevated"
          }`}
        >
          Cinematic
        </button>
      </div>

      {/* Audio List Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-text-muted">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span>Loading audio library...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-center p-3">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-red-400 font-medium text-[11px]">{error}</span>
            <button
              onClick={() => fetchStockAudios(searchQuery, activeFilter)}
              className="mt-1 px-2.5 py-1 bg-background-elevated border border-border hover:border-primary rounded-md flex items-center gap-1 text-[11px] text-text-primary transition-all"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        ) : audios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-text-muted text-center p-3">
            <Music size={24} className="opacity-40" />
            <span>No audio tracks found</span>
            {(searchQuery || activeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                  fetchStockAudios("", "all");
                }}
                className="text-xs text-primary underline mt-0.5"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          audios.map((item) => {
            const isPlaying = playingId === item.audio_id;
            const isImporting = importingId === item.audio_id;
            const isImported = importedIds.has(item.audio_id);
            const isGDrive = item.genre === "GDrive Stock" || item.audio_id >= 10000;

            return (
              <div
                key={item.audio_id}
                className={`group relative p-1.5 rounded-md border transition-all flex items-center gap-2 ${
                  isPlaying
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-background-tertiary/60 hover:bg-background-tertiary border-border/80 hover:border-border"
                }`}
              >
                {/* Play/Pause Preview Button */}
                <button
                  onClick={() => togglePlayPreview(item)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                    isPlaying
                      ? "bg-primary text-black shadow-md shadow-primary/30"
                      : "bg-background-elevated border border-border group-hover:border-primary/50 text-text-primary hover:text-primary"
                  }`}
                  title={isPlaying ? "Pause Preview" : "Preview Audio Track"}
                >
                  {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[11px] text-text-primary truncate" title={item.title}>
                      {item.title}
                    </span>
                    <span
                      className={`px-1 py-0.1 border rounded text-[8.5px] shrink-0 font-medium ${
                        isGDrive
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "bg-background-elevated border-border/60 text-text-muted"
                      }`}
                    >
                      {item.genre || (isGDrive ? "GDrive Stock" : "Stock Audio")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9.5px] text-text-muted">
                    {item.duration && <span>{item.duration}</span>}
                    {item.file_size && <span>• {item.file_size}</span>}
                  </div>

                  {/* Playback progress bar for preview */}
                  {isPlaying && (
                    <div className="w-full bg-background-elevated h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-primary h-full transition-all duration-100"
                        style={{ width: `${previewProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Import directly to Reel2Reel button */}
                <button
                  onClick={() => handleImportToProject(item)}
                  disabled={isImporting}
                  className={`px-2 py-1 rounded flex items-center gap-1 text-[10.5px] font-semibold shrink-0 transition-all ${
                    isImported
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-primary text-black hover:bg-primary/90 shadow-sm hover:shadow active:scale-95"
                  }`}
                  title="Import directly into Media Library"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      <span>Adding</span>
                    </>
                  ) : isImported ? (
                    <>
                      <CheckCircle2 size={11} />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus size={11} />
                      <span>Import</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
