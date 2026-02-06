import { Container, Graphics, Text } from 'pixi.js';
import { getFieldMaps } from '@/data/maps';
import { getMobById } from '@/data/mobs';
import type { MapInfo } from '@/types/map';

// ============================================================================
// Map Selection UI
// ============================================================================

interface MapSelectionOptions {
  onMapSelect: (mapId: number) => void;
  onClose: () => void;
  currentMapId: number;
  characterLevel?: number;
}

export class MapSelectionUI extends Container {
  private background: Graphics;
  private contentContainer: Container;
  private scrollContainer: Container;
  private scrollMask: Graphics;
  private options: MapSelectionOptions;
  private scrollY = 0;
  private maxScrollY = 0;
  private readonly panelWidth = 450;
  private readonly panelHeight = 600;

  constructor(options: MapSelectionOptions) {
    super();
    this.options = options;

    this.background = new Graphics();
    this.contentContainer = new Container();
    this.scrollContainer = new Container();
    this.scrollMask = new Graphics();

    this.createUI();
    this.setupScrolling();
  }

  // ============================================================================
  // UI Creation
  // ============================================================================

  private createUI(): void {
    this.createBackground();
    this.createHeader();
    this.createMapList();
    this.addChild(this.background);
    this.addChild(this.contentContainer);
  }

  private createBackground(): void {
    // Semi-transparent overlay
    this.background.rect(0, 0, window.innerWidth, window.innerHeight);
    this.background.fill({ color: 0x000000, alpha: 0.7 });
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => {
      this.options.onClose();
    });
  }

  private createHeader(): void {
    const panelX = (window.innerWidth - this.panelWidth) / 2;
    const panelY = (window.innerHeight - this.panelHeight) / 2;

    // Panel background
    const panel = new Graphics();
    panel.roundRect(0, 0, this.panelWidth, this.panelHeight, 10);
    panel.fill(0x2a2a2a);
    panel.stroke({ color: 0x4a4a4a, width: 2 });
    panel.x = panelX;
    panel.y = panelY;
    this.contentContainer.addChild(panel);

    // Title
    const title = new Text({
      text: '맵 선택',
      style: {
        fontSize: 24,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    title.x = panelX + (this.panelWidth - title.width) / 2;
    title.y = panelY + 20;
    this.contentContainer.addChild(title);

    // Close button
    const closeButton = this.createCloseButton(panelX + this.panelWidth - 35, panelY + 15);
    this.contentContainer.addChild(closeButton);
  }

  private createCloseButton(x: number, y: number): Container {
    const button = new Container();
    button.x = x;
    button.y = y;

    const bg = new Graphics();
    bg.circle(0, 0, 15);
    bg.fill(0xff4444);
    bg.eventMode = 'static';
    bg.cursor = 'pointer';

    const closeText = new Text({
      text: '✕',
      style: {
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    closeText.anchor.set(0.5);

    bg.on('pointerdown', () => {
      this.options.onClose();
    });

    button.addChild(bg);
    button.addChild(closeText);
    return button;
  }

  private createMapList(): void {
    const maps = getFieldMaps();
    const panelX = (window.innerWidth - this.panelWidth) / 2;
    const panelY = (window.innerHeight - this.panelHeight) / 2;
    const startY = 10; // Start from relative position within scroll container

    // Group maps by streetName > mapMark
    const grouped = this.groupMapsByRegion(maps);

    let currentY = startY;

    for (const [streetName, mapMarkGroups] of grouped.entries()) {
      // Street name header
      const streetHeader = this.createStreetHeader(streetName);
      streetHeader.x = 20;
      streetHeader.y = currentY;
      this.scrollContainer.addChild(streetHeader);
      currentY += 30;

      for (const [mapMark, mapList] of mapMarkGroups.entries()) {
        // Map mark subheader (if exists)
        if (mapMark) {
          const markHeader = this.createMapMarkHeader(mapMark);
          markHeader.x = 35;
          markHeader.y = currentY;
          this.scrollContainer.addChild(markHeader);
          currentY += 25;
        }

        // Map items
        for (const map of mapList) {
          const mapItem = this.createMapItem(map);
          mapItem.x = mapMark ? 50 : 35;
          mapItem.y = currentY;
          this.scrollContainer.addChild(mapItem);
          currentY += 85;
        }
      }

      currentY += 10; // Gap between regions
    }

    // Calculate max scroll
    const contentHeight = currentY;
    const scrollAreaHeight = this.panelHeight - 70; // Panel height minus header
    this.maxScrollY = Math.max(0, contentHeight - scrollAreaHeight);

    // Position scroll container
    this.scrollContainer.x = panelX;
    this.scrollContainer.y = panelY + 70;

    // Create mask for scroll area
    this.scrollMask.rect(panelX, panelY + 70, this.panelWidth, scrollAreaHeight);
    this.scrollMask.fill(0xffffff);
    this.scrollContainer.mask = this.scrollMask;

    this.contentContainer.addChild(this.scrollMask);
    this.contentContainer.addChild(this.scrollContainer);
  }

  private groupMapsByRegion(maps: MapInfo[]): Map<string, Map<string, MapInfo[]>> {
    const grouped = new Map<string, Map<string, MapInfo[]>>();

    for (const map of maps) {
      const streetName = map.streetName || '기타';
      const mapMark = map.mapMark || '';

      if (!grouped.has(streetName)) {
        grouped.set(streetName, new Map());
      }

      const mapMarkGroups = grouped.get(streetName)!;
      if (!mapMarkGroups.has(mapMark)) {
        mapMarkGroups.set(mapMark, []);
      }

      mapMarkGroups.get(mapMark)!.push(map);
    }

    return grouped;
  }

  private createStreetHeader(streetName: string): Container {
    const container = new Container();

    const text = new Text({
      text: `📍 ${streetName}`,
      style: {
        fontSize: 16,
        fill: 0xffdd44,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });

    container.addChild(text);
    return container;
  }

  private createMapMarkHeader(mapMark: string): Container {
    const container = new Container();

    const text = new Text({
      text: `├─ ${mapMark}`,
      style: {
        fontSize: 14,
        fill: 0xcccccc,
        fontFamily: 'Arial',
      },
    });

    container.addChild(text);
    return container;
  }

  private createMapItem(map: MapInfo): Container {
    const container = new Container();
    const itemWidth = 340; // Fixed width for consistency
    const itemHeight = 75;

    // Background
    const bg = new Graphics();
    const isCurrentMap = map.id === this.options.currentMapId;
    const bgColor = isCurrentMap ? 0x4a6fa5 : 0x3a3a3a;

    bg.roundRect(0, 0, itemWidth, itemHeight, 5);
    bg.fill(bgColor);
    bg.stroke({ color: isCurrentMap ? 0x6a8fc5 : 0x4a4a4a, width: 1 });

    if (!isCurrentMap) {
      bg.eventMode = 'static';
      bg.cursor = 'pointer';
      bg.on('pointerover', () => {
        bg.clear();
        bg.roundRect(0, 0, itemWidth, itemHeight, 5);
        bg.fill(0x4a4a4a);
        bg.stroke({ color: 0x6a6a6a, width: 1 });
      });
      bg.on('pointerout', () => {
        bg.clear();
        bg.roundRect(0, 0, itemWidth, itemHeight, 5);
        bg.fill(bgColor);
        bg.stroke({ color: 0x4a4a4a, width: 1 });
      });
      bg.on('pointerdown', () => {
        this.options.onMapSelect(map.id);
      });
    }

    container.addChild(bg);

    // Map Icon (Region-based)
    const iconSize = 50;
    const iconBg = new Graphics();
    const iconColor = this.getRegionColor(map.streetName);
    iconBg.roundRect(0, 0, iconSize, iconSize, 8);
    iconBg.fill({ color: iconColor, alpha: 0.3 });
    iconBg.stroke({ color: iconColor, width: 2 });
    iconBg.x = 10;
    iconBg.y = (itemHeight - iconSize) / 2;
    container.addChild(iconBg);

    // Icon emoji
    const iconText = new Text({
      text: this.getRegionEmoji(map.streetName),
      style: {
        fontSize: 24,
        fontFamily: 'Arial',
      },
    });
    iconText.x = iconBg.x + (iconSize - iconText.width) / 2;
    iconText.y = iconBg.y + (iconSize - iconText.height) / 2;
    container.addChild(iconText);

    // Map name
    const nameText = new Text({
      text: map.name,
      style: {
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    nameText.x = iconBg.x + iconSize + 15;
    nameText.y = 10;
    container.addChild(nameText);

    // Level range
    const levelRange = map.recommendedLevel
      ? `Lv.${map.recommendedLevel.min}-${map.recommendedLevel.max}`
      : 'Lv.?';
    const levelText = new Text({
      text: levelRange,
      style: {
        fontSize: 14,
        fill: 0xaaaaaa,
        fontFamily: 'Arial',
      },
    });
    levelText.x = iconBg.x + iconSize + 15;
    levelText.y = 35;
    container.addChild(levelText);

    // Monster list
    const mobNames = (map.spawns?.normal.mobs ?? [])
      .map((spawn) => {
        const mob = getMobById(spawn.mobId);
        return mob ? mob.name : null;
      })
      .filter((name): name is string => name !== null);

    if (mobNames.length > 0) {
      const monstersText = new Text({
        text: `🎯 ${mobNames.join(', ')}`,
        style: {
          fontSize: 12,
          fill: 0xcccccc,
          fontFamily: 'Arial',
        },
      });
      monstersText.x = iconBg.x + iconSize + 15;
      monstersText.y = 56;
      container.addChild(monstersText);
    }

    // Current map indicator
    if (isCurrentMap) {
      const currentLabel = new Text({
        text: '✓ 현재 위치',
        style: {
          fontSize: 14,
          fill: 0x88ff88,
          fontFamily: 'Arial',
        },
      });
      currentLabel.x = itemWidth - currentLabel.width - 15;
      currentLabel.y = 12;
      container.addChild(currentLabel);
    } else {
      const moveButton = new Text({
        text: '→ 이동',
        style: {
          fontSize: 14,
          fill: 0xffdd44,
          fontFamily: 'Arial',
        },
      });
      moveButton.x = itemWidth - moveButton.width - 15;
      moveButton.y = 12;
      container.addChild(moveButton);
    }

    return container;
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
    this.scrollContainer.y = (window.innerHeight - this.panelHeight) / 2 + 70 - this.scrollY;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getRegionColor(streetName?: string): number {
    switch (streetName) {
      case '빅토리아 아일랜드':
        return 0x66bb66; // Green
      case '히든 스트리트':
        return 0x9966ff; // Purple
      case '엘나스 산맥':
        return 0x66ccff; // Light Blue
      case '커닝 시티':
        return 0xffaa44; // Orange
      default:
        return 0x888888; // Gray
    }
  }

  private getRegionEmoji(streetName?: string): string {
    switch (streetName) {
      case '빅토리아 아일랜드':
        return '🌳';
      case '히든 스트리트':
        return '🔮';
      case '엘나스 산맥':
        return '❄️';
      case '커닝 시티':
        return '🏙️';
      default:
        return '🗺️';
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }

  public override destroy(): void {
    this.background.removeAllListeners();
    this.contentContainer.removeAllListeners();
    super.destroy({ children: true });
  }
}
