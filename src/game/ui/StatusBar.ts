import { Container, Graphics, Text } from 'pixi.js';
import { SLOT_CONFIG } from '@/constants/config';

// ============================================================================
// Types
// ============================================================================

export interface StatusBarData {
  label: string;
  current: number;
  max: number;
  color: number;
}

// ============================================================================
// StatusBar Component
// ============================================================================

/**
 * Status bar component for HP/MP/EXP display
 * Shows label, current/max values, and colored progress bar
 */
export class StatusBar extends Container {
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly labelWidth: number;
  
  private readonly labelText: Text;
  private readonly valueText: Text;
  private readonly barBackground: Graphics;
  private readonly barFill: Graphics;
  
  private currentValue: number = 0;
  private maxValue: number = 1;
  private barColor: number = 0xFFFFFF;

  /**
   * Create status bar
   * @param width - Total width of the bar
   * @param label - Label text (HP/MP/EXP)
   * @param color - Bar fill color
   */
  constructor(width: number, label: string, color: number) {
    super();
    
    this.barWidth = width;
    this.barHeight = SLOT_CONFIG.STAT_BAR.HEIGHT;
    this.labelWidth = SLOT_CONFIG.STAT_BAR.LABEL_WIDTH;
    this.barColor = color;

    // Label text
    this.labelText = new Text({
      text: label,
      style: {
        fontSize: 10,
        fill: 0xCCCCCC,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    this.labelText.anchor.set(0, 0.5);
    this.labelText.y = this.barHeight / 2;
    this.addChild(this.labelText);

    // Bar background
    this.barBackground = new Graphics();
    this.barBackground.x = this.labelWidth;
    this.addChild(this.barBackground);

    // Bar fill
    this.barFill = new Graphics();
    this.barFill.x = this.labelWidth;
    this.addChild(this.barFill);

    // Value text (current/max)
    this.valueText = new Text({
      text: '0/0',
      style: {
        fontSize: 9,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 1,
          distance: 1,
        },
      },
    });
    this.valueText.anchor.set(0.5, 0.5);
    this.valueText.x = this.labelWidth + (this.barWidth - this.labelWidth) / 2;
    this.valueText.y = this.barHeight / 2;
    this.addChild(this.valueText);

    this.drawBar();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Update bar values
   */
  public updateValues(current: number, max: number): void {
    this.currentValue = Math.max(0, current);
    this.maxValue = Math.max(1, max);
    
    this.valueText.text = `${Math.floor(this.currentValue)}/${Math.floor(this.maxValue)}`;
    this.drawBar();
  }

  /**
   * Set bar color
   */
  public setColor(color: number): void {
    this.barColor = color;
    this.drawBar();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private drawBar(): void {
    const barContentWidth = this.barWidth - this.labelWidth;
    const ratio = Math.min(1, Math.max(0, this.currentValue / this.maxValue));
    const fillWidth = barContentWidth * ratio;

    // Background
    this.barBackground.clear();
    this.barBackground.roundRect(0, 0, barContentWidth, this.barHeight, 3);
    this.barBackground.fill({ color: 0x1a1a1a });
    this.barBackground.stroke({ color: 0x333333, width: 1 });

    // Fill
    this.barFill.clear();
    if (fillWidth > 0) {
      this.barFill.roundRect(1, 1, fillWidth - 2, this.barHeight - 2, 2);
      this.barFill.fill({ color: this.barColor });
    }
  }
}
