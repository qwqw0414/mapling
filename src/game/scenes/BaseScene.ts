import { Container } from 'pixi.js';

// ============================================================================
// Base Scene Class
// ============================================================================

export abstract class BaseScene {
  public container: Container;
  protected isInitialized = false;

  constructor() {
    this.container = new Container();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.load();
    this.create();
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.container.destroy({ children: true });
    this.isInitialized = false;
  }

  // ============================================================================
  // Abstract Methods
  // ============================================================================

  protected abstract load(): Promise<void>;
  protected abstract create(): void;
  abstract update(deltaTime: number): void;
}
