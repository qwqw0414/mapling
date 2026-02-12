import { Container, Text } from 'pixi.js';
import { LAYOUT_CONFIG } from '@/constants/config';

// ============================================================================
// Log System (필드 우측 상단 오버레이)
// ============================================================================

interface LogEntry {
  text: Text;
  createdAt: number;
}

export class LogSystem {
  private logLayer: Container;
  private logEntries: Array<LogEntry> = [];
  private readonly fieldWidth: number;

  constructor(fieldLayer: Container, fieldWidth: number) {
    this.fieldWidth = fieldWidth;

    // 로그 컨테이너를 필드 레이어 위에 오버레이로 생성
    this.logLayer = new Container();
    this.logLayer.label = 'logOverlay';
    fieldLayer.addChild(this.logLayer);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  addLog(message: string, color: number = 0xFFFFFF): void {
    const maxEntries = LAYOUT_CONFIG.LOG.MAX_ENTRIES;

    const logText = new Text({
      text: message,
      style: {
        fontSize: 11,
        fill: color,
        fontFamily: 'Arial',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
          alpha: 0.9,
        },
      },
    });

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

  logWarning(message: string): void {
    this.addLog(message, 0xFF6666);
  }

  updateLogEntries(): void {
    const now = Date.now();
    const fadeStart = LAYOUT_CONFIG.LOG.FADE_START_MS;
    const fadeDuration = LAYOUT_CONFIG.LOG.FADE_DURATION_MS;

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
    const padding = LAYOUT_CONFIG.LOG.PADDING;

    const SKILL_BUTTON_OFFSET = 50;
    let y = padding + SKILL_BUTTON_OFFSET;
    for (const entry of this.logEntries) {
      // 우측 상단 정렬: 텍스트를 우측에 배치
      entry.text.anchor.set(1, 0);
      entry.text.x = this.fieldWidth - padding;
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
