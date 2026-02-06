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
// Constants
// ============================================================================

/** All bonus points go to STR (will be reset on job advancement) */
const DEFAULT_STATS: Stats = {
  str: 34,
  dex: 4,
  int: 4,
  luk: 4,
};

// ============================================================================
// CharacterCreationUI Component
// ============================================================================

/**
 * Character creation UI with name input only.
 * Stats are auto-assigned (all 30 bonus to STR).
 * Stats will be reset upon job advancement.
 */
export class CharacterCreationUI extends Container {
  private readonly onConfirmCallback: (data: CharacterCreationData) => void;
  private readonly onCancelCallback: () => void;

  private readonly panelWidth = 400;
  private readonly panelHeight = 220;

  // Keyboard handler reference for cleanup
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Character data
  private characterName: string = '';

  // UI Elements
  private nameInputText: Text | null = null;

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
    this.createNameInput(75);

    // Info text
    const infoText = new Text({
      text: '초기 능력치는 자동 배분됩니다 (전직 시 초기화)',
      style: {
        fontSize: 12,
        fill: 0x888888,
        fontFamily: 'Arial',
      },
    });
    infoText.anchor.set(0.5, 0);
    infoText.x = this.panelWidth / 2;
    infoText.y = 125;
    this.addChild(infoText);

    // Buttons
    this.createButtons(this.panelHeight - 60);
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

    // Auto-activate input on creation
    this.activateInput();
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
    const confirmButton = this.createButton('생성', buttonWidth, buttonHeight, 0x4488ff);
    confirmButton.x = (this.panelWidth - buttonWidth * 2 - gap) / 2 + buttonWidth + gap;
    confirmButton.y = y;
    confirmButton.on('pointerdown', () => {
      this.handleConfirm();
    });
    this.addChild(confirmButton);
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
  // Name Input
  // ============================================================================

  private activateInput(): void {
    this.isInputActive = true;
    this.updateNameDisplay();
  }

  private deactivateInput(): void {
    this.isInputActive = false;
    this.updateNameDisplay();
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
        this.handleConfirm();
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

    this.keydownHandler = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);
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
    if (!this.characterName.trim()) {
      console.log('[CharacterCreationUI] Name is required');
      return;
    }

    const data: CharacterCreationData = {
      name: this.characterName.trim(),
      stats: { ...DEFAULT_STATS },
    };

    console.log(
      `[CharacterCreationUI] Creating character: [name]=[${data.name}] [stats]=[STR:${data.stats.str},DEX:${data.stats.dex},INT:${data.stats.int},LUK:${data.stats.luk}]`,
    );

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

  // ============================================================================
  // Cleanup
  // ============================================================================

  public override destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    super.destroy({ children: true });
  }
}
