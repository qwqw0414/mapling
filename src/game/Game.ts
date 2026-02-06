import { Application } from 'pixi.js';
import { GAME_CONFIG, updateMapSize } from '@/constants/config';
import type { BaseScene } from './scenes/BaseScene';
import { MainScene } from './scenes/MainScene';
import { AssetManager } from './systems/AssetManager';

// ============================================================================
// Game Class
// ============================================================================

export class Game {
  private app: Application;
  private container: HTMLElement;
  private currentScene: BaseScene | null = null;
  private isInitialized = false;
  private resizeHandler: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.app = new Application();
    this.resizeHandler = this.handleResize.bind(this);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Get initial size from container
    const { width, height } = this.getContainerSize();
    updateMapSize(width, height);

    await this.app.init({
      width,
      height,
      backgroundColor: GAME_CONFIG.BACKGROUND_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: this.container,
    });

    this.container.appendChild(this.app.canvas);

    // Initialize persistent asset cache (IndexedDB)
    await AssetManager.getInstance().init();

    this.setupGameLoop();
    this.setupResizeListener();
    this.isInitialized = true;

    console.log('[Game] Initialized');

    // Start main scene (single page layout)
    await this.startMainScene();
  }

  async changeScene(scene: BaseScene): Promise<void> {
    if (this.currentScene) {
      await this.currentScene.destroy();
      this.app.stage.removeChildren();
    }

    this.currentScene = scene;
    await scene.init();
    this.app.stage.addChild(scene.container);
  }

  getApp(): Application {
    return this.app;
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.app.destroy(true);
  }

  // ============================================================================
  // Scene Methods
  // ============================================================================

  private async startMainScene(): Promise<void> {
    const mainScene = new MainScene(104010001); // 돼지의 해안가
    await this.changeScene(mainScene);
    console.log('[Game] Main scene started');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupGameLoop(): void {
    this.app.ticker.add((time) => {
      if (this.currentScene) {
        this.currentScene.update(time.deltaTime);
      }
    });
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', this.resizeHandler);
  }

  private handleResize(): void {
    const { width, height } = this.getContainerSize();
    updateMapSize(width, height);

    // Notify current scene about resize if it supports it
    if (this.currentScene && 'onResize' in this.currentScene) {
      (this.currentScene as BaseScene & { onResize: (w: number, h: number) => void }).onResize(width, height);
    }

    console.log(`[Game] Resized to ${width}x${height}`);
  }

  private getContainerSize(): { width: number; height: number } {
    return {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || window.innerHeight,
    };
  }
}
