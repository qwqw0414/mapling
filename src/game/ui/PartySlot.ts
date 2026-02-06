import { Container, Graphics, Text, Sprite } from 'pixi.js';
import { GifSprite, GifSource } from 'pixi.js/gif';
import { SLOT_CONFIG } from '@/constants/config';
import { StatusBar } from './StatusBar';
import { SkillBar } from './SkillBar';
import { getRequiredExp } from '@/data/expTable';
import type { PartyCharacter } from '@/types/party';
import type { CharacterMode } from '@/types/character';

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
}

// ============================================================================
// PartySlot Component
// ============================================================================

/**
 * Party slot UI component
 * Displays character sprite, HP/MP/EXP bars, and skill slots
 * Shows empty slot indicator if no character assigned
 */
export class PartySlot extends Container {
  private slotWidth: number;
  private slotHeight: number;
  private readonly slotIndex: number;
  private readonly padding: number;

  // Animation tracking
  private isAttackAnimating = false;
  
  private character: PartyCharacter | null = null;
  
  // UI Elements
  private readonly background: Graphics;
  private readonly emptyIndicator: Container;
  private readonly characterContainer: Container;
  
  private characterSprite: GifSprite | Sprite | null = null;
  private hpBar: StatusBar | null = null;
  private mpBar: StatusBar | null = null;
  private expBar: StatusBar | null = null;
  private skillBar: SkillBar | null = null;
  private nameText: Text | null = null;
  private levelText: Text | null = null;
  private modeToggleButton: Container | null = null;
  private modeToggleBg: Graphics | null = null;
  private modeToggleText: Text | null = null;

  // Callbacks
  private readonly onClickCallback?: (slotIndex: number) => void;
  private readonly onToggleModeCallback?: (slotIndex: number) => void;

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

    // Background
    this.background = new Graphics();
    this.addChild(this.background);

    // Empty slot indicator
    this.emptyIndicator = this.createEmptyIndicator();
    this.addChild(this.emptyIndicator);

    // Character container (hidden by default)
    this.characterContainer = new Container();
    this.characterContainer.visible = false;
    this.addChild(this.characterContainer);

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
      this.showCharacterUI(character);
    } else {
      this.showEmptySlot();
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
   */
  public setCharacterSprite(gifSource: GifSource | null): void {
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
    // FeetCenter: anchor (0.5, 0.5) = feet position (canvas center).
    // Place feet at sprite area bottom so character body extends upward.
    gifSprite.anchor.set(0.5, 0.5);
    gifSprite.x = this.slotWidth / 2;
    gifSprite.y = spriteBottomY;

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

  /**
   * Resize slot
   */
  public resize(width: number, height: number): void {
    this.slotWidth = width;
    this.slotHeight = height;
    this.drawBackground();
    
    // Re-layout character UI if character exists
    if (this.character) {
      this.showCharacterUI(this.character);
    } else {
      this.updateEmptyIndicatorPosition();
    }
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

  private updateEmptyIndicatorPosition(): void {
    if (this.emptyIndicator) {
      this.emptyIndicator.x = this.slotWidth / 2;
      this.emptyIndicator.y = this.slotHeight / 2;
    }
  }

  private showEmptySlot(): void {
    this.emptyIndicator.visible = true;
    this.characterContainer.visible = false;
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

    // Combat/Idle toggle button
    this.createModeToggleButton(character);
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
  // Private Methods - Mode Toggle Button
  // ============================================================================

  private createModeToggleButton(character: PartyCharacter): void {
    const buttonWidth = 50;
    const buttonHeight = 18;

    this.modeToggleButton = new Container();
    this.modeToggleButton.x = (this.slotWidth - buttonWidth) / 2;
    this.modeToggleButton.y = this.padding + 2;

    // Background
    this.modeToggleBg = new Graphics();
    this.modeToggleButton.addChild(this.modeToggleBg);

    // Label
    this.modeToggleText = new Text({
      text: '',
      style: {
        fontSize: 10,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    this.modeToggleText.anchor.set(0.5);
    this.modeToggleText.x = buttonWidth / 2;
    this.modeToggleText.y = buttonHeight / 2;
    this.modeToggleButton.addChild(this.modeToggleText);

    // Interactivity
    this.modeToggleButton.eventMode = 'static';
    this.modeToggleButton.cursor = 'pointer';
    this.modeToggleButton.on('pointerdown', (e) => {
      e.stopPropagation();
      if (this.onToggleModeCallback) {
        this.onToggleModeCallback(this.slotIndex);
      }
    });

    this.renderModeButton(character.mode, buttonWidth, buttonHeight);
    this.characterContainer.addChild(this.modeToggleButton);
  }

  /**
   * Update the mode toggle button appearance
   */
  public updateMode(mode: CharacterMode): void {
    if (!this.modeToggleBg || !this.modeToggleText) return;

    const buttonWidth = 50;
    const buttonHeight = 18;
    this.renderModeButton(mode, buttonWidth, buttonHeight);
  }

  private renderModeButton(mode: CharacterMode, width: number, height: number): void {
    if (!this.modeToggleBg || !this.modeToggleText) return;

    const isCombat = mode === 'combat';
    const bgColor = isCombat ? 0xCC3333 : 0x336699;
    const label = isCombat ? 'COMBAT' : 'IDLE';

    this.modeToggleBg.clear();
    this.modeToggleBg.roundRect(0, 0, width, height, 4);
    this.modeToggleBg.fill({ color: bgColor });

    this.modeToggleText.text = label;
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

    // Remove all event listeners
    this.removeAllListeners();

    // Cleanup UI elements
    if (this.characterSprite) {
      this.characterSprite.destroy();
      this.characterSprite = null;
    }

    super.destroy({ children: true });
  }
}
