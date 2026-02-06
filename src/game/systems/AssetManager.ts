// ============================================================================
// Asset Manager - Two-Level Caching (L1: Memory, L2: IndexedDB)
// ============================================================================

import { GifSource } from 'pixi.js/gif';
import { GAME_CONFIG } from '@/constants/config';
import { AssetCacheDB, STORE_NAMES } from './AssetCacheDB';
import type { CharacterLook, CharacterAnimation } from '@/data/characterLook';
import { buildItemsString, buildLookCacheKey } from '@/data/characterLook';

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

  // L1: Memory cache (fast, volatile)
  private mobGifCache: Map<string, CacheEntry<GifSource>> = new Map();
  private characterGifCache: Map<string, CacheEntry<GifSource>> = new Map();
  private bgmCache: Map<string, CacheEntry<string>> = new Map();
  private imageCache: Map<string, CacheEntry<Blob>> = new Map();
  private mobSoundCache: Map<string, CacheEntry<string>> = new Map();
  private gameSoundCache: Map<string, CacheEntry<string>> = new Map();

  // L2: IndexedDB cache (persistent, slower)
  private cacheDB: AssetCacheDB;

  // Loading state tracking (prevent duplicate requests)
  private loadingPromises: Map<string, Promise<unknown>> = new Map();

  // ============================================================================
  // Singleton
  // ============================================================================

  private constructor() {
    this.cacheDB = new AssetCacheDB();
  }

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Initialize persistent cache (IndexedDB).
   * Must be called once before using the asset manager.
   */
  async init(): Promise<void> {
    await this.cacheDB.init();
  }

  // ============================================================================
  // Mob GIF Assets
  // ============================================================================

  /**
   * Get mob animation GIF with two-level caching.
   * L1 (memory) -> L2 (IndexedDB) -> API fetch
   * @param mobId - Monster ID
   * @param animation - Animation name (stand, move, hit1, die1)
   */
  async getMobGif(mobId: number, animation: string): Promise<GifSource | null> {
    const cacheKey = `mob_${mobId}_${animation}`;

    // L1: Memory cache
    const cached = this.mobGifCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup: reuse in-flight request
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<GifSource | null>;
    }

    // L2 (IndexedDB) -> L3 (API)
    const loadPromise = this.resolveMobGif(mobId, animation, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const gifSource = await loadPromise;
      if (gifSource) {
        this.setMemoryCache(this.mobGifCache, cacheKey, gifSource);
      }
      return gifSource;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveMobGif(mobId: number, animation: string, cacheKey: string): Promise<GifSource | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.MOB_GIFS, cacheKey);
    if (dbData) {
      try {
        console.log(`[AssetManager] IndexedDB hit: [key]=[${cacheKey}]`);
        return await GifSource.from(dbData as ArrayBuffer);
      } catch {
        console.warn(`[AssetManager] Corrupted cache, re-fetching: [key]=[${cacheKey}]`);
      }
    }

    // L3: API fetch
    return this.fetchMobGif(mobId, animation, cacheKey);
  }

  private async fetchMobGif(mobId: number, animation: string, cacheKey: string): Promise<GifSource | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/mob/${mobId}/render/${animation}`;
      console.log(`[AssetManager] Fetching mob GIF: [mobId]=[${mobId}] [animation]=[${animation}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Store raw ArrayBuffer in IndexedDB (fire and forget)
      this.cacheDB.put(STORE_NAMES.MOB_GIFS, cacheKey, arrayBuffer).catch(() => {});

      return await GifSource.from(arrayBuffer);
    } catch (error) {
      console.error(`[AssetManager] Failed to load mob GIF: [mobId]=[${mobId}] [animation]=[${animation}]`, error);
      return null;
    }
  }

  // ============================================================================
  // Character GIF Assets
  // ============================================================================

  /**
   * Get character animation GIF with two-level caching.
   * URL: /api/{region}/{version}/Character/animated/{skinId}/{items}/{animation}
   * @param look - Character visual appearance
   * @param animation - Animation name (stand1, swingO1, etc.)
   */
  async getCharacterGif(look: CharacterLook, animation: CharacterAnimation): Promise<GifSource | null> {
    const cacheKey = buildLookCacheKey(look, animation);

    // L1: Memory cache
    const cached = this.characterGifCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup: reuse in-flight request
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<GifSource | null>;
    }

    // L2 (IndexedDB) -> L3 (API)
    const loadPromise = this.resolveCharacterGif(look, animation, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const gifSource = await loadPromise;
      if (gifSource) {
        this.setMemoryCache(this.characterGifCache, cacheKey, gifSource);
      }
      return gifSource;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveCharacterGif(
    look: CharacterLook,
    animation: CharacterAnimation,
    cacheKey: string,
  ): Promise<GifSource | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.CHARACTER_GIFS, cacheKey);
    if (dbData) {
      try {
        console.log(`[AssetManager] IndexedDB hit (character): [key]=[${cacheKey}]`);
        return await GifSource.from(dbData as ArrayBuffer);
      } catch {
        console.warn(`[AssetManager] Corrupted character cache, re-fetching: [key]=[${cacheKey}]`);
      }
    }

    // L3: API fetch
    return this.fetchCharacterGif(look, animation, cacheKey);
  }

  private async fetchCharacterGif(
    look: CharacterLook,
    animation: CharacterAnimation,
    cacheKey: string,
  ): Promise<GifSource | null> {
    try {
      const itemsStr = buildItemsString(look);
      // renderMode=4 (FeetCenter): feet always at canvas center for consistent vertical alignment
      const url = `${GAME_CONFIG.API_BASE_URL}/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Character/animated/${look.skinId}/${itemsStr}/${animation}?renderMode=4`;
      console.log(`[AssetManager] Fetching character GIF: [skinId]=[${look.skinId}] [animation]=[${animation}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Store in IndexedDB (fire and forget)
      this.cacheDB.put(STORE_NAMES.CHARACTER_GIFS, cacheKey, arrayBuffer).catch(() => {});

      return await GifSource.from(arrayBuffer);
    } catch (error) {
      console.error(
        `[AssetManager] Failed to load character GIF: [skinId]=[${look.skinId}] [animation]=[${animation}]`,
        error,
      );
      return null;
    }
  }

  // ============================================================================
  // BGM Assets
  // ============================================================================

  /**
   * Get BGM audio data with two-level caching.
   * @param bgmPath - BGM path (e.g., "Bgm02/AboveTheTreetops")
   */
  async getBgm(bgmPath: string): Promise<string | null> {
    const cacheKey = `bgm_${bgmPath}`;

    // L1: Memory cache
    const cached = this.bgmCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // L2 -> L3
    const loadPromise = this.resolveBgm(bgmPath, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const bgmData = await loadPromise;
      if (bgmData) {
        this.setMemoryCache(this.bgmCache, cacheKey, bgmData);
      }
      return bgmData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveBgm(bgmPath: string, cacheKey: string): Promise<string | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.BGM, cacheKey);
    if (dbData) {
      console.log(`[AssetManager] IndexedDB hit: [key]=[${cacheKey}]`);
      return dbData as string;
    }

    // L3: API fetch
    return this.fetchBgm(bgmPath, cacheKey);
  }

  private async fetchBgm(bgmPath: string, cacheKey: string): Promise<string | null> {
    try {
      const parts = bgmPath.split('/');
      if (parts.length !== 2) {
        console.warn(`[AssetManager] Invalid BGM path format: [bgmPath]=[${bgmPath}]`);
        return null;
      }

      const [folder, name] = parts;
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/${folder}.img/${name}`;
      console.log(`[AssetManager] Fetching BGM: [bgmPath]=[${bgmPath}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const data = await response.json();

      if (data.type === 11 && data.value) {
        // Store in IndexedDB (fire and forget)
        this.cacheDB.put(STORE_NAMES.BGM, cacheKey, data.value).catch(() => {});
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
   * Get mob sound data with two-level caching.
   * @param mobId - Monster ID (with leading zeros, e.g., "1210100")
   * @param soundType - Sound type ("Damage" or "Die")
   */
  async getMobSound(mobId: string, soundType: 'Damage' | 'Die'): Promise<string | null> {
    const cacheKey = `mobSound_${mobId}_${soundType}`;

    // L1: Memory cache
    const cached = this.mobSoundCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // L2 -> L3
    const loadPromise = this.resolveMobSound(mobId, soundType, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const soundData = await loadPromise;
      if (soundData) {
        this.setMemoryCache(this.mobSoundCache, cacheKey, soundData);
      }
      return soundData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveMobSound(mobId: string, soundType: 'Damage' | 'Die', cacheKey: string): Promise<string | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.MOB_SOUNDS, cacheKey);
    if (dbData) {
      return dbData as string;
    }

    // L3: API fetch
    return this.fetchMobSound(mobId, soundType, cacheKey);
  }

  private async fetchMobSound(mobId: string, soundType: string, cacheKey: string): Promise<string | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/Mob.img/${mobId}/${soundType}`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.type === 11 && data.value) {
        this.cacheDB.put(STORE_NAMES.MOB_SOUNDS, cacheKey, data.value).catch(() => {});
        return data.value;
      }

      return null;
    } catch {
      // Silently fail - not all mobs have sounds
      return null;
    }
  }

  // ============================================================================
  // Game Sound Assets
  // ============================================================================

  /**
   * Get game sound data with two-level caching.
   * @param soundPath - Sound path (e.g., "Game.img/PickUpItem")
   */
  async getGameSound(soundPath: string): Promise<string | null> {
    const cacheKey = `gameSound_${soundPath}`;

    // L1: Memory cache
    const cached = this.gameSoundCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<string | null>;
    }

    // L2 -> L3
    const loadPromise = this.resolveGameSound(soundPath, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const soundData = await loadPromise;
      if (soundData) {
        this.setMemoryCache(this.gameSoundCache, cacheKey, soundData);
      }
      return soundData;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveGameSound(soundPath: string, cacheKey: string): Promise<string | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.GAME_SOUNDS, cacheKey);
    if (dbData) {
      return dbData as string;
    }

    // L3: API fetch
    return this.fetchGameSound(soundPath, cacheKey);
  }

  private async fetchGameSound(soundPath: string, cacheKey: string): Promise<string | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/wz/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/Sound/${soundPath}`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.type === 11 && data.value) {
        this.cacheDB.put(STORE_NAMES.GAME_SOUNDS, cacheKey, data.value).catch(() => {});
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
   * Get image blob with two-level caching.
   * @param type - Asset type
   * @param id - Asset ID
   * @param variant - Variant name (e.g., "icon", "render")
   */
  async getImage(type: AssetType, id: number | string, variant: string = 'icon'): Promise<Blob | null> {
    const cacheKey = `${type}_${id}_${variant}`;

    // L1: Memory cache
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    // Dedup
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey) as Promise<Blob | null>;
    }

    // L2 -> L3
    const loadPromise = this.resolveImage(type, id, variant, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const blob = await loadPromise;
      if (blob) {
        this.setMemoryCache(this.imageCache, cacheKey, blob);
      }
      return blob;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async resolveImage(type: AssetType, id: number | string, variant: string, cacheKey: string): Promise<Blob | null> {
    // L2: IndexedDB
    const dbData = await this.cacheDB.get(STORE_NAMES.IMAGES, cacheKey);
    if (dbData) {
      console.log(`[AssetManager] IndexedDB hit: [key]=[${cacheKey}]`);
      return dbData as Blob;
    }

    // L3: API fetch
    return this.fetchImage(type, id, variant, cacheKey);
  }

  private async fetchImage(type: AssetType, id: number | string, variant: string, cacheKey: string): Promise<Blob | null> {
    try {
      const url = `${GAME_CONFIG.API_BASE_URL}/${GAME_CONFIG.API_REGION}/${GAME_CONFIG.API_VERSION}/${type}/${id}/${variant}`;
      console.log(`[AssetManager] Fetching image: [type]=[${type}] [id]=[${id}] [variant]=[${variant}]`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: [status]=[${response.status}]`);
      }

      const blob = await response.blob();

      // Store in IndexedDB (fire and forget)
      this.cacheDB.put(STORE_NAMES.IMAGES, cacheKey, blob).catch(() => {});

      return blob;
    } catch (error) {
      console.error(`[AssetManager] Failed to load image: [type]=[${type}] [id]=[${id}] [variant]=[${variant}]`, error);
      return null;
    }
  }

  // ============================================================================
  // Preloading
  // ============================================================================

  /**
   * Preload multiple mob animations in parallel.
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
   * Preload character animations in parallel.
   * @param look - Character visual appearance
   * @param animations - Array of animation names to preload
   */
  async preloadCharacterAnimations(
    look: CharacterLook,
    animations: CharacterAnimation[],
  ): Promise<void> {
    const promises = animations.map((anim) => this.getCharacterGif(look, anim));
    await Promise.all(promises);
    console.log(`[AssetManager] Preloaded ${animations.length} character animations: [skinId]=[${look.skinId}]`);
  }

  /**
   * Preload BGM files in parallel.
   */
  async preloadBgm(bgmPaths: string[]): Promise<void> {
    const promises = bgmPaths.map((path) => this.getBgm(path));
    await Promise.all(promises);
    console.log(`[AssetManager] Preloaded ${bgmPaths.length} BGM files`);
  }

  /**
   * Preload mob sounds in parallel.
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

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get cache statistics for both L1 (memory) and L2 (IndexedDB).
   */
  async getCacheStats(): Promise<{
    memory: { mobGifs: number; characterGifs: number; bgm: number; images: number; mobSounds: number; gameSounds: number };
    indexedDB: Record<string, number>;
  }> {
    const dbStats = await this.cacheDB.getStats();

    return {
      memory: {
        mobGifs: this.mobGifCache.size,
        characterGifs: this.characterGifCache.size,
        bgm: this.bgmCache.size,
        images: this.imageCache.size,
        mobSounds: this.mobSoundCache.size,
        gameSounds: this.gameSoundCache.size,
      },
      indexedDB: dbStats,
    };
  }

  /**
   * Clear all caches (both L1 memory and L2 IndexedDB).
   */
  async clearCache(): Promise<void> {
    this.clearMemoryCache();
    await this.cacheDB.clear();
    console.log('[AssetManager] All caches cleared (memory + IndexedDB)');
  }

  /**
   * Clear cache by type (both L1 and L2).
   */
  async clearCacheByType(type: 'mob' | 'character' | 'bgm' | 'image' | 'mobSound' | 'gameSound'): Promise<void> {
    switch (type) {
      case 'mob':
        this.mobGifCache.clear();
        await this.cacheDB.clear(STORE_NAMES.MOB_GIFS);
        break;
      case 'character':
        this.characterGifCache.clear();
        await this.cacheDB.clear(STORE_NAMES.CHARACTER_GIFS);
        break;
      case 'bgm':
        this.bgmCache.clear();
        await this.cacheDB.clear(STORE_NAMES.BGM);
        break;
      case 'image':
        this.imageCache.clear();
        await this.cacheDB.clear(STORE_NAMES.IMAGES);
        break;
      case 'mobSound':
        this.mobSoundCache.clear();
        await this.cacheDB.clear(STORE_NAMES.MOB_SOUNDS);
        break;
      case 'gameSound':
        this.gameSoundCache.clear();
        await this.cacheDB.clear(STORE_NAMES.GAME_SOUNDS);
        break;
    }
    console.log(`[AssetManager] Cache cleared: [type]=[${type}] (memory + IndexedDB)`);
  }

  /**
   * Clear only L1 memory cache (keep IndexedDB intact).
   * Useful for reducing memory usage without losing persistent cache.
   */
  clearMemoryCache(): void {
    this.mobGifCache.clear();
    this.characterGifCache.clear();
    this.bgmCache.clear();
    this.imageCache.clear();
    this.mobSoundCache.clear();
    this.gameSoundCache.clear();
    console.log('[AssetManager] Memory cache cleared');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private setMemoryCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.clearMemoryCache();
    this.cacheDB.destroy();
    AssetManager.instance = null;
  }
}
