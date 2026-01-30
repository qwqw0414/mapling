import { Container, Sprite } from 'pixi.js';
import type { CharacterState } from '@/types/character';

// ============================================================================
// Character Entity
// ============================================================================

export class Character {
  public container: Container;
  private sprite: Sprite | null = null;
  private state: CharacterState;

  constructor(state: CharacterState) {
    this.container = new Container();
    this.state = state;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async loadSprite(_skinId: number): Promise<void> {
    // TODO: Load character sprite from API
  }

  update(_deltaTime: number): void {
    // TODO: Update character animation
  }

  getState(): CharacterState {
    return this.state;
  }

  // ============================================================================
  // Combat Methods
  // ============================================================================

  takeDamage(amount: number): void {
    this.state.hp = Math.max(0, this.state.hp - amount);
  }

  heal(amount: number): void {
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
  }

  isDead(): boolean {
    return this.state.hp <= 0;
  }

  // ============================================================================
  // Animation Methods
  // ============================================================================

  playAttack(): void {
    // TODO: Play attack animation
  }

  playHit(): void {
    // TODO: Play hit animation
  }

  playDeath(): void {
    // TODO: Play death animation
  }
}
