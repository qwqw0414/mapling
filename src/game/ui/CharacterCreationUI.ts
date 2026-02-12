import { Container, Graphics, Text, Sprite } from 'pixi.js';
import { GifSprite } from 'pixi.js/gif';
import { AssetManager } from '@/game/systems/AssetManager';
import {
  DEFAULT_HAIR_OPTIONS,
  DEFAULT_FACE_OPTIONS,
  createLookWithChoices,
} from '@/data/characterLook';
import type { Stats } from '@/types/character';

// ============================================================================
// Types
// ============================================================================

interface CharacterCreationData {
  name: string;
  stats: Stats;
  hairId: number;
  faceId: number;
}

interface CharacterCreationOptions {
  onConfirm: (data: CharacterCreationData) => void;
  onCancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STATS: Stats = {
  str: 14,
  dex: 4,
  int: 4,
  luk: 4,
};

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 380;
const PREVIEW_SIZE = 100;

// ============================================================================
// CharacterCreationUI Component
// ============================================================================

/**
 * Character creation UI with name input, hair/face selection, and preview.
 * Stats are auto-assigned (10 bonus to STR).
 */
export class CharacterCreationUI extends Container {
  private readonly onConfirmCallback: (data: CharacterCreationData) => void;
  private readonly onCancelCallback: () => void;

  private readonly panelWidth = PANEL_WIDTH;
  private readonly panelHeight = PANEL_HEIGHT;

  // Hidden HTML input for IME support
  private hiddenInput: HTMLInputElement | null = null;

  // Character data
  private characterName: string = '';
  private hairIndex: number = 0;
  private faceIndex: number = 0;

  // UI Elements
  private nameInputText: Text | null = null;
  private hairLabelText: Text | null = null;
  private faceLabelText: Text | null = null;
  private previewContainer: Container | null = null;
  private previewSprite: GifSprite | Sprite | null = null;
  private isLoadingPreview = false;

  // Input state
  private isInputActive = false;

  constructor(options: CharacterCreationOptions) {
    super();

    this.onConfirmCallback = options.onConfirm;
    this.onCancelCallback = options.onCancel;

    // Random initial selection
    this.hairIndex = Math.floor(Math.random() * DEFAULT_HAIR_OPTIONS.length);
    this.faceIndex = Math.floor(Math.random() * DEFAULT_FACE_OPTIONS.length);

    this.setupKeyboardInput();
    this.createUI();
    this.loadPreview();
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
      // 패널 바깥 클릭 시에도 입력 포커스 유지
      if (this.isInputActive) {
        this.activateInput();
      }
    });
    this.addChild(overlay);

    // Panel background
    const panel = new Graphics();
    panel.roundRect(0, 0, this.panelWidth, this.panelHeight, 12);
    panel.fill({ color: 0x1a1a1a });
    panel.stroke({ color: 0x4488ff, width: 3 });
    panel.eventMode = 'static';
    panel.on('pointerdown', (e) => {
      e.stopPropagation();
      // 패널 클릭 시에도 입력 포커스 유지
      if (this.isInputActive) {
        this.activateInput();
      }
    });
    this.addChild(panel);

    // Title
    const title = new Text({
      text: '캐릭터 생성',
      style: {
        fontSize: 22,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    title.anchor.set(0.5, 0);
    title.x = this.panelWidth / 2;
    title.y = 18;
    this.addChild(title);

    let y = 55;

    // Name input
    this.createNameInput(y);
    y += 50;

    // Preview + selectors row
    this.createPreviewAndSelectors(y);
    y += PREVIEW_SIZE + 30;

    // Info text
    const infoText = new Text({
      text: '초기 능력치는 자동 배분됩니다 (전직 시 초기화)',
      style: {
        fontSize: 11,
        fill: 0x888888,
        fontFamily: 'Arial',
      },
    });
    infoText.anchor.set(0.5, 0);
    infoText.x = this.panelWidth / 2;
    infoText.y = y;
    this.addChild(infoText);

    // Buttons
    this.createButtons(this.panelHeight - 60);
  }

  // ============================================================================
  // Preview + Selectors
  // ============================================================================

  private createPreviewAndSelectors(startY: number): void {
    const previewX = 30;
    const selectorX = previewX + PREVIEW_SIZE + 20;

    // Preview area
    this.createPreviewArea(previewX, startY);

    // Hair selector
    const hairY = startY + 15;
    this.createSelector(
      '머리',
      selectorX,
      hairY,
      () => this.changeHair(-1),
      () => this.changeHair(1),
    );
    this.hairLabelText = this.createSelectorValue(selectorX, hairY);
    this.updateHairLabel();

    // Face selector
    const faceY = hairY + 50;
    this.createSelector(
      '얼굴',
      selectorX,
      faceY,
      () => this.changeFace(-1),
      () => this.changeFace(1),
    );
    this.faceLabelText = this.createSelectorValue(selectorX, faceY);
    this.updateFaceLabel();
  }

  private createPreviewArea(x: number, y: number): void {
    // Preview background
    const bg = new Graphics();
    bg.roundRect(x, y, PREVIEW_SIZE, PREVIEW_SIZE, 6);
    bg.fill({ color: 0x222233 });
    bg.stroke({ color: 0x444466, width: 1 });
    this.addChild(bg);

    // Preview container (for character sprite)
    this.previewContainer = new Container();
    this.previewContainer.x = x;
    this.previewContainer.y = y;
    this.addChild(this.previewContainer);

    // Loading text
    const loadingText = new Text({
      text: '...',
      style: { fontSize: 12, fill: 0x666666, fontFamily: 'Arial' },
    });
    loadingText.anchor.set(0.5);
    loadingText.x = PREVIEW_SIZE / 2;
    loadingText.y = PREVIEW_SIZE / 2;
    loadingText.label = 'loadingText';
    this.previewContainer.addChild(loadingText);
  }

  private createSelector(
    label: string,
    x: number,
    y: number,
    onPrev: () => void,
    onNext: () => void,
  ): void {
    // Label
    const labelText = new Text({
      text: label,
      style: {
        fontSize: 13,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    labelText.x = x;
    labelText.y = y;
    this.addChild(labelText);

    const arrowY = y + 22;
    const arrowWidth = 24;
    const arrowHeight = 24;

    // Left arrow
    const leftArrow = this.createArrowButton('<', arrowWidth, arrowHeight);
    leftArrow.x = x;
    leftArrow.y = arrowY;
    leftArrow.on('pointerdown', (e) => {
      e.stopPropagation();
      onPrev();
    });
    this.addChild(leftArrow);

    // Right arrow
    const rightArrow = this.createArrowButton('>', arrowWidth, arrowHeight);
    rightArrow.x = x + 200;
    rightArrow.y = arrowY;
    rightArrow.on('pointerdown', (e) => {
      e.stopPropagation();
      onNext();
    });
    this.addChild(rightArrow);
  }

  private createSelectorValue(x: number, y: number): Text {
    const valueText = new Text({
      text: '',
      style: {
        fontSize: 12,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
      },
    });
    valueText.anchor.set(0.5, 0);
    valueText.x = x + 112 + 12;
    valueText.y = y + 25;
    this.addChild(valueText);
    return valueText;
  }

  private createArrowButton(symbol: string, width: number, height: number): Container {
    const btn = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 4);
    bg.fill({ color: 0x444444 });
    btn.addChild(bg);

    const text = new Text({
      text: symbol,
      style: {
        fontSize: 14,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    text.eventMode = 'none';
    btn.addChild(text);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    btn.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 4);
      bg.fill({ color: 0x666666 });
    });
    btn.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 4);
      bg.fill({ color: 0x444444 });
    });

    return btn;
  }

  // ============================================================================
  // Hair / Face Selection
  // ============================================================================

  private changeHair(delta: number): void {
    const len = DEFAULT_HAIR_OPTIONS.length;
    this.hairIndex = (this.hairIndex + delta + len) % len;
    this.updateHairLabel();
    this.loadPreview();
  }

  private changeFace(delta: number): void {
    const len = DEFAULT_FACE_OPTIONS.length;
    this.faceIndex = (this.faceIndex + delta + len) % len;
    this.updateFaceLabel();
    this.loadPreview();
  }

  private updateHairLabel(): void {
    if (this.hairLabelText) {
      const hair = DEFAULT_HAIR_OPTIONS[this.hairIndex];
      this.hairLabelText.text = hair.nameKr;
    }
  }

  private updateFaceLabel(): void {
    if (this.faceLabelText) {
      const face = DEFAULT_FACE_OPTIONS[this.faceIndex];
      this.faceLabelText.text = face.nameKr;
    }
  }

  // ============================================================================
  // Preview Loading
  // ============================================================================

  private async loadPreview(): Promise<void> {
    if (!this.previewContainer || this.isLoadingPreview) return;

    this.isLoadingPreview = true;

    const hairId = DEFAULT_HAIR_OPTIONS[this.hairIndex].id;
    const faceId = DEFAULT_FACE_OPTIONS[this.faceIndex].id;
    const look = createLookWithChoices(hairId, faceId);

    // Capture current selection to detect stale loads
    const expectedHair = this.hairIndex;
    const expectedFace = this.faceIndex;

    try {
      const assetManager = AssetManager.getInstance();
      const gifSource = await assetManager.getCharacterGif(look, 'stand1');

      // Stale check: selection changed during load
      if (expectedHair !== this.hairIndex || expectedFace !== this.faceIndex) {
        this.isLoadingPreview = false;
        this.loadPreview();
        return;
      }

      // Remove old preview sprite
      if (this.previewSprite) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy();
        this.previewSprite = null;
      }

      // Remove loading text
      const loadingText = this.previewContainer.getChildByLabel('loadingText');
      if (loadingText) {
        this.previewContainer.removeChild(loadingText);
        loadingText.destroy();
      }

      if (gifSource) {
        const sprite = new GifSprite({
          source: gifSource,
          autoPlay: true,
          loop: true,
        });
        sprite.anchor.set(0.5, 1);
        sprite.x = PREVIEW_SIZE / 2;
        sprite.y = PREVIEW_SIZE - 5;
        this.previewSprite = sprite;
        this.previewContainer.addChild(sprite);
      }
    } catch (err) {
      console.warn('[CharacterCreationUI] Preview load failed:', err);
    }

    this.isLoadingPreview = false;
  }

  // ============================================================================
  // Name Input
  // ============================================================================

  private createNameInput(startY: number): void {
    const label = new Text({
      text: '이름:',
      style: {
        fontSize: 15,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
      },
    });
    label.x = 30;
    label.y = startY;
    this.addChild(label);

    const inputBg = new Graphics();
    inputBg.roundRect(100, startY - 5, 290, 35, 5);
    inputBg.fill({ color: 0x2a2a2a });
    inputBg.stroke({ color: 0x666666, width: 2 });
    inputBg.label = 'inputBg';
    this.addChild(inputBg);

    this.nameInputText = new Text({
      text: '|',
      style: {
        fontSize: 15,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
      },
    });
    this.nameInputText.x = 110;
    this.nameInputText.y = startY + 3;
    this.addChild(this.nameInputText);

    inputBg.eventMode = 'static';
    inputBg.cursor = 'text';
    inputBg.on('pointerdown', () => {
      this.activateInput();
    });

    this.activateInput();
  }

  private activateInput(): void {
    this.isInputActive = true;
    if (this.hiddenInput) {
      this.hiddenInput.value = this.characterName;
      // setTimeout으로 포커스를 지연시켜 캔버스 pointerdown 후 포커스를 되찾음
      setTimeout(() => {
        this.hiddenInput?.focus();
      }, 0);
    }
    this.updateNameDisplay();
  }

  private deactivateInput(): void {
    this.isInputActive = false;
    if (this.hiddenInput) {
      this.hiddenInput.blur();
    }
    this.updateNameDisplay();
  }

  private setupKeyboardInput(): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.setAttribute('inputmode', 'text');
    document.body.appendChild(input);
    this.hiddenInput = input;

    // Sync composed text from hidden input to PixiJS display
    input.addEventListener('input', () => {
      this.characterName = input.value;
      this.updateNameDisplay();
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.deactivateInput();
        return;
      }

      if (e.key === 'Enter') {
        // IME 조합 중이면 무시 (isComposing=true일 때는 Enter가 조합 확정용)
        if (e.isComposing) return;
        this.deactivateInput();
        this.handleConfirm();
        return;
      }
    });
  }

  private updateNameDisplay(): void {
    if (this.nameInputText) {
      const displayText = this.characterName + (this.isInputActive ? '|' : '');
      this.nameInputText.text = displayText || (this.isInputActive ? '|' : '');
    }
  }

  // ============================================================================
  // Buttons
  // ============================================================================

  private createButtons(y: number): void {
    const buttonWidth = 120;
    const buttonHeight = 40;
    const gap = 20;

    const cancelBtn = this.createButton('취소', buttonWidth, buttonHeight, 0x666666);
    cancelBtn.x = (this.panelWidth - buttonWidth * 2 - gap) / 2;
    cancelBtn.y = y;
    cancelBtn.on('pointerdown', () => {
      this.onCancelCallback();
    });
    this.addChild(cancelBtn);

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
    label.eventMode = 'none';
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
  // Confirmation
  // ============================================================================

  private handleConfirm(): void {
    if (!this.characterName.trim()) {
      console.log('[CharacterCreationUI] Name is required');
      return;
    }

    const hairId = DEFAULT_HAIR_OPTIONS[this.hairIndex].id;
    const faceId = DEFAULT_FACE_OPTIONS[this.faceIndex].id;

    const data: CharacterCreationData = {
      name: this.characterName.trim(),
      stats: { ...DEFAULT_STATS },
      hairId,
      faceId,
    };

    console.log(
      `[CharacterCreationUI] Creating character: [name]=[${data.name}] [hairId]=[${data.hairId}] [faceId]=[${data.faceId}]`,
    );

    this.onConfirmCallback(data);
  }

  // ============================================================================
  // Position
  // ============================================================================

  public centerIn(width: number, height: number): void {
    this.x = (width - this.panelWidth) / 2;
    this.y = (height - this.panelHeight) / 2;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  public override destroy(): void {
    if (this.hiddenInput) {
      this.hiddenInput.remove();
      this.hiddenInput = null;
    }

    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }

    super.destroy({ children: true });
  }
}
