import { Application } from 'pixi.js';
import { GAME_CONFIG } from '@/constants/config';
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

  constructor(container: HTMLElement) {
    this.container = container;
    this.app = new Application();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.app.init({
      width: GAME_CONFIG.WIDTH,
      height: GAME_CONFIG.HEIGHT,
      backgroundColor: GAME_CONFIG.BACKGROUND_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.container.appendChild(this.app.canvas);

    // Initialize persistent asset cache (IndexedDB)
    await AssetManager.getInstance().init();

    this.setupGameLoop();
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
}
