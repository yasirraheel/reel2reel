import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  X,
  Layers,
  Move,
  Zap,
  CheckCircle2,
  ExternalLink,
  Film,
  Compass,
} from "lucide-react";
import { startTour } from "../tour";

export interface AIVideoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  description: string;
  keyPoints: string[];
  simulationType: "scroll_arrows" | "detach_panels" | "effects" | "ai_tools" | "timeline_export";
}

const CHAPTERS: GuideChapter[] = [
  {
    id: "scroll_arrows",
    number: 1,
    title: "Top-Left Panels & Navigation Arrows",
    subtitle: "Discover all 12 creative tools with side arrows",
    duration: "0:45",
    description: "The top-left box contains Media, Stock Footage, Text, Effects, Transitions, Filters, and AI Generate. Use the new left & right glowing arrows or your mouse wheel to scroll horizontally and reveal all tools.",
    keyPoints: [
      "Click the glowing Right Arrow (›) to quickly reveal Effects, Transitions, and AI Generate.",
      "Click the Left Arrow (‹) to scroll back to your Project Media and Audio files.",
      "Scroll your mouse wheel up or down over the tab row to scroll horizontally.",
      "The 'FX' and 'AI' badges highlight the most powerful creative engines.",
    ],
    simulationType: "scroll_arrows",
  },
  {
    id: "detach_panels",
    number: 2,
    title: "Detachable & Multi-Screen Workspace",
    subtitle: "Move panels anywhere or pop out to a 2nd monitor",
    duration: "1:10",
    description: "Customize your desktop layout! You can detach the Media/Effects library, the Preview monitor, or the Inspector into floating movable windows, or pop them out to a separate monitor.",
    keyPoints: [
      "Hover over any panel header and click 'Detach' to float it as a movable desktop window.",
      "Click '2nd Screen' (Pop Out) to open the panel in a dedicated browser window on your second monitor.",
      "Drag the floating window by its title bar to place it anywhere on your desktop.",
      "Click 'Re-dock' anytime to snap the panel right back into the main grid layout.",
    ],
    simulationType: "detach_panels",
  },
  {
    id: "effects",
    number: 3,
    title: "CineWorm Visual & Stock Effects",
    subtitle: "Browse, live preview, and apply HD effects to timeline",
    duration: "1:00",
    description: "The expanded Effects panel gives you high-definition cinematic overlays, light leaks, glitch VFX, and transitions. Preview them in real-time on your canvas before dropping them on your timeline.",
    keyPoints: [
      "Click 'Preview' on any effect card to immediately stream it into your main video canvas.",
      "Click 'Add' to instantly create a new track with the effect aligned to your playhead.",
      "Switch between List View (detailed) and Grid View (visual cards) using the top toggles.",
      "Filter by categories like Cinematic, Light Leaks, Glitch, Particles, and Sci-Fi.",
    ],
    simulationType: "effects",
  },
  {
    id: "ai_tools",
    number: 4,
    title: "AI Generation & Smart Creator Tools",
    subtitle: "Text-to-speech, AI voiceovers & automated visuals",
    duration: "0:55",
    description: "Speed up your workflow using integrated AI models. Generate studio-quality voiceovers in dozens of accents, generate contextual imagery, and auto-align captions.",
    keyPoints: [
      "Open the 'AI Generate' tab via the top-left navigation.",
      "Type a script to generate realistic voiceovers and add them to your audio tracks.",
      "Use AI image generation to create custom b-roll and graphic overlays.",
      "Combine AI voiceovers with stock footage from our film library.",
    ],
    simulationType: "ai_tools",
  },
  {
    id: "timeline_export",
    number: 5,
    title: "Timeline Editing & 4K Master Export",
    subtitle: "Multi-track snapping, keyframes & high-res rendering",
    duration: "1:15",
    description: "Edit like a pro with magnetic timeline snapping, razor blade splitting, audio mixer, and multi-format export in MP4, ProRes, and 4K 60FPS.",
    keyPoints: [
      "Press 'S' to split clips at the playhead, or 'Space' to play/pause.",
      "Drag transitions directly between two adjacent video clips.",
      "Open the Keyframe Editor to animate position, scale, rotation, and opacity curves.",
      "Click 'Export' in the top-right toolbar to render your master video in seconds.",
    ],
    simulationType: "timeline_export",
  },
];

export const AIVideoGuideModal: React.FC<AIVideoGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);

  const activeChapter = CHAPTERS[currentChapterIndex];

  // Auto-progress simulation
  useEffect(() => {
    if (!isOpen) return;

    if (isPlaying) {
      progressIntervalRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            // Next chapter
            setCurrentChapterIndex((curr) => (curr + 1) % CHAPTERS.length);
            return 0;
          }
          return prev + 1.25;
        });
      }, 250);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isOpen, isPlaying]);

  const selectChapter = (index: number) => {
    setCurrentChapterIndex(index);
    setProgress(0);
    setIsPlaying(true);
  };

  const handleLaunchTour = () => {
    onClose();
    setTimeout(() => {
      startTour();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] max-h-[760px] bg-bg-1 border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-background-secondary via-bg-1 to-background-secondary border-b border-border/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-600 text-white flex items-center justify-center shadow-md shadow-fuchsia-500/20">
              <Sparkles size={18} className="animate-pulse" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <span>AI Video Guide: How to Use CineWorm Reel2Reel</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-extrabold uppercase tracking-wide">
                  Masterclass
                </span>
              </h3>
              <p className="text-xs text-fg-muted">
                Interactive video walkthrough covering navigation arrows, multi-screen panels & effects.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLaunchTour}
              className="px-3 py-1.5 rounded-lg bg-background-elevated hover:bg-hover border border-border text-fg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass size={14} className="text-accent" />
              <span>Spotlight Tour</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body: Split into Interactive Video Player (Left) and Chapters/Notes (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
          
          {/* Left: Video Player & Simulation Display */}
          <div className="col-span-8 flex flex-col h-full border-r border-border/80 bg-black/60 relative">
            
            {/* Visual Canvas Display */}
            <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center p-6 overflow-hidden">
              
              {/* Simulation Canvas Visuals according to chapter */}
              {activeChapter.simulationType === "scroll_arrows" && (
                <div className="w-full max-w-lg bg-bg-2 border-2 border-accent/40 rounded-2xl p-5 shadow-2xl relative space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <span className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                      Top-Left Panel: Interactive Scroll Navigation
                    </span>
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-md font-bold">New Feature</span>
                  </div>

                  {/* Simulated Nav Bar with Glowing Arrows */}
                  <div className="relative flex items-center gap-2 p-2 bg-bg-1 rounded-xl border border-border">
                    <div className="w-8 h-10 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-sm animate-pulse">
                      <ChevronLeft size={20} strokeWidth={3} />
                    </div>

                    <div className="flex-1 flex gap-2 overflow-hidden py-1">
                      <div className="px-3 py-2 rounded-xl bg-accent-soft text-accent text-xs font-bold shrink-0 shadow-sm">
                        📁 Media
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-bg-3 text-fg-2 text-xs font-semibold shrink-0">
                        🎵 Audio
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-bg-3 text-fg-2 text-xs font-semibold shrink-0">
                        🎬 Film
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-fuchsia-950/60 border border-fuchsia-500/50 text-fuchsia-300 text-xs font-bold shrink-0 relative animate-pulse shadow-md shadow-fuchsia-500/20">
                        ⚡ Effects <span className="text-[8px] bg-fuchsia-500 text-white px-1 rounded-full ml-1">FX</span>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold shrink-0 relative animate-pulse shadow-md shadow-amber-500/20">
                        ✨ AI Generate <span className="text-[8px] bg-amber-500 text-white px-1 rounded-full ml-1">AI</span>
                      </div>
                    </div>

                    <div className="w-8 h-10 rounded-lg bg-accent border border-accent-strong flex items-center justify-center text-accent-fg shadow-lg shadow-accent/40 ring-2 ring-accent/30 animate-bounce">
                      <ChevronRight size={20} strokeWidth={3} />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-background-secondary/80 border border-border/80 text-xs text-fg-2 space-y-1">
                    <p className="font-bold text-accent flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Never miss Effects or AI tools again!
                    </p>
                    <p className="text-[11px] text-fg-muted leading-relaxed">
                      Click the glowing right arrow or roll your mouse wheel over the tabs to instantly discover all 12 tools.
                    </p>
                  </div>
                </div>
              )}

              {activeChapter.simulationType === "detach_panels" && (
                <div className="w-full max-w-lg bg-bg-2 border-2 border-accent/40 rounded-2xl p-5 shadow-2xl relative space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <span className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                      <Move size={15} className="text-accent" />
                      Multi-Screen & Detachable Panel System
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold">Multi-Monitor</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-accent bg-accent/10 space-y-2 relative shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-fg">Monitor 1: Main</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-accent text-accent-fg rounded font-bold">Grid</span>
                      </div>
                      <div className="h-16 rounded-lg bg-bg-1 border border-border flex items-center justify-center text-xs text-fg-muted font-medium">
                        Timeline & Inspector
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-fuchsia-500 bg-fuchsia-500/10 space-y-2 relative shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-fuchsia-300">Monitor 2: Floating</span>
                        <ExternalLink size={12} className="text-fuchsia-400" />
                      </div>
                      <div className="h-16 rounded-lg bg-bg-1 border border-fuchsia-500/40 flex items-center justify-center text-xs text-fuchsia-300 font-bold shadow-md">
                        Preview / Effects Studio
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-fg-muted text-center">
                    Hover over any panel and click <strong className="text-fg">Detach</strong> or <strong className="text-fg">2nd Screen</strong> to pop it out to another monitor.
                  </p>
                </div>
              )}

              {activeChapter.simulationType === "effects" && (
                <div className="w-full max-w-lg bg-bg-2 border-2 border-fuchsia-500/40 rounded-2xl p-5 shadow-2xl relative space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={15} />
                      Enlarged CineWorm Effects Library
                    </span>
                    <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded-md font-bold">4K VFX</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { title: "Cinematic Anamorphic Flare", cat: "Light Leaks", tag: "PRO" },
                      { title: "Cyberpunk Digital Glitch", cat: "Distortion", tag: "HOT" },
                      { title: "Floating Gold Dust Particles", cat: "Overlays", tag: "4K" },
                    ].map((fx, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-bg-1 border border-border hover:border-fuchsia-500/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center">
                            <Play size={14} fill="currentColor" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-fg">{fx.title}</div>
                            <div className="text-[10px] text-fg-muted">{fx.cat}</div>
                          </div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-fuchsia-500 text-white font-extrabold">
                          {fx.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeChapter.simulationType === "ai_tools" && (
                <div className="w-full max-w-lg bg-bg-2 border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl relative space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={15} />
                      AI Video & Audio Synthesis
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold">AI Studio</span>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-1 border border-border space-y-2 text-left">
                    <label className="text-xs font-bold text-fg">AI Voice Script Prompt</label>
                    <div className="p-2.5 rounded-lg bg-bg-3 text-xs text-fg-2 font-mono border border-border/60">
                      "Welcome to CineWorm. Discover cinema without boundaries."
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-amber-400 font-bold">Studio Voice: Marcus (UK Master)</span>
                      <button className="px-3 py-1 rounded-lg bg-amber-500 text-black text-xs font-bold shadow-sm">
                        Generate Track
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeChapter.simulationType === "timeline_export" && (
                <div className="w-full max-w-lg bg-bg-2 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-2xl relative space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Film size={15} />
                      Timeline Master & High-Res Export
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold">ProRes / 4K</span>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-bg-1 border border-border">
                    <div className="h-6 rounded bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold flex items-center px-2">
                      Track 1: Main Video (4K 60FPS)
                    </div>
                    <div className="h-6 rounded bg-fuchsia-950/60 border border-fuchsia-500/40 text-[10px] text-fuchsia-300 font-bold flex items-center px-2">
                      Track 2: Light Leak FX Overlay
                    </div>
                    <div className="h-6 rounded bg-blue-950/60 border border-blue-500/40 text-[10px] text-blue-300 font-bold flex items-center px-2">
                      Track 3: AI Voiceover & Background Score
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls Bar */}
            <div className="p-4 bg-background-secondary border-t border-border/80 flex flex-col gap-2 shrink-0">
              
              {/* Progress Slider */}
              <div className="w-full flex items-center gap-2">
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = ((e.clientX - rect.left) / rect.width) * 100;
                    setProgress(Math.max(0, Math.min(100, pct)));
                  }}
                  className="flex-1 h-2 bg-bg-3 rounded-full overflow-hidden cursor-pointer relative"
                >
                  <div
                    style={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-accent to-fuchsia-500 rounded-full transition-all duration-150"
                  />
                </div>
                <span className="text-[11px] font-mono text-fg-muted shrink-0 w-10 text-right">
                  {Math.round(progress)}%
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectChapter((currentChapterIndex - 1 + CHAPTERS.length) % CHAPTERS.length)}
                    title="Previous Chapter"
                    className="p-2 rounded-lg hover:bg-hover text-fg-2 hover:text-fg transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-9 h-9 rounded-xl bg-accent text-accent-fg flex items-center justify-center shadow-md shadow-accent/20 hover:bg-accent-strong transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => selectChapter((currentChapterIndex + 1) % CHAPTERS.length)}
                    title="Next Chapter"
                    className="p-2 rounded-lg hover:bg-hover text-fg-2 hover:text-fg transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setProgress(0)}
                    title="Replay Chapter"
                    className="p-2 rounded-lg hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-fg-2">
                    Chapter {activeChapter.number} of {CHAPTERS.length}: <strong className="text-fg">{activeChapter.title}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-lg hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Right: Chapters List & Active Guide Insights */}
          <div className="col-span-4 flex flex-col h-full bg-bg-1 overflow-y-auto">
            
            {/* Chapters Navigation Header */}
            <div className="p-4 border-b border-border/80 bg-background-secondary/50 shrink-0">
              <span className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-accent" /> Video Chapters
              </span>
            </div>

            {/* Chapters List */}
            <div className="p-3 space-y-2 border-b border-border/80 shrink-0">
              {CHAPTERS.map((ch, idx) => {
                const isActive = idx === currentChapterIndex;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => selectChapter(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                      isActive
                        ? "bg-accent-soft/40 border-accent text-fg shadow-sm ring-1 ring-accent/30"
                        : "bg-background-secondary/60 hover:bg-background-secondary border-border/60 text-fg-2 hover:text-fg"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive
                          ? "bg-accent text-accent-fg"
                          : "bg-bg-3 text-fg-muted"
                      }`}
                    >
                      {ch.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate leading-snug">
                        {ch.title}
                      </div>
                      <div className="text-[11px] text-fg-muted truncate">
                        {ch.subtitle}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-fg-muted shrink-0 mt-1">
                      {ch.duration}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Chapter Details & Key Takeaways */}
            <div className="p-4 flex-1 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  Chapter {activeChapter.number} Summary
                </h4>
                <p className="text-xs text-fg leading-relaxed">
                  {activeChapter.description}
                </p>
              </div>

              <div>
                <h5 className="text-[11px] font-bold text-fg-2 uppercase tracking-wider mb-2">
                  Pro Tips:
                </h5>
                <ul className="space-y-1.5">
                  {activeChapter.keyPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-fg-2 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                      <span className="leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Modal CTA */}
            <div className="p-4 border-t border-border/80 bg-background-secondary/60 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-accent text-accent-fg font-bold text-xs hover:bg-accent-strong transition-all shadow-md shadow-accent/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Start Editing in Reel2Reel</span>
                <ChevronRight size={15} />
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
