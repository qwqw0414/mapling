import { Container, Graphics, Text } from 'pixi.js';
import type { Stats } from '@/types/character';

// ============================================================================
// Types
// ============================================================================

interface CharacterCreationData {
  name: string;
  stats: Stats;
}

interface CharacterCreationOptions {
  onConfirm: (data: CharacterCreationData) => void;
  onCancel: () => void;
}

// ============================================================================
// CharacterCreationUI Component
// ============================================================================

/**
 * Character creation UI with name input and stat distribution
 * Base stats: 4 each (STR, DEX, INT, LUK)
 * Available points: 30
 */
export class CharacterCreationUI extends Container {
  private readonly onConfirmCallback: (data: CharacterCreationData) => void;
  private readonly onCancelCallback: () => void;

  private readonly panelWidth = 400;
  private readonly panelHeight = 450;

  // Character data
  private characterName: string = '';
  private stats: Stats = {
    str: 4,
    dex: 4,
    int: 4,
    luk: 4,
  };
  private readonly baseStats = 4;
  private readonly totalPoints = 30;
  private remainingPoints = 30;

  // UI Elements
  private nameInputText: Text | null = null;
  private remainingPointsText: Text | null = null;
  private statTexts: Map<keyof Stats, Text> = new Map();
  private confirmButton: Container | null = null;

  // Input state
  private isInputActive = false;

  constructor(options: CharacterCreationOptions) {
    super();

    this.onConfirmCallback = options.onConfirm;
    this.onCancelCallback = options.onCancel;

    this.createUI();
    this.setupKeyboardInput();
  }

  // ============================================================================
  // UI Creation
  // ============================================================================

  private createUI(): void {
    // Dimmed background overlay
    const overlay = new Graphics();
    overlay.rect(-2000, -2000, 4000, 4000);
    overlay.fill({ color: 0x000000, alpha: 0.7 });
    overlay.eventMode = 'static';
    overlay.on('pointerdown', (e) => {
      e.stopPropagation();
    });
    this.addChild(overlay);

    // Panel background
    const panel = new Graphics();
    panel.roundRect(0, 0, this.panelWidth, this.panelHeight, 12);
    panel.fill({ color: 0x1a1a1a });
    panel.stroke({ color: 0x4488ff, width: 3 });
    this.addChild(panel);

    // Title
    const title = new Text({
      text: '캐릭터 생성',
      style: {
        fontSize: 24,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    title.anchor.set(0.5, 0);
    title.x = this.panelWidth / 2;
    title.y = 20;
    this.addChild(title);

    // Name input section
    this.createNameInput(70);

    // Stats section
    this.createStatsSection(140);

    // Buttons
    this.createButtons(this.panelHeight - 70);
  }

  private createNameInput(startY: number): void {
    // Label
    const label = new Text({
      text: '이름:',
      style: {
        fontSize: 16,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
      },
    });
    label.x = 30;
    label.y = startY;
    this.addChild(label);

    // Input box background
    const inputBg = new Graphics();
    inputBg.roundRect(100, startY - 5, 270, 35, 5);
    inputBg.fill({ color: 0x2a2a2a });
    inputBg.stroke({ color: 0x666666, width: 2 });
    inputBg.label = 'inputBg';
    this.addChild(inputBg);

    // Input text
    this.nameInputText = new Text({
      text: '|',
      style: {
        fontSize: 16,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
      },
    });
    this.nameInputText.x = 110;
    this.nameInputText.y = startY + 3;
    this.addChild(this.nameInputText);

    // Make input clickable
    inputBg.eventMode = 'static';
    inputBg.cursor = 'text';
    inputBg.on('pointerdown', () => {
      this.activateInput();
    });
  }

  private createStatsSection(startY: number): void {
    // Section title
    const sectionTitle = new Text({
      text: '능력치 분배',
      style: {
        fontSize: 18,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    sectionTitle.x = 30;
    sectionTitle.y = startY;
    this.addChild(sectionTitle);

    // Remaining points
    this.remainingPointsText = new Text({
      text: `남은 포인트: ${this.remainingPoints}`,
      style: {
        fontSize: 16,
        fill: 0xFFDD55,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    this.remainingPointsText.anchor.set(1, 0);
    this.remainingPointsText.x = this.panelWidth - 30;
    this.remainingPointsText.y = startY;
    this.addChild(this.remainingPointsText);

    // Stat rows
    const stats: Array<{ key: keyof Stats; label: string }> = [
      { key: 'str', label: 'STR (힘)' },
      { key: 'dex', label: 'DEX (민첩)' },
      { key: 'int', label: 'INT (지능)' },
      { key: 'luk', label: 'LUK (행운)' },
    ];

    let y = startY + 40;
    for (const stat of stats) {
      this.createStatRow(stat.key, stat.label, y);
      y += 50;
    }
  }

  private createStatRow(statKey: keyof Stats, label: string, y: number): void {
    const container = new Container();
    container.y = y;
    this.addChild(container);

    // Label
    const labelText = new Text({
      text: label,
      style: {
        fontSize: 14,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
      },
    });
    labelText.x = 40;
    container.addChild(labelText);

    // Minus button
    const minusBtn = this.createStatButton('-', 180);
    minusBtn.on('pointerdown', () => {
      this.decreaseStat(statKey);
    });
    container.addChild(minusBtn);

    // Stat value
    const statText = new Text({
      text: this.stats[statKey].toString(),
      style: {
        fontSize: 18,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    statText.anchor.set(0.5, 0.5);
    statText.x = 240;
    statText.y = 15;
    container.addChild(statText);
    this.statTexts.set(statKey, statText);

    // Plus button
    const plusBtn = this.createStatButton('+', 280);
    plusBtn.on('pointerdown', () => {
      this.increaseStat(statKey);
    });
    container.addChild(plusBtn);
  }

  private createStatButton(symbol: string, x: number): Container {
    const button = new Container();
    button.x = x;

    const size = 30;
    const bg = new Graphics();
    bg.roundRect(0, 0, size, size, 5);
    bg.fill({ color: 0x4488ff });
    bg.label = 'bg';
    button.addChild(bg);

    const text = new Text({
      text: symbol,
      style: {
        fontSize: 20,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5);
    text.x = size / 2;
    text.y = size / 2;
    button.addChild(text);

    button.eventMode = 'static';
    button.cursor = 'pointer';

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 5);
      bg.fill({ color: 0x5599ff });
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 5);
      bg.fill({ color: 0x4488ff });
    });

    return button;
  }

  private createButtons(y: number): void {
    const buttonWidth = 120;
    const buttonHeight = 40;
    const gap = 20;

    // Cancel button
    const cancelBtn = this.createButton('취소', buttonWidth, buttonHeight, 0x666666);
    cancelBtn.x = (this.panelWidth - buttonWidth * 2 - gap) / 2;
    cancelBtn.y = y;
    cancelBtn.on('pointerdown', () => {
      this.onCancelCallback();
    });
    this.addChild(cancelBtn);

    // Confirm button
    this.confirmButton = this.createButton('생성', buttonWidth, buttonHeight, 0x4488ff);
    this.confirmButton.x = (this.panelWidth - buttonWidth * 2 - gap) / 2 + buttonWidth + gap;
    this.confirmButton.y = y;
    this.confirmButton.on('pointerdown', () => {
      this.handleConfirm();
    });
    this.addChild(this.confirmButton);
  }

  private createButton(text: string, width: number, height: number, color: number): Container {
    const button = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 8);
    bg.fill({ color });
    bg.label = 'bg';
    button.addChild(bg);

    const label = new Text({
      text,
      style: {
        fontSize: 16,
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

    const hoverColor = color === 0x666666 ? 0x888888 : 0x5599ff;

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 8);
      bg.fill({ color: hoverColor });
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 8);
      bg.fill({ color });
    });

    return button;
  }

  // ============================================================================
  // Stat Management
  // ============================================================================

  private increaseStat(statKey: keyof Stats): void {
    if (this.remainingPoints <= 0) return;

    this.stats[statKey]++;
    this.remainingPoints--;
    this.updateStatDisplay(statKey);
    this.updateRemainingPoints();
  }

  private decreaseStat(statKey: keyof Stats): void {
    if (this.stats[statKey] <= this.baseStats) return;

    this.stats[statKey]--;
    this.remainingPoints++;
    this.updateStatDisplay(statKey);
    this.updateRemainingPoints();
  }

  private updateStatDisplay(statKey: keyof Stats): void {
    const text = this.statTexts.get(statKey);
    if (text) {
      text.text = this.stats[statKey].toString();
    }
  }

  private updateRemainingPoints(): void {
    if (this.remainingPointsText) {
      this.remainingPointsText.text = `남은 포인트: ${this.remainingPoints}`;
    }
  }

  // ============================================================================
  // Name Input
  // ============================================================================

  private activateInput(): void {
    this.isInputActive = true;
    this.updateNameDisplay();

    // Highlight input box
    const inputBg = this.getChildByName('inputBg') as Graphics;
    if (inputBg) {
      inputBg.clear();
      inputBg.roundRect(100, 65, 270, 35, 5);
      inputBg.fill({ color: 0x2a2a2a });
      inputBg.stroke({ color: 0x4488ff, width: 2 });
    }
  }

  private deactivateInput(): void {
    this.isInputActive = false;
    this.updateNameDisplay();

    // Reset input box
    const inputBg = this.getChildByName('inputBg') as Graphics;
    if (inputBg) {
      inputBg.clear();
      inputBg.roundRect(100, 65, 270, 35, 5);
      inputBg.fill({ color: 0x2a2a2a });
      inputBg.stroke({ color: 0x666666, width: 2 });
    }
  }

  private setupKeyboardInput(): void {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!this.isInputActive) return;

      if (e.key === 'Escape') {
        this.deactivateInput();
        return;
      }

      if (e.key === 'Enter') {
        this.deactivateInput();
        return;
      }

      if (e.key === 'Backspace') {
        this.characterName = this.characterName.slice(0, -1);
        this.updateNameDisplay();
        return;
      }

      // Only allow alphanumeric and Korean characters
      if (e.key.length === 1 && this.characterName.length < 12) {
        this.characterName += e.key;
        this.updateNameDisplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    this.on('destroyed', () => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  }

  private updateNameDisplay(): void {
    if (this.nameInputText) {
      const displayText = this.characterName + (this.isInputActive ? '|' : '');
      this.nameInputText.text = displayText || (this.isInputActive ? '|' : '');
    }
  }

  // ============================================================================
  // Confirmation
  // ============================================================================

  private handleConfirm(): void {
    // Validate name
    if (!this.characterName.trim()) {
      console.log('[CharacterCreationUI] Name is required');
      // TODO: Show error message
      return;
    }

    // Create character data
    const data: CharacterCreationData = {
      name: this.characterName.trim(),
      stats: { ...this.stats },
    };

    console.log('[CharacterCreationUI] Creating character: [name]=[${data.name}] [stats]=[${JSON.stringify(data.stats)}] [remaining]=[${this.remainingPoints}]');

    this.onConfirmCallback(data);
  }

  // ============================================================================
  // Position
  // ============================================================================

  /**
   * Center the UI in the given dimensions
   */
  public centerIn(width: number, height: number): void {
    this.x = (width - this.panelWidth) / 2;
    this.y = (height - this.panelHeight) / 2;
  }
}
