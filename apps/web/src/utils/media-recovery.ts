import type { MediaItem } from "@openreel/core";
import { saveMediaBlob } from "../services/media-storage";

export async function generateThumbnailFromBlob(
  blob: Blob,
  type: "video" | "audio" | "image",
): Promise<string | null> {
  if (type === "audio") {
    return null;
  }

  if (type === "image") {
    return URL.createObjectURL(blob);
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth, 320);
        canvas.height = Math.min(
          video.videoHeight,
          (320 / video.videoWidth) * video.videoHeight,
        );

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (thumbBlob) => {
              cleanup();
              if (thumbBlob) {
                resolve(URL.createObjectURL(thumbBlob));
              } else {
                resolve(null);
              }
            },
            "image/jpeg",
            0.7,
          );
        } else {
          cleanup();
          resolve(null);
        }
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    video.src = URL.createObjectURL(blob);
  });
}

/**
 * Restore a MediaItem, re-fetching remote blob if missing and regenerating dead thumbnails.
 */
export async function restoreMediaItem(
  item: MediaItem,
  storedBlob: Blob | undefined,
  projectId?: string,
): Promise<MediaItem> {
  let blob: Blob | null = storedBlob || item.blob || null;

  // If blob is missing but originalUrl exists (stock media / server resource), re-hydrate from cloud
  if (!blob && item.originalUrl) {
    try {
      let res = await fetch(item.originalUrl, { mode: "cors" });
      if (!res.ok) {
        // Fallback for CORS restricted hosts
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(item.originalUrl)}`;
        res = await fetch(proxyUrl);
      }

      if (res.ok) {
        blob = await res.blob();
        if (projectId) {
          try {
            await saveMediaBlob(projectId, item.id, blob, item.metadata);
          } catch {
            // Storage caching is best-effort
          }
        }
      }
    } catch (e) {
      console.warn(`[MediaRecovery] Could not re-fetch remote media for ${item.name}:`, e);
    }
  }

  if (!blob) {
    return item;
  }

  let thumbnailUrl = item.thumbnailUrl;

  if (!thumbnailUrl || thumbnailUrl.startsWith("blob:")) {
    thumbnailUrl = await generateThumbnailFromBlob(blob, item.type);
  }

  return {
    ...item,
    blob,
    thumbnailUrl,
    filmstripThumbnails: undefined,
  };
}
