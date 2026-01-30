import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { SLOT_CONFIG } from '@/constants/config';

// ============================================================================
// Types
// ============================================================================

export interface SkillSlotData {
  skillId: number | null;
  iconTexture?: Texture;
  cooldownRemaining?: number;
  isActive?: boolean;
}

// ============================================================================
// SkillBar Component
// ============================================================================

/**
 * Skill bar component with 8 skill slots
 * Displays skill icons with cooldown overlay and hotkeys (1-8)
 */
export class SkillBar extends Container {
  private readonly slotSize: number;
  private readonly slotGap: number;
  private readonly slotCount: number;
  
  private readonly slotContainers: Container[] = [];
  private readonly slotBackgrounds: Graphics[] = [];
  private readonly slotIcons: Array<Sprite | null> = [];
  private readonly slotHotkeys: Text[] = [];

  /**
   * Create skill bar with 8 slots
   */
  constructor() {
    super();
    
    this.slotSize = SLOT_CONFIG.SKILL_BAR.SLOT_SIZE;
    this.slotGap = SLOT_CONFIG.SKILL_BAR.SLOT_GAP;
    this.slotCount = SLOT_CONFIG.SKILL_BAR.SLOT_COUNT;

    this.createSlots();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Update skill at specific slot
   * @param slotIndex - Slot index (0-7)
   * @param skillData - Skill data or null for empty slot
   */
  public updateSkillSlot(slotIndex: number, skillData: SkillSlotData | null): void {
    if (slotIndex < 0 || slotIndex >= this.slotCount) {
      return;
    }

    const slotContainer = this.slotContainers[slotIndex];
    const currentIcon = this.slotIcons[slotIndex];

    // Remove existing icon
    if (currentIcon) {
      slotContainer.removeChild(currentIcon);
      currentIcon.destroy();
      this.slotIcons[slotIndex] = null;
    }

    // Add new icon if skill exists
    if (skillData?.skillId && skillData.iconTexture) {
      const icon = new Sprite(skillData.iconTexture);
      icon.anchor.set(0.5);
      icon.x = this.slotSize / 2;
      icon.y = this.slotSize / 2;
      
      // Scale icon to fit slot (with small padding)
      const maxSize = this.slotSize - 4;
      const scale = Math.min(maxSize / icon.width, maxSize / icon.height);
      icon.scale.set(scale);
      
      slotContainer.addChild(icon);
      this.slotIcons[slotIndex] = icon;
    }

    // Update slot appearance
    this.updateSlotAppearance(slotIndex, skillData);
  }

  /**
   * Get total width of the skill bar
   */
  public getTotalWidth(): number {
    return this.slotSize * this.slotCount + this.slotGap * (this.slotCount - 1);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createSlots(): void {
    for (let i = 0; i < this.slotCount; i++) {
      const slotContainer = this.createSlotContainer(i);
      slotContainer.x = i * (this.slotSize + this.slotGap);
      this.addChild(slotContainer);
      this.slotContainers.push(slotContainer);
    }
  }

  private createSlotContainer(index: number): Container {
    const container = new Container();
    container.label = `skillSlot_${index}`;

    // Background
    const background = new Graphics();
    background.roundRect(0, 0, this.slotSize, this.slotSize, 4);
    background.fill({ color: 0x1a1a1a });
    background.stroke({ color: 0x444444, width: 1 });
    background.label = 'background';
    container.addChild(background);
    this.slotBackgrounds.push(background);

    // Hotkey label (1-8)
    const hotkeyText = new Text({
      text: (index + 1).toString(),
      style: {
        fontSize: 9,
        fill: 0x999999,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    hotkeyText.anchor.set(1, 1);
    hotkeyText.x = this.slotSize - 2;
    hotkeyText.y = this.slotSize - 1;
    hotkeyText.label = 'hotkey';
    container.addChild(hotkeyText);
    this.slotHotkeys.push(hotkeyText);

    this.slotIcons.push(null);

    return container;
  }

  private updateSlotAppearance(slotIndex: number, skillData: SkillSlotData | null): void {
    const background = this.slotBackgrounds[slotIndex];
    
    // Update border color based on skill state
    let borderColor = 0x444444;
    
    if (skillData?.isActive) {
      borderColor = 0xFFD700; // Gold for active
    } else if (skillData?.skillId) {
      borderColor = 0x666666; // Lighter gray if slot has skill
    }

    background.clear();
    background.roundRect(0, 0, this.slotSize, this.slotSize, 4);
    background.fill({ color: 0x1a1a1a });
    background.stroke({ color: borderColor, width: 1 });

    // Add cooldown overlay if needed
    if (skillData?.cooldownRemaining && skillData.cooldownRemaining > 0) {
      const overlay = new Graphics();
      overlay.roundRect(0, 0, this.slotSize, this.slotSize, 4);
      overlay.fill({ color: 0x000000, alpha: 0.6 });
      overlay.label = 'cooldownOverlay';
      this.slotContainers[slotIndex].addChild(overlay);
    } else {
      // Remove cooldown overlay if exists
      const overlay = this.slotContainers[slotIndex].children.find(
        child => child.label === 'cooldownOverlay'
      );
      if (overlay) {
        this.slotContainers[slotIndex].removeChild(overlay);
        overlay.destroy();
      }
    }
  }
}
