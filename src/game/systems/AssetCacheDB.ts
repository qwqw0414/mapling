// ============================================================================
// Asset Cache DB - IndexedDB Persistent Cache Layer
// ============================================================================

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'mapling-assets';
const DB_VERSION = 2;
const LRU_EVICTION_COUNT = 10;

export const STORE_NAMES = {
  MOB_GIFS: 'mob-gifs',
  CHARACTER_GIFS: 'character-gifs',
  BGM: 'bgm',
  MOB_SOUNDS: 'mob-sounds',
  GAME_SOUNDS: 'game-sounds',
  IMAGES: 'images',
} as const;

// ============================================================================
// Types
// ============================================================================

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

interface DBCacheEntry {
  key: string;
  data: ArrayBuffer | string | Blob;
  timestamp: number;
}

// ============================================================================
// AssetCacheDB Class
// ============================================================================

/**
 * IndexedDB wrapper for persistent asset caching.
 * Provides L2 cache behind the in-memory L1 cache.
 * Gracefully degrades to no-op when IndexedDB is unavailable.
 */
export class AssetCacheDB {
  private db: IDBDatabase | null = null;
  private isAvailable = false;

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize IndexedDB connection and request persistent storage.
   * Silently degrades if IndexedDB is unavailable (e.g., private browsing).
   */
  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      console.warn('[AssetCacheDB] IndexedDB not available, using memory-only cache');
      return;
    }

    try {
      this.db = await this.openDB();
      this.isAvailable = true;
      await this.requestPersistentStorage();
      console.log('[AssetCacheDB] Initialized successfully');
    } catch (error) {
      console.warn('[AssetCacheDB] Failed to initialize, using memory-only cache', error);
      this.isAvailable = false;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        for (const storeName of Object.values(STORE_NAMES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async requestPersistentStorage(): Promise<void> {
    if (!navigator.storage?.persist) return;

    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[AssetCacheDB] Persistent storage: [granted]=[${isPersisted}]`);
    } catch {
      // Non-critical - ignore
    }
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Retrieve cached data from IndexedDB.
   * Updates access timestamp for LRU tracking.
   * @param storeName - Target object store
   * @param key - Cache key
   * @returns Cached data or null if not found / unavailable
   */
  async get(storeName: StoreName, key: string): Promise<ArrayBuffer | string | Blob | null> {
    if (!this.isAvailable || !this.db) return null;

    try {
      const entry = await this.getEntry(storeName, key);
      if (!entry) return null;

      // Update access timestamp for LRU (fire and forget)
      this.updateTimestamp(storeName, key).catch(() => {});

      return entry.data;
    } catch (error) {
      console.warn(`[AssetCacheDB] Get failed: [store]=[${storeName}] [key]=[${key}]`, error);
      return null;
    }
  }

  private getEntry(storeName: StoreName, key: string): Promise<DBCacheEntry | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private updateTimestamp(storeName: StoreName, key: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as DBCacheEntry | undefined;
          if (entry) {
            entry.timestamp = Date.now();
            store.put(entry);
          }
          resolve();
        };
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // ============================================================================
  // Write Operations
  // ============================================================================

  /**
   * Store data in IndexedDB with LRU eviction on quota exceeded.
   * @param storeName - Target object store
   * @param key - Cache key
   * @param data - Data to store
   * @returns true if stored successfully, false otherwise
   */
  async put(storeName: StoreName, key: string, data: ArrayBuffer | string | Blob): Promise<boolean> {
    if (!this.isAvailable || !this.db) return false;

    const entry: DBCacheEntry = {
      key,
      data,
      timestamp: Date.now(),
    };

    try {
      await this.putEntry(storeName, entry);
      return true;
    } catch (error) {
      if (!this.isQuotaError(error)) {
        console.warn(`[AssetCacheDB] Put failed: [store]=[${storeName}] [key]=[${key}]`, error);
        return false;
      }

      // Quota exceeded - evict oldest entries and retry
      console.warn(`[AssetCacheDB] Quota exceeded, evicting oldest entries: [store]=[${storeName}]`);

      try {
        await this.evictOldest(storeName, LRU_EVICTION_COUNT);
        await this.putEntry(storeName, entry);
        return true;
      } catch (retryError) {
        console.warn(`[AssetCacheDB] Put failed after eviction: [store]=[${storeName}] [key]=[${key}]`);
        return false;
      }
    }
  }

  private putEntry(storeName: StoreName, entry: DBCacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================================================
  // Eviction
  // ============================================================================

  /**
   * Delete the oldest entries from a store based on access timestamp (LRU).
   * @param storeName - Target object store
   * @param count - Number of entries to evict
   */
  private evictOldest(storeName: StoreName, count: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(); // ascending order (oldest first)

      let deleted = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          console.log(`[AssetCacheDB] Evicted [count]=[${deleted}] entries from [store]=[${storeName}]`);
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private isQuotaError(error: unknown): boolean {
    if (error instanceof DOMException) {
      return error.name === 'QuotaExceededError' || error.code === 22;
    }
    return false;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear cached data. If storeName is provided, clears only that store.
   * Otherwise, clears all stores.
   * @param storeName - Optional specific store to clear
   */
  async clear(storeName?: StoreName): Promise<void> {
    if (!this.isAvailable || !this.db) return;

    try {
      if (storeName) {
        await this.clearStore(storeName);
      } else {
        for (const name of Object.values(STORE_NAMES)) {
          await this.clearStore(name);
        }
      }
    } catch (error) {
      console.warn('[AssetCacheDB] Clear failed', error);
    }
  }

  private clearStore(storeName: StoreName): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get the number of entries in each object store.
   */
  async getStats(): Promise<Record<StoreName, number>> {
    const stats = {} as Record<StoreName, number>;

    for (const name of Object.values(STORE_NAMES)) {
      stats[name] = await this.getStoreCount(name);
    }

    return stats;
  }

  private async getStoreCount(storeName: StoreName): Promise<number> {
    if (!this.isAvailable || !this.db) return 0;

    try {
      return await new Promise<number>((resolve, reject) => {
        const tx = this.db!.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return 0;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Close the database connection.
   */
  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isAvailable = false;
  }
}
