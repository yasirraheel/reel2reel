import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  Search,
  Star,
  ChevronDown,
  Loader2,
  User,
  Settings,
  Filter,
  Globe,
  Sparkles,
} from "lucide-react";
import type { TtsProvider } from "../../../stores/settings-store";
import { useSettingsStore } from "../../../stores/settings-store";
import type { ElevenLabsVoice } from "./tts-types";
import { PIPER_VOICES } from "./tts-constants";

interface VoiceBrowserProps {
  provider: TtsProvider;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  allVoices: ElevenLabsVoice[];
  isLoadingVoices: boolean;
}

export const VoiceBrowser: React.FC<VoiceBrowserProps> = ({
  provider,
  selectedVoice,
  onSelectVoice,
  allVoices,
  isLoadingVoices,
}) => {
  const {
    favoriteVoices,
    addFavoriteVoice,
    removeFavoriteVoice,
    openSettings,
  } = useSettingsStore();

  const [voiceSearch, setVoiceSearch] = useState("");
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Piper voice filter state
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [accentFilter, setAccentFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("all");
  const [toneFilter, setToneFilter] = useState<string>("all");

  const isFavoriteVoice = useCallback(
    (voiceId: string) => favoriteVoices.some((v) => v.voiceId === voiceId),
    [favoriteVoices],
  );

  const toggleFavoriteVoice = useCallback(
    (voice: ElevenLabsVoice) => {
      if (isFavoriteVoice(voice.voice_id)) {
        removeFavoriteVoice(voice.voice_id);
      } else {
        addFavoriteVoice({
          voiceId: voice.voice_id,
          name: voice.name,
          previewUrl: voice.preview_url,
        });
      }
    },
    [isFavoriteVoice, addFavoriteVoice, removeFavoriteVoice],
  );

  const previewVoice = useCallback((previewUrl?: string, voiceId?: string) => {
    if (!previewUrl) return;

    if (previewAudioRef.current && previewingVoice === voiceId) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingVoice(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewingVoice(voiceId ?? null);

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    previewAudioRef.current = audio;

    audio.onended = () => {
      previewAudioRef.current = null;
      setPreviewingVoice(null);
    };
    audio.onerror = () => {
      previewAudioRef.current = null;
      setPreviewingVoice(null);
    };

    audio.src = previewUrl;
    audio.play().catch(() => {
      previewAudioRef.current = null;
      setPreviewingVoice(null);
    });
  }, [previewingVoice]);

  // Filter Piper Voices by profile metadata
  const filteredPiperVoices = useMemo(() => {
    return PIPER_VOICES.filter((v) => {
      if (genderFilter !== "all" && v.gender !== genderFilter) return false;
      if (accentFilter !== "all" && v.accent !== accentFilter) return false;
      if (ageFilter !== "all" && v.age !== ageFilter) return false;
      if (toneFilter !== "all" && v.tone !== toneFilter) return false;

      if (voiceSearch.trim()) {
        const q = voiceSearch.toLowerCase();
        const matchesName = v.name.toLowerCase().includes(q);
        const matchesAccent = (v.accent || "").toLowerCase().includes(q);
        const matchesTone = (v.tone || "").toLowerCase().includes(q);
        const matchesAge = (v.age || "").toLowerCase().includes(q);
        return matchesName || matchesAccent || matchesTone || matchesAge;
      }
      return true;
    });
  }, [genderFilter, accentFilter, ageFilter, toneFilter, voiceSearch]);

  const filteredVoices = useMemo(() => {
    return allVoices.filter((v) => {
      if (!voiceSearch.trim()) return true;
      const q = voiceSearch.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        Object.values(v.labels || {}).some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [allVoices, voiceSearch]);

  if (provider === "piper") {
    return (
      <div className="space-y-2.5 bg-background-tertiary/40 p-2.5 rounded-xl border border-border/80">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5">
            <User size={13} className="text-primary" />
            <span>Select VPS Neural Voice</span>
          </label>
          <span className="text-[9.5px] text-text-muted bg-primary/10 border border-primary/30 px-1.5 py-0.2 rounded font-medium">
            {filteredPiperVoices.length} available
          </span>
        </div>

        {/* Search input for Piper voices */}
        <div className="relative flex items-center">
          <Search size={11} className="absolute left-2 text-text-muted" />
          <input
            type="text"
            placeholder="Search voice by name, accent, tone (e.g. British, Deep, Amy)..."
            value={voiceSearch}
            onChange={(e) => setVoiceSearch(e.target.value)}
            className="w-full pl-6 pr-5 py-1 bg-background-tertiary border border-border/80 rounded-md text-[10.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {voiceSearch && (
            <button
              onClick={() => setVoiceSearch("")}
              className="absolute right-1.5 text-text-muted hover:text-text-primary text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Profile Filter Controls (Gender, Accent, Tone) */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {/* Gender Filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-1.5 py-0.5 bg-background-tertiary border border-border/80 rounded text-[9.5px] text-text-primary focus:outline-none focus:border-primary shrink-0"
          >
            <option value="all">All Genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>

          {/* Accent Filter */}
          <select
            value={accentFilter}
            onChange={(e) => setAccentFilter(e.target.value)}
            className="px-1.5 py-0.5 bg-background-tertiary border border-border/80 rounded text-[9.5px] text-text-primary focus:outline-none focus:border-primary shrink-0"
          >
            <option value="all">All Accents</option>
            <option value="US English">US English</option>
            <option value="British UK">British UK</option>
          </select>

          {/* Tone Filter */}
          <select
            value={toneFilter}
            onChange={(e) => setToneFilter(e.target.value)}
            className="px-1.5 py-0.5 bg-background-tertiary border border-border/80 rounded text-[9.5px] text-text-primary focus:outline-none focus:border-primary shrink-0"
          >
            <option value="all">All Tones</option>
            <option value="clear">Clear</option>
            <option value="narrative">Narrative</option>
            <option value="deep">Deep</option>
            <option value="warm">Warm</option>
            <option value="professional">Professional</option>
            <option value="conversational">Conversational</option>
          </select>

          {(genderFilter !== "all" || accentFilter !== "all" || toneFilter !== "all" || voiceSearch) && (
            <button
              onClick={() => {
                setGenderFilter("all");
                setAccentFilter("all");
                setAgeFilter("all");
                setToneFilter("all");
                setVoiceSearch("");
              }}
              className="text-[9px] text-primary underline shrink-0 px-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Voice Cards Grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
          {filteredPiperVoices.length === 0 ? (
            <div className="col-span-2 py-4 text-center text-[10px] text-text-muted">
              No voices match your filters. <button onClick={() => { setGenderFilter("all"); setAccentFilter("all"); setToneFilter("all"); setVoiceSearch(""); }} className="text-primary underline">Reset filters</button>
            </div>
          ) : (
            filteredPiperVoices.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <button
                  key={voice.id}
                  onClick={() => onSelectVoice(voice.id)}
                  className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/30"
                      : "bg-background-tertiary/70 border-border/80 hover:border-primary/50 hover:bg-background-tertiary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[11px] font-bold truncate ${isSelected ? "text-primary" : "text-text-primary"}`}>
                      {voice.name}
                    </span>
                    <span
                      className={`text-[8.5px] px-1 py-0.1 rounded font-semibold shrink-0 ${
                        voice.gender === "female"
                          ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {voice.gender === "female" ? "Female" : "Male"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {voice.accent && (
                      <span className="text-[8px] px-1 py-0.1 bg-background-elevated border border-border/60 text-text-muted rounded">
                        {voice.accent}
                      </span>
                    )}
                    {voice.tone && (
                      <span className="text-[8px] px-1 py-0.1 bg-primary/10 text-primary rounded font-medium capitalize">
                        {voice.tone}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-medium text-text-secondary">
        Voice
      </label>
      <div className="space-y-2">
        {favoriteVoices.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-text-muted flex items-center gap-1">
              <Star size={9} className="text-amber-400 fill-amber-400" /> Favorites
            </span>
            <div className="flex flex-wrap gap-1.5">
              {favoriteVoices.map((fav) => (
                <button
                  key={fav.voiceId}
                  onClick={() => onSelectVoice(fav.voiceId)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                    selectedVoice === fav.voiceId
                      ? "bg-primary text-white font-medium"
                      : "bg-background-tertiary text-text-secondary hover:text-text-primary border border-border"
                  }`}
                >
                  <Star size={8} className="text-amber-400 fill-amber-400" />
                  <span>{fav.name}</span>
                  {fav.previewUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(fav.previewUrl, fav.voiceId);
                      }}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                      title="Preview voice"
                    >
                      {previewingVoice === fav.voiceId ? (
                        <Pause size={8} />
                      ) : (
                        <Play size={8} />
                      )}
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowAllVoices(!showAllVoices)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] border border-dashed border-border text-text-muted hover:text-text-primary hover:border-primary/50 transition-colors"
        >
          <Search size={10} />
          {showAllVoices ? "Hide voice browser" : "Browse & search voices"}
          <ChevronDown size={10} className={`transition-transform ${showAllVoices ? "rotate-180" : ""}`} />
        </button>

        {showAllVoices && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-background-secondary">
              <Search size={12} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                placeholder="Search by name, accent, gender..."
                className="flex-1 bg-transparent text-[10px] text-text-primary placeholder:text-text-muted focus:outline-none"
                autoFocus
              />
              {isLoadingVoices && <Loader2 size={12} className="animate-spin text-text-muted" />}
            </div>

            <div className="max-h-48 overflow-y-auto">
              {filteredVoices.length === 0 ? (
                <div className="p-3 text-center text-[10px] text-text-muted">
                  {isLoadingVoices ? "Loading voices..." : allVoices.length === 0 ? (
                    <button
                      onClick={() => openSettings("api-keys")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors font-medium"
                    >
                      <Settings size={12} />
                      Unlock session to browse voices
                    </button>
                  ) : "No voices match your search"}
                </div>
              ) : (
                filteredVoices.map((voice) => {
                  const isSelected = selectedVoice === voice.voice_id;

                  return (
                    <div
                      key={voice.voice_id}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-background-tertiary border-l-2 border-transparent"
                      }`}
                      onClick={() => onSelectVoice(voice.voice_id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-text-primary truncate">
                            {voice.name}
                          </span>
                          {voice.category === "cloned" && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              Cloned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
