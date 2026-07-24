import React, { useState, useEffect } from "react";
import { Search, Image as ImageIcon, Plus, Loader2, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import { toast } from "../../../stores/notification-store";

export interface StockPhotoItem {
  photo_id: number;
  title: string;
  description?: string;
  image_url: string;
  image_name?: string;
  category?: string;
  tags?: string;
  keywords?: string;
  is_premium?: string | boolean;
}

const STOCK_API_BASE = "https://stock.cineworm.org/api/public/photos_list";
const STOCK_API_KEY = "com.cineworm.tv";

export const StockPhotosTab: React.FC = () => {
  const [photos, setPhotos] = useState<StockPhotoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const project = useProjectStore((s) => s.project);
  const importMedia = useProjectStore((s) => s.importMedia);

  const fetchStockPhotos = async (query = "", category = "all") => {
    setLoading(true);
    setError(null);
    try {
      let url = `${STOCK_API_BASE}?api_key=${encodeURIComponent(STOCK_API_KEY)}`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }
      if (category && category !== "all") {
        url += `&category=${encodeURIComponent(category)}`;
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
      if (data && Array.isArray(data.PHOTOS_LIST)) {
        setPhotos(data.PHOTOS_LIST);
      } else {
        setPhotos([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch stock photos:", err);
      setError(err?.message || "Could not connect to stock photo library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockPhotos(searchQuery, selectedCategory);
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockPhotos(searchQuery, selectedCategory);
  };

  // Direct In-Memory Import into Reel2Reel (IndexedDB)
  const handleImportToProject = async (item: StockPhotoItem) => {
    const fileName = item.image_name || `${item.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.png`;

    // Duplicate check
    const alreadyExists = project.mediaLibrary.items.some(
      (m) =>
        m.name === fileName ||
        m.name === item.title ||
        (m.metadata && (m.metadata as any).stockPhotoId === item.photo_id)
    );

    if (alreadyExists) {
      setImportedIds((prev) => new Set(prev).add(item.photo_id));
      toast.info("Already in Project", `"${item.title}" is already in your Media library.`);
      return;
    }

    setImportingId(item.photo_id);
    try {
      const res = await fetch(item.image_url);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const blob = await res.blob();
      const mimeType = blob.type || "image/png";

      const file = new File([blob], fileName, { type: mimeType });

      await importMedia(file);

      setImportedIds((prev) => new Set(prev).add(item.photo_id));
      toast.success("Imported Photo", `"${item.title}" is ready in your Media library!`);
    } catch (err: any) {
      console.error("Failed to import stock photo:", err);
      toast.error("Import Failed", `Could not import "${item.title}": ${err?.message || "Network error"}`);
    } finally {
      setImportingId(null);
    }
  };

  // Extract unique categories for dropdown filter
  const categories = Array.from(new Set(photos.map((p) => p.category).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col h-full bg-background-secondary text-text-primary text-xs select-none">
      {/* Ultra-Compact Single Row Header: Search + Category Filter */}
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5 bg-background-tertiary/40 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
          <Search size={12} className="absolute left-2 text-text-muted" />
          <input
            type="text"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-5 py-1 bg-background-tertiary border border-border/80 rounded-md text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                fetchStockPhotos("", selectedCategory);
              }}
              className="absolute right-1.5 text-text-muted hover:text-text-primary text-xs"
            >
              ×
            </button>
          )}
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2 py-1 bg-background-tertiary border border-border/80 rounded-md text-[10.5px] font-medium text-text-secondary focus:outline-none focus:border-primary shrink-0 cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Photo Grid Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-text-muted">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span>Loading stock photos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-center p-3">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-red-400 font-medium text-[11px]">{error}</span>
            <button
              onClick={() => fetchStockPhotos(searchQuery, selectedCategory)}
              className="mt-1 px-2.5 py-1 bg-background-elevated border border-border hover:border-primary rounded-md flex items-center gap-1 text-[11px] text-text-primary transition-all"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-1.5 text-text-muted text-center p-3">
            <ImageIcon size={24} className="opacity-40" />
            <span>No stock photos found</span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  fetchStockPhotos("", "all");
                }}
                className="text-xs text-primary underline mt-0.5"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((item) => {
              const isImporting = importingId === item.photo_id;
              const isImported = importedIds.has(item.photo_id);
              const isPremium = String(item.is_premium) === "true";

              return (
                <div
                  key={item.photo_id}
                  className="group relative rounded-lg border border-border/80 hover:border-primary overflow-hidden bg-background-tertiary/60 flex flex-col transition-all"
                >
                  {/* Thumbnail Image */}
                  <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Premium / Free Badge */}
                    <div className="absolute top-1 right-1 z-10">
                      {isPremium ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-black font-bold text-[8.5px] flex items-center gap-0.5 shadow-sm">
                          <Sparkles size={9} />
                          PRO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/80 text-black font-bold text-[8.5px]">
                          FREE
                        </span>
                      )}
                    </div>

                    {/* Quick Import Hover Button */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 p-2">
                      <button
                        onClick={() => handleImportToProject(item)}
                        disabled={isImporting}
                        className={`w-full py-1.5 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold transition-all shadow-lg ${
                          isImported
                            ? "bg-emerald-500 text-black"
                            : "bg-primary text-black hover:bg-primary/90 active:scale-95"
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Adding</span>
                          </>
                        ) : isImported ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={12} />
                            <span>Import</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Photo Title & Category */}
                  <div className="p-1.5 flex flex-col gap-0.5">
                    <span className="font-semibold text-[10.5px] text-text-primary truncate" title={item.title}>
                      {item.title}
                    </span>
                    {item.category && (
                      <span className="text-[9px] text-text-muted truncate">
                        {item.category}
                      </span>
                    )}
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
