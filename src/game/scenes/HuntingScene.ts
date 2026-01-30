import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { GifSprite, GifSource } from 'pixi.js/gif';
import { BaseScene } from './BaseScene';
import { 
  MAP_CONFIG, 
  SPAWN_CONFIG, 
  MONSTER_BEHAVIOR_CONFIG 
} from '@/constants/config';
import { getMapById } from '@/data/maps';
import { getMobById } from '@/data/mobs';
import { AudioManager } from '@/game/systems/AudioManager';
import { AssetManager } from '@/game/systems/AssetManager';
import type { MapInfo } from '@/types/map';
import type { MobData } from '@/types/monster';

// Animation types available from API
const MOB_ANIMATIONS = ['stand', 'move', 'hit1', 'die1'] as const;
type MobAnimation = (typeof MOB_ANIMATIONS)[number];

// Hit animation duration (ms)
const HIT_ANIMATION_DURATION = 450;

// Death fade out duration (ms)
const DEATH_FADE_DURATION = 600;

// ============================================================================
// Types
// ============================================================================

type MonsterAction = 'idle' | 'moveLeft' | 'moveRight' | 'jump';

interface MonsterState {
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
  direction: number; // -1: left, 1: right
  currentAnimation: MobAnimation;
  moveSpeed: number; // Monster-specific move speed
  canJump: boolean; // Whether this monster can jump
  lastHitTime: number; // Time of last hit (for HP bar visibility)
  isHit: boolean; // Currently in hit animation
  hitEndTime: number; // When hit animation ends
  isDying: boolean; // Currently in death animation
  deathStartTime: number; // When death animation started
}

// ============================================================================
// Hunting Scene (Field Demo)
// ============================================================================

export class HuntingScene extends BaseScene {
  private mapInfo: MapInfo | null = null;
  private monsters: Map<string, MonsterState> = new Map();
  private monsterSprites: Map<string, Container> = new Map();
  // Key format: "{mobId}_{animation}" (e.g., "1210100_stand", "1210100_move")
  private mobGifSources: Map<string, GifSource> = new Map();
  // Key format: "{mobId}_{soundType}" (e.g., "1210100_Damage", "1210100_Die")
  private mobSounds: Map<string, HTMLAudioElement> = new Map();

  // Game sounds
  private itemPickupSound: HTMLAudioElement | null = null;

  // Layers
  private backgroundLayer!: Container;
  private entityLayer!: Container;

  // UI Elements
  private mapNameText: Text | null = null;
  private levelInfoText: Text | null = null;

  // Log System
  private logContainer: Container | null = null;
  private logEntries: Array<{ text: Text; createdAt: number }> = [];
  private readonly MAX_LOG_ENTRIES = 10;
  private readonly LOG_FADE_START = 3000; // Start fading after 3 seconds
  private readonly LOG_FADE_DURATION = 2000; // Fade out over 2 seconds

  // Spawn
  private spawnTimer = 0;
  private monsterIdCounter = 0;

  // Damage number stacking (tracks Y offset per monster)
  private damageOffsets: Map<string, { offset: number; lastTime: number }> = new Map();
  private readonly DAMAGE_STACK_HEIGHT = 35; // Height between stacked damage numbers
  private readonly DAMAGE_STACK_RESET_TIME = 600; // Reset stack after 600ms of no damage

  // Click handler reference (for cleanup)
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(mapId: number = 104010001) {
    super();
    this.mapInfo = getMapById(mapId) ?? null;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  protected async load(): Promise<void> {
    if (!this.mapInfo) {
      console.error('[HuntingScene] Map not found');
      return;
    }
    console.log('[HuntingScene] Loading map:', this.mapInfo.name);

    const assetManager = AssetManager.getInstance();

    // Preload monster GIF animations using AssetManager (cached)
    for (const mobSpawn of this.mapInfo.spawns.normal.mobs) {
      const mob = getMobById(mobSpawn.mobId);
      if (mob) {
        for (const animation of MOB_ANIMATIONS) {
          const gifSource = await assetManager.getMobGif(mob.id, animation);
          if (gifSource) {
            const key = `${mob.id}_${animation}`;
            this.mobGifSources.set(key, gifSource);
            console.log(`[HuntingScene] Loaded mob GIF: ${mob.name} (${animation})`);
          }
        }

        // Preload mob sounds (Damage, Die)
        // API uses 7-digit format with leading zeros (e.g., "0130101" for 130101)
        const mobIdStr = mob.id.toString().padStart(7, '0');
        const soundTypes: Array<'Damage' | 'Die'> = ['Damage', 'Die'];
        for (const soundType of soundTypes) {
          const soundData = await assetManager.getMobSound(mobIdStr, soundType);
          if (soundData) {
            const audio = this.createAudioFromBase64(soundData);
            const key = `${mob.id}_${soundType}`;
            this.mobSounds.set(key, audio);
            console.log(`[HuntingScene] Loaded mob sound: ${mob.name} (${soundType})`);
          }
        }
      }
    }

    // Preload item pickup sound
    const pickupSoundData = await assetManager.getGameSound('Game.img/PickUpItem');
    if (pickupSoundData) {
      this.itemPickupSound = this.createAudioFromBase64(pickupSoundData);
      console.log('[HuntingScene] Loaded item pickup sound');
    }

    // Play BGM
    if (this.mapInfo.bgm) {
      const audioManager = AudioManager.getInstance();
      audioManager.init();
      audioManager.playBgm(this.mapInfo.bgm);
    }
  }

  /**
   * Create audio element from base64 encoded data
   */
  private createAudioFromBase64(base64Data: string): HTMLAudioElement {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);
    return new Audio(blobUrl);
  }

  /**
   * Play mob sound effect
   */
  private playMobSound(mobId: number, soundType: 'Damage' | 'Die'): void {
    const key = `${mobId}_${soundType}`;
    const audio = this.mobSounds.get(key);
    if (audio) {
      // Clone and play to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }

  protected create(): void {
    this.createLayers();
    this.createBackground();
    this.createMapInfo();
    this.createLogContainer();
    this.spawnInitialMonsters();
    this.setupClickHandler();
  }

  update(deltaTime: number): void {
    if (!this.isInitialized) return;

    this.updateSpawnTimer(deltaTime);
    this.updateMonsters(deltaTime);
    this.updateLogEntries();
  }

  // ============================================================================
  // Layer Creation
  // ============================================================================

  private createLayers(): void {
    this.backgroundLayer = new Container();
    this.entityLayer = new Container();

    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.entityLayer);
  }

  // ============================================================================
  // Background (Empty - no background)
  // ============================================================================

  private createBackground(): void {
    // No background - transparent/empty
  }

  // ============================================================================
  // Map Info Display
  // ============================================================================

  private createMapInfo(): void {
    if (!this.mapInfo) return;

    this.mapNameText = new Text({
      text: this.mapInfo.name,
      style: {
        fontSize: 20,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 3,
          distance: 2,
        },
      },
    });
    this.mapNameText.anchor.set(0.5, 0);
    this.mapNameText.x = MAP_CONFIG.WIDTH / 2;
    this.mapNameText.y = 15;

    this.levelInfoText = new Text({
      text: `적정 레벨: ${this.mapInfo.recommendedLevel.min} ~ ${this.mapInfo.recommendedLevel.max}`,
      style: {
        fontSize: 14,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
      },
    });
    this.levelInfoText.anchor.set(0.5, 0);
    this.levelInfoText.x = MAP_CONFIG.WIDTH / 2;
    this.levelInfoText.y = 42;

    this.backgroundLayer.addChild(this.mapNameText);
    this.backgroundLayer.addChild(this.levelInfoText);
  }

  // ============================================================================
  // Log System
  // ============================================================================

  private createLogContainer(): void {
    this.logContainer = new Container();
    this.logContainer.x = 15;
    this.logContainer.y = 70; // Below map info
    this.backgroundLayer.addChild(this.logContainer);
  }

  /**
   * Add a log entry
   */
  private addLog(message: string, color: number = 0xFFFFFF): void {
    if (!this.logContainer) return;

    const logText = new Text({
      text: message,
      style: {
        fontSize: 12,
        fill: color,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
        },
      },
    });

    // Add to entries
    this.logEntries.unshift({ text: logText, createdAt: Date.now() });

    // Remove oldest if exceeds max
    while (this.logEntries.length > this.MAX_LOG_ENTRIES) {
      const removed = this.logEntries.pop();
      if (removed) {
        this.logContainer.removeChild(removed.text);
        removed.text.destroy();
      }
    }

    // Add to container
    this.logContainer.addChild(logText);

    // Update positions
    this.updateLogPositions();
  }

  private updateLogPositions(): void {
    let y = 0;
    for (const entry of this.logEntries) {
      entry.text.y = y;
      y += 16; // Line height
    }
  }

  private updateLogEntries(): void {
    const now = Date.now();

    for (let i = this.logEntries.length - 1; i >= 0; i--) {
      const entry = this.logEntries[i];
      const age = now - entry.createdAt;

      if (age > this.LOG_FADE_START) {
        const fadeProgress = (age - this.LOG_FADE_START) / this.LOG_FADE_DURATION;
        entry.text.alpha = Math.max(0, 1 - fadeProgress);

        // Remove fully faded entries
        if (fadeProgress >= 1) {
          this.logContainer?.removeChild(entry.text);
          entry.text.destroy();
          this.logEntries.splice(i, 1);
          this.updateLogPositions();
        }
      }
    }
  }

  /**
   * Log experience gain
   */
  private logExpGain(mobName: string, exp: number): void {
    this.addLog(`${mobName} 처치! +${exp} EXP`, 0x90EE90);
  }

  /**
   * Log meso gain
   */
  private logMesoGain(amount: number): void {
    this.addLog(`+${amount} 메소`, 0xFFD700);
  }

  /**
   * Log item drop
   */
  private logItemDrop(itemName: string): void {
    this.addLog(`${itemName} 획득!`, 0x87CEEB);
  }

  // ============================================================================
  // Resize Handler
  // ============================================================================

  onResize(width: number, _height: number): void {
    // Update map info position to center
    if (this.mapNameText) {
      this.mapNameText.x = width / 2;
    }
    if (this.levelInfoText) {
      this.levelInfoText.x = width / 2;
    }
  }

  // ============================================================================
  // Monster Spawning
  // ============================================================================

  private spawnInitialMonsters(): void {
    if (!this.mapInfo) return;

    const initialCount = Math.floor(SPAWN_CONFIG.MAX_MONSTERS * SPAWN_CONFIG.INITIAL_SPAWN_RATIO);
    for (let i = 0; i < initialCount; i++) {
      this.spawnMonster();
    }
  }

  private updateSpawnTimer(deltaTime: number): void {
    if (!this.mapInfo) return;

    this.spawnTimer += deltaTime * 16.67;

    if (this.spawnTimer >= SPAWN_CONFIG.NORMAL_INTERVAL) {
      this.spawnTimer = 0;
      this.trySpawnMonster();
    }
  }

  private trySpawnMonster(): void {
    if (!this.mapInfo) return;

    // Check if we can spawn more monsters
    if (this.monsters.size < SPAWN_CONFIG.MAX_MONSTERS) {
      this.spawnMonster();
    }
  }

  private spawnMonster(): void {
    if (!this.mapInfo) return;

    const mob = this.selectRandomMob();
    if (!mob) return;

    const instanceId = `mob_${++this.monsterIdCounter}`;
    const x = MAP_CONFIG.SPAWN_AREA.MIN_X + Math.random() * (MAP_CONFIG.SPAWN_AREA.MAX_X - MAP_CONFIG.SPAWN_AREA.MIN_X);
    const y = MAP_CONFIG.PLATFORM_Y.FLOOR_1; // Use ground level

    // Calculate move speed based on mob's speed stat
    // MapleStory speed: -100 (slow) to +100 (fast), 0 is normal
    const speedMultiplier = 1 + (mob.meta.speed / 100);
    const moveSpeed = MONSTER_BEHAVIOR_CONFIG.BASE_MOVE_SPEED * Math.max(0.3, speedMultiplier);

    // Check if monster can jump
    const canJump = mob.canJump;

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
      actionTimer: this.getRandomActionTime(),
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

  private getRandomActionTime(): number {
    const { ACTION_CHANGE_MIN, ACTION_CHANGE_MAX } = MONSTER_BEHAVIOR_CONFIG;
    return ACTION_CHANGE_MIN + Math.random() * (ACTION_CHANGE_MAX - ACTION_CHANGE_MIN);
  }

  private getRandomAction(canJump: boolean): MonsterAction {
    const rand = Math.random();
    
    if (canJump) {
      // Monster can jump: idle 25%, moveLeft 25%, moveRight 25%, jump 25%
      if (rand < 0.25) return 'idle';
      if (rand < 0.5) return 'moveLeft';
      if (rand < 0.75) return 'moveRight';
      return 'jump';
    } else {
      // Monster cannot jump: idle 33%, moveLeft 33%, moveRight 33%
      if (rand < 0.33) return 'idle';
      if (rand < 0.66) return 'moveLeft';
      return 'moveRight';
    }
  }

  // ============================================================================
  // Monster Sprite
  // ============================================================================

  private createMonsterSprite(state: MonsterState, mob: MobData): void {
    const monsterContainer = new Container();
    monsterContainer.x = state.x;
    monsterContainer.y = state.y;
    monsterContainer.alpha = 0; // Start transparent for fade-in

    // Create sprite container for easy animation swapping
    const spriteContainer = new Container();
    spriteContainer.label = 'spriteContainer';
    monsterContainer.addChild(spriteContainer);

    // Create all animation sprites (hidden by default)
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
        gifSprite.visible = animation === 'stand'; // Only show stand initially
        spriteContainer.addChild(gifSprite);
      }
    }

    // Fallback if no animations loaded
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

    // HP bar container (hidden by default, shown on hit)
    const hpBarContainer = new Container();
    hpBarContainer.label = 'hpBarContainer';
    hpBarContainer.y = -70;
    hpBarContainer.visible = false; // Hidden until hit
    monsterContainer.addChild(hpBarContainer);

    // HP bar background
    const hpBg = new Graphics();
    hpBg.rect(-25, 0, 50, 6);
    hpBg.fill({ color: 0x333333 });
    hpBg.label = 'hpBg';
    hpBarContainer.addChild(hpBg);

    // HP bar (red)
    const hpBar = new Graphics();
    hpBar.rect(-24, 1, 48, 4);
    hpBar.fill({ color: 0xFF0000 });
    hpBar.label = 'hpBar';
    hpBarContainer.addChild(hpBar);

    // Name tag (below monster)
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
    nameTag.y = 5; // Below monster (anchor is at bottom)
    nameTag.label = 'nameTag';
    monsterContainer.addChild(nameTag);

    this.entityLayer.addChild(monsterContainer);
    this.monsterSprites.set(state.instanceId, monsterContainer);
  }

  private getMobColor(level: number): number {
    if (level <= 5) return 0x90EE90;
    if (level <= 10) return 0xFFB6C1;
    if (level <= 15) return 0xFFD700;
    return 0xFF6347;
  }

  private setMonsterAnimation(sprite: Container, animation: MobAnimation): void {
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

  private updateMonsters(deltaTime: number): void {
    const now = Date.now();
    const { FADE_IN_DURATION, JUMP_VELOCITY, GRAVITY } = MONSTER_BEHAVIOR_CONFIG;

    for (const [id, monster] of this.monsters) {
      const sprite = this.monsterSprites.get(id);
      if (!sprite) continue;

      // Handle dying monsters (fade out)
      if (monster.isDying) {
        const deathElapsed = now - monster.deathStartTime;
        const deathProgress = Math.min(deathElapsed / DEATH_FADE_DURATION, 1);
        sprite.alpha = 1 - deathProgress;

        if (deathProgress >= 1) {
          // Fully faded, remove monster
          this.removeMonster(id);
        }
        continue; // Skip all other updates for dying monsters
      }

      // Fade-in effect
      const elapsed = now - monster.spawnTime;
      if (elapsed < FADE_IN_DURATION) {
        sprite.alpha = elapsed / FADE_IN_DURATION;
      } else {
        sprite.alpha = 1;
      }

      // Check if hit animation ended
      if (monster.isHit && now >= monster.hitEndTime) {
        monster.isHit = false;
        // Return to appropriate animation
        const isMoving = monster.action === 'moveLeft' || monster.action === 'moveRight' || monster.isJumping;
        const returnAnimation: MobAnimation = isMoving ? 'move' : 'stand';
        monster.currentAnimation = returnAnimation;
        this.setMonsterAnimation(sprite, returnAnimation);
      }

      // Determine if monster is moving
      const isMoving = monster.action === 'moveLeft' || monster.action === 'moveRight' || monster.isJumping;

      // Skip action updates if being hit
      if (!monster.isHit) {
        // Update action timer
        monster.actionTimer -= deltaTime * 16.67;
        if (monster.actionTimer <= 0 && !monster.isJumping) {
          monster.action = this.getRandomAction(monster.canJump);
          monster.actionTimer = this.getRandomActionTime();

          // Handle jump initiation (only if monster can jump)
          if (monster.action === 'jump' && monster.canJump) {
            monster.isJumping = true;
            monster.velocityY = JUMP_VELOCITY;
            // Also move horizontally during jump
            if (Math.random() < 0.5) {
              monster.direction = Math.random() < 0.5 ? -1 : 1;
            }
          }

          // Update direction based on action
          if (monster.action === 'moveLeft') {
            monster.direction = -1;
          } else if (monster.action === 'moveRight') {
            monster.direction = 1;
          }
        }

        // Determine required animation based on action
        const requiredAnimation: MobAnimation = isMoving ? 'move' : 'stand';

        // Update animation if changed
        if (monster.currentAnimation !== requiredAnimation) {
          monster.currentAnimation = requiredAnimation;
          this.setMonsterAnimation(sprite, requiredAnimation);
        }

        // Apply movement (using monster-specific speed)
        if (isMoving) {
          const moveDir = monster.action === 'moveLeft' ? -1 : 
                         monster.action === 'moveRight' ? 1 : 
                         monster.direction;
          monster.x += moveDir * monster.moveSpeed * deltaTime;
        }
      }

      // Apply jump physics
      if (monster.isJumping) {
        monster.velocityY += GRAVITY * deltaTime;
        monster.y += monster.velocityY * deltaTime;

        // Land on ground
        if (monster.y >= monster.baseY) {
          monster.y = monster.baseY;
          monster.isJumping = false;
          monster.velocityY = 0;
          monster.action = 'idle';
          monster.actionTimer = this.getRandomActionTime();
        }
      }

      // Boundary check
      if (monster.x < MAP_CONFIG.SPAWN_AREA.MIN_X) {
        monster.x = MAP_CONFIG.SPAWN_AREA.MIN_X;
        monster.direction = 1;
        monster.action = 'moveRight';
      } else if (monster.x > MAP_CONFIG.SPAWN_AREA.MAX_X) {
        monster.x = MAP_CONFIG.SPAWN_AREA.MAX_X;
        monster.direction = -1;
        monster.action = 'moveLeft';
      }

      // Update sprite position
      sprite.x = monster.x;
      sprite.y = monster.y;

      // Flip sprite based on direction (only the sprite container, not UI elements)
      // Note: MapleStory mob GIFs face LEFT by default, so flip when moving RIGHT
      const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
      if (spriteContainer) {
        spriteContainer.scale.x = monster.direction > 0 ? -1 : 1;
      }

      // Update HP bar visibility (show only when recently hit)
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
  // Monster Damage
  // ============================================================================

  /**
   * Apply damage to a monster
   * @param instanceId - Monster instance ID
   * @param damage - Damage amount
   * @param isCritical - Whether this is a critical hit
   * @returns true if monster died
   */
  hitMonster(instanceId: string, damage: number, isCritical: boolean = false): boolean {
    const monster = this.monsters.get(instanceId);
    if (!monster) return false;

    // Skip if monster is already dying
    if (monster.isDying) return false;

    const sprite = this.monsterSprites.get(instanceId);
    if (!sprite) return false;

    const now = Date.now();

    // Apply damage
    monster.currentHp = Math.max(0, monster.currentHp - damage);
    monster.lastHitTime = now;

    // Set hit state
    monster.isHit = true;
    monster.hitEndTime = now + HIT_ANIMATION_DURATION;

    // Play hit animation and sound
    monster.currentAnimation = 'hit1';
    this.setMonsterAnimation(sprite, 'hit1');
    this.playMobSound(monster.mobId, 'Damage');

    // Show damage number (with stacking)
    this.showDamageNumber(instanceId, damage, monster.x, monster.y, isCritical);

    // Update HP bar
    const hpBarContainer = sprite.getChildByName('hpBarContainer') as Container;
    if (hpBarContainer) {
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

    // Check if dead
    if (monster.currentHp <= 0) {
      // Start death animation
      monster.isDying = true;
      monster.deathStartTime = now;
      monster.isHit = false;

      // Play death animation and sound
      monster.currentAnimation = 'die1';
      this.setMonsterAnimation(sprite, 'die1');
      this.playMobSound(monster.mobId, 'Die');

      // Log experience and handle drops
      const mob = getMobById(monster.mobId);
      if (mob) {
        // Log EXP gain
        this.logExpGain(mob.name, mob.meta.exp);

        // Handle meso (log only, no visual drop)
        this.tryDropMeso(mob.meso);

        // Handle item drops (visual + log)
        this.tryDropItems(mob.drops, monster.x, monster.y);
      }

      // Hide HP bar and name tag during death
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

  /**
   * Show floating damage number with stacking
   * @param instanceId - Monster instance ID
   * @param damage - Damage amount
   * @param x - X position
   * @param y - Y position
   * @param isCritical - Whether this is a critical hit
   */
  private showDamageNumber(instanceId: string, damage: number, x: number, y: number, isCritical: boolean = false): void {
    const now = Date.now();
    const damageStr = damage.toString();

    // Calculate stacking offset
    let stackOffset = 0;
    const existingOffset = this.damageOffsets.get(instanceId);

    if (existingOffset && (now - existingOffset.lastTime) < this.DAMAGE_STACK_RESET_TIME) {
      // Stack on top of previous damage
      stackOffset = existingOffset.offset + this.DAMAGE_STACK_HEIGHT;
    }

    // Update offset tracker
    this.damageOffsets.set(instanceId, { offset: stackOffset, lastTime: now });

    const damageContainer = new Container();
    damageContainer.x = x;
    damageContainer.y = y - 50 - stackOffset;

    // Color scheme based on critical
    // Normal: Orange-yellow with dark red stroke (like the image)
    // Critical: Pink-magenta with dark purple stroke
    const fillColor = isCritical ? 0xFF6090 : 0xFFA040; // Pink for crit, Orange for normal
    const strokeColor = isCritical ? 0x990050 : 0xAA2200; // Dark pink for crit, Dark red for normal
    const fontSize = isCritical ? 30 : 26;

    // Create individual digit texts for maple-style bouncing effect
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

    this.entityLayer.addChild(damageContainer);

    // Animate each digit with maple-style bounce
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Animate each digit with staggered timing
      for (let i = 0; i < digits.length; i++) {
        const digit = digits[i];
        const delay = i * 25; // Stagger each digit
        const digitElapsed = Math.max(0, elapsed - delay);
        const digitProgress = Math.min(digitElapsed / (duration - delay), 1);

        if (digitElapsed > 0) {
          // Bounce effect (jump up then settle)
          const bounceProgress = Math.min(digitProgress * 2, 1);
          const bounceHeight = isCritical ? 25 : 18;
          const bounce = Math.sin(bounceProgress * Math.PI) * bounceHeight;
          const floatUp = digitProgress * 35;
          digit.y = -bounce - floatUp;

          // Slight horizontal shake for critical
          if (isCritical && digitProgress < 0.3) {
            digit.x = (startX + i * digitWidth) + Math.sin(digitProgress * 25) * 3;
          }

          // Scale pop effect
          if (digitProgress < 0.15) {
            const scaleAmount = isCritical ? 0.3 : 0.2;
            const scale = 1 + Math.sin(digitProgress * Math.PI * 6.67) * scaleAmount;
            digit.scale.set(scale);
          } else {
            digit.scale.set(1);
          }
        }
      }

      // Fade out in the last 30%
      if (progress > 0.7) {
        damageContainer.alpha = 1 - ((progress - 0.7) / 0.3);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.entityLayer.removeChild(damageContainer);
        damageContainer.destroy();
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Meso Drop
  // ============================================================================

  /**
   * Try to drop meso based on drop chance (log only, no visual)
   */
  private tryDropMeso(meso: { amount: number; chance: number }): void {
    // Roll for drop chance (chance is percentage, e.g., 65 = 65%)
    if (Math.random() * 100 > meso.chance) {
      return; // No drop
    }

    // Calculate actual amount (base amount +/- 20%)
    const variance = 0.2;
    const minAmount = Math.floor(meso.amount * (1 - variance));
    const maxAmount = Math.ceil(meso.amount * (1 + variance));
    const amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;

    // Log meso gain (no visual drop)
    this.logMesoGain(amount);
  }

  // ============================================================================
  // Item Drop
  // ============================================================================

  /**
   * Try to drop items based on drop chances (with fly animation + log)
   */
  private tryDropItems(drops: Array<{ itemId: number; name?: string; chance: number }>, x: number, y: number): void {
    for (const drop of drops) {
      // Roll for drop chance (chance is percentage)
      if (Math.random() * 100 <= drop.chance) {
        this.createItemDrop(drop, x, y);
        // Log item acquisition
        this.logItemDrop(drop.name || `아이템 ${drop.itemId}`);
        // Play pickup sound
        this.playItemPickupSound();
      }
    }
  }

  /**
   * Play item pickup sound
   */
  private playItemPickupSound(): void {
    if (this.itemPickupSound) {
      // Clone to allow overlapping sounds
      const sound = this.itemPickupSound.cloneNode() as HTMLAudioElement;
      sound.volume = 0.5;
      sound.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }

  /**
   * Create item drop sprite with fly-to-center animation
   */
  private async createItemDrop(drop: { itemId: number; name?: string; chance: number }, x: number, y: number): Promise<void> {
    const itemContainer = new Container();
    itemContainer.x = x;
    itemContainer.y = y;

    // Try to load item icon
    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', drop.itemId, 'icon');

    if (iconBlob) {
      // Create image from blob
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      const texture = Texture.from(img);
      const itemSprite = new Sprite(texture);
      itemSprite.anchor.set(0.5);

      // Scale down if too large
      const maxSize = 24;
      if (itemSprite.width > maxSize || itemSprite.height > maxSize) {
        const scale = maxSize / Math.max(itemSprite.width, itemSprite.height);
        itemSprite.scale.set(scale);
      }

      itemContainer.addChild(itemSprite);
    } else {
      // Fallback: colored box
      const fallback = new Graphics();
      fallback.rect(-10, -10, 20, 20);
      fallback.fill({ color: 0x8B4513 });
      fallback.rect(-8, -8, 16, 16);
      fallback.fill({ color: 0xDEB887 });
      itemContainer.addChild(fallback);
    }

    this.entityLayer.addChild(itemContainer);

    // Fly to center animation
    this.flyToCenter(itemContainer, x, y);
  }

  /**
   * Fly to center animation (used by item drops)
   */
  private flyToCenter(container: Container, startX: number, startY: number): void {
    const centerX = MAP_CONFIG.WIDTH / 2;
    const centerY = MAP_CONFIG.HEIGHT / 2;
    const duration = 500;
    const startTime = Date.now();

    // Small bounce first
    const bounceHeight = 30;
    const bounceTime = 150;

    const animate = (): void => {
      const elapsed = Date.now() - startTime;

      if (elapsed < bounceTime) {
        // Bounce up phase
        const progress = elapsed / bounceTime;
        const bounceY = Math.sin(progress * Math.PI) * bounceHeight;
        container.y = startY - bounceY;
      } else {
        // Fly to center phase
        const flyProgress = Math.min(1, (elapsed - bounceTime) / (duration - bounceTime));
        const easeProgress = 1 - Math.pow(1 - flyProgress, 2); // Ease out

        container.x = startX + (centerX - startX) * easeProgress;
        container.y = startY + (centerY - startY) * easeProgress;
        container.alpha = 1 - flyProgress * 0.5; // Fade slightly

        if (flyProgress >= 1) {
          this.entityLayer.removeChild(container);
          container.destroy();
          return;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Get monster at screen position
   * @param x - Screen X
   * @param y - Screen Y
   * @returns Monster instance ID or null
   */
  getMonsterAtPosition(x: number, y: number): string | null {
    for (const [instanceId, sprite] of this.monsterSprites) {
      const bounds = sprite.getBounds();
      // PixiJS v8 Bounds uses x, y, width, height
      const isInBounds = x >= bounds.x && 
                         x <= bounds.x + bounds.width &&
                         y >= bounds.y && 
                         y <= bounds.y + bounds.height;
      if (isInBounds) {
        return instanceId;
      }
    }
    return null;
  }

  private removeMonster(instanceId: string): void {
    const sprite = this.monsterSprites.get(instanceId);
    if (sprite) {
      this.entityLayer.removeChild(sprite);
      sprite.destroy();
    }
    this.monsterSprites.delete(instanceId);
    this.monsters.delete(instanceId);
    this.damageOffsets.delete(instanceId);
  }

  // ============================================================================
  // Test Combat (Click to Attack)
  // ============================================================================

  private setupClickHandler(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    this.clickHandler = () => {
      this.attackRandomMonster();
    };

    canvas.addEventListener('click', this.clickHandler);
  }

  private removeClickHandler(): void {
    if (this.clickHandler) {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.removeEventListener('click', this.clickHandler);
      }
      this.clickHandler = null;
    }
  }

  /**
   * Attack a random monster with random damage
   * For testing purposes
   */
  private attackRandomMonster(): void {
    // Filter out dying monsters from targets
    const aliveMonsters = Array.from(this.monsters.entries())
      .filter(([, state]) => !state.isDying);

    if (aliveMonsters.length === 0) return;

    // Select random alive monster
    const randomIndex = Math.floor(Math.random() * aliveMonsters.length);
    const [targetId, monster] = aliveMonsters[randomIndex];

    // Critical hit chance (30%)
    const isCritical = Math.random() < 0.3;

    // Random damage: Normal 10~30, Critical 25~50 (1.5x ~ 2x multiplier)
    let damage: number;
    if (isCritical) {
      damage = Math.floor(Math.random() * 26) + 25;
    } else {
      damage = Math.floor(Math.random() * 21) + 10;
    }

    // Get monster info for logging
    const mob = getMobById(monster.mobId);

    // Apply damage
    const isDead = this.hitMonster(targetId, damage, isCritical);

    // Log result
    if (mob) {
      const critText = isCritical ? ' [CRITICAL]' : '';
      console.log(
        `[Combat] Hit ${mob.name}: [damage]=[${damage}]${critText} [hp]=[${monster.currentHp}/${monster.maxHp}] [dead]=[${isDead}]`
      );
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async destroy(): Promise<void> {
    this.removeClickHandler();
    this.monsters.clear();
    this.monsterSprites.clear();
    this.mobGifSources.clear();
    this.mobSounds.clear();
    this.damageOffsets.clear();
    this.itemPickupSound = null;

    // Clear log entries
    for (const entry of this.logEntries) {
      entry.text.destroy();
    }
    this.logEntries = [];

    await super.destroy();
  }
}
