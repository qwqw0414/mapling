import { GAME_CONFIG } from '@/constants/config';
import type { MobData } from '@/types/monster';
import type { Item } from '@/types/item';
import type { MapInfo } from '@/types/map';

// ============================================================================
// MapleStory.IO API Service
// ============================================================================

export class MapleStoryAPI {
  private baseUrl: string;
  private region: string;
  private version: string;

  constructor() {
    this.baseUrl = GAME_CONFIG.API_BASE_URL;
    this.region = GAME_CONFIG.API_REGION;
    this.version = GAME_CONFIG.API_VERSION;
  }

  // ============================================================================
  // URL Builders
  // ============================================================================

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}/${this.region}/${this.version}${endpoint}`;
  }

  private buildImageUrl(endpoint: string): string {
    return this.buildUrl(endpoint);
  }

  // ============================================================================
  // Monster API
  // ============================================================================

  async searchMobs(params: {
    name?: string;
    minLevel?: number;
    maxLevel?: number;
    count?: number;
  }): Promise<MobData[]> {
    const query = new URLSearchParams();
    if (params.name) query.set('searchFor', params.name);
    if (params.minLevel) query.set('minLevelFilter', params.minLevel.toString());
    if (params.maxLevel) query.set('maxLevelFilter', params.maxLevel.toString());
    if (params.count) query.set('count', params.count.toString());

    const url = this.buildUrl(`/mob?${query.toString()}`);
    const response = await fetch(url);
    return response.json();
  }

  async getMobInfo(mobId: number): Promise<MobData> {
    const url = this.buildUrl(`/mob/${mobId}`);
    const response = await fetch(url);
    return response.json();
  }

  getMobIconUrl(mobId: number): string {
    return this.buildImageUrl(`/mob/${mobId}/icon`);
  }

  getMobRenderUrl(mobId: number, animation: string = 'stand'): string {
    return this.buildImageUrl(`/mob/${mobId}/render/${animation}`);
  }

  // ============================================================================
  // Item API
  // ============================================================================

  async searchItems(params: {
    name?: string;
    category?: string;
    minLevel?: number;
    maxLevel?: number;
    count?: number;
  }): Promise<Item[]> {
    const query = new URLSearchParams();
    if (params.name) query.set('searchFor', params.name);
    if (params.category) query.set('overallCategoryFilter', params.category);
    if (params.minLevel) query.set('minLevelFilter', params.minLevel.toString());
    if (params.maxLevel) query.set('maxLevelFilter', params.maxLevel.toString());
    if (params.count) query.set('count', params.count.toString());

    const url = this.buildUrl(`/item?${query.toString()}`);
    const response = await fetch(url);
    return response.json();
  }

  async getItemInfo(itemId: number): Promise<Item> {
    const url = this.buildUrl(`/item/${itemId}`);
    const response = await fetch(url);
    return response.json();
  }

  getItemIconUrl(itemId: number): string {
    return this.buildImageUrl(`/item/${itemId}/icon`);
  }

  // ============================================================================
  // Map API
  // ============================================================================

  async searchMaps(params: {
    name?: string;
    count?: number;
  }): Promise<MapInfo[]> {
    const query = new URLSearchParams();
    if (params.name) query.set('searchFor', params.name);
    if (params.count) query.set('count', params.count.toString());

    const url = this.buildUrl(`/map?${query.toString()}`);
    const response = await fetch(url);
    return response.json();
  }

  async getMapInfo(mapId: number): Promise<MapInfo> {
    const url = this.buildUrl(`/map/${mapId}`);
    const response = await fetch(url);
    return response.json();
  }

  getMapMinimapUrl(mapId: number): string {
    return this.buildImageUrl(`/map/${mapId}/minimap`);
  }

  getMapRenderUrl(mapId: number): string {
    return this.buildImageUrl(`/map/${mapId}/render`);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const mapleStoryAPI = new MapleStoryAPI();
