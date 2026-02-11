import { Container, Graphics, Text } from 'pixi.js';
import { GAME_CONFIG } from '@/constants/config';
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
    this.background.rect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    this.background.fill({ color: 0x000000, alpha: 0.7 });
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => {
      this.options.onClose();
    });
  }

  private createHeader(): void {
    const panelX = (GAME_CONFIG.WIDTH - this.panelWidth) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - this.panelHeight) / 2;

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
    const panelX = (GAME_CONFIG.WIDTH - this.panelWidth) / 2;
    const panelY = (GAME_CONFIG.HEIGHT - this.panelHeight) / 2;
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
          currentY += 58;
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
      text: streetName,
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
    const itemWidth = 370;
    const itemHeight = 50;
    const paddingX = 12;

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

    // Map name
    const nameText = new Text({
      text: map.name,
      style: {
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    });
    nameText.x = paddingX;
    nameText.y = 8;
    container.addChild(nameText);

    // Level range (next to map name)
    const levelRange = map.recommendedLevel
      ? `Lv.${map.recommendedLevel.min}-${map.recommendedLevel.max}`
      : 'Lv.?';
    const levelText = new Text({
      text: levelRange,
      style: {
        fontSize: 11,
        fill: 0x999999,
        fontFamily: 'Arial',
      },
    });
    levelText.x = nameText.x + nameText.width + 8;
    levelText.y = 10;
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
        text: mobNames.join(', '),
        style: {
          fontSize: 11,
          fill: 0xaaaaaa,
          fontFamily: 'Arial',
        },
      });
      monstersText.x = paddingX;
      monstersText.y = 30;
      container.addChild(monstersText);
    }

    // Current map indicator / move button
    if (isCurrentMap) {
      const currentLabel = new Text({
        text: '현재',
        style: {
          fontSize: 11,
          fill: 0x88ff88,
          fontFamily: 'Arial',
        },
      });
      currentLabel.x = itemWidth - currentLabel.width - paddingX;
      currentLabel.y = 10;
      container.addChild(currentLabel);
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
    this.scrollContainer.y = (GAME_CONFIG.HEIGHT - this.panelHeight) / 2 + 70 - this.scrollY;
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
