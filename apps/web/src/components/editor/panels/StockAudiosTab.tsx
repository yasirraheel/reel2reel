import React, { useState, useEffect, useRef } from "react";
import { Search, Music, Play, Pause, Plus, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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

const STOCK_API_BASE = "https://stock.cineworm.org/api/public/audios_list";
const STOCK_API_KEY = "com.cineworm.tv";

export const StockAudiosTab: React.FC = () => {
  const [audios, setAudios] = useState<StockAudioItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  // Audio preview playback state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const importMedia = useProjectStore((s) => s.importMedia);

  const fetchStockAudios = async (query = "", genre = "all") => {
    setLoading(true);
    setError(null);
    try {
      let url = `${STOCK_API_BASE}?api_key=${encodeURIComponent(STOCK_API_KEY)}`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }
      if (genre && genre !== "all") {
        url += `&genre=${encodeURIComponent(genre)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-KEY": STOCK_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.AUDIOS_LIST)) {
        setAudios(data.AUDIOS_LIST);
      } else {
        setAudios([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch stock audios:", err);
      setError(err?.message || "Could not connect to stock audio library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockAudios(searchQuery, selectedGenre);
  }, [selectedGenre]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockAudios(searchQuery, selectedGenre);
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
      if (newAudio.duration) {
        setPreviewProgress((newAudio.currentTime / newAudio.duration) * 100);
      }
    };

    newAudio.onended = () => {
      setPlayingId(null);
      setPreviewProgress(0);
    };

    newAudio.onerror = () => {
      toast.error("Playback Failed", `Could not play preview for ${item.title}`);
      setPlayingId(null);
    };

    newAudio.play().then(() => {
      setPlayingId(item.audio_id);
    }).catch(() => {
      toast.error("Playback Blocked", "Click to interact before playing audio.");
      setPlayingId(null);
    });
  };

  // Direct Import into Reel2Reel (IndexedDB)
  const handleImportToProject = async (item: StockAudioItem) => {
    setImportingId(item.audio_id);
    try {
      const res = await fetch(item.audio_url);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const blob = await res.blob();
      const formatExt = item.format || "mp3";
      const fileName = `${item.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.${formatExt}`;
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

  // Extract unique genres for filter buttons
  const genres = Array.from(new Set(audios.map((a) => a.genre).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col h-full bg-background-secondary text-text-primary text-xs select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-border flex flex-col gap-2 bg-background-tertiary/40">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search stock audios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-background-tertiary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                fetchStockAudios("", selectedGenre);
              }}
              className="absolute right-2 text-text-muted hover:text-text-primary"
            >
              ×
            </button>
          )}
        </form>

        {/* Genre Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedGenre("all")}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
              selectedGenre === "all"
                ? "bg-primary text-black"
                : "bg-background-elevated hover:bg-background-tertiary text-text-secondary border border-border"
            }`}
          >
            All Tracks
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                selectedGenre === genre
                  ? "bg-primary text-black"
                  : "bg-background-elevated hover:bg-background-tertiary text-text-secondary border border-border"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Audio List Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span>Loading stock audio library...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center p-4">
            <AlertCircle size={24} className="text-red-400" />
            <span className="text-red-400 font-medium">{error}</span>
            <button
              onClick={() => fetchStockAudios(searchQuery, selectedGenre)}
              className="mt-2 px-3 py-1.5 bg-background-elevated border border-border hover:border-primary rounded-md flex items-center gap-1.5 text-xs text-text-primary transition-all"
            >
              <RefreshCw size={12} />
              Retry Connection
            </button>
          </div>
        ) : audios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted text-center p-4">
            <Music size={32} className="opacity-40" />
            <span>No stock audio tracks found</span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedGenre("all");
                  fetchStockAudios("", "all");
                }}
                className="text-xs text-primary underline mt-1"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          audios.map((item) => {
            const isPlaying = playingId === item.audio_id;
            const isImporting = importingId === item.audio_id;
            const isImported = importedIds.has(item.audio_id);

            return (
              <div
                key={item.audio_id}
                className={`group relative p-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                  isPlaying
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-background-tertiary/60 hover:bg-background-tertiary border-border/80 hover:border-border"
                }`}
              >
                {/* Play/Pause Preview Button */}
                <button
                  onClick={() => togglePlayPreview(item)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                    isPlaying
                      ? "bg-primary text-black shadow-md shadow-primary/30"
                      : "bg-background-elevated border border-border group-hover:border-primary/50 text-text-primary hover:text-primary"
                  }`}
                  title={isPlaying ? "Pause Preview" : "Preview Audio Track"}
                >
                  {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-text-primary truncate" title={item.title}>
                      {item.title}
                    </span>
                    {item.genre && (
                      <span className="px-1.5 py-0.2 bg-background-elevated border border-border/60 rounded text-[9px] text-text-muted shrink-0">
                        {item.genre}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                    {item.duration && <span>{item.duration}</span>}
                    {item.file_size && <span>• {item.file_size}</span>}
                    {item.format && <span className="uppercase text-[9px] font-mono">{item.format}</span>}
                  </div>

                  {/* Playback progress bar for preview */}
                  {isPlaying && (
                    <div className="w-full bg-background-elevated h-1 rounded-full overflow-hidden mt-1.5">
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
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-all ${
                    isImported
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-primary text-black hover:bg-primary/90 shadow-sm hover:shadow active:scale-95"
                  }`}
                  title="Download directly into Reel2Reel Media Library"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : isImported ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
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
