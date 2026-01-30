import { BaseScene } from './BaseScene';

// ============================================================================
// Town Scene (Idle/Preparation State)
// ============================================================================

export class TownScene extends BaseScene {
  constructor() {
    super();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  protected async load(): Promise<void> {
    // TODO: Load town assets
  }

  protected create(): void {
    // TODO: Create town UI
    // - Character info panel
    // - Inventory panel
    // - Skill panel
    // - Shop panel
    // - Enhancement panel
    // - Field selection
  }

  update(_deltaTime: number): void {
    // TODO: Update town state
  }
}
