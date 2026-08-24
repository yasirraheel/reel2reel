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
      // Using a CORS proxy to bypass client-side fetch restrictions on third-party image URLs
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.image_url)}`;
      const res = await fetch(corsProxyUrl);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const blob = await res.blob();
      const mimeType = blob.type || "image/png";

      const file = new File([blob], fileName, { type: mimeType });

      await importMedia(file, {
        originalUrl: item.image_url,
        stockMetadata: { stockPhotoId: item.photo_id },
      });

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
      {/* Search & Category Filter Bar */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-background-tertiary/40 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
          <Search size={15} className="absolute left-3 text-text-muted" />
          <input
            type="text"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-7 bg-background-tertiary border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                fetchStockPhotos("", selectedCategory);
              }}
              className="absolute right-2.5 text-text-muted hover:text-text-primary text-sm font-bold"
            >
              ×
            </button>
          )}
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-9 px-3 bg-background-tertiary border border-border rounded-lg text-xs font-semibold text-text-primary focus:outline-none focus:border-primary shrink-0 cursor-pointer shadow-sm"
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
      <div className="flex-1 overflow-y-auto p-3 pb-36">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2.5 text-text-muted">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-medium">Loading stock photos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center p-4">
            <AlertCircle size={24} className="text-red-400" />
            <span className="text-red-400 font-bold text-xs">{error}</span>
            <button
              onClick={() => fetchStockPhotos(searchQuery, selectedCategory)}
              className="mt-1.5 px-3 py-1.5 bg-background-elevated border border-border hover:border-primary rounded-lg flex items-center gap-1.5 text-xs text-text-primary font-semibold transition-all shadow-sm"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-muted text-center p-4">
            <ImageIcon size={32} className="opacity-40" />
            <span className="text-xs font-medium">No stock photos found</span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  fetchStockPhotos("", "all");
                }}
                className="text-xs font-semibold text-primary underline mt-1"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((item) => {
              const isImporting = importingId === item.photo_id;
              const isImported = importedIds.has(item.photo_id);
              const isPremium = String(item.is_premium) === "true";

              return (
                <div
                  key={item.photo_id}
                  className="group relative rounded-xl border-2 border-border hover:border-primary overflow-hidden bg-background-tertiary/60 flex flex-col transition-all shadow-sm"
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
                    <div className="absolute top-1.5 right-1.5 z-10">
                      {isPremium ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-black font-extrabold text-[9px] flex items-center gap-1 shadow-sm">
                          <Sparkles size={10} />
                          PRO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-black font-extrabold text-[9px] shadow-sm">
                          FREE
                        </span>
                      )}
                    </div>

                    {/* Quick Import Hover Button */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 p-3 backdrop-blur-xs">
                      <button
                        onClick={() => handleImportToProject(item)}
                        disabled={isImporting}
                        className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-lg ${
                          isImported
                            ? "bg-emerald-500 text-black"
                            : "bg-primary text-black hover:bg-primary/90 active:scale-95"
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Adding</span>
                          </>
                        ) : isImported ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} strokeWidth={2.5} />
                            <span>Import</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Photo Title & Category */}
                  <div className="p-2 flex flex-col gap-0.5">
                    <span className="font-bold text-xs text-text-primary truncate" title={item.title}>
                      {item.title}
                    </span>
                    {item.category && (
                      <span className="text-[10.5px] text-text-muted truncate">
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
