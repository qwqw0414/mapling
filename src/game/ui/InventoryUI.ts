import { Container, Graphics, Text } from 'pixi.js';
import { INVENTORY_CONFIG } from '@/constants/config';
import type { InventorySlot } from '@/types/item';

// ============================================================================
// Types
// ============================================================================

type InventoryTab = 'equip' | 'use' | 'etc';

interface InventoryUIOptions {
  width: number;
  height: number;
  onTabChange?: (tab: InventoryTab) => void;
  onSlotClick?: (slotIndex: number, item: InventorySlot | null) => void;
}

interface TabButton {
  container: Container;
  background: Graphics;
  text: Text;
  tab: InventoryTab;
}

// ============================================================================
// InventoryUI Component
// ============================================================================

/**
 * Inventory UI component with tabs for equip/use/etc items
 * Displays items in a scrollable grid with meso counter
 */
export class InventoryUI extends Container {
  private uiWidth: number;
  private uiHeight: number;

  // UI Elements
  private readonly background: Graphics;
  private readonly tabContainer: Container;
  private readonly mesoText: Text;
  private readonly gridContainer: Container;
  private readonly gridMask: Graphics;
  private readonly scrollContainer: Container;

  // State
  private currentTab: InventoryTab = 'equip';
  private currentMeso: number = 0;
  private items: InventorySlot[] = [];
  private slotGraphics: Graphics[] = [];
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private gridColumns: number = 1;

  // Tab buttons
  private tabButtons: TabButton[] = [];

  // Callbacks
  private readonly onTabChangeCallback?: (tab: InventoryTab) => void;
  private readonly onSlotClickCallback?: (slotIndex: number, item: InventorySlot | null) => void;

  constructor(options: InventoryUIOptions) {
    super();

    this.uiWidth = options.width;
    this.uiHeight = options.height;
    this.onTabChangeCallback = options.onTabChange;
    this.onSlotClickCallback = options.onSlotClick;

    // Background
    this.background = new Graphics();
    this.addChild(this.background);

    // Tab container
    this.tabContainer = new Container();
    this.addChild(this.tabContainer);

    // Meso text
    this.mesoText = new Text({
      text: '0',
      style: {
        fontSize: 12,
        fill: INVENTORY_CONFIG.MESO_COLOR,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    this.addChild(this.mesoText);

    // Grid container with mask
    this.gridContainer = new Container();
    this.addChild(this.gridContainer);

    this.gridMask = new Graphics();
    this.gridContainer.mask = this.gridMask;
    this.addChild(this.gridMask);

    // Scroll container (inside grid container)
    this.scrollContainer = new Container();
    this.gridContainer.addChild(this.scrollContainer);

    // Initialize
    this.drawBackground();
    this.createTabs();
    this.updateMesoText();
    this.createGridSlots();
    this.setupScrolling();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Update meso display
   */
  public updateMeso(amount: number): void {
    this.currentMeso = amount;
    this.updateMesoText();
  }

  /**
   * Update items for current tab
   */
  public updateItems(items: InventorySlot[]): void {
    this.items = items;
    this.updateGridContent();
    this.updateScrollBounds();
  }

  /**
   * Set active tab
   */
  public setTab(tab: InventoryTab): void {
    if (this.currentTab === tab) return;

    this.currentTab = tab;
    this.updateTabStyles();
    this.scrollY = 0;
    this.scrollContainer.y = 0;

    if (this.onTabChangeCallback) {
      this.onTabChangeCallback(tab);
    }
  }

  /**
   * Get current tab
   */
  public getTab(): InventoryTab {
    return this.currentTab;
  }

  /**
   * Resize the inventory UI
   */
  public resize(width: number, height: number): void {
    this.uiWidth = width;
    this.uiHeight = height;

    this.drawBackground();
    this.layoutTabs();
    this.updateMesoPosition();
    this.createGridSlots();
    this.updateGridContent();
    this.updateScrollBounds();
  }

  // ============================================================================
  // Private Methods - Background
  // ============================================================================

  private drawBackground(): void {
    this.background.clear();
    this.background.roundRect(0, 0, this.uiWidth, this.uiHeight, 4);
    this.background.fill({ color: INVENTORY_CONFIG.BACKGROUND_COLOR });
    this.background.stroke({ color: INVENTORY_CONFIG.BORDER_COLOR, width: 1 });
  }

  // ============================================================================
  // Private Methods - Tabs
  // ============================================================================

  private createTabs(): void {
    const tabs: Array<{ id: InventoryTab; label: string }> = [
      { id: 'equip', label: '장비' },
      { id: 'use', label: '소비' },
      { id: 'etc', label: '기타' },
    ];

    for (const tabData of tabs) {
      const button = this.createTabButton(tabData.id, tabData.label);
      this.tabButtons.push(button);
      this.tabContainer.addChild(button.container);
    }

    this.layoutTabs();
    this.updateTabStyles();
  }

  private createTabButton(tab: InventoryTab, label: string): TabButton {
    const container = new Container();

    const background = new Graphics();
    container.addChild(background);

    const text = new Text({
      text: label,
      style: {
        fontSize: 11,
        fill: 0xFFFFFF,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5, 0.5);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => this.setTab(tab));

    return { container, background, text, tab };
  }

  private layoutTabs(): void {
    const padding = INVENTORY_CONFIG.TAB_PADDING;
    const tabWidth = Math.floor((this.uiWidth - padding * 2) / 3);
    const tabHeight = INVENTORY_CONFIG.TAB_HEIGHT - padding * 2;

    let x = padding;
    for (const button of this.tabButtons) {
      button.container.x = x;
      button.container.y = padding;

      button.background.clear();
      button.background.roundRect(0, 0, tabWidth - 2, tabHeight, 3);

      button.text.x = (tabWidth - 2) / 2;
      button.text.y = tabHeight / 2;

      x += tabWidth;
    }
  }

  private updateTabStyles(): void {
    for (const button of this.tabButtons) {
      const isActive = button.tab === this.currentTab;
      const color = isActive
        ? INVENTORY_CONFIG.TAB_ACTIVE_COLOR
        : INVENTORY_CONFIG.TAB_INACTIVE_COLOR;

      button.background.clear();
      const tabWidth = Math.floor((this.uiWidth - INVENTORY_CONFIG.TAB_PADDING * 2) / 3);
      const tabHeight = INVENTORY_CONFIG.TAB_HEIGHT - INVENTORY_CONFIG.TAB_PADDING * 2;

      button.background.roundRect(0, 0, tabWidth - 2, tabHeight, 3);
      button.background.fill({ color, alpha: isActive ? 1 : 0.5 });
    }
  }

  // ============================================================================
  // Private Methods - Meso
  // ============================================================================

  private updateMesoText(): void {
    this.mesoText.text = this.formatMeso(this.currentMeso);
    this.updateMesoPosition();
  }

  private updateMesoPosition(): void {
    const padding = INVENTORY_CONFIG.PADDING;
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;
    const slotGap = INVENTORY_CONFIG.SLOT_GAP;

    // Calculate grid position to align meso with grid right edge
    const availableWidth = this.uiWidth - padding * 2;
    const columns = Math.max(1, Math.floor((availableWidth + slotGap) / (slotSize + slotGap)));
    const actualGridWidth = columns * slotSize + (columns - 1) * slotGap;
    const gridStartX = (this.uiWidth - actualGridWidth) / 2;
    const gridEndX = gridStartX + actualGridWidth;

    this.mesoText.anchor.set(1, 1);
    this.mesoText.x = gridEndX;
    this.mesoText.y = this.uiHeight - padding;
  }

  private formatMeso(amount: number): string {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  }

  // ============================================================================
  // Private Methods - Grid
  // ============================================================================

  private createGridSlots(): void {
    // Clear existing slots
    for (const slot of this.slotGraphics) {
      this.scrollContainer.removeChild(slot);
      slot.destroy();
    }
    this.slotGraphics = [];

    const padding = INVENTORY_CONFIG.PADDING;
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;
    const slotGap = INVENTORY_CONFIG.SLOT_GAP;

    // Calculate grid area (reserve space for meso at bottom)
    const mesoAreaHeight = 24;
    const gridY = INVENTORY_CONFIG.TAB_HEIGHT + padding;
    const availableWidth = this.uiWidth - padding * 2;
    const gridHeight = this.uiHeight - gridY - padding - mesoAreaHeight;

    // Dynamically calculate columns to fill width
    const columns = Math.max(1, Math.floor((availableWidth + slotGap) / (slotSize + slotGap)));
    const rows = Math.max(1, Math.floor((gridHeight + slotGap) / (slotSize + slotGap)));

    // Calculate actual grid width and center it
    const actualGridWidth = columns * slotSize + (columns - 1) * slotGap;
    const gridStartX = (this.uiWidth - actualGridWidth) / 2;

    // Minimum slots for scrolling (at least 24 slots)
    const minSlots = 24;
    const visibleSlots = columns * rows;
    const totalSlots = Math.max(minSlots, visibleSlots);

    // Store current columns for scroll calculation
    this.gridColumns = columns;

    // Update mask
    this.gridMask.clear();
    this.gridMask.rect(gridStartX, gridY, actualGridWidth, gridHeight);
    this.gridMask.fill({ color: 0xFFFFFF });

    // Set grid container position
    this.gridContainer.y = 0;
    this.scrollContainer.y = 0;

    // Create slots (centered)
    for (let i = 0; i < totalSlots; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);

      const slot = new Graphics();
      slot.roundRect(0, 0, slotSize, slotSize, 2);
      slot.fill({ color: INVENTORY_CONFIG.SLOT_BACKGROUND_COLOR });
      slot.stroke({ color: INVENTORY_CONFIG.SLOT_BORDER_COLOR, width: 1 });

      slot.x = gridStartX + col * (slotSize + slotGap);
      slot.y = gridY + row * (slotSize + slotGap);

      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.on('pointerdown', () => this.onSlotClick(i));

      this.scrollContainer.addChild(slot);
      this.slotGraphics.push(slot);
    }

    this.updateScrollBounds();
  }

  private updateGridContent(): void {
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;

    for (let i = 0; i < this.slotGraphics.length; i++) {
      const slot = this.slotGraphics[i];
      const item = this.items[i] ?? null;

      // Clear slot content (keep only background)
      while (slot.children.length > 0) {
        slot.removeChildAt(0);
      }

      // Redraw slot background
      slot.clear();
      slot.roundRect(0, 0, slotSize, slotSize, 2);
      slot.fill({ color: INVENTORY_CONFIG.SLOT_BACKGROUND_COLOR });
      slot.stroke({
        color: item ? 0x6688ff : INVENTORY_CONFIG.SLOT_BORDER_COLOR,
        width: 1,
      });

      if (item) {
        // Item name (shortened)
        const nameText = new Text({
          text: item.item.name.substring(0, 4),
          style: {
            fontSize: 9,
            fill: 0xFFFFFF,
            fontFamily: 'Arial',
          },
        });
        nameText.anchor.set(0.5, 0.5);
        nameText.x = slotSize / 2;
        nameText.y = slotSize / 2;
        slot.addChild(nameText);

        // Stack count for use/etc items
        if (item.item.category !== 'equip' && item.quantity > 1) {
          const countText = new Text({
            text: item.quantity.toString(),
            style: {
              fontSize: 9,
              fill: 0xFFFF00,
              fontFamily: 'Arial',
              fontWeight: 'bold',
            },
          });
          countText.anchor.set(1, 1);
          countText.x = slotSize - 2;
          countText.y = slotSize - 2;
          slot.addChild(countText);
        }
      }
    }
  }

  private onSlotClick(index: number): void {
    const item = this.items[index] ?? null;
    if (this.onSlotClickCallback) {
      this.onSlotClickCallback(index, item);
    }
  }

  // ============================================================================
  // Private Methods - Scrolling
  // ============================================================================

  private setupScrolling(): void {
    this.eventMode = 'static';

    this.on('wheel', (event: WheelEvent) => {
      const delta = event.deltaY > 0 ? 20 : -20;
      this.scroll(delta);
    });
  }

  private scroll(delta: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + delta));
    this.scrollContainer.y = -this.scrollY;
  }

  private updateScrollBounds(): void {
    const padding = INVENTORY_CONFIG.PADDING;
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;
    const slotGap = INVENTORY_CONFIG.SLOT_GAP;
    const mesoAreaHeight = 24;

    const gridY = INVENTORY_CONFIG.TAB_HEIGHT + padding;
    const gridHeight = this.uiHeight - gridY - padding - mesoAreaHeight;

    const totalRows = Math.ceil(this.slotGraphics.length / this.gridColumns);
    const contentHeight = totalRows * (slotSize + slotGap);

    this.maxScrollY = Math.max(0, contentHeight - gridHeight);
  }
}
