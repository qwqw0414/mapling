// ============================================================================
// Asset Manager - Runtime Caching
// ============================================================================

import { GifSource } from 'pixi.js/gif';
import { GAME_CONFIG } from '@/constants/config';

// ============================================================================
// Types
// ============================================================================

type AssetType = 'mob' | 'bgm' | 'map' | 'item' | 'npc';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// AssetManager Class (Singleton)
// ============================================================================

export class AssetManager {
  private static instance: AssetManager | null = null;

  // Cache storage by type
  private mobGifCache: Map<string, CacheEntry<GifSource>> = new Map();
  private bgmCache: Map<string, CacheEntry<string>> = new Map(); // base64 data
  private imageCache: Map<string, CacheEntry<Blob>> = new Map();
  private mobSoundCache: Map<string, CacheEntry<string>> = new Map(); // base64 data

  // Loading state tracking (prevent duplicate requests)
  private loadingPromises: Map<string, Promise<unknown>> = new Map();

  // ============================================================================
  // Singleton
  // ============================================================================

  private constructor() {}

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  // ============================================================================
  // Mob GIF Assets
  // ============================================================================

  /**
   * Get mob animation GIF (cached)
   * @param mobId - Monster ID
   * @param animation - Animation name (stand, move, hit1, die1)
   */
  async getMobGif(mobId: number, animation: string): Promise<GifSource | null> {
    const cacheKey = `mob_${mobId}_${animation}`;

    // Check cache
    const cached = this.mobGifCache.get(cacheKey);
    if (cached) {
      console.log(`[AssetManager] Cache hit: [key]=[${cacheKey}]`);
      return cached.data;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      console.log(`[AssetManager] Waiting for loading: [key]=[${cacheKey}]`);
      return this.loadingPromises.get(cacheKey) as Promise<GifSource | null>;
    }

    // Load from API
    const loadPromise = this.loadMobGif(mobId, animation);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const gifSource = await loadPromise;
      if (gifSource) {
        this.mobGifCache.set(cacheKey, {
          data: gifSource,
          timestamp: Date.now(),
        });
        console.log(`[AssetManager] Cached: [key]=[${cacheKey}]`);
      }
      return gifSource;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadMobGif(mobId: number, animation: string): Promise<GifSource | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/mob/${mobId}/render/${animation}`;
      console.log(`[AssetManager] Loading mob GIF: [mobId]=[${mobId}] [animation]=[${animation}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const gifSource = await GifSource.from(arrayBuffer);
      return gifSource;
    } catch (error) {
      console.error(`[AssetManager] Failed to load mob GIF: [mobId]=[${mobId}] [animation]=[${animation}]`, error);
      return null;
    }
  }

  // ============================================================================
  // BGM Assets
  // ============================================================================

  /**
   * Get BGM audio data (cached)
   * @param bgmPath - BGM path (e.g., "Bgm02/AboveTheTreetops")
   */
  async getBgm(bgmPath: string): Promise<string | null> {
    const cacheKey = `bgm_${bgmPath}`;

    // Check cache
    const cached = this.bgmCache.get(cacheKey);
    if (cached) {
      console.log(`[AssetManager] Cache hit: [key]=[${cacheKey}]`);
      return cached.data;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      console.log(`[AssetManager] Waiting for loading: [key]=[${cacheKey}]`);
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // Load from API
    const loadPromise = this.loadBgm(bgmPath);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const bgmData = await loadPromise;
      if (bgmData) {
        this.bgmCache.set(cacheKey, {
          data: bgmData,
          timestamp: Date.now(),
        });
        console.log(`[AssetManager] Cached: [key]=[${cacheKey}]`);
      }
      return bgmData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadBgm(bgmPath: string): Promise<string | null> {
    try {
      const parts = bgmPath.split('/');
      if (parts.length !== 2) {
        console.warn(`[AssetManager] Invalid BGM path format: [bgmPath]=[${bgmPath}]`);
        return null;
      }

      const [folder, name] = parts;
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/${folder}.img/${name}`;
      console.log(`[AssetManager] Loading BGM: [bgmPath]=[${bgmPath}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const data = await response.json();

      // API returns { type: 11, value: "base64 encoded audio data" }
      if (data.type === 11 && data.value) {
        return data.value;
      }

      return null;
    } catch (error) {
      console.error(`[AssetManager] Failed to load BGM: [bgmPath]=[${bgmPath}]`, error);
      return null;
    }
  }

  // ============================================================================
  // Mob Sound Assets
  // ============================================================================

  /**
   * Get mob sound data (cached)
   * @param mobId - Monster ID (with leading zeros, e.g., "1210100")
   * @param soundType - Sound type ("Damage" or "Die")
   */
  async getMobSound(mobId: string, soundType: 'Damage' | 'Die'): Promise<string | null> {
    const cacheKey = `mobSound_${mobId}_${soundType}`;

    // Check cache
    const cached = this.mobSoundCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // Load from API
    const loadPromise = this.loadMobSound(mobId, soundType);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const soundData = await loadPromise;
      if (soundData) {
        this.mobSoundCache.set(cacheKey, {
          data: soundData,
          timestamp: Date.now(),
        });
        console.log(`[AssetManager] Cached mob sound: [mobId]=[${mobId}] [type]=[${soundType}]`);
      }
      return soundData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadMobSound(mobId: string, soundType: string): Promise<string | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/Mob.img/${mobId}/${soundType}`;

      const response = await fetch(url);
      if (!response.ok) {
        // Sound might not exist for this mob
        return null;
      }

      const data = await response.json();

      // API returns { type: 11, value: "base64 encoded audio data" }
      if (data.type === 11 && data.value) {
        return data.value;
      }

      return null;
    } catch (error) {
      // Silently fail - not all mobs have sounds
      return null;
    }
  }

  // ============================================================================
  // Game Sound Assets
  // ============================================================================

  /**
   * Game sound cache
   */
  private gameSoundCache: Map<string, CacheEntry<string>> = new Map();

  /**
   * Get game sound data (cached)
   * @param soundPath - Sound path (e.g., "Game.img/PickUpItem")
   */
  async getGameSound(soundPath: string): Promise<string | null> {
    const cacheKey = `gameSound_${soundPath}`;

    // Check cache
    const cached = this.gameSoundCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // Load from API
    const loadPromise = this.loadGameSound(soundPath);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const soundData = await loadPromise;
      if (soundData) {
        this.gameSoundCache.set(cacheKey, {
          data: soundData,
          timestamp: Date.now(),
        });
        console.log(`[AssetManager] Cached game sound: [path]=[${soundPath}]`);
      }
      return soundData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadGameSound(soundPath: string): Promise<string | null> {
    try {
      // soundPath format: "Game.img/PickUpItem" -> Sound/Game.img/PickUpItem
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/${soundPath}`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // API returns { type: 11, value: "base64 encoded audio data" }
      if (data.type === 11 && data.value) {
        return data.value;
      }

      return null;
    } catch (error) {
      console.error(`[AssetManager] Failed to load game sound: [path]=[${soundPath}]`, error);
      return null;
    }
  }

  // ============================================================================
  // Generic Image Assets
  // ============================================================================

  /**
   * Get image blob (cached)
   * @param type - Asset type
   * @param id - Asset ID
   * @param variant - Variant name (e.g., "icon", "render")
   */
  async getImage(type: AssetType, id: number | string, variant: string = 'icon'): Promise<Blob | null> {
    const cacheKey = `${type}_${id}_${variant}`;

    // Check cache
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      console.log(`[AssetManager] Cache hit: [key]=[${cacheKey}]`);
      return cached.data;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      console.log(`[AssetManager] Waiting for loading: [key]=[${cacheKey}]`);
      return this.loadingPromises.get(cacheKey) as Promise<Blob | null>;
    }

    // Load from API
    const loadPromise = this.loadImage(type, id, variant);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const blob = await loadPromise;
      if (blob) {
        this.imageCache.set(cacheKey, {
          data: blob,
          timestamp: Date.now(),
        });
        console.log(`[AssetManager] Cached: [key]=[${cacheKey}]`);
      }
      return blob;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async loadImage(type: AssetType, id: number | string, variant: string): Promise<Blob | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/${type}/${id}/${variant}`;
      console.log(`[AssetManager] Loading image: [type]=[${type}] [id]=[${id}] [variant]=[${variant}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      return await response.blob();
    } catch (error) {
      console.error(`[AssetManager] Failed to load image: [type]=[${type}] [id]=[${id}] [variant]=[${variant}]`, error);
      return null;
    }
  }

  // ============================================================================
  // Preloading
  // ============================================================================

  /**
   * Preload multiple mob animations
   */
  async preloadMobAnimations(mobIds: number[], animations: string[] = ['stand', 'move']): Promise<void> {
    const promises: Promise<GifSource | null>[] = [];

    for (const mobId of mobIds) {
      for (const animation of animations) {
        promises.push(this.getMobGif(mobId, animation));
      }
    }

    await Promise.all(promises);
    console.log(`[AssetManager] Preloaded ${promises.length} mob animations`);
  }

  /**
   * Preload BGM
   */
  async preloadBgm(bgmPaths: string[]): Promise<void> {
    const promises = bgmPaths.map((path) => this.getBgm(path));
    await Promise.all(promises);
    console.log(`[AssetManager] Preloaded ${bgmPaths.length} BGM files`);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Preload mob sounds
   */
  async preloadMobSounds(mobIds: string[]): Promise<void> {
    const promises: Promise<string | null>[] = [];
    const soundTypes: Array<'Damage' | 'Die'> = ['Damage', 'Die'];

    for (const mobId of mobIds) {
      for (const soundType of soundTypes) {
        promises.push(this.getMobSound(mobId, soundType));
      }
    }

    await Promise.all(promises);
    console.log(`[AssetManager] Preloaded sounds for ${mobIds.length} mobs`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { mobGifs: number; bgm: number; images: number; mobSounds: number; gameSounds: number } {
    return {
      mobGifs: this.mobGifCache.size,
      bgm: this.bgmCache.size,
      images: this.imageCache.size,
      mobSounds: this.mobSoundCache.size,
      gameSounds: this.gameSoundCache.size,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.mobGifCache.clear();
    this.bgmCache.clear();
    this.imageCache.clear();
    this.mobSoundCache.clear();
    this.gameSoundCache.clear();
    console.log('[AssetManager] All caches cleared');
  }

  /**
   * Clear cache by type
   */
  clearCacheByType(type: 'mob' | 'bgm' | 'image' | 'mobSound' | 'gameSound'): void {
    switch (type) {
      case 'mob':
        this.mobGifCache.clear();
        break;
      case 'bgm':
        this.bgmCache.clear();
        break;
      case 'image':
        this.imageCache.clear();
        break;
      case 'mobSound':
        this.mobSoundCache.clear();
        break;
      case 'gameSound':
        this.gameSoundCache.clear();
        break;
    }
    console.log(`[AssetManager] Cache cleared: [type]=[${type}]`);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.clearCache();
    AssetManager.instance = null;
  }
}
