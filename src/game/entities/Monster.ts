import { Container, Sprite } from 'pixi.js';
import type { MonsterInstance, MonsterInfo } from '@/types/monster';

// ============================================================================
// Monster Entity
// ============================================================================

export class Monster {
  public container: Container;
  private sprite: Sprite | null = null;
  private instance: MonsterInstance;

  constructor(instance: MonsterInstance) {
    this.container = new Container();
    this.instance = instance;
    this.container.x = instance.x;
    this.container.y = instance.y;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async loadSprite(): Promise<void> {
    // TODO: Load monster sprite from API
  }

  update(_deltaTime: number): void {
    // TODO: Update monster animation and movement
  }

  getInstance(): MonsterInstance {
    return this.instance;
  }

  getInfo(): MonsterInfo {
    return this.instance.info;
  }

  // ============================================================================
  // Combat Methods
  // ============================================================================

  takeDamage(amount: number): void {
    this.instance.currentHp = Math.max(0, this.instance.currentHp - amount);
  }

  isDead(): boolean {
    return this.instance.currentHp <= 0;
  }

  // ============================================================================
  // Animation Methods
  // ============================================================================

  playHit(): void {
    // TODO: Play hit animation
  }

  playDeath(): void {
    // TODO: Play death animation
  }
}
