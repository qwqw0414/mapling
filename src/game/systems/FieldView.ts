import { Container, Graphics } from 'pixi.js';
import { LAYOUT_CONFIG } from '@/constants/config';

// ============================================================================
// Field View
// ============================================================================

export class FieldView {
  private fieldLayer: Container;
  private fieldWidth: number;
  private fieldHeight: number;

  constructor(fieldLayer: Container, fieldWidth: number, fieldHeight: number) {
    this.fieldLayer = fieldLayer;
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;

    this.createField();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private createField(): void {
    const fieldBg = new Graphics();
    fieldBg.label = 'fieldBg';
    fieldBg.rect(0, 0, this.fieldWidth, this.fieldHeight);
    fieldBg.fill({ color: 0x0a0a0a, alpha: 0.5 });
    this.fieldLayer.addChild(fieldBg);

    const groundY = this.fieldHeight - 30;
    const groundLine = new Graphics();
    groundLine.label = 'groundLine';
    groundLine.moveTo(20, groundY);
    groundLine.lineTo(this.fieldWidth - 20, groundY);
    groundLine.stroke({ color: 0x333333, width: 2 });
    this.fieldLayer.addChild(groundLine);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  updateFieldDimensions(width: number, height: number): void {
    this.fieldWidth = width;
    this.fieldHeight = height;

    const fieldBg = this.fieldLayer.getChildByName('fieldBg') as Graphics;
    if (fieldBg) {
      fieldBg.clear();
      fieldBg.rect(0, 0, this.fieldWidth, this.fieldHeight);
      fieldBg.fill({ color: 0x0a0a0a, alpha: 0.5 });
    }

    const groundY = this.fieldHeight - 30;
    const groundLine = this.fieldLayer.getChildByName('groundLine') as Graphics;
    if (groundLine) {
      groundLine.clear();
      groundLine.moveTo(20, groundY);
      groundLine.lineTo(this.fieldWidth - 20, groundY);
      groundLine.stroke({ color: 0x333333, width: 2 });
    }
  }

  setupClickHandler(callback: () => void): void {
    this.fieldLayer.eventMode = 'static';
    this.fieldLayer.cursor = 'pointer';

    this.fieldLayer.on('pointerdown', callback);
  }

  removeClickHandler(): void {
    this.fieldLayer.eventMode = 'auto';
    this.fieldLayer.cursor = 'auto';
    this.fieldLayer.removeAllListeners('pointerdown');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.removeClickHandler();

    const fieldBg = this.fieldLayer.getChildByName('fieldBg');
    if (fieldBg) {
      this.fieldLayer.removeChild(fieldBg);
      fieldBg.destroy();
    }

    const groundLine = this.fieldLayer.getChildByName('groundLine');
    if (groundLine) {
      this.fieldLayer.removeChild(groundLine);
      groundLine.destroy();
    }
  }
}
