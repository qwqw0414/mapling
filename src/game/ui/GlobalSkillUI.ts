import { Container, Graphics, Text } from 'pixi.js';
import { GAME_CONFIG } from '@/constants/config';
import { GLOBAL_SKILL_GROUPS, getSkillsByGroup } from '@/data/globalSkills';
import { useGlobalSkillStore } from '@/stores/globalSkillStore';
import { useCharacterStore } from '@/stores/characterStore';
import type { GlobalSkillDef, SkillGroupId } from '@/types/globalSkill';

// ============================================================================
// Constants
// ============================================================================

const PANEL_WIDTH = 650;
const PANEL_HEIGHT = 480;
const HEADER_HEIGHT = 60;
const TAB_HEIGHT = 40;
const SKILL_ROW_HEIGHT = 56;
const PADDING = 16;
const SKILL_LIST_TOP = HEADER_HEIGHT + TAB_HEIGHT + 8;

const COLORS = {
  OVERLAY: 0x000000,
  PANEL_BG: 0x1e1e2e,
  PANEL_BORDER: 0x4488ff,
  HEADER_BG: 0x16162a,
  TAB_ACTIVE: 0x4488ff,
  TAB_INACTIVE: 0x333355,
  TAB_TEXT_ACTIVE: 0xffffff,
  TAB_TEXT_INACTIVE: 0x999999,
  SKILL_BG: 0x252540,
  SKILL_BG_HOVER: 0x2e2e50,
  SKILL_BORDER: 0x3a3a5a,
  LEVEL_BAR_BG: 0x333355,
  LEVEL_BAR_FILL: 0x4488ff,
  BUTTON_ACTIVE: 0x44aa44,
  BUTTON_DISABLED: 0x555555,
  BUTTON_HOVER: 0x55cc55,
  MESO_COLOR: 0xffd700,
  MAX_LEVEL_COLOR: 0xffaa00,
} as const;

// ============================================================================
// Types
// ============================================================================

interface GlobalSkillUIOptions {
  onClose: () => void;
}

// ============================================================================
// Global Skill UI
// ============================================================================

export class GlobalSkillUI extends Container {
  private readonly options: GlobalSkillUIOptions;
  private readonly background: Graphics;
  private readonly contentContainer: Container;
  private readonly skillListContainer: Container;
  private readonly scrollMask: Graphics;
  private activeGroupId: SkillGroupId = 'field';
  private tabButtons: Map<SkillGroupId, { container: Container; bg: Graphics; text: Text }> = new Map();
  private mesoText: Text | null = null;
  private scrollY = 0;
  private maxScrollY = 0;

  constructor(options: GlobalSkillUIOptions) {
    super();
    this.options = options;
    this.background = new Graphics();
    this.contentContainer = new Container();
    this.skillListContainer = new Container();
    this.scrollMask = new Graphics();

    this.createUI();
    this.setupScrolling();
  }

  // ============================================================================
  // UI Creation
  // ============================================================================

  private createUI(): void {
    this.createOverlay();
    this.createPanel();
    this.createHeader();
    this.createTabs();
    this.renderSkillList();

    this.addChild(this.background);
    this.addChild(this.contentContainer);
  }

  private createOverlay(): void {
    this.background.rect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    this.background.fill({ color: COLORS.OVERLAY, alpha: 0.7 });
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => {
      this.options.onClose();
    });
  }

  private createPanel(): void {
    const panelX = (GAME_CONFIG.WIDTH - PANEL_WIDTH) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - PANEL_HEIGHT) / 2;

    // Panel background
    const panel = new Graphics();
    panel.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10);
    panel.fill(COLORS.PANEL_BG);
    panel.stroke({ color: COLORS.PANEL_BORDER, width: 2 });
    panel.x = panelX;
    panel.y = panelY;
    panel.eventMode = 'static';
    panel.on('pointerdown', (e) => {
      e.stopPropagation();
    });
    this.contentContainer.addChild(panel);
  }

  private createHeader(): void {
    const panelX = (GAME_CONFIG.WIDTH - PANEL_WIDTH) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - PANEL_HEIGHT) / 2;

    // Header background
    const headerBg = new Graphics();
    headerBg.roundRect(0, 0, PANEL_WIDTH, HEADER_HEIGHT, 10);
    headerBg.fill(COLORS.HEADER_BG);
    headerBg.x = panelX;
    headerBg.y = panelY;
    this.contentContainer.addChild(headerBg);

    // Title
    const title = new Text({
      text: '글로벌 스킬',
      style: {
        fontSize: 22,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    title.x = panelX + PADDING;
    title.y = panelY + (HEADER_HEIGHT - title.height) / 2;
    this.contentContainer.addChild(title);

    // Meso display
    const currentMeso = useCharacterStore.getState().meso;
    this.mesoText = new Text({
      text: `${this.formatMeso(currentMeso)} meso`,
      style: {
        fontSize: 14,
        fill: COLORS.MESO_COLOR,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    this.mesoText.x = panelX + PANEL_WIDTH - PADDING - this.mesoText.width - 50;
    this.mesoText.y = panelY + (HEADER_HEIGHT - this.mesoText.height) / 2;
    this.contentContainer.addChild(this.mesoText);

    // Close button
    const closeButton = this.createCloseButton(
      panelX + PANEL_WIDTH - 30,
      panelY + HEADER_HEIGHT / 2,
    );
    this.contentContainer.addChild(closeButton);
  }

  private createCloseButton(x: number, y: number): Container {
    const button = new Container();
    button.x = x;
    button.y = y;

    const bg = new Graphics();
    bg.circle(0, 0, 14);
    bg.fill(0xff4444);
    bg.eventMode = 'static';
    bg.cursor = 'pointer';

    const closeText = new Text({
      text: 'X',
      style: {
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    closeText.anchor.set(0.5);

    bg.on('pointerdown', (e) => {
      e.stopPropagation();
      this.options.onClose();
    });

    bg.on('pointerover', () => {
      bg.clear();
      bg.circle(0, 0, 14);
      bg.fill(0xff6666);
    });

    bg.on('pointerout', () => {
      bg.clear();
      bg.circle(0, 0, 14);
      bg.fill(0xff4444);
    });

    button.addChild(bg);
    button.addChild(closeText);
    return button;
  }

  // ============================================================================
  // Tabs
  // ============================================================================

  private createTabs(): void {
    const panelX = (GAME_CONFIG.WIDTH - PANEL_WIDTH) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - PANEL_HEIGHT) / 2;
    const tabY = panelY + HEADER_HEIGHT;
    const tabWidth = Math.floor((PANEL_WIDTH - PADDING * 2) / GLOBAL_SKILL_GROUPS.length);

    for (let i = 0; i < GLOBAL_SKILL_GROUPS.length; i++) {
      const group = GLOBAL_SKILL_GROUPS[i];
      const isActive = group.id === this.activeGroupId;

      const tabContainer = new Container();
      tabContainer.x = panelX + PADDING + i * tabWidth;
      tabContainer.y = tabY;

      const tabBg = new Graphics();
      tabBg.roundRect(0, 4, tabWidth - 4, TAB_HEIGHT - 8, 6);
      tabBg.fill(isActive ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE);
      tabBg.eventMode = 'static';
      tabBg.cursor = 'pointer';

      const tabText = new Text({
        text: group.name,
        style: {
          fontSize: 14,
          fill: isActive ? COLORS.TAB_TEXT_ACTIVE : COLORS.TAB_TEXT_INACTIVE,
          fontWeight: isActive ? 'bold' : 'normal',
          fontFamily: 'Arial',
        },
      });
      tabText.x = (tabWidth - 4 - tabText.width) / 2;
      tabText.y = (TAB_HEIGHT - tabText.height) / 2;

      // Group color indicator
      const colorDot = new Graphics();
      colorDot.circle(tabText.x - 10, TAB_HEIGHT / 2, 4);
      colorDot.fill(group.color);

      tabBg.on('pointerdown', (e) => {
        e.stopPropagation();
        this.setActiveGroup(group.id);
      });

      tabContainer.addChild(tabBg);
      tabContainer.addChild(colorDot);
      tabContainer.addChild(tabText);
      this.contentContainer.addChild(tabContainer);

      this.tabButtons.set(group.id, { container: tabContainer, bg: tabBg, text: tabText });
    }
  }

  private setActiveGroup(groupId: SkillGroupId): void {
    if (this.activeGroupId === groupId) return;
    this.activeGroupId = groupId;
    this.scrollY = 0;

    // Update tab visuals
    const tabWidth = Math.floor((PANEL_WIDTH - PADDING * 2) / GLOBAL_SKILL_GROUPS.length);
    for (const [id, tab] of this.tabButtons) {
      const isActive = id === groupId;
      tab.bg.clear();
      tab.bg.roundRect(0, 4, tabWidth - 4, TAB_HEIGHT - 8, 6);
      tab.bg.fill(isActive ? COLORS.TAB_ACTIVE : COLORS.TAB_INACTIVE);
      tab.text.style.fill = isActive ? COLORS.TAB_TEXT_ACTIVE : COLORS.TAB_TEXT_INACTIVE;
      tab.text.style.fontWeight = isActive ? 'bold' : 'normal';
    }

    this.renderSkillList();
  }

  // ============================================================================
  // Skill List
  // ============================================================================

  private renderSkillList(): void {
    // Clear previous skills
    this.skillListContainer.removeChildren();
    this.skillListContainer.y = 0;

    const skills = getSkillsByGroup(this.activeGroupId);
    const panelX = (GAME_CONFIG.WIDTH - PANEL_WIDTH) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - PANEL_HEIGHT) / 2;
    const listWidth = PANEL_WIDTH - PADDING * 2;

    let currentY = 0;

    for (const skill of skills) {
      const row = this.createSkillRow(skill, listWidth);
      row.y = currentY;
      this.skillListContainer.addChild(row);
      currentY += SKILL_ROW_HEIGHT;
    }

    // Calculate scroll limits
    const scrollAreaHeight = PANEL_HEIGHT - SKILL_LIST_TOP - PADDING;
    this.maxScrollY = Math.max(0, currentY - scrollAreaHeight);

    // Position and mask the skill list
    this.skillListContainer.x = panelX + PADDING;
    this.skillListContainer.y = panelY + SKILL_LIST_TOP;

    // Setup or update scroll mask
    this.scrollMask.clear();
    this.scrollMask.rect(panelX + PADDING, panelY + SKILL_LIST_TOP, listWidth, scrollAreaHeight);
    this.scrollMask.fill(0xffffff);
    this.skillListContainer.mask = this.scrollMask;

    // Add to content if not already
    if (!this.skillListContainer.parent) {
      this.contentContainer.addChild(this.scrollMask);
      this.contentContainer.addChild(this.skillListContainer);
    }
  }

  private createSkillRow(skill: GlobalSkillDef, width: number): Container {
    const store = useGlobalSkillStore.getState();
    const currentLevel = store.getSkillLevel(skill.id);
    const isMaxLevel = currentLevel >= skill.maxLevel;
    const currentMeso = useCharacterStore.getState().meso;
    const canAfford = currentMeso >= skill.costPerLevel;

    const row = new Container();

    // Row background
    const bg = new Graphics();
    bg.roundRect(0, 0, width, SKILL_ROW_HEIGHT - 4, 6);
    bg.fill(COLORS.SKILL_BG);
    bg.stroke({ color: COLORS.SKILL_BORDER, width: 1 });
    row.addChild(bg);

    // Skill name
    const nameText = new Text({
      text: skill.name,
      style: {
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    nameText.x = 12;
    nameText.y = 6;
    row.addChild(nameText);

    // Level display
    const levelColor = isMaxLevel ? COLORS.MAX_LEVEL_COLOR : 0xcccccc;
    const levelText = new Text({
      text: `Lv. ${currentLevel} / ${skill.maxLevel}`,
      style: {
        fontSize: 12,
        fill: levelColor,
        fontFamily: 'Arial',
        fontWeight: isMaxLevel ? 'bold' : 'normal',
      },
    });
    levelText.x = 12;
    levelText.y = 28;
    row.addChild(levelText);

    // Level progress bar
    const barX = levelText.x + levelText.width + 10;
    const barWidth = 80;
    const barHeight = 8;
    const barY = 32;

    const barBg = new Graphics();
    barBg.roundRect(barX, barY, barWidth, barHeight, 3);
    barBg.fill(COLORS.LEVEL_BAR_BG);
    row.addChild(barBg);

    if (currentLevel > 0) {
      const fillWidth = Math.floor((currentLevel / skill.maxLevel) * barWidth);
      const barFill = new Graphics();
      barFill.roundRect(barX, barY, fillWidth, barHeight, 3);
      barFill.fill(isMaxLevel ? COLORS.MAX_LEVEL_COLOR : COLORS.LEVEL_BAR_FILL);
      row.addChild(barFill);
    }

    // Effect description
    const effectText = this.getEffectDescription(skill, currentLevel);
    const descText = new Text({
      text: effectText,
      style: {
        fontSize: 11,
        fill: 0x99aabb,
        fontFamily: 'Arial',
      },
    });
    descText.x = barX + barWidth + 12;
    descText.y = 10;
    row.addChild(descText);

    // Current effect value
    const currentEffect = this.getCurrentEffectText(skill, currentLevel);
    const currentEffectText = new Text({
      text: currentEffect,
      style: {
        fontSize: 11,
        fill: 0x88ccff,
        fontFamily: 'Arial',
      },
    });
    currentEffectText.x = barX + barWidth + 12;
    currentEffectText.y = 28;
    row.addChild(currentEffectText);

    // Level Up button
    const buttonWidth = 80;
    const buttonHeight = 32;
    const buttonX = width - buttonWidth - 12;
    const buttonY = (SKILL_ROW_HEIGHT - 4 - buttonHeight) / 2;

    if (isMaxLevel) {
      const maxBadge = new Text({
        text: 'MAX',
        style: {
          fontSize: 14,
          fill: COLORS.MAX_LEVEL_COLOR,
          fontWeight: 'bold',
          fontFamily: 'Arial',
        },
      });
      maxBadge.x = buttonX + (buttonWidth - maxBadge.width) / 2;
      maxBadge.y = buttonY + (buttonHeight - maxBadge.height) / 2;
      row.addChild(maxBadge);
    } else {
      const buttonContainer = this.createLevelUpButton(
        skill,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        canAfford,
      );
      row.addChild(buttonContainer);
    }

    return row;
  }

  private createLevelUpButton(
    skill: GlobalSkillDef,
    x: number,
    y: number,
    width: number,
    height: number,
    canAfford: boolean,
  ): Container {
    const container = new Container();
    container.x = x;
    container.y = y;

    const bgColor = canAfford ? COLORS.BUTTON_ACTIVE : COLORS.BUTTON_DISABLED;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 5);
    bg.fill(bgColor);
    bg.eventMode = 'static';
    bg.cursor = canAfford ? 'pointer' : 'default';

    // Cost text
    const costText = new Text({
      text: `${this.formatMeso(skill.costPerLevel)}`,
      style: {
        fontSize: 11,
        fill: canAfford ? COLORS.MESO_COLOR : 0x777777,
        fontFamily: 'Arial',
      },
    });
    costText.x = (width - costText.width) / 2;
    costText.y = 3;

    // "UP" label
    const upText = new Text({
      text: 'UP',
      style: {
        fontSize: 12,
        fill: canAfford ? 0xffffff : 0x777777,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    upText.x = (width - upText.width) / 2;
    upText.y = 17;

    if (canAfford) {
      bg.on('pointerover', () => {
        bg.clear();
        bg.roundRect(0, 0, width, height, 5);
        bg.fill(COLORS.BUTTON_HOVER);
      });
      bg.on('pointerout', () => {
        bg.clear();
        bg.roundRect(0, 0, width, height, 5);
        bg.fill(COLORS.BUTTON_ACTIVE);
      });
      bg.on('pointerdown', (e) => {
        e.stopPropagation();
        this.handleLevelUp(skill.id);
      });
    }

    container.addChild(bg);
    container.addChild(costText);
    container.addChild(upText);
    return container;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  private handleLevelUp(skillId: string): void {
    const isSuccess = useGlobalSkillStore.getState().levelUpSkill(skillId);
    if (isSuccess) {
      this.refreshUI();
    }
  }

  private refreshUI(): void {
    // Update meso display
    if (this.mesoText) {
      const currentMeso = useCharacterStore.getState().meso;
      this.mesoText.text = `${this.formatMeso(currentMeso)} meso`;
    }

    // Re-render skill list
    this.renderSkillList();
  }

  // ============================================================================
  // Effect Descriptions
  // ============================================================================

  private getEffectDescription(skill: GlobalSkillDef, currentLevel: number): string {
    const nextLevel = currentLevel + 1;
    if (currentLevel >= skill.maxLevel) {
      return skill.description;
    }

    const nextValue = this.formatEffectValue(skill, nextLevel);
    return `다음: ${nextValue}`;
  }

  private getCurrentEffectText(skill: GlobalSkillDef, currentLevel: number): string {
    if (currentLevel === 0) {
      return '효과 없음';
    }

    const currentValue = this.formatEffectValue(skill, currentLevel);
    return `현재: ${currentValue}`;
  }

  private formatEffectValue(skill: GlobalSkillDef, level: number): string {
    const value = skill.effectPerLevel * level;

    switch (skill.id) {
      case 'maxMonsters':
      case 'batchSpawn':
        return `+${value}${skill.unit}`;
      case 'spawnInterval':
        return `-${value}${skill.unit}`;
      case 'initialSpawnRatio':
        return `+${Math.round(value * 100)}${skill.unit}`;
      case 'expRate':
      case 'mesoRate':
        return `+${Math.round(value * 100)}${skill.unit}`;
      case 'equipDropRate':
      case 'useDropRate':
      case 'etcDropRate':
        return `+${Math.round(value * 100)}${skill.unit}`;
      case 'mesoDropChance':
        return `+${value}${skill.unit}`;
      default:
        return `${value}${skill.unit}`;
    }
  }

  // ============================================================================
  // Scrolling
  // ============================================================================

  private setupScrolling(): void {
    this.contentContainer.eventMode = 'static';
    this.contentContainer.on('wheel', (event: any) => {
      event.preventDefault();
      const delta = event.deltaY;
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + delta * 0.5));
      this.updateScrollPosition();
    });
  }

  private updateScrollPosition(): void {
    const panelY = (GAME_CONFIG.HEIGHT - PANEL_HEIGHT) / 2;
    this.skillListContainer.y = panelY + SKILL_LIST_TOP - this.scrollY;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private formatMeso(amount: number): string {
    return amount.toLocaleString();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  public override destroy(): void {
    this.background.removeAllListeners();
    this.contentContainer.removeAllListeners();
    super.destroy({ children: true });
  }
}
