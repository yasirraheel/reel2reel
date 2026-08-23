import type { Project } from "@openreel/core";
import { serializeProject, deserializeProject } from "@openreel/core";

export type CloudSyncStatus = "idle" | "saving" | "saved" | "error" | "offline";

export interface CloudProjectSummary {
  id: number;
  title: string;
  duration: number;
  status: string;
  updated_at: number | null;
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSavedAt: number | null;
  errorMessage: string | null;
  serverId: number | null;
}

type SyncStatusListener = (state: CloudSyncState) => void;

class CloudSyncManager {
  private syncUrl = "/user/editor/api/sync";
  private currentUrl = "/user/editor/api/current";
  private listUrl = "/user/editor/api/projects";
  private loadUrl = "/user/editor/api/load";
  private deleteUrl = "/user/editor/api/delete";

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceInterval = 5000; // 5 seconds
  private lastSavedHash: string = "";
  private pendingProject: Project | null = null;
  private serverId: number | null = null;

  private state: CloudSyncState = {
    status: "idle",
    lastSavedAt: null,
    errorMessage: null,
    serverId: null,
  };

  private listeners: Set<SyncStatusListener> = new Set();
  private initialized = false;

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Attach beforeunload handler to flush any pending unsaved state
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this.pendingProject) {
          this.syncImmediatelyBeacon(this.pendingProject);
        }
      });

      window.addEventListener("online", () => {
        if (this.state.status === "offline" || this.pendingProject) {
          if (this.pendingProject) {
            this.syncNow(this.pendingProject);
          } else {
            this.updateState({ status: "saved" });
          }
        }
      });

      window.addEventListener("offline", () => {
        this.updateState({ status: "offline" });
      });
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): CloudSyncState {
    return this.state;
  }

  private updateState(partial: Partial<CloudSyncState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Mark the project as dirty and schedule a debounced sync to the server.
   */
  public markDirty(project: Project) {
    if (!project) return;
    this.pendingProject = project;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.syncNow(project);
    }, this.debounceInterval);
  }

  /**
   * Sync the project JSON immediately to the server.
   */
  public async syncNow(project: Project): Promise<boolean> {
    if (!project) return false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.updateState({ status: "offline" });
      return false;
    }

    const serializedData = serializeProject(project);
    const hash = this.simpleHash(serializedData);

    // Skip if unchanged
    if (hash === this.lastSavedHash && this.state.status === "saved") {
      return true;
    }

    this.updateState({ status: "saving", errorMessage: null });

    try {
      // Calculate total duration across tracks
      let totalDuration = 0;
      for (const track of project.timeline.tracks) {
        for (const clip of track.clips) {
          const end = clip.startTime + clip.duration;
          if (end > totalDuration) totalDuration = end;
        }
      }

      const payload = {
        title: project.name || "Untitled Project",
        client_project_id: project.id,
        server_id: this.serverId,
        duration: totalDuration,
        project_data: serializedData,
      };

      const response = await fetch(this.syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const res = await response.json();
      if (!res.success) {
        throw new Error(res.message || "Failed to save project to server");
      }

      this.lastSavedHash = hash;
      this.pendingProject = null;
      if (res.server_id) {
        this.serverId = res.server_id;
      }

      this.updateState({
        status: "saved",
        lastSavedAt: res.updated_at || Date.now(),
        serverId: this.serverId,
        errorMessage: null,
      });

      return true;
    } catch (err: any) {
      console.warn("[CloudSync] Sync failed:", err);
      this.updateState({
        status: "error",
        errorMessage: err?.message || "Sync failed",
      });
      return false;
    }
  }

  /**
   * Synchronous beacon sync on page unload.
   */
  private syncImmediatelyBeacon(project: Project) {
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const serializedData = serializeProject(project);
        const payload = JSON.stringify({
          title: project.name || "Untitled Project",
          client_project_id: project.id,
          server_id: this.serverId,
          project_data: serializedData,
        });

        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(this.syncUrl, blob);
      }
    } catch (e) {
      // Best-effort
    }
  }

  /**
   * Fetch user's latest project from the server on editor boot.
   */
  public async fetchCurrentServerProject(): Promise<{
    hasProject: boolean;
    project: Project | null;
    serverProjectData?: any;
    updatedAt?: number;
  }> {
    try {
      const response = await fetch(this.currentUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) {
        return { hasProject: false, project: null };
      }

      const res = await response.json();
      if (res.success && res.hasProject && res.project) {
        this.serverId = res.project.id;
        const rawTimeline = res.project.timeline_data;
        let deserialized: Project | null = null;

        if (typeof rawTimeline === "string") {
          deserialized = deserializeProject(rawTimeline);
        } else if (rawTimeline && typeof rawTimeline === "object") {
          deserialized = rawTimeline as Project;
        }

        if (deserialized) {
          this.updateState({
            status: "saved",
            lastSavedAt: res.project.updated_at || Date.now(),
            serverId: res.project.id,
          });

          return {
            hasProject: true,
            project: deserialized,
            serverProjectData: res.project,
            updatedAt: res.project.updated_at || 0,
          };
        }
      }

      return { hasProject: false, project: null };
    } catch (err) {
      console.warn("[CloudSync] Could not fetch server project:", err);
      return { hasProject: false, project: null };
    }
  }

  /**
   * List all projects saved on cloud.
   */
  public async listCloudProjects(): Promise<CloudProjectSummary[]> {
    try {
      const response = await fetch(this.listUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) return [];
      const res = await response.json();
      return res.success && Array.isArray(res.projects) ? res.projects : [];
    } catch {
      return [];
    }
  }

  /**
   * Load a specific cloud project by server ID.
   */
  public async loadCloudProject(id: number): Promise<Project | null> {
    try {
      const response = await fetch(`${this.loadUrl}/${id}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) return null;
      const res = await response.json();
      if (res.success && res.project?.timeline_data) {
        this.serverId = res.project.id;
        const raw = res.project.timeline_data;
        return typeof raw === "string" ? deserializeProject(raw) : (raw as Project);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Delete cloud project by ID.
   */
  public async deleteCloudProject(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.deleteUrl}/${id}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });

      if (!response.ok) return false;
      const res = await response.json();
      return !!res.success;
    } catch {
      return false;
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return String(hash);
  }
}

export const cloudSyncManager = new CloudSyncManager();
