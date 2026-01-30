import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { GifSprite, GifSource } from 'pixi.js/gif';
import { BaseScene } from './BaseScene';
import {
  MAP_CONFIG,
  SPAWN_CONFIG,
  MONSTER_BEHAVIOR_CONFIG,
  LAYOUT_CONFIG,
  SLOT_CONFIG,
} from '@/constants/config';
import { getMapById } from '@/data/maps';
import { getMobById } from '@/data/mobs';
import { AudioManager } from '@/game/systems/AudioManager';
import { AssetManager } from '@/game/systems/AssetManager';
import { PartySlot } from '@/game/ui/PartySlot';
import { CharacterCreationUI } from '@/game/ui/CharacterCreationUI';
import { MapSelectionUI } from '@/game/ui/MapSelectionUI';
import type { MapInfo } from '@/types/map';
import type { MobData } from '@/types/monster';
import type { PartyCharacter } from '@/types/party';
import type { Stats } from '@/types/character';

// ============================================================================
// Constants
// ============================================================================

const MOB_ANIMATIONS = ['stand', 'move', 'hit1', 'die1'] as const;
type MobAnimation = (typeof MOB_ANIMATIONS)[number];

const HIT_ANIMATION_DURATION = 450;
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

interface LayoutDimensions {
  header: { x: number; y: number; width: number; height: number };
  party: { x: number; y: number; width: number; height: number };
  field: { x: number; y: number; width: number; height: number };
  log: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Main Scene
// ============================================================================

export class MainScene extends BaseScene {
  private mapInfo: MapInfo | null = null;
  private monsters: Map<string, MonsterState> = new Map();
  private monsterSprites: Map<string, Container> = new Map();
  private mobGifSources: Map<string, GifSource> = new Map();
  private mobSounds: Map<string, HTMLAudioElement> = new Map();
  private itemPickupSound: HTMLAudioElement | null = null;

  // Layout containers
  private headerLayer!: Container;
  private partyLayer!: Container;
  private fieldLayer!: Container;
  private logLayer!: Container;

  // Layout dimensions (calculated on resize)
  private layout!: LayoutDimensions;

  // UI elements
  private mapTitleText: Text | null = null;
  private mesoText: Text | null = null;
  private partySlots: PartySlot[] = [];
  private createCharacterButton: Container | null = null;
  private characterCreationUI: CharacterCreationUI | null = null;
  private mapSelectionUI: MapSelectionUI | null = null;
  
  // Party data (initially empty)
  private partyCharacters: Array<PartyCharacter | null> = [];

  // Log system
  private logEntries: Array<{ text: Text; createdAt: number }> = [];

  // Spawn
  private spawnTimer = 0;
  private monsterIdCounter = 0;

  // Damage stacking
  private damageOffsets: Map<string, { offset: number; lastTime: number }> = new Map();
  private readonly DAMAGE_STACK_HEIGHT = 35;
  private readonly DAMAGE_STACK_RESET_TIME = 600;

  constructor(mapId: number = 104010001) {
    super();
    this.mapInfo = getMapById(mapId) ?? null;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  protected async load(): Promise<void> {
    if (!this.mapInfo) {
      console.error('[MainScene] Map not found');
      return;
    }
    console.log('[MainScene] Loading map:', this.mapInfo.name);

    const assetManager = AssetManager.getInstance();

    // Preload monster GIF animations
    for (const mobSpawn of this.mapInfo.spawns.normal.mobs) {
      const mob = getMobById(mobSpawn.mobId);
      if (mob) {
        for (const animation of MOB_ANIMATIONS) {
          const gifSource = await assetManager.getMobGif(mob.id, animation);
          if (gifSource) {
            const key = `${mob.id}_${animation}`;
            this.mobGifSources.set(key, gifSource);
          }
        }

        const mobIdStr = mob.id.toString().padStart(7, '0');
        const soundTypes: Array<'Damage' | 'Die'> = ['Damage', 'Die'];
        for (const soundType of soundTypes) {
          const soundData = await assetManager.getMobSound(mobIdStr, soundType);
          if (soundData) {
            const audio = this.createAudioFromBase64(soundData);
            const key = `${mob.id}_${soundType}`;
            this.mobSounds.set(key, audio);
          }
        }
      }
    }

    // Preload item pickup sound
    const pickupSoundData = await assetManager.getGameSound('Game.img/PickUpItem');
    if (pickupSoundData) {
      this.itemPickupSound = this.createAudioFromBase64(pickupSoundData);
    }

    // Play BGM
    if (this.mapInfo.bgm) {
      const audioManager = AudioManager.getInstance();
      audioManager.init();
      audioManager.playBgm(this.mapInfo.bgm);
    }
  }

  protected create(): void {
    this.calculateLayout();
    this.createLayers();
    this.createHeader();
    this.createPartyArea();
    this.createFieldArea();
    this.createLogArea();
    this.spawnInitialMonsters();

    console.log('[MainScene] Created with layout:', this.layout);
  }

  update(deltaTime: number): void {
    if (!this.isInitialized) return;

    this.updateSpawnTimer(deltaTime);
    this.updateMonsters(deltaTime);
    this.updateLogEntries();
  }

  // ============================================================================
  // Layout Calculation
  // ============================================================================

  private calculateLayout(): void {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const headerHeight = LAYOUT_CONFIG.HEADER.HEIGHT;
    const partyHeight = Math.floor((height - headerHeight) * LAYOUT_CONFIG.PARTY_AREA.HEIGHT_RATIO);
    const logHeight = Math.floor((height - headerHeight) * LAYOUT_CONFIG.LOG_AREA.HEIGHT_RATIO);
    const fieldHeight = height - headerHeight - partyHeight - logHeight;

    this.layout = {
      header: {
        x: 0,
        y: 0,
        width: width,
        height: headerHeight,
      },
      party: {
        x: 0,
        y: headerHeight,
        width: width,
        height: partyHeight,
      },
      field: {
        x: 0,
        y: headerHeight + partyHeight,
        width: width,
        height: fieldHeight,
      },
      log: {
        x: 0,
        y: headerHeight + partyHeight + fieldHeight,
        width: width,
        height: logHeight,
      },
    };
  }

  // ============================================================================
  // Layer Creation
  // ============================================================================

  private createLayers(): void {
    this.headerLayer = new Container();
    this.partyLayer = new Container();
    this.fieldLayer = new Container();
    this.logLayer = new Container();

    // Position layers
    this.headerLayer.y = this.layout.header.y;
    this.partyLayer.y = this.layout.party.y;
    this.fieldLayer.y = this.layout.field.y;
    this.logLayer.y = this.layout.log.y;

    // Add to main container
    this.container.addChild(this.headerLayer);
    this.container.addChild(this.partyLayer);
    this.container.addChild(this.fieldLayer);
    this.container.addChild(this.logLayer);

    // Debug: Draw area boundaries (can be removed later)
    this.drawLayoutDebug();
  }

  private drawLayoutDebug(): void {
    // Header border
    const headerBorder = new Graphics();
    headerBorder.label = 'debugBorder';
    headerBorder.rect(0, 0, this.layout.header.width, this.layout.header.height);
    headerBorder.stroke({ color: 0x333333, width: 1 });
    this.headerLayer.addChild(headerBorder);

    // Party area border
    const partyBorder = new Graphics();
    partyBorder.label = 'debugBorder';
    partyBorder.rect(0, 0, this.layout.party.width, this.layout.party.height);
    partyBorder.stroke({ color: 0x333333, width: 1 });
    this.partyLayer.addChild(partyBorder);

    // Field area border
    const fieldBorder = new Graphics();
    fieldBorder.label = 'debugBorder';
    fieldBorder.rect(0, 0, this.layout.field.width, this.layout.field.height);
    fieldBorder.stroke({ color: 0x333333, width: 1 });
    this.fieldLayer.addChild(fieldBorder);

    // Log area border
    const logBorder = new Graphics();
    logBorder.label = 'debugBorder';
    logBorder.rect(0, 0, this.layout.log.width, this.layout.log.height);
    logBorder.stroke({ color: 0x333333, width: 1 });
    this.logLayer.addChild(logBorder);
  }

  private updateDebugBorders(): void {
    // Update header border
    const headerBorder = this.headerLayer.getChildByName('debugBorder') as Graphics;
    if (headerBorder) {
      headerBorder.clear();
      headerBorder.rect(0, 0, this.layout.header.width, this.layout.header.height);
      headerBorder.stroke({ color: 0x333333, width: 1 });
    }

    // Update party border
    const partyBorder = this.partyLayer.getChildByName('debugBorder') as Graphics;
    if (partyBorder) {
      partyBorder.clear();
      partyBorder.rect(0, 0, this.layout.party.width, this.layout.party.height);
      partyBorder.stroke({ color: 0x333333, width: 1 });
    }

    // Update field border
    const fieldBorder = this.fieldLayer.getChildByName('debugBorder') as Graphics;
    if (fieldBorder) {
      fieldBorder.clear();
      fieldBorder.rect(0, 0, this.layout.field.width, this.layout.field.height);
      fieldBorder.stroke({ color: 0x333333, width: 1 });
    }

    // Update log border
    const logBorder = this.logLayer.getChildByName('debugBorder') as Graphics;
    if (logBorder) {
      logBorder.clear();
      logBorder.rect(0, 0, this.layout.log.width, this.layout.log.height);
      logBorder.stroke({ color: 0x333333, width: 1 });
    }
  }

  // ============================================================================
  // Header Area (맵 정보 + 메소)
  // ============================================================================

  private createHeader(): void {
    if (!this.mapInfo) return;

    const padding = LAYOUT_CONFIG.HEADER.PADDING;

    // Map title (left side with dropdown arrow)
    this.mapTitleText = new Text({
      text: `${this.mapInfo.name} ▼`,
      style: {
        fontSize: 18,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
        },
      },
    });
    this.mapTitleText.x = padding;
    this.mapTitleText.y = (this.layout.header.height - this.mapTitleText.height) / 2;
    this.mapTitleText.eventMode = 'static';
    this.mapTitleText.cursor = 'pointer';
    this.mapTitleText.on('pointerdown', () => {
      this.openMapSelection();
    });
    this.headerLayer.addChild(this.mapTitleText);

    // Meso display (right side)
    this.mesoText = new Text({
      text: '메소: 0',
      style: {
        fontSize: 16,
        fill: 0xFFD700,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
        },
      },
    });
    this.mesoText.anchor.set(1, 0.5);
    this.mesoText.x = this.layout.header.width - padding;
    this.mesoText.y = this.layout.header.height / 2;
    this.headerLayer.addChild(this.mesoText);

    // Add character button will be added dynamically
    this.updateAddCharacterButton();
  }

  /**
   * Update add character button in header
   */
  private updateAddCharacterButton(): void {
    // Remove existing button only if it's in header layer
    if (this.createCharacterButton && this.createCharacterButton.parent === this.headerLayer) {
      this.headerLayer.removeChild(this.createCharacterButton);
      this.createCharacterButton.destroy();
      this.createCharacterButton = null;
    }

    // Show button in header only if party has at least 1 character and is not full
    const maxSlots = LAYOUT_CONFIG.PARTY_AREA.MAX_SLOTS;
    if (this.partyCharacters.length > 0 && this.partyCharacters.length < maxSlots) {
      const padding = LAYOUT_CONFIG.HEADER.PADDING;
      
      this.createCharacterButton = this.createSmallAddButton();
      
      // Position: right side, before meso text
      const mesoTextLeft = this.mesoText ? this.mesoText.x - this.mesoText.width : this.layout.header.width - padding;
      this.createCharacterButton.x = mesoTextLeft - 40; // 40px gap from meso
      this.createCharacterButton.y = (this.layout.header.height - 32) / 2; // Center vertically (32 is button size)
      
      this.headerLayer.addChild(this.createCharacterButton);
    }
  }

  // ============================================================================
  // Party Area (동적 캐릭터 슬롯)
  // ============================================================================

  /**
   * Create party area UI
   * Shows "Create Character" button if no characters exist
   * Otherwise shows character slots centered with fixed width
   */
  private createPartyArea(): void {
    this.renderPartySlots();
    this.createPartyFieldDivider();
  }

  /**
   * Render party slots based on current party state
   */
  private renderPartySlots(): void {
    // Clear existing slots and button
    this.clearPartySlots();

    const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;
    const availableHeight = this.layout.party.height - padding * 2;

    // Fixed slot dimensions
    const slotWidth = SLOT_CONFIG.MIN_WIDTH;
    const slotHeight = Math.max(SLOT_CONFIG.MIN_HEIGHT, availableHeight);
    const slotGap = LAYOUT_CONFIG.PARTY_AREA.SLOT_GAP;

    if (this.partyCharacters.length === 0) {
      // No characters: show "Create Character" button only
      this.createCharacterButton = this.createAddCharacterButton(slotWidth, slotHeight, true);
      this.createCharacterButton.x = (this.layout.party.width - slotWidth) / 2;
      this.createCharacterButton.y = padding;
      this.partyLayer.addChild(this.createCharacterButton);
    } else {
      // Has characters: show character slots only
      const totalWidth = this.partyCharacters.length * slotWidth + (this.partyCharacters.length - 1) * slotGap;
      const startX = (this.layout.party.width - totalWidth) / 2;
      const startY = padding;

      // Create character slots
      for (let i = 0; i < this.partyCharacters.length; i++) {
        const character = this.partyCharacters[i];
        const slot = this.createPartySlot(i, slotWidth, slotHeight);
        
        if (character) {
          slot.setCharacter(character);
        }
        
        slot.x = startX + i * (slotWidth + slotGap);
        slot.y = startY;
        this.partyLayer.addChild(slot);
        this.partySlots.push(slot);
      }
    }

    // Update add button in header (if needed)
    this.updateAddCharacterButton();
  }

  /**
   * Clear all party slots
   */
  private clearPartySlots(): void {
    // Remove existing slots
    for (const slot of this.partySlots) {
      this.partyLayer.removeChild(slot);
      slot.destroy();
    }
    this.partySlots = [];

    // Remove create button if exists in party layer
    if (this.createCharacterButton && this.createCharacterButton.parent === this.partyLayer) {
      this.partyLayer.removeChild(this.createCharacterButton);
      this.createCharacterButton.destroy();
      this.createCharacterButton = null;
    }
  }

  /**
   * Create "Add Character" button (large, for initial state)
   */
  private createAddCharacterButton(width: number, height: number, isInitial: boolean = false): Container {
    const button = new Container();
    button.label = 'addCharacterButton';

    // Background
    const background = new Graphics();
    background.roundRect(0, 0, width, height, 8);
    background.fill({ color: 0x1a1a1a });
    background.stroke({ color: 0x4488ff, width: 2, alpha: 0.6 });
    button.addChild(background);

    // Plus icon
    const plusSize = 40;
    const plusGraphics = new Graphics();
    plusGraphics.rect(width / 2 - plusSize / 2, height / 2 - 2, plusSize, 4);
    plusGraphics.fill({ color: 0x4488ff });
    plusGraphics.rect(width / 2 - 2, height / 2 - plusSize / 2, 4, plusSize);
    plusGraphics.fill({ color: 0x4488ff });
    button.addChild(plusGraphics);

    // Label
    const labelText = isInitial ? '캐릭터 생성' : '캐릭터 추가';
    const label = new Text({
      text: labelText,
      style: {
        fontSize: 13,
        fill: 0x4488ff,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5, 0);
    label.x = width / 2;
    label.y = height / 2 + plusSize / 2 + 8;
    button.addChild(label);

    // Interactivity
    button.eventMode = 'static';
    button.cursor = 'pointer';

    button.on('pointerdown', () => {
      this.onAddCharacterClick();
    });

    button.on('pointerover', () => {
      background.clear();
      background.roundRect(0, 0, width, height, 8);
      background.fill({ color: 0x2a2a2a });
      background.stroke({ color: 0x5599ff, width: 2 });
    });

    button.on('pointerout', () => {
      background.clear();
      background.roundRect(0, 0, width, height, 8);
      background.fill({ color: 0x1a1a1a });
      background.stroke({ color: 0x4488ff, width: 2, alpha: 0.6 });
    });

    return button;
  }

  /**
   * Create small "+" button (for top-right corner)
   */
  private createSmallAddButton(): Container {
    const button = new Container();
    button.label = 'smallAddButton';

    const buttonSize = 32;
    const plusSize = 16;

    // Background circle
    const background = new Graphics();
    background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
    background.fill({ color: 0x4488ff });
    background.stroke({ color: 0xFFFFFF, width: 2 });
    button.addChild(background);

    // Plus icon
    const plusGraphics = new Graphics();
    plusGraphics.rect(buttonSize / 2 - plusSize / 2, buttonSize / 2 - 1.5, plusSize, 3);
    plusGraphics.fill({ color: 0xFFFFFF });
    plusGraphics.rect(buttonSize / 2 - 1.5, buttonSize / 2 - plusSize / 2, 3, plusSize);
    plusGraphics.fill({ color: 0xFFFFFF });
    button.addChild(plusGraphics);

    // Interactivity
    button.eventMode = 'static';
    button.cursor = 'pointer';

    button.on('pointerdown', () => {
      this.onAddCharacterClick();
    });

    button.on('pointerover', () => {
      background.clear();
      background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
      background.fill({ color: 0x5599ff });
      background.stroke({ color: 0xFFFFFF, width: 2 });
    });

    button.on('pointerout', () => {
      background.clear();
      background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
      background.fill({ color: 0x4488ff });
      background.stroke({ color: 0xFFFFFF, width: 2 });
    });

    return button;
  }

  /**
   * Handle add character button click
   */
  private onAddCharacterClick(): void {
    console.log('[MainScene] Add character clicked');
    this.showCharacterCreationUI();
  }

  private createPartyFieldDivider(): void {
    const divider = new Graphics();
    divider.label = 'partyFieldDivider';
    
    // Draw gradient-like divider line
    const lineY = this.layout.party.height;
    const padding = 30;
    
    divider.moveTo(padding, lineY);
    divider.lineTo(this.layout.party.width - padding, lineY);
    divider.stroke({ color: 0x4488ff, width: 2 });
    
    // Add subtle glow effect (wider, more transparent line behind)
    const glowLine = new Graphics();
    glowLine.label = 'partyFieldDividerGlow';
    glowLine.moveTo(padding, lineY);
    glowLine.lineTo(this.layout.party.width - padding, lineY);
    glowLine.stroke({ color: 0x4488ff, width: 6, alpha: 0.2 });
    
    this.partyLayer.addChild(glowLine);
    this.partyLayer.addChild(divider);
    
    // Set initial alpha
    divider.alpha = 0.3;
    glowLine.alpha = 0.15;
  }

  private updatePartyFieldDivider(): void {
    const divider = this.partyLayer.getChildByName('partyFieldDivider') as Graphics;
    const glowLine = this.partyLayer.getChildByName('partyFieldDividerGlow') as Graphics;
    
    if (divider) {
      const lineY = this.layout.party.height;
      const padding = 30;
      const currentAlpha = divider.alpha;
      
      divider.clear();
      divider.moveTo(padding, lineY);
      divider.lineTo(this.layout.party.width - padding, lineY);
      divider.stroke({ color: 0x4488ff, width: 2 });
      divider.alpha = currentAlpha;
    }
    
    if (glowLine) {
      const lineY = this.layout.party.height;
      const padding = 30;
      
      glowLine.clear();
      glowLine.moveTo(padding, lineY);
      glowLine.lineTo(this.layout.party.width - padding, lineY);
      glowLine.stroke({ color: 0x4488ff, width: 6, alpha: 0.2 });
    }
  }

  private createPartySlot(index: number, width: number, height: number): PartySlot {
    const partySlot = new PartySlot({
      width,
      height,
      slotIndex: index,
      character: null,
      onClick: (slotIndex: number) => {
        this.onSlotClick(slotIndex);
      },
    });

    return partySlot;
  }

  /**
   * Handle party slot click
   */
  private onSlotClick(slotIndex: number): void {
    const character = this.partyCharacters[slotIndex];
    if (character) {
      console.log(`[MainScene] Character slot ${slotIndex} clicked: [name]=[${character.name}]`);
      // TODO: Open character details/equipment/skills UI
    } else {
      console.log(`[MainScene] Empty slot ${slotIndex} clicked`);
    }
  }

  /**
   * Show character creation UI
   */
  private showCharacterCreationUI(): void {
    const maxSlots = LAYOUT_CONFIG.PARTY_AREA.MAX_SLOTS;
    if (this.partyCharacters.length >= maxSlots) {
      console.log('[MainScene] Party is full');
      return;
    }

    // Remove existing UI if any
    if (this.characterCreationUI) {
      this.container.removeChild(this.characterCreationUI);
      this.characterCreationUI.destroy();
      this.characterCreationUI = null;
    }

    // Create new character creation UI
    this.characterCreationUI = new CharacterCreationUI({
      onConfirm: (data) => {
        this.createCharacter(data.name, data.stats);
        this.hideCharacterCreationUI();
      },
      onCancel: () => {
        this.hideCharacterCreationUI();
      },
    });

    this.characterCreationUI.centerIn(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
    this.container.addChild(this.characterCreationUI);

    console.log('[MainScene] Character creation UI opened');
  }

  /**
   * Hide character creation UI
   */
  private hideCharacterCreationUI(): void {
    if (this.characterCreationUI) {
      this.container.removeChild(this.characterCreationUI);
      this.characterCreationUI.destroy();
      this.characterCreationUI = null;
      console.log('[MainScene] Character creation UI closed');
    }
  }

  /**
   * Create new character with given name and stats
   */
  private createCharacter(name: string, stats: Stats): void {
    const newCharacter: PartyCharacter = {
      id: `char_${Date.now()}`,
      name: name,
      level: 1,
      exp: 0,
      job: 'beginner',
      stats: { ...stats },
      combatStats: {
        accuracy: 10,
        evasion: 5,
        criticalChance: 0.05,
        criticalDamage: 1.5,
        dropRate: 1.0,
      },
      statPoints: 0,
      skillPoints: 0,
      hp: 50 + stats.str * 2, // HP based on STR
      maxHp: 50 + stats.str * 2,
      mp: 10 + stats.int * 2, // MP based on INT
      maxMp: 10 + stats.int * 2,
      isActive: true,
      learnedSkills: [],
      equippedSkillSlots: [null, null, null, null, null, null],
      lastAttackTime: 0,
      currentAnimation: 'stand',
    };

    this.partyCharacters.push(newCharacter);
    this.renderPartySlots();

    console.log(`[MainScene] Character created: [name]=[${newCharacter.name}] [stats]=[STR:${stats.str},DEX:${stats.dex},INT:${stats.int},LUK:${stats.luk}] [partySize]=[${this.partyCharacters.length}]`);
  }

  /**
   * Update party slots on resize
   */
  private updatePartySlots(): void {
    // Re-render all slots with new dimensions
    this.renderPartySlots();
  }

  // ============================================================================
  // Field Area (사냥 필드 - 몬스터만)
  // ============================================================================

  private createFieldArea(): void {
    // Field background (subtle gradient or pattern can be added)
    const fieldBg = new Graphics();
    fieldBg.label = 'fieldBg';
    fieldBg.rect(0, 0, this.layout.field.width, this.layout.field.height);
    fieldBg.fill({ color: 0x0a0a0a, alpha: 0.5 });
    this.fieldLayer.addChild(fieldBg);

    // Ground line
    const groundY = this.layout.field.height - 30;
    const groundLine = new Graphics();
    groundLine.label = 'groundLine';
    groundLine.moveTo(20, groundY);
    groundLine.lineTo(this.layout.field.width - 20, groundY);
    groundLine.stroke({ color: 0x333333, width: 2 });
    this.fieldLayer.addChild(groundLine);

    // Setup click handler for field area only
    this.setupClickHandler();
  }

  private updateFieldArea(): void {
    // Update field background
    const fieldBg = this.fieldLayer.getChildByName('fieldBg') as Graphics;
    if (fieldBg) {
      fieldBg.clear();
      fieldBg.rect(0, 0, this.layout.field.width, this.layout.field.height);
      fieldBg.fill({ color: 0x0a0a0a, alpha: 0.5 });
    }

    // Update ground line
    const groundY = this.layout.field.height - 30;
    const groundLine = this.fieldLayer.getChildByName('groundLine') as Graphics;
    if (groundLine) {
      groundLine.clear();
      groundLine.moveTo(20, groundY);
      groundLine.lineTo(this.layout.field.width - 20, groundY);
      groundLine.stroke({ color: 0x333333, width: 2 });
    }

    // Update all monsters' baseY and sprite positions
    const fieldPadding = LAYOUT_CONFIG.FIELD_AREA.PADDING;
    const minX = fieldPadding + 50;
    const maxX = this.layout.field.width - fieldPadding - 50;

    for (const [id, monster] of this.monsters) {
      monster.baseY = groundY;
      if (!monster.isJumping) {
        monster.y = groundY;
      }

      // Clamp X position to new boundaries
      monster.x = Math.max(minX, Math.min(maxX, monster.x));

      // Update sprite position immediately
      const sprite = this.monsterSprites.get(id);
      if (sprite) {
        sprite.x = monster.x;
        sprite.y = monster.y;
      }
    }
  }

  // ============================================================================
  // Log Area
  // ============================================================================

  private createLogArea(): void {
    const padding = LAYOUT_CONFIG.LOG_AREA.PADDING;

    // Log area title
    const logTitle = new Text({
      text: '[로그]',
      style: {
        fontSize: 12,
        fill: 0x888888,
        fontFamily: 'Arial',
      },
    });
    logTitle.x = padding;
    logTitle.y = 5;
    this.logLayer.addChild(logTitle);
  }

  private addLog(message: string, color: number = 0xFFFFFF): void {
    const padding = LAYOUT_CONFIG.LOG_AREA.PADDING;
    const maxEntries = LAYOUT_CONFIG.LOG_AREA.MAX_ENTRIES;

    const logText = new Text({
      text: message,
      style: {
        fontSize: 11,
        fill: color,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 1,
          distance: 1,
        },
      },
    });
    logText.x = padding;

    this.logEntries.unshift({ text: logText, createdAt: Date.now() });

    while (this.logEntries.length > maxEntries) {
      const removed = this.logEntries.pop();
      if (removed) {
        this.logLayer.removeChild(removed.text);
        removed.text.destroy();
      }
    }

    this.logLayer.addChild(logText);
    this.updateLogPositions();
  }

  private updateLogPositions(): void {
    let y = 22; // Below title
    for (const entry of this.logEntries) {
      entry.text.y = y;
      y += 14;
    }
  }

  private updateLogEntries(): void {
    const now = Date.now();
    const fadeStart = LAYOUT_CONFIG.LOG_AREA.FADE_START_MS;
    const fadeDuration = LAYOUT_CONFIG.LOG_AREA.FADE_DURATION_MS;

    for (let i = this.logEntries.length - 1; i >= 0; i--) {
      const entry = this.logEntries[i];
      const age = now - entry.createdAt;

      if (age > fadeStart) {
        const fadeProgress = (age - fadeStart) / fadeDuration;
        entry.text.alpha = Math.max(0, 1 - fadeProgress);

        if (fadeProgress >= 1) {
          this.logLayer.removeChild(entry.text);
          entry.text.destroy();
          this.logEntries.splice(i, 1);
          this.updateLogPositions();
        }
      }
    }
  }

  private logExpGain(mobName: string, exp: number): void {
    this.addLog(`${mobName} 처치! +${exp} EXP`, 0x90EE90);
  }

  private logMesoGain(amount: number): void {
    this.addLog(`+${amount} 메소`, 0xFFD700);
  }

  private logItemDrop(itemName: string): void {
    this.addLog(`${itemName} 획득!`, 0x87CEEB);
  }

  // ============================================================================
  // Resize Handler
  // ============================================================================

  onResize(_width: number, _height: number): void {
    // Recalculate layout based on updated MAP_CONFIG
    this.calculateLayout();

    // Update layer positions
    this.headerLayer.y = this.layout.header.y;
    this.partyLayer.y = this.layout.party.y;
    this.fieldLayer.y = this.layout.field.y;
    this.logLayer.y = this.layout.log.y;

    // Update debug borders
    this.updateDebugBorders();

    // Update header elements
    if (this.mesoText) {
      this.mesoText.x = this.layout.header.width - LAYOUT_CONFIG.HEADER.PADDING;
    }
    this.updateAddCharacterButton();

    // Update party slots and divider
    this.updatePartySlots();
    this.updatePartyFieldDivider();

    // Update field area (background, ground line, monster positions)
    this.updateFieldArea();

    console.log(`[MainScene] Resized to ${this.layout.field.width}x${this.layout.field.height}`);
  }

  // ============================================================================
  // Monster Spawning (Field relative coordinates)
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

    if (this.monsters.size < SPAWN_CONFIG.MAX_MONSTERS) {
      this.spawnMonster();
    }
  }

  private spawnMonster(): void {
    if (!this.mapInfo) return;

    const mob = this.selectRandomMob();
    if (!mob) return;

    const instanceId = `mob_${++this.monsterIdCounter}`;

    // Spawn within field area (relative to field layer)
    const fieldPadding = LAYOUT_CONFIG.FIELD_AREA.PADDING;
    const minX = fieldPadding + 50;
    const maxX = this.layout.field.width - fieldPadding - 50;
    const groundY = this.layout.field.height - 30;

    const x = minX + Math.random() * (maxX - minX);
    const y = groundY;

    const speedMultiplier = 1 + (mob.meta.speed / 100);
    const moveSpeed = MONSTER_BEHAVIOR_CONFIG.BASE_MOVE_SPEED * Math.max(0.3, speedMultiplier);
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
      if (rand < 0.25) return 'idle';
      if (rand < 0.5) return 'moveLeft';
      if (rand < 0.75) return 'moveRight';
      return 'jump';
    } else {
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

    // HP bar container
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

    // Name tag
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

    // Field boundaries (relative to field layer)
    const fieldPadding = LAYOUT_CONFIG.FIELD_AREA.PADDING;
    const minX = fieldPadding + 50;
    const maxX = this.layout.field.width - fieldPadding - 50;

    for (const [id, monster] of this.monsters) {
      const sprite = this.monsterSprites.get(id);
      if (!sprite) continue;

      // Handle dying monsters
      if (monster.isDying) {
        const deathElapsed = now - monster.deathStartTime;
        const deathProgress = Math.min(deathElapsed / DEATH_FADE_DURATION, 1);
        sprite.alpha = 1 - deathProgress;

        if (deathProgress >= 1) {
          this.removeMonster(id);
        }
        continue;
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
          monster.actionTimer = this.getRandomActionTime();

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

      // Jump physics
      if (monster.isJumping) {
        monster.velocityY += GRAVITY * deltaTime;
        monster.y += monster.velocityY * deltaTime;

        if (monster.y >= monster.baseY) {
          monster.y = monster.baseY;
          monster.isJumping = false;
          monster.velocityY = 0;
          monster.action = 'idle';
          monster.actionTimer = this.getRandomActionTime();
        }
      }

      // Boundary check (field-relative)
      if (monster.x < minX) {
        monster.x = minX;
        monster.direction = 1;
        monster.action = 'moveRight';
      } else if (monster.x > maxX) {
        monster.x = maxX;
        monster.direction = -1;
        monster.action = 'moveLeft';
      }

      // Update sprite
      sprite.x = monster.x;
      sprite.y = monster.y;

      const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
      if (spriteContainer) {
        spriteContainer.scale.x = monster.direction > 0 ? -1 : 1;
      }

      // HP bar visibility
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

  hitMonster(instanceId: string, damage: number, isCritical: boolean = false): boolean {
    const monster = this.monsters.get(instanceId);
    if (!monster) return false;

    if (monster.isDying) return false;

    const sprite = this.monsterSprites.get(instanceId);
    if (!sprite) return false;

    const now = Date.now();

    monster.currentHp = Math.max(0, monster.currentHp - damage);
    monster.lastHitTime = now;

    monster.isHit = true;
    monster.hitEndTime = now + HIT_ANIMATION_DURATION;

    monster.currentAnimation = 'hit1';
    this.setMonsterAnimation(sprite, 'hit1');
    this.playMobSound(monster.mobId, 'Damage');

    // Check if monster will die
    const willDie = monster.currentHp <= 0;
    
    // If dying, reset position first before showing damage number
    if (willDie) {
      monster.isJumping = false;
      monster.velocityY = 0;
      monster.y = monster.baseY;
      monster.action = 'idle';
      sprite.y = monster.y;
      
      // Reset spriteContainer position
      const spriteContainer = sprite.getChildByName('spriteContainer') as Container;
      if (spriteContainer) {
        spriteContainer.y = 0;
      }
    }

    // Show damage number at the correct position
    this.showDamageNumber(instanceId, damage, monster.x, monster.y, isCritical);

    // Update HP bar only if not dying
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
      this.setMonsterAnimation(sprite, 'die1');
      this.playMobSound(monster.mobId, 'Die');

      const mob = getMobById(monster.mobId);
      if (mob) {
        this.logExpGain(mob.name, mob.meta.exp);
        this.tryDropMeso(mob.meso);
        this.tryDropItems(mob.drops, monster.x, monster.y);
      }

      // Hide HP bar and name tag
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

  private showDamageNumber(instanceId: string, damage: number, x: number, y: number, isCritical: boolean = false): void {
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

    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
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
        damageContainer.destroy();
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Drops
  // ============================================================================

  private tryDropMeso(meso: { amount: number; chance: number }): void {
    if (Math.random() * 100 > meso.chance) {
      return;
    }

    const variance = 0.2;
    const minAmount = Math.floor(meso.amount * (1 - variance));
    const maxAmount = Math.ceil(meso.amount * (1 + variance));
    const amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;

    this.logMesoGain(amount);
  }

  private tryDropItems(drops: Array<{ itemId: number; name?: string; chance: number }>, x: number, y: number): void {
    for (const drop of drops) {
      if (Math.random() * 100 <= drop.chance) {
        this.createItemDrop(drop, x, y);
        this.logItemDrop(drop.name || `아이템 ${drop.itemId}`);
        this.playItemPickupSound();
      }
    }
  }

  /**
   * Create item drop sprite with fly-to-party animation
   */
  private async createItemDrop(drop: { itemId: number; name?: string; chance: number }, x: number, y: number): Promise<void> {
    const itemContainer = new Container();
    itemContainer.x = x;
    itemContainer.y = y;

    // Try to load item icon
    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', drop.itemId, 'icon');

    if (iconBlob) {
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      const texture = Texture.from(img);
      const itemSprite = new Sprite(texture);
      itemSprite.anchor.set(0.5);

      // Scale down if too large
      const maxSize = 32;
      if (itemSprite.width > maxSize || itemSprite.height > maxSize) {
        const scale = maxSize / Math.max(itemSprite.width, itemSprite.height);
        itemSprite.scale.set(scale);
      }

      itemContainer.addChild(itemSprite);
    } else {
      // Fallback: colored box
      const fallback = new Graphics();
      fallback.rect(-12, -12, 24, 24);
      fallback.fill({ color: 0x8B4513 });
      fallback.rect(-10, -10, 20, 20);
      fallback.fill({ color: 0xDEB887 });
      itemContainer.addChild(fallback);
    }

    this.fieldLayer.addChild(itemContainer);

    // Fly to party area (top center)
    this.flyToPartyArea(itemContainer, x, y);
  }

  /**
   * Fly to party area animation (item flies up to character slots)
   */
  private flyToPartyArea(container: Container, startX: number, startY: number): void {
    // Target: just above the divider line (relative to field layer, so negative Y)
    const targetX = this.layout.party.width / 2;
    const targetY = -5; // Just at the divider line level

    const duration = 600;
    const startTime = Date.now();

    // Small bounce first
    const bounceHeight = 40;
    const bounceTime = 150;

    const animate = (): void => {
      const elapsed = Date.now() - startTime;

      if (elapsed < bounceTime) {
        // Bounce up phase
        const progress = elapsed / bounceTime;
        const bounceY = Math.sin(progress * Math.PI) * bounceHeight;
        container.y = startY - bounceY;
        container.scale.set(1 + progress * 0.2); // Slight scale up
      } else {
        // Fly to party area phase
        const flyProgress = Math.min(1, (elapsed - bounceTime) / (duration - bounceTime));
        
        // Ease out cubic for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - flyProgress, 3);

        container.x = startX + (targetX - startX) * easeProgress;
        container.y = startY + (targetY - startY) * easeProgress;
        
        // Scale down and fade as it approaches
        const scale = 1.2 - flyProgress * 0.4;
        container.scale.set(scale);
        container.alpha = 1 - flyProgress * 0.3;

        // Trigger divider effect when crossing the boundary
        if (flyProgress > 0.6 && flyProgress < 0.65) {
          this.playDividerEffect();
        }

        if (flyProgress >= 1) {
          this.fieldLayer.removeChild(container);
          container.destroy();
          return;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Play divider line glow effect when item is collected
   */
  private playDividerEffect(): void {
    const divider = this.partyLayer.getChildByName('partyFieldDivider') as Graphics;
    const glowLine = this.partyLayer.getChildByName('partyFieldDividerGlow') as Graphics;
    if (!divider) return;

    // Already animating check
    if (divider.alpha > 0.5) return;

    const startTime = Date.now();
    const duration = 500;
    const originalAlpha = 0.3;
    const peakAlpha = 1.0;
    const glowOriginalAlpha = 0.15;
    const glowPeakAlpha = 0.6;

    const animate = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Pulse effect: quick rise, slow fall
      let alpha: number;
      let glowAlpha: number;
      if (progress < 0.25) {
        // Rise
        const riseProgress = progress / 0.25;
        alpha = originalAlpha + (peakAlpha - originalAlpha) * riseProgress;
        glowAlpha = glowOriginalAlpha + (glowPeakAlpha - glowOriginalAlpha) * riseProgress;
      } else {
        // Fall
        const fallProgress = (progress - 0.25) / 0.75;
        const easeOut = 1 - Math.pow(1 - fallProgress, 2);
        alpha = peakAlpha - (peakAlpha - originalAlpha) * easeOut;
        glowAlpha = glowPeakAlpha - (glowPeakAlpha - glowOriginalAlpha) * easeOut;
      }

      divider.alpha = alpha;
      if (glowLine) {
        glowLine.alpha = glowAlpha;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        divider.alpha = originalAlpha;
        if (glowLine) {
          glowLine.alpha = glowOriginalAlpha;
        }
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Audio
  // ============================================================================

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

  private playMobSound(mobId: number, soundType: 'Damage' | 'Die'): void {
    const key = `${mobId}_${soundType}`;
    const audio = this.mobSounds.get(key);
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch(() => { });
    }
  }

  private playItemPickupSound(): void {
    if (this.itemPickupSound) {
      const sound = this.itemPickupSound.cloneNode() as HTMLAudioElement;
      sound.volume = 0.5;
      sound.play().catch(() => { });
    }
  }

  // ============================================================================
  // Click Handler (Test Combat - Field Area Only)
  // ============================================================================

  /**
   * Setup click handler for field area only
   */
  private setupClickHandler(): void {
    // Make field layer interactive
    this.fieldLayer.eventMode = 'static';
    this.fieldLayer.cursor = 'pointer';
    
    // Add click event to field layer only
    this.fieldLayer.on('pointerdown', () => {
      this.attackRandomMonster();
    });
  }

  /**
   * Remove click handler from field layer
   */
  private removeClickHandler(): void {
    this.fieldLayer.eventMode = 'auto';
    this.fieldLayer.cursor = 'auto';
    this.fieldLayer.removeAllListeners('pointerdown');
  }

  private attackRandomMonster(): void {
    const aliveMonsters = Array.from(this.monsters.entries())
      .filter(([, state]) => !state.isDying);

    if (aliveMonsters.length === 0) return;

    const randomIndex = Math.floor(Math.random() * aliveMonsters.length);
    const [targetId, monster] = aliveMonsters[randomIndex];

    const isCritical = Math.random() < 0.3;

    let damage: number;
    if (isCritical) {
      damage = Math.floor(Math.random() * 26) + 25;
    } else {
      damage = Math.floor(Math.random() * 21) + 10;
    }

    const mob = getMobById(monster.mobId);

    const isDead = this.hitMonster(targetId, damage, isCritical);

    if (mob) {
      const critText = isCritical ? ' [CRITICAL]' : '';
      console.log(
        `[Combat] Hit ${mob.name}: [damage]=[${damage}]${critText} [hp]=[${monster.currentHp}/${monster.maxHp}] [dead]=[${isDead}]`
      );
    }
  }

  // ============================================================================
  // Monster Management
  // ============================================================================

  private removeMonster(instanceId: string): void {
    const sprite = this.monsterSprites.get(instanceId);
    if (sprite) {
      this.fieldLayer.removeChild(sprite);
      sprite.destroy();
    }
    this.monsterSprites.delete(instanceId);
    this.monsters.delete(instanceId);
    this.damageOffsets.delete(instanceId);
  }

  // ============================================================================
  // Map Transition
  // ============================================================================

  /**
   * Open map selection UI
   */
  private openMapSelection(): void {
    if (this.mapSelectionUI) {
      return; // Already open
    }

    this.mapSelectionUI = new MapSelectionUI({
      onMapSelect: (mapId: number) => {
        this.closeMapSelection();
        this.changeMap(mapId);
      },
      onClose: () => {
        this.closeMapSelection();
      },
      currentMapId: this.mapInfo?.id ?? 0,
    });

    this.container.addChild(this.mapSelectionUI);
  }

  /**
   * Close map selection UI
   */
  private closeMapSelection(): void {
    if (this.mapSelectionUI) {
      this.container.removeChild(this.mapSelectionUI);
      this.mapSelectionUI.destroy();
      this.mapSelectionUI = null;
    }
  }

  /**
   * Change to a new map
   */
  private async changeMap(newMapId: number): Promise<void> {
    if (!this.mapInfo || this.mapInfo.id === newMapId) {
      return; // Same map
    }

    console.log(`[MainScene] Changing map: [from]=[${this.mapInfo.name}] [to]=[${newMapId}]`);

    // 1. Clear current map
    this.clearAllMonsters();
    this.clearAllDrops();
    await this.stopCurrentBGM();

    // 2. Load new map
    this.mapInfo = getMapById(newMapId) ?? null;
    if (!this.mapInfo) {
      console.error('[MainScene] Failed to load new map:', newMapId);
      return;
    }

    // 3. Update UI
    if (this.mapTitleText) {
      this.mapTitleText.text = `${this.mapInfo.name} ▼`;
    }

    // 4. Load new map assets
    await this.loadMapAssets();

    // 5. Play new BGM
    if (this.mapInfo.bgm) {
      const audioManager = AudioManager.getInstance();
      audioManager.playBgm(this.mapInfo.bgm);
    }

    // 6. Spawn initial monsters
    this.spawnInitialMonsters();

    console.log(`[MainScene] Map changed successfully to: [map]=[${this.mapInfo.name}]`);
  }

  /**
   * Clear all monsters from the field
   */
  private clearAllMonsters(): void {
    console.log(`[MainScene] Clearing all monsters: [count]=[${this.monsters.size}]`);

    for (const [_instanceId, sprite] of this.monsterSprites.entries()) {
      this.fieldLayer.removeChild(sprite);
      sprite.destroy();
    }

    this.monsters.clear();
    this.monsterSprites.clear();
    this.damageOffsets.clear();
    this.spawnTimer = 0;
    this.monsterIdCounter = 0;
  }

  /**
   * Clear all drops from the field
   */
  private clearAllDrops(): void {
    // Remove all drop items (they have specific labels)
    const children = this.fieldLayer.children.slice();
    for (const child of children) {
      if (child.label && child.label.startsWith('dropItem_')) {
        this.fieldLayer.removeChild(child);
        child.destroy();
      }
    }
  }

  /**
   * Stop current BGM
   */
  private async stopCurrentBGM(): Promise<void> {
    const audioManager = AudioManager.getInstance();
    await audioManager.stopBgm();
  }

  /**
   * Load assets for new map
   */
  private async loadMapAssets(): Promise<void> {
    if (!this.mapInfo) return;

    const assetManager = AssetManager.getInstance();

    // Clear existing mob assets
    this.mobGifSources.clear();
    this.mobSounds.clear();

    // Preload monster GIF animations
    for (const mobSpawn of this.mapInfo.spawns.normal.mobs) {
      const mob = getMobById(mobSpawn.mobId);
      if (mob) {
        for (const animation of MOB_ANIMATIONS) {
          const gifSource = await assetManager.getMobGif(mob.id, animation);
          if (gifSource) {
            const key = `${mob.id}_${animation}`;
            this.mobGifSources.set(key, gifSource);
          }
        }

        const mobIdStr = mob.id.toString().padStart(7, '0');
        const soundTypes: Array<'Damage' | 'Die'> = ['Damage', 'Die'];
        for (const soundType of soundTypes) {
          const soundData = await assetManager.getMobSound(mobIdStr, soundType);
          if (soundData) {
            const audio = this.createAudioFromBase64(soundData);
            const key = `${mob.id}_${soundType}`;
            this.mobSounds.set(key, audio);
          }
        }
      }
    }

    console.log(`[MainScene] Loaded assets for map: [map]=[${this.mapInfo.name}]`);
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

    for (const entry of this.logEntries) {
      entry.text.destroy();
    }
    this.logEntries = [];

    if (this.mapSelectionUI) {
      this.mapSelectionUI.destroy();
      this.mapSelectionUI = null;
    }

    await super.destroy();
  }
}
