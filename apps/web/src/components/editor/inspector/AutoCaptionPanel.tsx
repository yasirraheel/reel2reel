import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Mic, MicOff, Languages, AlertCircle, Wand2, Loader2 } from "lucide-react";
import { useEngineStore } from "../../../stores/engine-store";
import { useProjectStore } from "../../../stores/project-store";
import { SpeechToTextEngine } from "@openreel/core";
import type {
  TranscriptionProgress,
  TranscriptionSegment,
} from "@openreel/core";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@openreel/ui";
import { OPENREEL_TRANSCRIBE_URL } from "../../../config/api-endpoints";
import { toast } from "../../../stores/notification-store";
import { loadMediaBlob } from "../../../services/media-storage";

const CAPTION_STYLE_PRESETS = [
  {
    id: "default",
    name: "Default",
    description: "White text on dark background",
  },
  { id: "modern", name: "Modern", description: "Clean, minimal style" },
  { id: "bold", name: "Bold", description: "Large, impactful text" },
  { id: "cinematic", name: "Cinematic", description: "Film-style captions" },
  { id: "minimal", name: "Minimal", description: "Subtle, understated" },
];

export const AutoCaptionPanel: React.FC = () => {
  const getSpeechToTextEngine = useEngineStore(
    (state) => state.getSpeechToTextEngine,
  );
  const addSubtitle = useProjectStore((state) => state.addSubtitle);
  const applySubtitleStylePreset = useProjectStore(
    (state) => state.applySubtitleStylePreset,
  );
  const mediaItems = useProjectStore((state) => state.project.mediaLibrary.items);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isVpsProcessing, setIsVpsProcessing] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [selectedStyle, setSelectedStyle] = useState("default");
  const [selectedMediaId, setSelectedMediaId] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isSupported = useMemo(() => SpeechToTextEngine.isSupported(), []);
  const languages = useMemo(
    () => SpeechToTextEngine.getSupportedLanguages(),
    [],
  );

  // Filter audio and video items available in project
  const audioVideoItems = useMemo(() => {
    return mediaItems.filter((m) => m.type === "audio" || m.type === "video");
  }, [mediaItems]);

  // Set default selected media item
  useEffect(() => {
    if (!selectedMediaId && audioVideoItems.length > 0) {
      setSelectedMediaId(audioVideoItems[0].id);
    }
  }, [audioVideoItems, selectedMediaId]);

  // Stop mic recording and release microphone stream when user unmounts panel / switches tab
  useEffect(() => {
    return () => {
      getSpeechToTextEngine().then((speechEngine) => {
        speechEngine.stopTranscription();
      }).catch(() => {});
    };
  }, [getSpeechToTextEngine]);

  // 1. Live Microphone Speech Recording (WebSpeech API)
  const handleStartLiveRecording = useCallback(async () => {
    setError(null);
    setSegments([]);
    setIsTranscribing(true);
    setProgress({ progress: 10, status: "transcribing", currentTime: 0, totalDuration: 0, segmentsFound: 0 });

    try {
      const speechEngine = await getSpeechToTextEngine();
      speechEngine.setOptions({ language: selectedLanguage });

      speechEngine.onProgress((prog) => {
        setProgress(prog);
      });

      speechEngine.onSegment((segment) => {
        setSegments((prev) => [...prev, segment]);
      });

      await speechEngine.startLiveTranscription();
    } catch (err: any) {
      console.error("Failed to start mic recording:", err);
      setError(err?.message || "Could not access microphone");
      setIsTranscribing(false);
      setProgress(null);
    }
  }, [getSpeechToTextEngine, selectedLanguage]);

  // Stop Live Microphone Recording
  const handleStopLiveRecording = useCallback(async () => {
    try {
      const speechEngine = await getSpeechToTextEngine();
      const result = speechEngine.stopTranscription();

      if (result.success && result.segments.length > 0) {
        setSegments(result.segments);
        const subtitles = speechEngine.segmentsToSubtitles(result.segments);
        subtitles.forEach((subtitle) => {
          addSubtitle(subtitle);
        });

        if (selectedStyle !== "default") {
          await applySubtitleStylePreset(selectedStyle);
        }

        toast.success("Auto Captions Added", `Added ${subtitles.length} subtitle clips to timeline!`);
      }
    } catch (err: any) {
      console.warn("Stop recording error:", err);
    } finally {
      setIsTranscribing(false);
      setProgress(null);
    }
  }, [getSpeechToTextEngine, addSubtitle, applySubtitleStylePreset, selectedStyle]);

  // 2. Transcribe Video/Audio Clips using VPS Faster-Whisper
  const handleVpsAudioTranscribe = useCallback(async () => {
    setError(null);
    setIsVpsProcessing(true);

    try {
      const targetItem = audioVideoItems.find((m) => m.id === selectedMediaId) || audioVideoItems[0];
      
      const formData = new FormData();
      formData.append("language", selectedLanguage);

      if (targetItem) {
        const blob = await loadMediaBlob(targetItem.id);
        if (blob) {
          formData.append("audio", blob, targetItem.name);
        }
      }

      const response = await fetch(`${OPENREEL_TRANSCRIBE_URL}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`VPS server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.segments)) {
        const parsedSegments: TranscriptionSegment[] = data.segments.map((s: any, i: number) => ({
          id: `seg_${i}`,
          text: s.text,
          startTime: s.start,
          endTime: s.end,
          confidence: 0.95,
        }));

        setSegments(parsedSegments);

        parsedSegments.forEach((seg) => {
          addSubtitle({
            id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            text: seg.text,
            startTime: seg.startTime,
            endTime: seg.endTime,
          });
        });

        if (selectedStyle !== "default") {
          await applySubtitleStylePreset(selectedStyle);
        }

        toast.success("VPS Captions Generated", `Added ${parsedSegments.length} subtitle clips to timeline!`);
      } else {
        throw new Error("No transcription segments returned by VPS");
      }
    } catch (err: any) {
      console.error("VPS Transcription error:", err);
      setError(err?.message || "Failed to transcribe audio on VPS");
    } finally {
      setIsVpsProcessing(false);
    }
  }, [selectedLanguage, selectedMediaId, audioVideoItems, addSubtitle, applySubtitleStylePreset, selectedStyle]);

  const handleApplySegments = useCallback(async () => {
    if (segments.length === 0) return;

    const speechEngine = await getSpeechToTextEngine();
    const subtitles = speechEngine.segmentsToSubtitles(segments);
    subtitles.forEach((subtitle) => {
      addSubtitle(subtitle);
    });

    if (selectedStyle !== "default") {
      await applySubtitleStylePreset(selectedStyle);
    }

    setSegments([]);
    toast.success("Subtitles Applied", `Added ${subtitles.length} clips to timeline.`);
  }, [getSpeechToTextEngine, addSubtitle, applySubtitleStylePreset, segments, selectedStyle]);

  if (!isSupported) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-status-warning">
          <AlertCircle size={16} />
          <span className="text-[11px] font-medium">Browser Not Supported</span>
        </div>
        <p className="text-[10px] text-text-muted">
          Auto-captions require Chrome or Edge browser with Speech Recognition API support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full pb-28">
      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/30">
        <Mic size={16} className="text-primary" />
        <div>
          <span className="text-[11px] font-medium text-text-primary">
            Auto-Caption & Speech AI
          </span>
          <p className="text-[9px] text-text-muted">
            Transcribe timeline tracks or live mic recording
          </p>
        </div>
      </div>

      <div className="space-y-3 p-3 bg-background-tertiary rounded-lg">
        {/* Target Media Track Selection */}
        {audioVideoItems.length > 0 && (
          <div className="space-y-1 pb-2 border-b border-border/60">
            <span className="text-[10px] text-text-secondary font-medium block">
              Source Track to Caption
            </span>
            <select
              value={selectedMediaId}
              onChange={(e) => setSelectedMediaId(e.target.value)}
              disabled={isTranscribing || isVpsProcessing}
              className="w-full px-2 py-1.5 bg-background-secondary border border-border rounded-md text-[10.5px] text-text-primary focus:outline-none focus:border-primary"
            >
              {audioVideoItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.type === "video" ? "🎬 " : "🎵 "} {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages size={14} className="text-text-secondary" />
            <span className="text-[10px] text-text-secondary">Language</span>
          </div>
          <Select
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
            disabled={isTranscribing || isVpsProcessing}
          >
            <SelectTrigger className="w-auto min-w-[100px] bg-background-secondary border-border text-text-primary text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background-secondary border-border">
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary">Caption Style</span>
          <Select
            value={selectedStyle}
            onValueChange={setSelectedStyle}
            disabled={isTranscribing || isVpsProcessing}
          >
            <SelectTrigger className="w-auto min-w-[100px] bg-background-secondary border-border text-text-primary text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background-secondary border-border">
              {CAPTION_STYLE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400">{error}</span>
        </div>
      )}

      {/* Live Mic Recording Status */}
      {isTranscribing && (
        <div className="space-y-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-text-primary">Live Mic Status</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="text-[10px] text-red-400 font-bold">Recording...</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary">Segments Found</span>
            <span className="text-[10px] text-text-primary font-mono font-bold">
              {progress?.segmentsFound ?? segments.length}
            </span>
          </div>
        </div>
      )}

      {/* Captured Subtitles Preview */}
      {segments.length > 0 && !isTranscribing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary">
              {segments.length} caption{segments.length !== 1 ? "s" : ""} detected
            </span>
            <button
              onClick={handleApplySegments}
              className="px-2.5 py-1 text-[10px] bg-primary text-black font-semibold rounded hover:bg-primary/90 transition-colors shadow-sm"
            >
              Add to Timeline
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {segments.map((segment, index) => (
              <div
                key={index}
                className="p-2 bg-background-secondary border border-border/80 rounded text-[10px] text-text-primary"
              >
                <span className="text-text-muted font-mono">
                  [{(segment.startTime ?? 0).toFixed(1)}s - {(segment.endTime ?? 0).toFixed(1)}s]
                </span>
                <span className="ml-2 font-medium">{segment.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Button 1: VPS Speech AI Caption Generator for Timeline Track */}
        <button
          onClick={handleVpsAudioTranscribe}
          disabled={isTranscribing || isVpsProcessing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-black rounded-lg hover:bg-primary/90 transition-all font-semibold shadow-sm disabled:opacity-50"
        >
          {isVpsProcessing ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-[11px]">Transcribing Track on VPS...</span>
            </>
          ) : (
            <>
              <Wand2 size={15} />
              <span className="text-[11px]">Generate Captions via VPS AI</span>
            </>
          )}
        </button>

        {/* Button 2: Live Mic Recording */}
        {!isTranscribing ? (
          <button
            onClick={handleStartLiveRecording}
            disabled={isVpsProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background-elevated border border-border hover:border-primary text-text-primary rounded-lg transition-all"
          >
            <Mic size={14} className="text-primary" />
            <span className="text-[10.5px] font-medium">Start Mic Live Recording</span>
          </button>
        ) : (
          <button
            onClick={handleStopLiveRecording}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold shadow-md animate-pulse"
          >
            <MicOff size={16} />
            <span className="text-[11px]">Stop Recording</span>
          </button>
        )}
      </div>

      <p className="text-[9px] text-text-muted text-center">
        Select an audio/video track above and click Generate Captions via VPS AI for automatic timeline subtitles.
      </p>
    </div>
  );
};

export default AutoCaptionPanel;
