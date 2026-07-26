export interface ChunkedDownloaderOptions {
  url: string;
  chunkSize?: number; // Defaults to 5MB
  onProgress?: (bytesLoaded: number, totalBytes: number, percentage: number) => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export class ChunkedDownloader {
  private url: string;
  private chunkSize: number;
  private onProgress?: (bytesLoaded: number, totalBytes: number, percentage: number) => void;
  private onComplete?: (blob: Blob) => void;
  private onError?: (error: Error) => void;
  
  private abortController: AbortController | null = null;
  private chunks: Uint8Array[] = [];
  private totalBytes: number = 0;
  private bytesLoaded: number = 0;
  private isPaused: boolean = false;
  private isCanceled: boolean = false;
  private currentChunkIndex: number = 0;

  constructor(options: ChunkedDownloaderOptions) {
    this.url = options.url;
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  public async start() {
    this.isPaused = false;
    this.isCanceled = false;
    this.abortController = new AbortController();

    try {
      // Step 1: Try to get Content-Length using HEAD request
      const headResponse = await fetch(this.url, { method: "HEAD" });
      const contentLengthHeader = headResponse.headers.get("Content-Length");
      const acceptRanges = headResponse.headers.get("Accept-Ranges");
      
      if (contentLengthHeader && acceptRanges === "bytes") {
        this.totalBytes = parseInt(contentLengthHeader, 10);
        await this.downloadInChunks();
      } else {
        // Fallback: Standard fetch with stream reading for progress
        await this.downloadStandard();
      }
    } catch (error: any) {
      if (this.isCanceled || error.name === "AbortError") return;
      if (this.onError) this.onError(error);
    }
  }

  private async downloadInChunks() {
    const totalChunks = Math.ceil(this.totalBytes / this.chunkSize);

    while (this.currentChunkIndex < totalChunks) {
      if (this.isPaused || this.isCanceled) break;

      const start = this.currentChunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize - 1, this.totalBytes - 1);

      try {
        const response = await fetch(this.url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: this.abortController?.signal,
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Failed to fetch chunk ${this.currentChunkIndex}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        this.chunks[this.currentChunkIndex] = new Uint8Array(arrayBuffer);
        
        this.bytesLoaded += arrayBuffer.byteLength;
        const percentage = Math.round((this.bytesLoaded / this.totalBytes) * 100);
        
        if (this.onProgress) {
          this.onProgress(this.bytesLoaded, this.totalBytes, percentage);
        }

        this.currentChunkIndex++;
      } catch (error: any) {
        if (this.isCanceled || error.name === "AbortError") return;
        throw error;
      }
    }

    if (this.currentChunkIndex === totalChunks && !this.isCanceled) {
      const finalBlob = new Blob(this.chunks as BlobPart[]);
      if (this.onComplete) this.onComplete(finalBlob);
    }
  }

  private async downloadStandard() {
    try {
      const response = await fetch(this.url, { signal: this.abortController?.signal });
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const contentLengthHeader = response.headers.get("Content-Length");
      if (contentLengthHeader) {
        this.totalBytes = parseInt(contentLengthHeader, 10);
      }

      if (!response.body) throw new Error("ReadableStream not supported by browser");

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        if (this.isPaused || this.isCanceled) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (value) {
          chunks.push(value);
          this.bytesLoaded += value.length;
          
          let percentage = 0;
          if (this.totalBytes > 0) {
            percentage = Math.round((this.bytesLoaded / this.totalBytes) * 100);
          }
          
          if (this.onProgress) {
            this.onProgress(this.bytesLoaded, this.totalBytes, percentage);
          }
        }
      }

      if (!this.isPaused && !this.isCanceled) {
        const finalBlob = new Blob(chunks as BlobPart[]);
        if (this.onComplete) this.onComplete(finalBlob);
      }
    } catch (error: any) {
      if (this.isCanceled || error.name === "AbortError") return;
      throw error;
    }
  }

  public pause() {
    this.isPaused = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public resume() {
    if (this.isPaused) {
      this.start();
    }
  }

  public cancel() {
    this.isCanceled = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.chunks = [];
    this.bytesLoaded = 0;
    this.currentChunkIndex = 0;
  }
}
