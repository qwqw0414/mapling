import { Container, Text } from 'pixi.js';
import { LAYOUT_CONFIG } from '@/constants/config';

// ============================================================================
// Log System
// ============================================================================

interface LogEntry {
  text: Text;
  createdAt: number;
}

export class LogSystem {
  private logLayer: Container;
  private logEntries: Array<LogEntry> = [];

  constructor(logLayer: Container) {
    this.logLayer = logLayer;
    this.createLogTitle();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private createLogTitle(): void {
    const padding = LAYOUT_CONFIG.LOG_AREA.PADDING;

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

  // ============================================================================
  // Public API
  // ============================================================================

  addLog(message: string, color: number = 0xFFFFFF): void {
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

  logExpGain(mobName: string, exp: number): void {
    this.addLog(`${mobName} 처치! +${exp} EXP`, 0x90EE90);
  }

  logMesoGain(amount: number): void {
    this.addLog(`+${amount} 메소`, 0xFFD700);
  }

  logItemDrop(itemName: string): void {
    this.addLog(`${itemName} 획득!`, 0x87CEEB);
  }

  updateLogEntries(): void {
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

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private updateLogPositions(): void {
    let y = 22;
    for (const entry of this.logEntries) {
      entry.text.y = y;
      y += 14;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    for (const entry of this.logEntries) {
      entry.text.destroy();
    }
    this.logEntries = [];
  }
}
