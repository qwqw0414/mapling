import { Container, Graphics, Text } from 'pixi.js';
import { GifSprite, GifSource } from 'pixi.js/gif';
import {
  SPAWN_CONFIG,
  MONSTER_BEHAVIOR_CONFIG,
  LAYOUT_CONFIG,
} from '@/constants/config';
import { getMobById } from '@/data/mobs';
import type { MapInfo } from '@/types/map';
import type { MobData } from '@/types/monster';

// ============================================================================
// Constants
// ============================================================================

export const MOB_ANIMATIONS = ['stand', 'move', 'hit1', 'die1'] as const;
export type MobAnimation = (typeof MOB_ANIMATIONS)[number];

export const HIT_ANIMATION_DURATION = 450;
export const DEATH_FADE_DURATION = 600;

// ============================================================================
// Types
// ============================================================================

export type MonsterAction = 'idle' | 'moveLeft' | 'moveRight' | 'jump';

export interface MonsterState {
  instanceId: string;
  mobId: number;
  x: number;
  y: number;
  baseY: number;
  platformId: number;
  currentHp: number;
  maxHp: number;
  spawnTime: number;
  action: MonsterAction;
  actionTimer: number;
  velocityY: number;
  isJumping: boolean;
  direction: number;
  currentAnimation: MobAnimation;
  moveSpeed: number;
  canJump: boolean;
  lastHitTime: number;
  isHit: boolean;
  hitEndTime: number;
  isDying: boolean;
  deathStartTime: number;
}

// ============================================================================
// Monster System
// ============================================================================

export class MonsterSystem {
  private mapInfo: MapInfo | null = null;
  private monsters: Map<string, MonsterState> = new Map();
  private monsterSprites: Map<string, Container> = new Map();
  private mobGifSources: Map<string, GifSource> = new Map();
  private readonly fieldLayer: Container;
  private readonly fieldWidth: number;
  private readonly fieldHeight: number;

  // Cached field bounds
  private readonly fieldMinX: number;
  private readonly fieldMaxX: number;

  private spawnTimer = 0;
  private monsterIdCounter = 0;

  constructor(fieldLayer: Container, fieldWidth: number, fieldHeight: number) {
    this.fieldLayer = fieldLayer;
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;

    const fieldPadding = LAYOUT_CONFIG.LEFT_PANEL.PADDING;
    this.fieldMinX = fieldPadding + 50;
    this.fieldMaxX = this.fieldWidth - fieldPadding - 50;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  setMap(mapInfo: MapInfo | null): void {
    this.mapInfo = mapInfo;
  }

  setMobAssets(mobGifSources: Map<string, GifSource>): void {
    this.mobGifSources = mobGifSources;
  }

  getMonster(instanceId: string): MonsterState | undefined {
    return this.monsters.get(instanceId);
  }

  getMonsterSprite(instanceId: string): Container | undefined {
    return this.monsterSprites.get(instanceId);
  }

  getAllMonsters(): Map<string, MonsterState> {
    return this.monsters;
  }

  // ============================================================================
  // Monster Spawning
  // ============================================================================

  spawnInitialMonsters(): void {
    if (!this.mapInfo) return;

    const initialCount = Math.floor(SPAWN_CONFIG.MAX_MONSTERS * SPAWN_CONFIG.INITIAL_SPAWN_RATIO);
    for (let i = 0; i < initialCount; i++) {
      this.spawnMonster();
    }
  }

  updateSpawnTimer(deltaTime: number): void {
    if (!this.mapInfo) return;

    this.spawnTimer += deltaTime * 16.67;

    if (this.spawnTimer >= SPAWN_CONFIG.NORMAL_INTERVAL) {
      this.spawnTimer = 0;
      this.trySpawnMonster();
    }
  }

  private trySpawnMonster(): void {
    if (!this.mapInfo) return;

    if (this.monsters.size < SPAWN_CONFIG.MAX_MONSTERS) {
      this.spawnMonster();
    }
  }

  private spawnMonster(): void {
    if (!this.mapInfo) return;

    const mob = this.selectRandomMob();
    if (!mob) return;

    const instanceId = `mob_${++this.monsterIdCounter}`;

    const groundY = this.fieldHeight - 30;
    const x = this.fieldMinX + Math.random() * (this.fieldMaxX - this.fieldMinX);
    const y = groundY;

    const speedMultiplier = 1 + (mob.meta.speed / 100);
    const moveSpeed = MONSTER_BEHAVIOR_CONFIG.BASE_MOVE_SPEED * Math.max(0.3, speedMultiplier);
    const canJump = mob.canJump ?? false;

    const state: MonsterState = {
      instanceId,
      mobId: mob.id,
      x,
      y,
      baseY: y,
      platformId: 1,
      currentHp: mob.meta.maxHp,
      maxHp: mob.meta.maxHp,
      spawnTime: Date.now(),
      action: 'idle',
      actionTimer: this.getRandomActionTime('idle'),
      velocityY: 0,
      isJumping: false,
      direction: Math.random() < 0.5 ? -1 : 1,
      currentAnimation: 'stand',
      moveSpeed,
      canJump,
      lastHitTime: 0,
      isHit: false,
      hitEndTime: 0,
      isDying: false,
      deathStartTime: 0,
    };

    this.monsters.set(instanceId, state);
    this.createMonsterSprite(state, mob);
  }

  private selectRandomMob(): MobData | null {
    if (!this.mapInfo) return null;

    const mobs = this.mapInfo.spawns.normal.mobs;
    const totalWeight = mobs.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const mobSpawn of mobs) {
      random -= mobSpawn.weight;
      if (random <= 0) {
        return getMobById(mobSpawn.mobId) ?? null;
      }
    }

    return getMobById(mobs[0].mobId) ?? null;
  }

  // ============================================================================
  // Monster Sprite
  // ============================================================================

  private createMonsterSprite(state: MonsterState, mob: MobData): void {
    const monsterContainer = new Container();
    monsterContainer.x = state.x;
    monsterContainer.y = state.y;
    monsterContainer.alpha = 0;

    const spriteContainer = new Container();
    spriteContainer.label = 'spriteContainer';
    monsterContainer.addChild(spriteContainer);

    for (const animation of MOB_ANIMATIONS) {
      const key = `${mob.id}_${animation}`;
      const gifSource = this.mobGifSources.get(key);

      if (gifSource) {
        const gifSprite = new GifSprite({
          source: gifSource,
          autoPlay: true,
          loop: true,
        });
        gifSprite.anchor.set(0.5, 1);
        gifSprite.label = `anim_${animation}`;
        gifSprite.visible = animation === 'stand';
        spriteContainer.addChild(gifSprite);
      }
    }

    if (spriteContainer.children.length === 0) {
      const body = new Graphics();
      const color = this.getMobColor(mob.meta.level);
      body.ellipse(0, -20, 25, 20);
      body.fill({ color });
      body.circle(-8, -25, 4);
      body.circle(8, -25, 4);
      body.fill({ color: 0xFFFFFF });
      body.circle(-8, -25, 2);
      body.circle(8, -25, 2);
      body.fill({ color: 0x000000 });
      body.label = 'fallback';
      spriteContainer.addChild(body);
    }

    const hpBarContainer = new Container();
    hpBarContainer.label = 'hpBarContainer';
    hpBarContainer.y = -70;
    hpBarContainer.visible = false;
    monsterContainer.addChild(hpBarContainer);

    const hpBg = new Graphics();
    hpBg.rect(-25, 0, 50, 6);
    hpBg.fill({ color: 0x333333 });
    hpBg.label = 'hpBg';
    hpBarContainer.addChild(hpBg);

    const hpBar = new Graphics();
    hpBar.rect(-24, 1, 48, 4);
    hpBar.fill({ color: 0xFF0000 });
    hpBar.label = 'hpBar';
    hpBarContainer.addChild(hpBar);

    const nameTag = new Text({
      text: `Lv.${mob.meta.level} ${mob.name}`,
      style: {
        fontSize: 11,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 1,
          distance: 1,
        },
      },
    });
    nameTag.anchor.set(0.5, 0);
    nameTag.y = 5;
    nameTag.label = 'nameTag';
    monsterContainer.addChild(nameTag);

    this.fieldLayer.addChild(monsterContainer);
    this.monsterSprites.set(state.instanceId, monsterContainer);
  }

  private getMobColor(level: number): number {
    if (level <= 5) return 0x90EE90;
    if (level <= 10) return 0xFFB6C1;
    if (level <= 15) return 0xFFD700;
    return 0xFF6347;
  }

  setMonsterAnimation(sprite: Container, animation: MobAnimation): void {
    const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
    if (!spriteContainer) return;

    for (const child of spriteContainer.children) {
      if (child.label === `anim_${animation}`) {
        child.visible = true;
      } else if (child.label?.startsWith('anim_')) {
        child.visible = false;
      }
    }
  }

  // ============================================================================
  // Monster Updates
  // ============================================================================

  updateMonsters(deltaTime: number): void {
    const now = Date.now();
    const { FADE_IN_DURATION, JUMP_VELOCITY, GRAVITY } = MONSTER_BEHAVIOR_CONFIG;
    const minX = this.fieldMinX;
    const maxX = this.fieldMaxX;

    for (const [id, monster] of this.monsters) {
      const sprite = this.monsterSprites.get(id);
      if (!sprite) continue;

      if (monster.isDying) {
        const deathElapsed = now - monster.deathStartTime;
        const deathProgress = Math.min(deathElapsed / DEATH_FADE_DURATION, 1);
        sprite.alpha = 1 - deathProgress;

        if (deathProgress >= 1) {
          this.removeMonster(id);
        }
        continue;
      }

      const elapsed = now - monster.spawnTime;
      if (elapsed < FADE_IN_DURATION) {
        sprite.alpha = elapsed / FADE_IN_DURATION;
      } else {
        sprite.alpha = 1;
      }

      if (monster.isHit && now >= monster.hitEndTime) {
        monster.isHit = false;
        const isMoving = monster.action === 'moveLeft' || monster.action === 'moveRight' || monster.isJumping;
        const returnAnimation: MobAnimation = isMoving ? 'move' : 'stand';
        monster.currentAnimation = returnAnimation;
        this.setMonsterAnimation(sprite, returnAnimation);
      }

      const isMoving = monster.action === 'moveLeft' || monster.action === 'moveRight' || monster.isJumping;

      if (!monster.isHit) {
        monster.actionTimer -= deltaTime * 16.67;
        if (monster.actionTimer <= 0 && !monster.isJumping) {
          monster.action = this.getRandomAction(monster.canJump);
          monster.actionTimer = this.getRandomActionTime(monster.action);

          if (monster.action === 'jump' && monster.canJump) {
            monster.isJumping = true;
            monster.velocityY = JUMP_VELOCITY;
            if (Math.random() < 0.5) {
              monster.direction = Math.random() < 0.5 ? -1 : 1;
            }
          }

          if (monster.action === 'moveLeft') {
            monster.direction = -1;
          } else if (monster.action === 'moveRight') {
            monster.direction = 1;
          }
        }

        const requiredAnimation: MobAnimation = isMoving ? 'move' : 'stand';

        if (monster.currentAnimation !== requiredAnimation) {
          monster.currentAnimation = requiredAnimation;
          this.setMonsterAnimation(sprite, requiredAnimation);
        }

        if (isMoving) {
          const moveDir = monster.action === 'moveLeft' ? -1 :
            monster.action === 'moveRight' ? 1 :
              monster.direction;
          monster.x += moveDir * monster.moveSpeed * deltaTime;
        }
      }

      if (monster.isJumping) {
        monster.velocityY += GRAVITY * deltaTime;
        monster.y += monster.velocityY * deltaTime;

        if (monster.y >= monster.baseY) {
          monster.y = monster.baseY;
          monster.isJumping = false;
          monster.velocityY = 0;
          monster.action = 'idle';
          monster.actionTimer = this.getRandomActionTime('idle');
        }
      }

      if (monster.x < minX) {
        monster.x = minX;
        monster.direction = 1;
        monster.action = 'moveRight';
      } else if (monster.x > maxX) {
        monster.x = maxX;
        monster.direction = -1;
        monster.action = 'moveLeft';
      }

      sprite.x = monster.x;
      sprite.y = monster.y;

      const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
      if (spriteContainer) {
        spriteContainer.scale.x = monster.direction > 0 ? -1 : 1;
      }

      const hpBarContainer = sprite.getChildByName('hpBarContainer') as Container;
      if (hpBarContainer) {
        const timeSinceHit = now - monster.lastHitTime;
        const shouldShowHpBar = monster.lastHitTime > 0 &&
          timeSinceHit < MONSTER_BEHAVIOR_CONFIG.HP_BAR_DISPLAY_DURATION;
        hpBarContainer.visible = shouldShowHpBar;
      }
    }
  }

  // ============================================================================
  // Monster Management
  // ============================================================================

  removeMonster(instanceId: string): void {
    const sprite = this.monsterSprites.get(instanceId);
    if (sprite) {
      this.fieldLayer.removeChild(sprite);
      sprite.destroy();
    }
    this.monsterSprites.delete(instanceId);
    this.monsters.delete(instanceId);
  }

  clearAll(): void {
    for (const [_instanceId, sprite] of this.monsterSprites.entries()) {
      this.fieldLayer.removeChild(sprite);
      sprite.destroy();
    }

    this.monsters.clear();
    this.monsterSprites.clear();
    this.spawnTimer = 0;
    this.monsterIdCounter = 0;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getRandomActionTime(action: MonsterAction): number {
    // Different duration ranges for each action type
    switch (action) {
      case 'idle':
        // Idle: 1.5s ~ 4s (longer idle time for natural pauses)
        return 1500 + Math.random() * 2500;
      case 'moveLeft':
      case 'moveRight':
        // Movement: 1s ~ 2.5s (moderate walking time)
        return 1000 + Math.random() * 1500;
      case 'jump':
        // Jump duration is controlled by physics, but set timer for next action
        return 800 + Math.random() * 1200;
      default:
        return 1500 + Math.random() * 1500;
    }
  }

  private getRandomAction(canJump: boolean): MonsterAction {
    const rand = Math.random();

    if (canJump) {
      // Jump-capable monsters: idle 35%, moveLeft 27.5%, moveRight 27.5%, jump 10%
      if (rand < 0.35) return 'idle';
      if (rand < 0.625) return 'moveLeft';
      if (rand < 0.90) return 'moveRight';
      return 'jump';
    } else {
      // Non-jumping monsters: idle 35%, moveLeft 32.5%, moveRight 32.5%
      if (rand < 0.35) return 'idle';
      if (rand < 0.675) return 'moveLeft';
      return 'moveRight';
    }
  }
}
