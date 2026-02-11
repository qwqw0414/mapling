import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { GifSprite, GifSource } from 'pixi.js/gif';
import { SLOT_CONFIG } from '@/constants/config';
import { StatusBar } from './StatusBar';
import { SkillBar } from './SkillBar';
import { AssetManager } from '@/game/systems/AssetManager';
import { getRequiredExp } from '@/data/expTable';
import { getJobData } from '@/data/jobs';
import type { PartyCharacter } from '@/types/party';
import type { CharacterMode } from '@/types/character';
import type { CharacterAnimation } from '@/data/characterLook';
import { getAnimationSpriteOffset } from '@/data/characterLook';
import type { EquipSlot, EquipItem } from '@/types/item';

// ============================================================================
// Constants
// ============================================================================

const FLIP_DURATION = 300;

type SlotView = 'character' | 'stats' | 'equip';

// ============================================================================
// Equipment Paper-doll Layout
// ============================================================================

const EQUIP_GRID_COLUMNS = 3;
const EQUIP_GRID_GAP = 5;

interface EquipSlotDef {
  slot: EquipSlot;
  label: string;
  col: number;
  row: number;
  equippedColor: number;
}

const EQUIP_SLOT_DEFS: EquipSlotDef[] = [
  // Row 0: 머리 / 갑옷
  { slot: 'hat',       label: '모자',   col: 0, row: 0, equippedColor: 0x4466AA },
  { slot: 'top',       label: '상의',   col: 1, row: 0, equippedColor: 0x4466AA },
  { slot: 'bottom',    label: '하의',   col: 2, row: 0, equippedColor: 0x4466AA },
  // Row 1: 손 장비
  { slot: 'weapon',    label: '무기',   col: 0, row: 1, equippedColor: 0xAA4444 },
  { slot: 'gloves',    label: '장갑',   col: 1, row: 1, equippedColor: 0x4466AA },
  { slot: 'shield',    label: '방패',   col: 2, row: 1, equippedColor: 0x4466AA },
  // Row 2: 발 / 기타
  { slot: 'shoes',     label: '신발',   col: 0, row: 2, equippedColor: 0x4466AA },
  { slot: 'cape',      label: '망토',   col: 1, row: 2, equippedColor: 0x6644AA },
  { slot: 'accessory', label: '장신구', col: 2, row: 2, equippedColor: 0xAAAA44 },
];

const GRADE_BORDER_COLORS: Record<string, number> = {
  common: 0x888888,
  rare: 0x4488FF,
  epic: 0xAA44FF,
  unique: 0xFFAA00,
};

// ============================================================================
// Types
// ============================================================================

interface PartySlotOptions {
  width: number;
  height: number;
  slotIndex: number;
  character?: PartyCharacter | null;
  onClick?: (slotIndex: number) => void;
  onToggleMode?: (slotIndex: number) => void;
  onUnequipItem?: (slotIndex: number, equipSlot: EquipSlot, item: EquipItem) => void;
}

// ============================================================================
// PartySlot Component
// ============================================================================

/**
 * Party slot UI component
 * Displays character sprite, HP/MP/EXP bars, and skill slots
 * Supports flip animation to toggle between character view and stats view
 */
export class PartySlot extends Container {
  private readonly slotWidth: number;
  private readonly slotHeight: number;
  private readonly slotIndex: number;
  private readonly padding: number;

  // Animation tracking
  private isAttackAnimating = false;
  private isFlipping = false;

  private character: PartyCharacter | null = null;

  // Current view state
  private currentView: SlotView = 'character';

  // UI Elements
  private readonly background: Graphics;
  private readonly emptyIndicator: Container;
  private readonly characterContainer: Container;
  private readonly statsContainer: Container;
  private readonly equipContainer: Container;

  // Content wrapper for flip animation (contains all views)
  private readonly contentWrapper: Container;

  // Mode toggle (fixed on top of background, outside contentWrapper)
  private modeToggleContainer: Container | null = null;
  private modeToggleTrack: Graphics | null = null;
  private modeToggleThumb: Graphics | null = null;
  private modeToggleLabel: Text | null = null;

  private characterSprite: GifSprite | Sprite | null = null;
  private hpBar: StatusBar | null = null;
  private mpBar: StatusBar | null = null;
  private expBar: StatusBar | null = null;
  private skillBar: SkillBar | null = null;
  private nameText: Text | null = null;
  private levelText: Text | null = null;
  private statViewButton: Container | null = null;
  private equipViewButton: Container | null = null;

  // Current mode tracking for enable/disable
  private currentMode: CharacterMode = 'idle';

  // Stored equip slot bounds for hit detection (relative to equipContainer)
  private equipSlotBounds: Array<{ slot: EquipSlot; x: number; y: number; size: number }> = [];

  // Equipment tooltip
  private equipTooltip: Container | null = null;

  // Callbacks
  private readonly onClickCallback?: (slotIndex: number) => void;
  private readonly onToggleModeCallback?: (slotIndex: number) => void;
  private readonly onUnequipItemCallback?: (slotIndex: number, equipSlot: EquipSlot, item: EquipItem) => void;

  /**
   * Create party slot
   */
  constructor(options: PartySlotOptions) {
    super();

    this.slotWidth = options.width;
    this.slotHeight = options.height;
    this.slotIndex = options.slotIndex;
    this.padding = SLOT_CONFIG.PADDING;
    this.onClickCallback = options.onClick;
    this.onToggleModeCallback = options.onToggleMode;
    this.onUnequipItemCallback = options.onUnequipItem;

    // Background
    this.background = new Graphics();
    this.addChild(this.background);

    // Content wrapper for flip effect
    this.contentWrapper = new Container();
    this.addChild(this.contentWrapper);

    // Empty slot indicator
    this.emptyIndicator = this.createEmptyIndicator();
    this.contentWrapper.addChild(this.emptyIndicator);

    // Character container (default view)
    this.characterContainer = new Container();
    this.characterContainer.visible = false;
    this.contentWrapper.addChild(this.characterContainer);

    // Stats container (hidden by default)
    this.statsContainer = new Container();
    this.statsContainer.visible = false;
    this.contentWrapper.addChild(this.statsContainer);

    // Equipment container (hidden by default)
    this.equipContainer = new Container();
    this.equipContainer.visible = false;
    this.contentWrapper.addChild(this.equipContainer);

    // Initial render
    this.drawBackground();

    if (options.character) {
      this.setCharacter(options.character);
    }

    // Setup interactivity
    this.setupInteractivity();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Set or update character data
   */
  public setCharacter(character: PartyCharacter | null): void {
    this.character = character;

    if (character) {
      this.currentMode = character.mode;
      this.showCharacterUI(character);
      this.buildStatsView(character);
      this.buildEquipView(character);
      this.createModeToggle(character);
      // Show current view
      this.characterContainer.visible = this.currentView === 'character';
      this.statsContainer.visible = this.currentView === 'stats';
      this.equipContainer.visible = this.currentView === 'equip';
      this.updateInteractiveState();
    } else {
      this.showEmptySlot();
      this.removeModeToggle();
    }
  }

  /**
   * Update the entire character data and refresh UI
   */
  public updateCharacter(character: PartyCharacter): void {
    this.character = character;
    const requiredExp = this.calculateRequiredExp(character.level);

    this.hpBar?.updateValues(character.hp, character.maxHp);
    this.mpBar?.updateValues(character.mp, character.maxMp);
    this.expBar?.updateValues(character.exp, requiredExp);

    if (this.levelText) {
      this.levelText.text = `Lv.${character.level}`;
    }

    this.updateMode(character.mode);

    // Rebuild current non-character view when data changes
    if (this.currentView === 'stats') {
      this.buildStatsView(character);
    } else if (this.currentView === 'equip') {
      this.buildEquipView(character);
    }

    this.updateInteractiveState();
  }

  /**
   * Update character status (HP/MP/EXP)
   */
  public updateStatus(hp: number, maxHp: number, mp: number, maxMp: number, exp: number, requiredExp: number): void {
    if (!this.character) return;

    this.character.hp = hp;
    this.character.maxHp = maxHp;
    this.character.mp = mp;
    this.character.maxMp = maxMp;
    this.character.exp = exp;

    this.hpBar?.updateValues(hp, maxHp);
    this.mpBar?.updateValues(mp, maxMp);
    this.expBar?.updateValues(exp, requiredExp);
  }

  /**
   * Set character sprite (GIF animation or static texture)
   * @param gifSource - GIF source to display
   * @param animation - Animation name for per-animation position offset correction
   */
  public setCharacterSprite(gifSource: GifSource | null, animation?: CharacterAnimation): void {
    // Remove existing sprite
    if (this.characterSprite) {
      this.characterContainer.removeChild(this.characterSprite);
      this.characterSprite.destroy();
      this.characterSprite = null;
    }

    if (!gifSource) return;

    const spriteHeight = this.slotHeight * SLOT_CONFIG.SPRITE_HEIGHT_RATIO;
    const spriteBottomY = this.padding + spriteHeight;

    // Create GIF sprite - use original size without scaling
    const gifSprite = new GifSprite({
      source: gifSource,
      autoPlay: true,
      loop: true,
    });
    // Anchor at bottom-right for consistent animation alignment
    gifSprite.anchor.set(1, 1);

    // Apply per-animation sprite offset correction
    const offset = animation ? getAnimationSpriteOffset(animation) : { x: 0, y: 0 };
    gifSprite.x = this.slotWidth / 2 + 30 + offset.x;
    gifSprite.y = spriteBottomY + offset.y;

    this.characterSprite = gifSprite;
    this.characterContainer.addChildAt(gifSprite, 0);
  }

  /**
   * Play attack animation (for testing/demo)
   */
  public playAttackAnimation(): void {
    if (!this.characterSprite || this.isAttackAnimating) return;

    this.isAttackAnimating = true;
    const originalScale = this.characterSprite.scale.x;
    const duration = 300;
    const startTime = Date.now();

    const animate = (): void => {
      if (!this.isAttackAnimating || !this.characterSprite) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const scale = originalScale + Math.sin(progress * Math.PI) * 0.1;
      this.characterSprite.scale.set(scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.characterSprite.scale.set(originalScale);
        this.isAttackAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Private Methods - Empty Slot
  // ============================================================================

  private createEmptyIndicator(): Container {
    const container = new Container();

    const plusSize = SLOT_CONFIG.EMPTY_SLOT.PLUS_SIZE;
    const plusColor = SLOT_CONFIG.EMPTY_SLOT.PLUS_COLOR;

    const plusGraphics = new Graphics();
    plusGraphics.rect(-plusSize / 2, -2, plusSize, 4);
    plusGraphics.fill({ color: plusColor });
    plusGraphics.rect(-2, -plusSize / 2, 4, plusSize);
    plusGraphics.fill({ color: plusColor });
    container.addChild(plusGraphics);

    const label = new Text({
      text: `슬롯 ${this.slotIndex + 1}`,
      style: {
        fontSize: 12,
        fill: 0x666666,
        fontFamily: 'Arial',
      },
    });
    label.anchor.set(0.5, 0);
    label.y = plusSize / 2 + 10;
    container.addChild(label);

    // Set initial position
    container.x = this.slotWidth / 2;
    container.y = this.slotHeight / 2;

    return container;
  }

  private showEmptySlot(): void {
    this.emptyIndicator.visible = true;
    this.characterContainer.visible = false;
    this.statsContainer.visible = false;
    this.equipContainer.visible = false;
  }

  // ============================================================================
  // Private Methods - Character UI
  // ============================================================================

  private showCharacterUI(character: PartyCharacter): void {
    this.emptyIndicator.visible = false;
    this.characterContainer.visible = true;

    // Clear existing UI
    this.characterContainer.removeChildren();

    // Calculate layout areas
    const spriteHeight = this.slotHeight * SLOT_CONFIG.SPRITE_HEIGHT_RATIO;
    const statsStartY = this.padding + spriteHeight;

    // Character name & level
    this.createCharacterInfo(character, statsStartY);

    // Status bars (HP/MP/EXP)
    this.createStatusBars(character, statsStartY + 20);

    // Skill bar
    this.createSkillBar(character, statsStartY + 20 + 3 * (SLOT_CONFIG.STAT_BAR.HEIGHT + SLOT_CONFIG.STAT_BAR.GAP) + 5);

    // View buttons (top-right area, inside characterContainer)
    this.createViewButtons();
  }

  private createCharacterInfo(character: PartyCharacter, y: number): void {
    // Level badge
    this.levelText = new Text({
      text: `Lv.${character.level}`,
      style: {
        fontSize: 11,
        fill: 0xFFD700,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
        },
      },
    });
    this.levelText.x = this.padding;
    this.levelText.y = y;
    this.characterContainer.addChild(this.levelText);

    // Character name
    this.nameText = new Text({
      text: character.name,
      style: {
        fontSize: 11,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
        },
      },
    });
    this.nameText.anchor.set(1, 0);
    this.nameText.x = this.slotWidth - this.padding;
    this.nameText.y = y;
    this.characterContainer.addChild(this.nameText);
  }

  private createStatusBars(character: PartyCharacter, startY: number): void {
    const barWidth = this.slotWidth - this.padding * 2;
    const barGap = SLOT_CONFIG.STAT_BAR.GAP;

    // HP Bar (Red)
    this.hpBar = new StatusBar(barWidth, 'HP', 0xFF3333);
    this.hpBar.x = this.padding;
    this.hpBar.y = startY;
    this.hpBar.updateValues(character.hp, character.maxHp);
    this.characterContainer.addChild(this.hpBar);

    // MP Bar (Blue)
    this.mpBar = new StatusBar(barWidth, 'MP', 0x3366FF);
    this.mpBar.x = this.padding;
    this.mpBar.y = startY + SLOT_CONFIG.STAT_BAR.HEIGHT + barGap;
    this.mpBar.updateValues(character.mp, character.maxMp);
    this.characterContainer.addChild(this.mpBar);

    // EXP Bar (Yellow/Green)
    this.expBar = new StatusBar(barWidth, 'EXP', 0xFFDD55);
    this.expBar.x = this.padding;
    this.expBar.y = startY + (SLOT_CONFIG.STAT_BAR.HEIGHT + barGap) * 2;

    // Calculate required exp (simplified formula)
    const requiredExp = this.calculateRequiredExp(character.level);
    this.expBar.updateValues(character.exp, requiredExp);
    this.characterContainer.addChild(this.expBar);
  }

  private createSkillBar(character: PartyCharacter, y: number): void {
    this.skillBar = new SkillBar();

    // Center skill bar
    const skillBarWidth = this.skillBar.getTotalWidth();
    this.skillBar.x = (this.slotWidth - skillBarWidth) / 2;
    this.skillBar.y = y;

    // Initialize skill slots with character's equipped skills
    for (let i = 0; i < character.equippedSkillSlots.length && i < 6; i++) {
      const skillId = character.equippedSkillSlots[i];
      if (skillId !== null) {
        this.skillBar.updateSkillSlot(i, {
          skillId,
          isActive: false,
        });
      }
    }

    this.characterContainer.addChild(this.skillBar);
  }

  private calculateRequiredExp(level: number): number {
    return getRequiredExp(level);
  }

  // ============================================================================
  // Private Methods - Mode Toggle (좌측 상단 고정 토글 스위치)
  // ============================================================================

  private createModeToggle(character: PartyCharacter): void {
    this.removeModeToggle();

    const toggleWidth = 40;
    const toggleHeight = 16;
    const thumbSize = 12;

    this.modeToggleContainer = new Container();
    this.modeToggleContainer.x = this.padding;
    this.modeToggleContainer.y = this.padding;

    // Track (pill shape background)
    this.modeToggleTrack = new Graphics();
    this.modeToggleContainer.addChild(this.modeToggleTrack);

    // Thumb (circle indicator)
    this.modeToggleThumb = new Graphics();
    this.modeToggleContainer.addChild(this.modeToggleThumb);

    // Label text below toggle
    this.modeToggleLabel = new Text({
      text: '',
      style: {
        fontSize: 8,
        fill: 0xAAAAAA,
        fontFamily: 'Arial',
      },
    });
    this.modeToggleLabel.anchor.set(0.5, 0);
    this.modeToggleLabel.x = toggleWidth / 2;
    this.modeToggleLabel.y = toggleHeight + 2;
    this.modeToggleContainer.addChild(this.modeToggleLabel);

    this.renderModeToggle(character.mode, toggleWidth, toggleHeight, thumbSize);

    // Interactivity
    this.modeToggleContainer.eventMode = 'static';
    this.modeToggleContainer.cursor = 'pointer';
    this.modeToggleContainer.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= toggleWidth && y >= 0 && y <= toggleHeight + 14 };
    this.modeToggleContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      if (this.onToggleModeCallback) {
        this.onToggleModeCallback(this.slotIndex);
      }
    });

    // Add directly to the slot (above background, outside contentWrapper)
    this.addChild(this.modeToggleContainer);
  }

  private removeModeToggle(): void {
    if (this.modeToggleContainer) {
      if (this.modeToggleContainer.parent) {
        this.modeToggleContainer.parent.removeChild(this.modeToggleContainer);
      }
      this.modeToggleContainer.destroy({ children: true });
      this.modeToggleContainer = null;
      this.modeToggleTrack = null;
      this.modeToggleThumb = null;
      this.modeToggleLabel = null;
    }
  }

  private renderModeToggle(mode: CharacterMode, trackWidth: number, trackHeight: number, thumbSize: number): void {
    if (!this.modeToggleTrack || !this.modeToggleThumb || !this.modeToggleLabel) return;

    const isCombat = mode === 'combat';
    const trackColor = isCombat ? 0xCC3333 : 0x336699;
    const thumbX = isCombat ? trackWidth - thumbSize / 2 - 2 : thumbSize / 2 + 2;

    // Track
    this.modeToggleTrack.clear();
    this.modeToggleTrack.roundRect(0, 0, trackWidth, trackHeight, trackHeight / 2);
    this.modeToggleTrack.fill({ color: trackColor });

    // Thumb
    this.modeToggleThumb.clear();
    this.modeToggleThumb.circle(thumbX, trackHeight / 2, thumbSize / 2);
    this.modeToggleThumb.fill({ color: 0xFFFFFF });

    // Label
    this.modeToggleLabel.text = isCombat ? 'COMBAT' : 'IDLE';
    this.modeToggleLabel.style.fill = isCombat ? 0xFF6666 : 0x88AACC;
  }

  // ============================================================================
  // Private Methods - View Buttons (우측 상단, characterContainer 내부)
  // ============================================================================

  private createViewButtons(): void {
    const buttonWidth = 36;
    const buttonHeight = 16;
    const buttonGap = 4;

    // STAT button (rightmost)
    this.statViewButton = this.createViewButton(
      'STAT', buttonWidth, buttonHeight, 0x555555,
      () => this.toggleView('stats'),
    );
    this.statViewButton.x = this.slotWidth - this.padding - buttonWidth;
    this.statViewButton.y = this.padding;
    this.characterContainer.addChild(this.statViewButton);

    // EQUIP button (left of STAT)
    this.equipViewButton = this.createViewButton(
      'EQUIP', buttonWidth, buttonHeight, 0x554433,
      () => this.toggleView('equip'),
    );
    this.equipViewButton.x = this.slotWidth - this.padding - buttonWidth * 2 - buttonGap;
    this.equipViewButton.y = this.padding;
    this.characterContainer.addChild(this.equipViewButton);
  }

  /**
   * Create a small view toggle button
   */
  private createViewButton(
    labelText: string,
    width: number,
    height: number,
    baseColor: number,
    onClick: () => void,
  ): Container {
    const button = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 4);
    bg.fill({ color: baseColor });
    button.addChild(bg);

    const label = new Text({
      text: labelText,
      style: {
        fontSize: 8,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5);
    label.x = width / 2;
    label.y = height / 2;
    button.addChild(label);

    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick();
    });

    button.on('pointerover', () => {
      if (this.currentMode === 'combat') return;
      bg.clear();
      bg.roundRect(0, 0, width, height, 4);
      bg.fill({ color: 0x777777 });
    });
    button.on('pointerout', () => {
      const color = this.currentMode === 'combat' ? 0x333333 : baseColor;
      bg.clear();
      bg.roundRect(0, 0, width, height, 4);
      bg.fill({ color });
    });

    return button;
  }

  /**
   * Update interactive state based on current mode
   * Combat mode disables stat/equip view buttons
   */
  private updateInteractiveState(): void {
    const isCombat = this.currentMode === 'combat';

    if (this.statViewButton) {
      this.statViewButton.eventMode = isCombat ? 'none' : 'static';
      this.statViewButton.cursor = isCombat ? 'default' : 'pointer';
      this.statViewButton.alpha = isCombat ? 0.4 : 1.0;
    }

    if (this.equipViewButton) {
      this.equipViewButton.eventMode = isCombat ? 'none' : 'static';
      this.equipViewButton.cursor = isCombat ? 'default' : 'pointer';
      this.equipViewButton.alpha = isCombat ? 0.4 : 1.0;
    }

    // If switching to combat while non-character view is open, flip back
    if (isCombat && this.currentView !== 'character') {
      this.toggleView('character');
    }
  }

  // ============================================================================
  // Private Methods - Stats View
  // ============================================================================

  private buildStatsView(character: PartyCharacter): void {
    this.statsContainer.removeChildren();

    const padding = this.padding;
    let y = padding + 4;
    const lineHeight = 16;
    const labelX = padding + 4;
    const valueX = this.slotWidth - padding - 4;

    // Header: name + level
    const headerText = new Text({
      text: `${character.name} (Lv.${character.level})`,
      style: {
        fontSize: 11,
        fill: 0xFFD700,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 2, distance: 1 },
      },
    });
    headerText.anchor.set(0.5, 0);
    headerText.x = this.slotWidth / 2;
    headerText.y = y;
    this.statsContainer.addChild(headerText);
    y += lineHeight + 4;

    // Job name
    const jobData = getJobData(character.job);
    const jobText = new Text({
      text: jobData.nameKr,
      style: { fontSize: 10, fill: 0xAAAAAA, fontFamily: 'Arial' },
    });
    jobText.anchor.set(0.5, 0);
    jobText.x = this.slotWidth / 2;
    jobText.y = y;
    this.statsContainer.addChild(jobText);
    y += lineHeight + 2;

    // Divider line
    const divider = new Graphics();
    divider.moveTo(labelX, y);
    divider.lineTo(valueX, y);
    divider.stroke({ color: 0x444444, width: 1 });
    this.statsContainer.addChild(divider);
    y += 6;

    // Base stats
    const statColors: Record<string, number> = {
      STR: 0xFFAAAA,
      DEX: 0xAAFFAA,
      INT: 0xAAAAFF,
      LUK: 0xFFFFAA,
    };

    const statEntries = [
      { label: 'STR', value: character.stats.str, isPrimary: jobData.primaryStat === 'str' },
      { label: 'DEX', value: character.stats.dex, isPrimary: jobData.primaryStat === 'dex' },
      { label: 'INT', value: character.stats.int, isPrimary: jobData.primaryStat === 'int' },
      { label: 'LUK', value: character.stats.luk, isPrimary: jobData.primaryStat === 'luk' },
    ];

    for (const entry of statEntries) {
      const color = statColors[entry.label] ?? 0xFFFFFF;
      const prefix = entry.isPrimary ? '> ' : '  ';

      const statLabel = new Text({
        text: `${prefix}${entry.label}`,
        style: {
          fontSize: 11,
          fill: color,
          fontFamily: 'Arial',
          fontWeight: entry.isPrimary ? 'bold' : 'normal',
        },
      });
      statLabel.x = labelX;
      statLabel.y = y;
      this.statsContainer.addChild(statLabel);

      const statValue = new Text({
        text: `${entry.value}`,
        style: {
          fontSize: 11,
          fill: color,
          fontFamily: 'Arial',
          fontWeight: 'bold',
        },
      });
      statValue.anchor.set(1, 0);
      statValue.x = valueX;
      statValue.y = y;
      this.statsContainer.addChild(statValue);

      y += lineHeight;
    }

    // Divider
    y += 2;
    const divider2 = new Graphics();
    divider2.moveTo(labelX, y);
    divider2.lineTo(valueX, y);
    divider2.stroke({ color: 0x444444, width: 1 });
    this.statsContainer.addChild(divider2);
    y += 6;

    // Combat stats
    const combatEntries = [
      { label: 'HP', value: `${character.hp}/${character.maxHp}`, color: 0xFF6666 },
      { label: 'MP', value: `${character.mp}/${character.maxMp}`, color: 0x6666FF },
      { label: 'W.ATK', value: `${character.weaponAttack}`, color: 0xFFCC88 },
      { label: 'M.ATK', value: `${character.magicAttack}`, color: 0x88CCFF },
      { label: 'ACC', value: `${character.combatStats.accuracy}`, color: 0xCCCCCC },
      { label: 'CRIT', value: `${(character.combatStats.criticalChance * 100).toFixed(1)}%`, color: 0xFF88FF },
    ];

    for (const entry of combatEntries) {
      const combatLabel = new Text({
        text: entry.label,
        style: { fontSize: 10, fill: 0x999999, fontFamily: 'Arial' },
      });
      combatLabel.x = labelX;
      combatLabel.y = y;
      this.statsContainer.addChild(combatLabel);

      const combatValue = new Text({
        text: entry.value,
        style: {
          fontSize: 10,
          fill: entry.color,
          fontFamily: 'Arial',
          fontWeight: 'bold',
        },
      });
      combatValue.anchor.set(1, 0);
      combatValue.x = valueX;
      combatValue.y = y;
      this.statsContainer.addChild(combatValue);

      y += lineHeight - 2;
    }

    // Back button at bottom
    this.createBackButton();
  }

  private createBackButton(): void {
    this.addBackButtonTo(this.statsContainer);
  }

  // ============================================================================
  // Private Methods - Equipment View (Paper-doll)
  // ============================================================================

  private buildEquipView(character: PartyCharacter): void {
    this.equipContainer.removeChildren();

    const padding = this.padding;
    const centerX = this.slotWidth / 2;
    const labelX = padding + 4;
    const valueX = this.slotWidth - padding - 4;
    let y = padding + 4;

    // Header: name + level
    const headerText = new Text({
      text: `${character.name} (Lv.${character.level})`,
      style: {
        fontSize: 11,
        fill: 0xFFD700,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 2, distance: 1 },
      },
    });
    headerText.anchor.set(0.5, 0);
    headerText.x = centerX;
    headerText.y = y;
    this.equipContainer.addChild(headerText);
    y += 16;

    // Divider
    const divider = new Graphics();
    divider.moveTo(labelX, y);
    divider.lineTo(valueX, y);
    divider.stroke({ color: 0x444444, width: 1 });
    this.equipContainer.addChild(divider);
    y += 8;

    // Calculate slot size based on available space
    const gridStartY = y;
    const availableWidth = this.slotWidth - padding * 2;
    const availableHeight = this.slotHeight - gridStartY - padding;
    const gridRows = 3;

    const slotSize = Math.floor(
      Math.min(
        (availableWidth - EQUIP_GRID_GAP * (EQUIP_GRID_COLUMNS - 1)) / EQUIP_GRID_COLUMNS,
        (availableHeight - EQUIP_GRID_GAP * (gridRows - 1)) / gridRows,
      ),
    );

    const gridWidth = slotSize * EQUIP_GRID_COLUMNS + EQUIP_GRID_GAP * (EQUIP_GRID_COLUMNS - 1);
    const gridHeight = slotSize * gridRows + EQUIP_GRID_GAP * (gridRows - 1);
    const gridOffsetX = (this.slotWidth - gridWidth) / 2;
    const gridOffsetY = gridStartY + (availableHeight - gridHeight) / 2;

    const equipment = character.equipment;

    // Store slot bounds for external hit detection
    this.equipSlotBounds = [];

    // Equipment slot boxes (3x3 grid)
    for (const slotDef of EQUIP_SLOT_DEFS) {
      const slotX = gridOffsetX + slotDef.col * (slotSize + EQUIP_GRID_GAP);
      const slotY = gridOffsetY + slotDef.row * (slotSize + EQUIP_GRID_GAP);
      const equippedItem: EquipItem | null = equipment[slotDef.slot];

      this.equipSlotBounds.push({ slot: slotDef.slot, x: slotX, y: slotY, size: slotSize });
      this.drawEquipSlotBox(slotX, slotY, slotSize, slotDef, equippedItem);
    }

    // Overall indicator (if equipped, show below grid)
    if (equipment.overall) {
      const overallY = gridOffsetY + gridHeight + 4;
      const overallText = new Text({
        text: `[OVR] ${equipment.overall.name}`,
        style: { fontSize: 8, fill: 0xAACC88, fontFamily: 'Arial' },
      });
      overallText.anchor.set(0.5, 0);
      overallText.x = centerX;
      overallText.y = overallY;
      this.equipContainer.addChild(overallText);
    }

    // Back button
    this.createEquipBackButton();
  }

  /**
   * Draw a single interactive equipment slot box in the grid
   */
  private drawEquipSlotBox(
    x: number,
    y: number,
    size: number,
    slotDef: EquipSlotDef,
    equippedItem: EquipItem | null,
  ): void {
    // Slot container for interactivity
    const slotContainer = new Container();
    slotContainer.x = x;
    slotContainer.y = y;

    const box = new Graphics();
    const drawSlotBg = (highlight: boolean = false): void => {
      box.clear();
      if (equippedItem) {
        const borderColor = GRADE_BORDER_COLORS[equippedItem.grade] ?? 0x888888;
        const bgColor = highlight ? this.lightenColor(slotDef.equippedColor) : slotDef.equippedColor;
        box.roundRect(0, 0, size, size, 4);
        box.fill({ color: bgColor });
        box.roundRect(0, 0, size, size, 4);
        box.stroke({ color: borderColor, width: 1.5 });
      } else {
        const bgColor = highlight ? 0x334455 : 0x222222;
        const borderColor = highlight ? 0x5588AA : 0x3A3A3A;
        box.roundRect(0, 0, size, size, 4);
        box.fill({ color: bgColor });
        box.roundRect(0, 0, size, size, 4);
        box.stroke({ color: borderColor, width: 1 });
      }
    };

    drawSlotBg();
    slotContainer.addChild(box);

    if (equippedItem) {
      // Load and display item icon
      this.loadEquipSlotIcon(slotContainer, equippedItem, size);
    } else {
      const slotLabel = new Text({
        text: slotDef.label,
        style: {
          fontSize: 9,
          fill: 0x555555,
          fontFamily: 'Arial',
        },
      });
      slotLabel.anchor.set(0.5);
      slotLabel.x = size / 2;
      slotLabel.y = size / 2;
      slotContainer.addChild(slotLabel);
    }

    // Interactivity
    slotContainer.eventMode = 'static';
    slotContainer.cursor = equippedItem ? 'grab' : 'default';
    slotContainer.hitArea = { contains: (px: number, py: number) => px >= 0 && px <= size && py >= 0 && py <= size };

    slotContainer.on('pointerover', (e) => {
      drawSlotBg(true);
      if (equippedItem) {
        this.showEquipTooltip(equippedItem, e.global.x, e.global.y);
      }
    });
    slotContainer.on('pointerout', () => {
      drawSlotBg(false);
      this.hideEquipTooltip();
    });
    slotContainer.on('pointermove', (e) => {
      if (equippedItem) {
        this.updateEquipTooltipPosition(e.global.x, e.global.y);
      }
    });

    slotContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      this.hideEquipTooltip();
      if (equippedItem && this.onUnequipItemCallback) {
        this.onUnequipItemCallback(this.slotIndex, slotDef.slot, equippedItem);
      }
    });

    this.equipContainer.addChild(slotContainer);
  }

  /**
   * Load item icon for an equipment slot box
   */
  private async loadEquipSlotIcon(
    slotContainer: Container,
    item: EquipItem,
    size: number,
  ): Promise<void> {
    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', item.id, 'icon');

    // Check if container is still valid
    if (!slotContainer.parent) return;

    if (iconBlob) {
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      if (!slotContainer.parent) {
        URL.revokeObjectURL(img.src);
        return;
      }

      const texture = Texture.from(img);
      const iconSprite = new Sprite(texture);
      iconSprite.anchor.set(0.5);
      iconSprite.x = size / 2;
      iconSprite.y = size / 2;

      // Scale to fit slot
      const maxSize = size - 6;
      if (iconSprite.width > maxSize || iconSprite.height > maxSize) {
        const scale = maxSize / Math.max(iconSprite.width, iconSprite.height);
        iconSprite.scale.set(scale);
      }

      // Insert after box graphics (index 1)
      slotContainer.addChildAt(iconSprite, 1);
    } else {
      // Fallback: show abbreviated item name if icon not found
      const displayName = this.formatItemName(item.name, size);
      const itemLabel = new Text({
        text: displayName,
        style: {
          fontSize: 7,
          fill: 0xFFFFFF,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          wordWrap: true,
          wordWrapWidth: size - 4,
          align: 'center',
        },
      });
      itemLabel.anchor.set(0.5);
      itemLabel.x = size / 2;
      itemLabel.y = size / 2;
      slotContainer.addChild(itemLabel);
    }
  }

  /**
   * Lighten a color for hover effect
   */
  private lightenColor(color: number): number {
    const r = Math.min(255, ((color >> 16) & 0xFF) + 30);
    const g = Math.min(255, ((color >> 8) & 0xFF) + 30);
    const b = Math.min(255, (color & 0xFF) + 30);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Returns the current view mode of this party slot
   */
  public getCurrentView(): SlotView {
    return this.currentView;
  }

  /**
   * Check if a global point is over an equipment slot and return the slot type.
   * Uses stored slot bounds + equipContainer.toLocal for reliable coordinate mapping.
   */
  public getEquipSlotAtGlobal(globalX: number, globalY: number): EquipSlot | null {
    if (this.currentView !== 'equip' || !this.character) return null;
    if (this.equipSlotBounds.length === 0) return null;

    // Convert global position to equipContainer's local space
    const localPos = this.equipContainer.toLocal({ x: globalX, y: globalY });

    for (const bound of this.equipSlotBounds) {
      if (
        localPos.x >= bound.x &&
        localPos.x <= bound.x + bound.size &&
        localPos.y >= bound.y &&
        localPos.y <= bound.y + bound.size
      ) {
        return bound.slot;
      }
    }
    return null;
  }

  /**
   * Format item name to fit in equipment slot box
   */
  private formatItemName(name: string, slotSize: number): string {
    const maxCharsPerLine = Math.floor(slotSize / 5);
    if (name.length <= maxCharsPerLine) return name;
    if (name.length <= maxCharsPerLine * 2) {
      const mid = Math.ceil(name.length / 2);
      return name.substring(0, mid) + '\n' + name.substring(mid);
    }
    return name.substring(0, maxCharsPerLine * 2 - 1) + '..';
  }

  // ============================================================================
  // Equipment Tooltip
  // ============================================================================

  /**
   * Show tooltip for equipped item (same format as inventory tooltip)
   */
  private showEquipTooltip(item: EquipItem, globalX: number, globalY: number): void {
    this.hideEquipTooltip();

    const tooltip = new Container();
    tooltip.label = 'equipTooltip';

    const padding = 8;
    const lineHeight = 14;
    const lines: Array<{ text: string; color: number; bold?: boolean }> = [];

    // Item name with grade color
    const gradeColors: Record<string, number> = {
      common: 0x66CCFF,
      rare: 0x4488FF,
      epic: 0xAA44FF,
      unique: 0xFFAA00,
    };
    const nameColor = gradeColors[item.grade] ?? 0x66CCFF;
    lines.push({ text: item.name, color: nameColor, bold: true });

    // Category + slot
    const slotNames: Record<string, string> = {
      weapon: '무기', hat: '모자', top: '상의', bottom: '하의',
      overall: '한벌옷', shoes: '신발', gloves: '장갑',
      cape: '망토', accessory: '장신구', shield: '방패',
    };
    lines.push({ text: `[장비 - ${slotNames[item.slot] ?? item.slot}]`, color: 0xAAAAAA });

    // Description
    if (item.description) {
      lines.push({ text: '', color: 0xFFFFFF });
      const descLines = item.description.split('\\n');
      for (const descLine of descLines) {
        lines.push({ text: descLine, color: 0xCCCCCC });
      }
    }

    // Combat stats
    lines.push({ text: '', color: 0xFFFFFF });
    if (item.attackPower > 0) lines.push({ text: `공격력: +${item.attackPower}`, color: 0xFF9999 });
    if (item.magicPower > 0) lines.push({ text: `마력: +${item.magicPower}`, color: 0x9999FF });
    if (item.defense > 0) lines.push({ text: `방어력: +${item.defense}`, color: 0x99FF99 });

    // Bonus stats
    if (item.stats) {
      if (item.stats.str) lines.push({ text: `STR: +${item.stats.str}`, color: 0xFFAAAA });
      if (item.stats.dex) lines.push({ text: `DEX: +${item.stats.dex}`, color: 0xAAFFAA });
      if (item.stats.int) lines.push({ text: `INT: +${item.stats.int}`, color: 0xAAAAFF });
      if (item.stats.luk) lines.push({ text: `LUK: +${item.stats.luk}`, color: 0xFFFFAA });
    }

    // Upgrade slots
    if (item.upgradeSlots > 0) {
      lines.push({ text: `업그레이드 가능 횟수: ${item.upgradeSlots - item.usedSlots}`, color: 0xFFFF00 });
    }

    // Required level
    if (item.requiredLevel > 0) {
      lines.push({ text: `REQ LEV: ${item.requiredLevel}`, color: 0xFF6666 });
    }

    // Sell price
    if (item.sellPrice > 0) {
      lines.push({ text: `판매가: ${item.sellPrice} 메소`, color: 0xFFD700 });
    }

    // Filter out empty spacer lines at the start/end, keep internal ones
    const filteredLines = lines.filter((line, idx) => {
      if (line.text === '' && idx === lines.length - 1) return false;
      return true;
    });

    // Calculate tooltip size
    let maxWidth = 0;
    const textObjects: Text[] = [];

    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i];
      const textObj = new Text({
        text: line.text,
        style: {
          fontSize: 11,
          fill: line.color,
          fontFamily: 'Arial',
          fontWeight: line.bold ? 'bold' : 'normal',
        },
      });
      textObj.x = padding;
      textObj.y = padding + i * lineHeight;
      textObjects.push(textObj);
      maxWidth = Math.max(maxWidth, textObj.width);
    }

    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = filteredLines.length * lineHeight + padding * 2;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, tooltipWidth, tooltipHeight, 4);
    bg.fill({ color: 0x1a1a2e, alpha: 0.95 });
    bg.stroke({ color: 0x4488ff, width: 1 });
    tooltip.addChild(bg);

    for (const textObj of textObjects) {
      tooltip.addChild(textObj);
    }

    this.equipTooltip = tooltip;
    // Add to the PartySlot itself (not equipContainer) so it renders on top
    this.addChild(tooltip);
    this.updateEquipTooltipPosition(globalX, globalY);
  }

  /**
   * Hide equipment tooltip
   */
  private hideEquipTooltip(): void {
    if (this.equipTooltip) {
      if (this.equipTooltip.parent) {
        this.equipTooltip.parent.removeChild(this.equipTooltip);
      }
      this.equipTooltip.destroy({ children: true });
      this.equipTooltip = null;
    }
  }

  /**
   * Update equipment tooltip position relative to cursor
   */
  private updateEquipTooltipPosition(globalX: number, globalY: number): void {
    if (!this.equipTooltip) return;

    const localPos = this.toLocal({ x: globalX, y: globalY });

    const offsetX = 10;
    const offsetY = 5;
    const tooltipWidth = this.equipTooltip.width;
    const tooltipHeight = this.equipTooltip.height;

    // Default: show tooltip to the left of cursor
    let tooltipX = localPos.x - tooltipWidth - offsetX;
    let tooltipY = localPos.y - offsetY;

    // If tooltip would go too far left, show on right
    if (tooltipX < -tooltipWidth) {
      tooltipX = localPos.x + offsetX;
    }

    // Keep vertically within slot bounds
    if (tooltipY + tooltipHeight > this.slotHeight) {
      tooltipY = this.slotHeight - tooltipHeight;
    }
    if (tooltipY < 0) {
      tooltipY = 0;
    }

    this.equipTooltip.x = tooltipX;
    this.equipTooltip.y = tooltipY;
  }

  private createEquipBackButton(): void {
    this.addBackButtonTo(this.equipContainer);
  }

  /**
   * Add a back button to the top-right of the given container
   */
  private addBackButtonTo(target: Container): void {
    const buttonWidth = 36;
    const buttonHeight = 16;
    const button = new Container();
    button.x = this.slotWidth - this.padding - buttonWidth;
    button.y = this.padding;

    const bg = new Graphics();
    bg.roundRect(0, 0, buttonWidth, buttonHeight, 4);
    bg.fill({ color: 0x555555 });
    button.addChild(bg);

    const label = new Text({
      text: 'BACK',
      style: {
        fontSize: 8,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5);
    label.x = buttonWidth / 2;
    label.y = buttonHeight / 2;
    button.addChild(label);

    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', (e) => {
      e.stopPropagation();
      this.toggleView('character');
    });

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, buttonWidth, buttonHeight, 4);
      bg.fill({ color: 0x777777 });
    });
    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, buttonWidth, buttonHeight, 4);
      bg.fill({ color: 0x555555 });
    });

    target.addChild(button);
  }

  // ============================================================================
  // Private Methods - View Toggle (Flip Animation)
  // ============================================================================

  private toggleView(targetView: SlotView = 'character'): void {
    if (this.isFlipping || !this.character) return;

    // Hide tooltip when switching views
    this.hideEquipTooltip();

    // If already showing this view, return to character
    const finalTarget = targetView === this.currentView ? 'character' : targetView;

    // Block non-character views while in combat
    if (finalTarget !== 'character' && this.currentMode === 'combat') return;

    // Nothing to do if already at target
    if (finalTarget === this.currentView) return;

    // Rebuild target view with latest data before showing
    if (finalTarget === 'stats') {
      this.buildStatsView(this.character);
    } else if (finalTarget === 'equip') {
      this.buildEquipView(this.character);
    }

    this.playFlipAnimation(finalTarget);
  }

  private playFlipAnimation(targetView: SlotView): void {
    this.isFlipping = true;

    const halfDuration = FLIP_DURATION / 2;
    const startTime = Date.now();
    const pivotX = this.slotWidth / 2;

    // Store original pivot
    this.contentWrapper.pivot.x = pivotX;
    this.contentWrapper.x = pivotX;

    const animate = (): void => {
      if (!this.isFlipping) return;

      const elapsed = Date.now() - startTime;

      if (elapsed < halfDuration) {
        // First half: scale X from 1 to 0 (close)
        const progress = elapsed / halfDuration;
        const easeProgress = Math.sin(progress * Math.PI / 2);
        this.contentWrapper.scale.x = 1 - easeProgress;
      } else if (elapsed < FLIP_DURATION) {
        // At halfway point, swap views
        if (this.currentView !== targetView) {
          this.currentView = targetView;
          this.characterContainer.visible = targetView === 'character';
          this.statsContainer.visible = targetView === 'stats';
          this.equipContainer.visible = targetView === 'equip';
        }

        // Second half: scale X from 0 to 1 (open)
        const progress = (elapsed - halfDuration) / halfDuration;
        const easeProgress = Math.sin(progress * Math.PI / 2);
        this.contentWrapper.scale.x = easeProgress;
      } else {
        // Animation complete
        this.contentWrapper.scale.x = 1;
        this.currentView = targetView;
        this.characterContainer.visible = targetView === 'character';
        this.statsContainer.visible = targetView === 'stats';
        this.equipContainer.visible = targetView === 'equip';
        this.isFlipping = false;
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Public Methods - Mode Update
  // ============================================================================

  /**
   * Update the mode toggle appearance and interactive state
   */
  public updateMode(mode: CharacterMode): void {
    this.currentMode = mode;
    this.renderModeToggle(mode, 40, 16, 12);
    this.updateInteractiveState();
  }

  // ============================================================================
  // Private Methods - Rendering
  // ============================================================================

  private drawBackground(): void {
    this.background.clear();
    this.background.roundRect(0, 0, this.slotWidth, this.slotHeight, 8);
    this.background.fill({ color: SLOT_CONFIG.EMPTY_SLOT.BACKGROUND_COLOR });
    this.background.stroke({ color: SLOT_CONFIG.EMPTY_SLOT.BORDER_COLOR, width: 2 });
  }

  // ============================================================================
  // Private Methods - Interactivity
  // ============================================================================

  private setupInteractivity(): void {
    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointerdown', () => {
      if (this.onClickCallback) {
        this.onClickCallback(this.slotIndex);
      }
    });

    this.on('pointerover', () => {
      this.background.clear();
      this.background.roundRect(0, 0, this.slotWidth, this.slotHeight, 8);
      this.background.fill({ color: SLOT_CONFIG.EMPTY_SLOT.BACKGROUND_COLOR });
      this.background.stroke({ color: 0x666666, width: 2 });
    });

    this.on('pointerout', () => {
      this.drawBackground();
    });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  public override destroy(): void {
    // Stop pending animations
    this.isAttackAnimating = false;
    this.isFlipping = false;

    // Remove all event listeners
    this.removeAllListeners();

    // Cleanup tooltip
    this.hideEquipTooltip();

    // Cleanup mode toggle
    this.removeModeToggle();

    // Cleanup UI elements
    if (this.characterSprite) {
      this.characterSprite.destroy();
      this.characterSprite = null;
    }

    super.destroy({ children: true });
  }
}
