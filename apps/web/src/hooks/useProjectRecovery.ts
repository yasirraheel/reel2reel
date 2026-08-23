import { useState, useEffect, useCallback } from "react";
import { autoSaveManager, type AutoSaveMetadata } from "../services/auto-save";
import { cloudSyncManager } from "../services/cloud-sync";
import { clearAllStorage } from "../services/media-storage";
import { useProjectStore } from "../stores/project-store";

interface RecoveryState {
  isChecking: boolean;
  availableSaves: AutoSaveMetadata[];
  showDialog: boolean;
}

export function useProjectRecovery() {
  const [state, setState] = useState<RecoveryState>({
    isChecking: true,
    availableSaves: [],
    showDialog: false,
  });

  const recoverFromAutoSave = useProjectStore((s) => s.recoverFromAutoSave);
  const loadProjectFromCloud = useProjectStore((s) => s.loadProjectFromCloud);

  useEffect(() => {
    const checkForRecovery = async () => {
      try {
        await autoSaveManager.initialize();
        cloudSyncManager.initialize();

        // 1. Check for cloud saved project on server first
        const cloudResult = await cloudSyncManager.fetchCurrentServerProject();
        const localSaves = await autoSaveManager.checkForRecovery();

        const latestLocalTimestamp = localSaves.length > 0 ? Math.max(...localSaves.map((s) => s.timestamp)) : 0;
        const cloudTimestamp = cloudResult.updatedAt || 0;

        // If cloud project exists and is at least as fresh as local (or within 10s difference), automatically load it
        if (cloudResult.hasProject && cloudResult.project && (cloudTimestamp >= latestLocalTimestamp - 10000 || localSaves.length === 0)) {
          console.info("[Recovery] Auto-loading cloud saved project from server...");
          await loadProjectFromCloud(cloudResult.project);
          setState({
            isChecking: false,
            availableSaves: [],
            showDialog: false,
          });
          return;
        }

        // If local emergency snapshot is significantly newer than cloud, offer recovery dialog
        if (localSaves.length > 0) {
          setState({
            isChecking: false,
            availableSaves: localSaves,
            showDialog: true,
          });
        } else if (cloudResult.hasProject && cloudResult.project) {
          await loadProjectFromCloud(cloudResult.project);
          setState({
            isChecking: false,
            availableSaves: [],
            showDialog: false,
          });
        } else {
          setState({
            isChecking: false,
            availableSaves: [],
            showDialog: false,
          });
        }
      } catch (error) {
        console.warn("[Recovery] Failed to check for saves:", error);
        setState({
          isChecking: false,
          availableSaves: [],
          showDialog: false,
        });
      }
    };

    checkForRecovery();
  }, [loadProjectFromCloud]);

  const recover = useCallback(
    async (saveId: string) => {
      const success = await recoverFromAutoSave(saveId);
      if (success) {
        setState((prev) => ({ ...prev, showDialog: false }));
      }
      return success;
    },
    [recoverFromAutoSave],
  );

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, showDialog: false }));
  }, []);

  const clearAll = useCallback(async () => {
    await autoSaveManager.clearAllSaves();
    await clearAllStorage();
    setState((prev) => ({ ...prev, availableSaves: [], showDialog: false }));
  }, []);

  return {
    isChecking: state.isChecking,
    availableSaves: state.availableSaves,
    showDialog: state.showDialog,
    recover,
    dismiss,
    clearAll,
  };
}
