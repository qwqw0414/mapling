import { Container, Graphics, Text } from 'pixi.js';
import type { MonsterState, MobAnimation } from './MonsterSystem';
import { HIT_ANIMATION_DURATION } from './MonsterSystem';

// ============================================================================
// Damage System
// ============================================================================

export class DamageSystem {
  private fieldLayer: Container;
  private damageOffsets: Map<string, { offset: number; lastTime: number }> = new Map();

  private readonly DAMAGE_STACK_HEIGHT = 35;
  private readonly DAMAGE_STACK_RESET_TIME = 600;

  private mobSounds: Map<string, HTMLAudioElement> = new Map();

  // Animation tracking for cleanup
  private activeAnimations: Set<Container> = new Set();

  constructor(fieldLayer: Container) {
    this.fieldLayer = fieldLayer;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  setMobSounds(mobSounds: Map<string, HTMLAudioElement>): void {
    this.mobSounds = mobSounds;
  }

  /**
   * Apply damage to a monster
   * @returns true if monster died
   */
  hitMonster(
    monster: MonsterState,
    sprite: Container,
    damage: number,
    isCritical: boolean,
    setAnimationCallback: (sprite: Container, animation: MobAnimation) => void
  ): boolean {
    if (monster.isDying) return false;

    const now = Date.now();

    monster.currentHp = Math.max(0, monster.currentHp - damage);
    monster.lastHitTime = now;

    monster.isHit = true;
    monster.hitEndTime = now + HIT_ANIMATION_DURATION;

    monster.currentAnimation = 'hit1';
    setAnimationCallback(sprite, 'hit1');
    this.playMobSound(monster.mobId, 'Damage');

    const willDie = monster.currentHp <= 0;

    if (willDie) {
      monster.isJumping = false;
      monster.velocityY = 0;
      monster.y = monster.baseY;
      monster.action = 'idle';
      sprite.y = monster.y;

      const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
      if (spriteContainer) {
        spriteContainer.y = 0;
      }
    }

    this.showDamageNumber(monster.instanceId, damage, monster.x, monster.y, isCritical);

    const hpBarContainer = sprite.getChildByName('hpBarContainer') as Container;
    if (hpBarContainer && !willDie) {
      hpBarContainer.visible = true;

      const hpBar = hpBarContainer.getChildByName('hpBar') as Graphics;
      if (hpBar) {
        const hpRatio = monster.currentHp / monster.maxHp;
        const barWidth = Math.max(0, 48 * hpRatio);

        hpBar.clear();
        hpBar.rect(-24, 1, barWidth, 4);
        hpBar.fill({ color: 0xFF0000 });
      }
    }

    if (willDie) {
      monster.isDying = true;
      monster.deathStartTime = now;
      monster.isHit = false;

      monster.currentAnimation = 'die1';
      setAnimationCallback(sprite, 'die1');
      this.playMobSound(monster.mobId, 'Die');

      if (hpBarContainer) {
        hpBarContainer.visible = false;
      }
      const nameTag = sprite.getChildByName('nameTag');
      if (nameTag) {
        nameTag.visible = false;
      }

      return true;
    }

    return false;
  }

  // ============================================================================
  // Damage Number Display
  // ============================================================================

  private showDamageNumber(
    instanceId: string,
    damage: number,
    x: number,
    y: number,
    isCritical: boolean = false
  ): void {
    const now = Date.now();
    const damageStr = damage.toString();

    let stackOffset = 0;
    const existingOffset = this.damageOffsets.get(instanceId);

    if (existingOffset && (now - existingOffset.lastTime) < this.DAMAGE_STACK_RESET_TIME) {
      stackOffset = existingOffset.offset + this.DAMAGE_STACK_HEIGHT;
    }

    this.damageOffsets.set(instanceId, { offset: stackOffset, lastTime: now });

    const damageContainer = new Container();
    damageContainer.x = x;
    damageContainer.y = y - 50 - stackOffset;

    const fillColor = isCritical ? 0xFF6090 : 0xFFA040;
    const strokeColor = isCritical ? 0x990050 : 0xAA2200;
    const fontSize = isCritical ? 30 : 26;

    const digits: Text[] = [];
    const digitWidth = isCritical ? 24 : 20;
    const totalWidth = damageStr.length * digitWidth;
    const startX = -totalWidth / 2 + digitWidth / 2;

    for (let i = 0; i < damageStr.length; i++) {
      const digit = new Text({
        text: damageStr[i],
        style: {
          fontSize: fontSize,
          fontWeight: 'bold',
          fontFamily: 'Arial Black, Arial',
          fontStyle: 'italic',
          fill: fillColor,
          stroke: {
            color: strokeColor,
            width: 4,
          },
          dropShadow: {
            color: 0x000000,
            blur: 0,
            angle: Math.PI / 2,
            distance: 2,
          },
        },
      });
      digit.anchor.set(0.5);
      digit.x = startX + i * digitWidth;
      digit.y = 0;
      digits.push(digit);
      damageContainer.addChild(digit);
    }

    this.fieldLayer.addChild(damageContainer);
    this.activeAnimations.add(damageContainer);

    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      // Stop if container was already destroyed (e.g. by clearAll during map change)
      if (damageContainer.destroyed) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      for (let i = 0; i < digits.length; i++) {
        const digit = digits[i];
        const delay = i * 25;
        const digitElapsed = Math.max(0, elapsed - delay);
        const digitProgress = Math.min(digitElapsed / (duration - delay), 1);

        if (digitElapsed > 0) {
          const bounceProgress = Math.min(digitProgress * 2, 1);
          const bounceHeight = isCritical ? 25 : 18;
          const bounce = Math.sin(bounceProgress * Math.PI) * bounceHeight;
          const floatUp = digitProgress * 35;
          digit.y = -bounce - floatUp;

          if (isCritical && digitProgress < 0.3) {
            digit.x = (startX + i * digitWidth) + Math.sin(digitProgress * 25) * 3;
          }

          if (digitProgress < 0.15) {
            const scaleAmount = isCritical ? 0.3 : 0.2;
            const scale = 1 + Math.sin(digitProgress * Math.PI * 6.67) * scaleAmount;
            digit.scale.set(scale);
          } else {
            digit.scale.set(1);
          }
        }
      }

      if (progress > 0.7) {
        damageContainer.alpha = 1 - ((progress - 0.7) / 0.3);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.fieldLayer.removeChild(damageContainer);
        this.activeAnimations.delete(damageContainer);
        damageContainer.destroy();
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Audio
  // ============================================================================

  private playMobSound(mobId: number, soundType: 'Damage' | 'Die'): void {
    const key = `${mobId}_${soundType}`;
    const audio = this.mobSounds.get(key);
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch(() => { });
    }
  }

  // ============================================================================
  // Miss Text
  // ============================================================================

  /**
   * Show a "MISS" text above a monster sprite
   */
  showMissText(sprite: Container): void {
    const missText = new Text({
      text: 'MISS',
      style: {
        fontSize: 16,
        fill: 0xAAAAAA,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    missText.anchor.set(0.5);
    missText.x = sprite.x;
    missText.y = sprite.y - 40;
    this.fieldLayer.addChild(missText);

    const startY = missText.y;
    const startTime = Date.now();
    const duration = 600;

    const animate = (): void => {
      // Stop if text was already destroyed (e.g. by clearAll during map change)
      if (missText.destroyed) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      missText.y = startY - progress * 30;
      missText.alpha = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (missText.parent) missText.parent.removeChild(missText);
        missText.destroy();
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clearDamageOffsets(instanceId: string): void {
    this.damageOffsets.delete(instanceId);
  }

  clearAll(): void {
    this.damageOffsets.clear();

    // Cleanup active damage number animations
    for (const container of this.activeAnimations) {
      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy();
    }
    this.activeAnimations.clear();
  }
}
