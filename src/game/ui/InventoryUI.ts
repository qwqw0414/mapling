import { Container, Graphics, Text, Sprite, Texture, FederatedPointerEvent } from 'pixi.js';
import { INVENTORY_CONFIG } from '@/constants/config';
import { AssetManager } from '@/game/systems/AssetManager';
import type { InventorySlot, ItemCategory } from '@/types/item';

// ============================================================================
// Types
// ============================================================================

type InventoryTab = 'equip' | 'use' | 'etc';

interface InventoryUIOptions {
  width: number;
  height: number;
  onTabChange?: (tab: InventoryTab) => void;
  onSlotClick?: (slotIndex: number, item: InventorySlot | null) => void;
  onItemSwap?: (category: ItemCategory, fromIndex: number, toIndex: number) => void;
  onDragOutside?: (slotIndex: number, item: InventorySlot, globalX: number, globalY: number) => void;
  onDoubleClick?: (slotIndex: number, item: InventorySlot) => void;
  onItemDelete?: (slotIndex: number, item: InventorySlot) => void;
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
  private readonly uiWidth: number;
  private readonly uiHeight: number;

  // UI Elements
  private readonly background: Graphics;
  private readonly tabContainer: Container;
  private readonly mesoText: Text;
  private readonly gridContainer: Container;
  private readonly gridMask: Graphics;
  private readonly scrollContainer: Container;
  private readonly trashBin: Container;
  private isOverTrashBin: boolean = false;

  // State
  private currentTab: InventoryTab = 'equip';
  private currentMeso: number = 0;
  private items: (InventorySlot | null)[] = [];
  private slotGraphics: Graphics[] = [];
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private gridColumns: number = 1;

  // Tab buttons
  private tabButtons: TabButton[] = [];

  // Tooltip
  private tooltip: Container | null = null;

  // Drag and Drop
  private isDragging: boolean = false;
  private dragStartIndex: number = -1;
  private dragGhost: Container | null = null;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };

  // Double-click detection
  private lastClickTime: number = 0;
  private lastClickIndex: number = -1;
  private static readonly DOUBLE_CLICK_THRESHOLD_MS = 350;

  // Callbacks
  private readonly onTabChangeCallback?: (tab: InventoryTab) => void;
  private readonly onSlotClickCallback?: (slotIndex: number, item: InventorySlot | null) => void;
  private readonly onItemSwapCallback?: (category: ItemCategory, fromIndex: number, toIndex: number) => void;
  private readonly onDragOutsideCallback?: (slotIndex: number, item: InventorySlot, globalX: number, globalY: number) => void;
  private readonly onDoubleClickCallback?: (slotIndex: number, item: InventorySlot) => void;
  private readonly onItemDeleteCallback?: (slotIndex: number, item: InventorySlot) => void;

  constructor(options: InventoryUIOptions) {
    super();

    this.uiWidth = options.width;
    this.uiHeight = options.height;
    this.onTabChangeCallback = options.onTabChange;
    this.onSlotClickCallback = options.onSlotClick;
    this.onItemSwapCallback = options.onItemSwap;
    this.onDragOutsideCallback = options.onDragOutside;
    this.onDoubleClickCallback = options.onDoubleClick;
    this.onItemDeleteCallback = options.onItemDelete;

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

    // Trash bin
    this.trashBin = new Container();
    this.addChild(this.trashBin);

    // Initialize
    this.drawBackground();
    this.createTabs();
    this.createTrashBin();
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
  public updateItems(items: (InventorySlot | null)[]): void {
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
    text.eventMode = 'none';
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => this.setTab(tab));

    return { container, background, text, tab };
  }

  private layoutTabs(): void {
    const padding = INVENTORY_CONFIG.TAB_PADDING;
    const tabGap = INVENTORY_CONFIG.TAB_GAP;
    const tabCount = this.tabButtons.length;
    const tabHeight = INVENTORY_CONFIG.TAB_HEIGHT - padding * 2;

    const totalAvailable = this.uiWidth - padding * 2;
    const totalGaps = tabGap * (tabCount - 1);

    for (let i = 0; i < tabCount; i++) {
      const button = this.tabButtons[i];

      // Distribute fractional pixels evenly across tabs
      const tabStart = Math.round(i * (totalAvailable - totalGaps) / tabCount);
      const tabEnd = Math.round((i + 1) * (totalAvailable - totalGaps) / tabCount);
      const tabWidth = tabEnd - tabStart;
      const x = padding + tabStart + i * tabGap;

      button.container.x = x;
      button.container.y = padding;

      button.background.clear();
      button.background.roundRect(0, 0, tabWidth, tabHeight, 3);

      button.text.x = tabWidth / 2;
      button.text.y = tabHeight / 2;
    }
  }

  private updateTabStyles(): void {
    const padding = INVENTORY_CONFIG.TAB_PADDING;
    const tabGap = INVENTORY_CONFIG.TAB_GAP;
    const tabCount = this.tabButtons.length;
    const tabHeight = INVENTORY_CONFIG.TAB_HEIGHT - padding * 2;
    const totalAvailable = this.uiWidth - padding * 2;
    const totalGaps = tabGap * (tabCount - 1);

    for (let i = 0; i < tabCount; i++) {
      const button = this.tabButtons[i];
      const isActive = button.tab === this.currentTab;
      const color = isActive
        ? INVENTORY_CONFIG.TAB_ACTIVE_COLOR
        : INVENTORY_CONFIG.TAB_INACTIVE_COLOR;

      const tabStart = Math.round(i * (totalAvailable - totalGaps) / tabCount);
      const tabEnd = Math.round((i + 1) * (totalAvailable - totalGaps) / tabCount);
      const tabWidth = tabEnd - tabStart;

      button.background.clear();
      button.background.roundRect(0, 0, tabWidth, tabHeight, 3);
      button.background.fill({ color, alpha: isActive ? 1 : 0.5 });
    }
  }

  // ============================================================================
  // Private Methods - Trash Bin
  // ============================================================================

  private createTrashBin(): void {
    const size = 24;
    const padding = INVENTORY_CONFIG.PADDING;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, size, size, 3);
    bg.fill({ color: INVENTORY_CONFIG.SLOT_BACKGROUND_COLOR });
    bg.stroke({ color: INVENTORY_CONFIG.SLOT_BORDER_COLOR, width: 1 });
    this.trashBin.addChild(bg);

    // Trash icon (simple trash can shape, scaled down)
    const icon = new Graphics();
    
    // Lid
    icon.rect(5, 5, 14, 1.5);
    icon.fill({ color: 0xAAAAAA });
    
    // Handle
    icon.moveTo(10.5, 5);
    icon.lineTo(10.5, 3.5);
    icon.arc(12, 3.5, 1.5, Math.PI, 0, false);
    icon.lineTo(13.5, 5);
    icon.stroke({ color: 0xAAAAAA, width: 1 });
    
    // Body
    icon.moveTo(6.5, 6.5);
    icon.lineTo(7, 18);
    icon.lineTo(17, 18);
    icon.lineTo(17.5, 6.5);
    icon.closePath();
    icon.fill({ color: 0x666666 });
    icon.stroke({ color: 0xAAAAAA, width: 0.8 });
    
    // Vertical lines inside
    icon.moveTo(9.5, 8);
    icon.lineTo(9.5, 16.5);
    icon.stroke({ color: 0xAAAAAA, width: 0.8 });
    
    icon.moveTo(12, 8);
    icon.lineTo(12, 16.5);
    icon.stroke({ color: 0xAAAAAA, width: 0.8 });
    
    icon.moveTo(14.5, 8);
    icon.lineTo(14.5, 16.5);
    icon.stroke({ color: 0xAAAAAA, width: 0.8 });
    
    icon.eventMode = 'none';
    this.trashBin.addChild(icon);

    // Position at bottom left
    this.trashBin.x = padding;
    this.trashBin.y = this.uiHeight - size - padding;

    // Make trash bin visible but don't need event listeners
    // (we check position manually in updateDropTarget)
    this.trashBin.eventMode = 'none';
  }

  private highlightTrashBin(highlight: boolean): void {
    const bg = this.trashBin.children[0] as Graphics;
    const size = 24;
    
    bg.clear();
    bg.roundRect(0, 0, size, size, 3);
    bg.fill({ 
      color: highlight ? 0xFF6666 : INVENTORY_CONFIG.SLOT_BACKGROUND_COLOR,
      alpha: highlight ? 0.8 : 1
    });
    bg.stroke({ 
      color: highlight ? 0xFF0000 : INVENTORY_CONFIG.SLOT_BORDER_COLOR, 
      width: highlight ? 2 : 1 
    });
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
    return `${Math.floor(amount).toLocaleString()} 메소`;
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
      slot.on('pointerdown', (e: FederatedPointerEvent) => this.onSlotPointerDown(i, e));
      slot.on('pointerup', () => this.onSlotPointerUp(i));
      slot.on('pointerover', (e: FederatedPointerEvent) => this.onSlotPointerOver(i, e));
      slot.on('pointerout', () => this.onSlotPointerOut());
      slot.on('pointermove', (e: FederatedPointerEvent) => this.onSlotPointerMove(e));

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
      slot.stroke({ color: INVENTORY_CONFIG.SLOT_BORDER_COLOR, width: 1 });

      if (item) {
        // Load and display item icon
        this.loadItemIcon(slot, item, slotSize);

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
          countText.eventMode = 'none';
          slot.addChild(countText);
        }
      }
    }
  }

  private async loadItemIcon(slot: Graphics, inventorySlot: InventorySlot, slotSize: number): Promise<void> {
    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', inventorySlot.item.id, 'icon');

    // Check if slot is still valid (might have been cleared during async load)
    if (!slot.parent) return;

    if (iconBlob) {
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      // Check again after image load
      if (!slot.parent) {
        URL.revokeObjectURL(img.src);
        return;
      }

      const texture = Texture.from(img);
      const iconSprite = new Sprite(texture);
      iconSprite.anchor.set(0.5);
      iconSprite.x = slotSize / 2;
      iconSprite.y = slotSize / 2;

      // Scale all icons to consistent size within slot
      const targetSize = slotSize - 6;
      const scale = targetSize / Math.max(iconSprite.width, iconSprite.height);
      iconSprite.scale.set(scale);

      slot.addChildAt(iconSprite, 0);
    } else {
      // Fallback: show item name if icon not found
      const nameText = new Text({
        text: inventorySlot.item.name.substring(0, 4),
        style: {
          fontSize: 9,
          fill: 0xFFFFFF,
          fontFamily: 'Arial',
        },
      });
      nameText.anchor.set(0.5, 0.5);
      nameText.x = slotSize / 2;
      nameText.y = slotSize / 2;
      slot.addChildAt(nameText, 0);
    }
  }

  // ============================================================================
  // Private Methods - Drag and Drop
  // ============================================================================

  private onSlotPointerDown(index: number, e: FederatedPointerEvent): void {
    const item = this.items[index] ?? null;
    if (!item) return;

    this.dragStartIndex = index;
    this.dragStartPos = { x: e.global.x, y: e.global.y };
    this.hideTooltip();

    // Add global event listeners for smooth dragging
    this.on('globalpointermove', this.onGlobalPointerMove, this);
    this.on('pointerup', this.onGlobalPointerUp, this);
    this.on('pointerupoutside', this.onGlobalPointerUp, this);
  }

  private onGlobalPointerMove = (e: FederatedPointerEvent): void => {
    if (this.isDragging) {
      this.updateDragGhost(e.global.x, e.global.y);
      this.updateDropTarget(e.global.x, e.global.y);
    } else if (this.dragStartIndex !== -1) {
      const dx = e.global.x - this.dragStartPos.x;
      const dy = e.global.y - this.dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5) {
        this.startDrag(e.global.x, e.global.y);
      }
    }
  };

  private onGlobalPointerUp = (e: FederatedPointerEvent): void => {
    if (this.isDragging && this.dragStartIndex !== -1) {
      const dragItem = this.items[this.dragStartIndex];
      
      // Check if dropped on trash bin
      if (this.isOverTrashBin && dragItem) {
        if (this.onItemDeleteCallback) {
          this.onItemDeleteCallback(this.dragStartIndex, dragItem);
        }
      } else {
        const dropIndex = this.getSlotIndexAtPosition(e.global.x, e.global.y);
        if (dropIndex !== -1 && dropIndex !== this.dragStartIndex) {
          // Drop inside inventory -> swap
          if (this.onItemSwapCallback) {
            this.onItemSwapCallback(this.currentTab, this.dragStartIndex, dropIndex);
          }
        } else if (dropIndex === -1) {
          // Drop outside inventory -> notify parent for cross-component drop
          if (dragItem && this.onDragOutsideCallback) {
            this.onDragOutsideCallback(this.dragStartIndex, dragItem, e.global.x, e.global.y);
          }
        }
      }
    } else if (!this.isDragging && this.dragStartIndex !== -1) {
      // Regular click or double-click
      const now = Date.now();
      const clickedIndex = this.dragStartIndex;
      const clickedItem = this.items[clickedIndex] ?? null;

      if (
        clickedItem &&
        this.lastClickIndex === clickedIndex &&
        now - this.lastClickTime < InventoryUI.DOUBLE_CLICK_THRESHOLD_MS &&
        this.onDoubleClickCallback
      ) {
        // Double-click detected
        this.onDoubleClickCallback(clickedIndex, clickedItem);
        this.lastClickTime = 0;
        this.lastClickIndex = -1;
      } else {
        // Single click
        if (this.onSlotClickCallback) {
          this.onSlotClickCallback(clickedIndex, clickedItem);
        }
        this.lastClickTime = now;
        this.lastClickIndex = clickedIndex;
      }
    }

    this.onDragEnd();
  };

  private onSlotPointerUp(_index: number): void {
    // Handled by global pointer up
  }

  private onSlotPointerOver(index: number, e: FederatedPointerEvent): void {
    if (this.isDragging) {
      this.highlightSlot(index, true);
    } else if (!this.isDragging && this.dragStartIndex === -1) {
      const item = this.items[index] ?? null;
      if (item) {
        this.showTooltip(item, e.global.x, e.global.y);
      }
    }
  }

  private onSlotPointerOut(): void {
    if (!this.isDragging) {
      this.hideTooltip();
    }
  }

  private onSlotPointerMove(e: FederatedPointerEvent): void {
    if (!this.isDragging && this.dragStartIndex === -1) {
      this.updateTooltipPosition(e.global.x, e.global.y);
    }
  }

  private startDrag(globalX: number, globalY: number): void {
    const item = this.items[this.dragStartIndex];
    if (!item) return;

    this.isDragging = true;
    this.hideTooltip();

    // Create drag ghost
    this.dragGhost = new Container();
    this.dragGhost.alpha = 0.85;

    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;

    // Ghost background
    const bg = new Graphics();
    bg.roundRect(0, 0, slotSize, slotSize, 2);
    bg.fill({ color: 0x2a2a4a, alpha: 0.9 });
    bg.stroke({ color: 0x66CCFF, width: 2 });
    this.dragGhost.addChild(bg);

    // Load and add item icon to ghost
    this.loadDragGhostIcon(item, slotSize);

    this.addChild(this.dragGhost);
    this.updateDragGhost(globalX, globalY);

    // Dim the original slot
    const originalSlot = this.slotGraphics[this.dragStartIndex];
    if (originalSlot) {
      originalSlot.alpha = 0.3;
    }
  }

  private async loadDragGhostIcon(inventorySlot: InventorySlot, slotSize: number): Promise<void> {
    if (!this.dragGhost) return;

    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', inventorySlot.item.id, 'icon');

    if (!this.dragGhost) return; // Check again after async

    if (iconBlob) {
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      if (!this.dragGhost) {
        URL.revokeObjectURL(img.src);
        return;
      }

      const texture = Texture.from(img);
      const iconSprite = new Sprite(texture);
      iconSprite.anchor.set(0.5);
      iconSprite.x = slotSize / 2;
      iconSprite.y = slotSize / 2;

      // Scale all icons to consistent size within ghost
      const targetSize = slotSize - 6;
      const scale = targetSize / Math.max(iconSprite.width, iconSprite.height);
      iconSprite.scale.set(scale);

      this.dragGhost.addChildAt(iconSprite, 1);
    } else {
      // Fallback: show item name
      const nameText = new Text({
        text: inventorySlot.item.name.substring(0, 4),
        style: {
          fontSize: 10,
          fill: 0xFFFFFF,
          fontFamily: 'Arial',
          fontWeight: 'bold',
        },
      });
      nameText.anchor.set(0.5);
      nameText.x = slotSize / 2;
      nameText.y = slotSize / 2;
      this.dragGhost.addChild(nameText);
    }
  }

  private updateDragGhost(globalX: number, globalY: number): void {
    if (!this.dragGhost) return;

    const localPos = this.toLocal({ x: globalX, y: globalY });
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;

    this.dragGhost.x = localPos.x - slotSize / 2;
    this.dragGhost.y = localPos.y - slotSize / 2;
  }

  private updateDropTarget(globalX: number, globalY: number): void {
    // Check if over trash bin
    const localPos = this.toLocal({ x: globalX, y: globalY });
    const trashBinSize = 24;
    const isOverTrash = 
      localPos.x >= this.trashBin.x &&
      localPos.x <= this.trashBin.x + trashBinSize &&
      localPos.y >= this.trashBin.y &&
      localPos.y <= this.trashBin.y + trashBinSize;

    if (isOverTrash !== this.isOverTrashBin) {
      this.isOverTrashBin = isOverTrash;
      this.highlightTrashBin(isOverTrash);
    }

    // Clear all slot highlights first
    for (let i = 0; i < this.slotGraphics.length; i++) {
      this.highlightSlot(i, false);
    }

    // Highlight the slot under cursor (only if not over trash bin)
    if (!this.isOverTrashBin) {
      const targetIndex = this.getSlotIndexAtPosition(globalX, globalY);
      if (targetIndex !== -1 && targetIndex !== this.dragStartIndex) {
        this.highlightSlot(targetIndex, true);
      }
    }
  }

  private getSlotIndexAtPosition(globalX: number, globalY: number): number {
    const localPos = this.scrollContainer.toLocal({ x: globalX, y: globalY });
    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;

    for (let i = 0; i < this.slotGraphics.length; i++) {
      const slot = this.slotGraphics[i];
      const slotX = slot.x;
      const slotY = slot.y;

      if (
        localPos.x >= slotX &&
        localPos.x <= slotX + slotSize &&
        localPos.y >= slotY - this.scrollY &&
        localPos.y <= slotY + slotSize - this.scrollY
      ) {
        return i;
      }
    }

    return -1;
  }

  private onDragEnd(): void {
    // Remove global event listeners
    this.off('globalpointermove', this.onGlobalPointerMove, this);
    this.off('pointerup', this.onGlobalPointerUp, this);
    this.off('pointerupoutside', this.onGlobalPointerUp, this);

    // Restore original slot opacity
    if (this.dragStartIndex !== -1) {
      const originalSlot = this.slotGraphics[this.dragStartIndex];
      if (originalSlot) {
        originalSlot.alpha = 1;
      }
    }

    // Remove ghost
    if (this.dragGhost) {
      this.removeChild(this.dragGhost);
      this.dragGhost.destroy({ children: true });
      this.dragGhost = null;
    }

    // Remove all highlights
    for (let i = 0; i < this.slotGraphics.length; i++) {
      this.highlightSlot(i, false);
    }

    // Reset trash bin highlight
    this.isOverTrashBin = false;
    this.highlightTrashBin(false);

    this.isDragging = false;
    this.dragStartIndex = -1;
  }

  private highlightSlot(index: number, highlight: boolean): void {
    const slot = this.slotGraphics[index];
    if (!slot) return;

    const slotSize = INVENTORY_CONFIG.SLOT_SIZE;

    slot.clear();
    slot.roundRect(0, 0, slotSize, slotSize, 2);
    slot.fill({ color: highlight ? 0x336699 : INVENTORY_CONFIG.SLOT_BACKGROUND_COLOR });
    slot.stroke({
      color: highlight ? 0x66CCFF : INVENTORY_CONFIG.SLOT_BORDER_COLOR,
      width: highlight ? 2 : 1,
    });
  }

  // ============================================================================
  // Private Methods - Tooltip
  // ============================================================================

  private showTooltip(inventorySlot: InventorySlot, globalX: number, globalY: number): void {
    this.hideTooltip();

    const item = inventorySlot.item;
    const tooltip = new Container();
    tooltip.label = 'itemTooltip';

    const padding = 8;
    const lineHeight = 14;
    const lines: Array<{ text: string; color: number; bold?: boolean }> = [];

    // Item name (color by category)
    const nameColor = item.category === 'equip' ? 0x66CCFF :
      item.category === 'use' ? 0x99FF99 : 0xFFCC66;
    lines.push({ text: item.name, color: nameColor, bold: true });

    // Category
    const categoryText = item.category === 'equip' ? '장비' :
      item.category === 'use' ? '소비' : '기타';
    lines.push({ text: `[${categoryText}]`, color: 0xAAAAAA });

    // Description
    if (item.description) {
      lines.push({ text: '', color: 0xFFFFFF }); // spacer
      const descLines = item.description.split('\\n');
      for (const descLine of descLines) {
        lines.push({ text: descLine, color: 0xCCCCCC });
      }
    }

    // Equip stats
    if (item.category === 'equip') {
      lines.push({ text: '', color: 0xFFFFFF }); // spacer
      if (item.attackPower > 0) lines.push({ text: `공격력: +${item.attackPower}`, color: 0xFF9999 });
      if (item.magicPower > 0) lines.push({ text: `마력: +${item.magicPower}`, color: 0x9999FF });
      if (item.defense > 0) lines.push({ text: `방어력: +${item.defense}`, color: 0x99FF99 });

      // Stats
      if (item.stats) {
        if (item.stats.str) lines.push({ text: `STR: +${item.stats.str}`, color: 0xFFAAAA });
        if (item.stats.dex) lines.push({ text: `DEX: +${item.stats.dex}`, color: 0xAAFFAA });
        if (item.stats.int) lines.push({ text: `INT: +${item.stats.int}`, color: 0xAAAAFF });
        if (item.stats.luk) lines.push({ text: `LUK: +${item.stats.luk}`, color: 0xFFFFAA });
      }

      // Upgrade slots
      if (item.upgradeSlots > 0) {
        lines.push({ text: `업그레이드 가능 횟수: ${item.upgradeSlots - item.usedSlots}`, color: 0xFFFF00 });
      }

      // Required level
      if (item.requiredLevel > 0) {
        lines.push({ text: `REQ LEV: ${item.requiredLevel}`, color: 0xFF6666 });
      }
    }

    // Use item effects
    if (item.category === 'use') {
      lines.push({ text: '', color: 0xFFFFFF }); // spacer
      const effect = item.effect;
      if (effect.type === 'heal_hp') {
        lines.push({ text: `HP +${effect.value} 회복`, color: 0xFF9999 });
      } else if (effect.type === 'heal_mp') {
        lines.push({ text: `MP +${effect.value} 회복`, color: 0x9999FF });
      } else if (effect.type === 'heal_both') {
        lines.push({ text: `HP/MP +${effect.value} 회복`, color: 0xFF99FF });
      } else if (effect.type === 'buff') {
        lines.push({ text: `버프 효과: +${effect.value}`, color: 0xFFFF99 });
        if (effect.duration) {
          lines.push({ text: `지속시간: ${effect.duration / 1000}초`, color: 0xAAAAAA });
        }
      }

      // Stack info
      lines.push({ text: `최대 중첩: ${item.maxStack}개`, color: 0xAAAAAA });
    }

    // Etc item stack info
    if (item.category === 'etc') {
      lines.push({ text: '', color: 0xFFFFFF }); // spacer
      lines.push({ text: `최대 중첩: ${item.maxStack}개`, color: 0xAAAAAA });
    }

    // Quantity
    if (inventorySlot.quantity > 1) {
      lines.push({ text: `보유 수량: ${inventorySlot.quantity}개`, color: 0xFFFFFF });
    }

    // Sell price
    if (item.sellPrice > 0) {
      lines.push({ text: `판매가: ${item.sellPrice} 메소`, color: 0xFFD700 });
    }

    // Calculate tooltip size
    let maxWidth = 0;
    const textObjects: Text[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const textObj = new Text({
        text: line.text,
        style: {
          fontSize: 11,
          fill: line.color,
          fontFamily: 'Arial',
          fontWeight: line.bold ? 'bold' : 'normal',
        },
      });
      textObj.x = padding;
      textObj.y = padding + i * lineHeight;
      textObjects.push(textObj);
      maxWidth = Math.max(maxWidth, textObj.width);
    }

    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, tooltipWidth, tooltipHeight, 4);
    bg.fill({ color: 0x1a1a2e, alpha: 0.95 });
    bg.stroke({ color: 0x4488ff, width: 1 });
    tooltip.addChild(bg);

    // Add text objects
    for (const textObj of textObjects) {
      tooltip.addChild(textObj);
    }

    // Position tooltip
    this.tooltip = tooltip;
    this.addChild(tooltip);
    this.updateTooltipPosition(globalX, globalY);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.removeChild(this.tooltip);
      this.tooltip.destroy({ children: true });
      this.tooltip = null;
    }
  }

  private updateTooltipPosition(globalX: number, globalY: number): void {
    if (!this.tooltip) return;

    // Convert global position to local
    const localPos = this.toLocal({ x: globalX, y: globalY });

    // Offset from cursor
    const offsetX = 10;
    const offsetY = 5;

    const tooltipWidth = this.tooltip.width;
    const tooltipHeight = this.tooltip.height;

    // Default: show tooltip to the left of cursor (since inventory is on the right side)
    let tooltipX = localPos.x - tooltipWidth - offsetX;
    let tooltipY = localPos.y - offsetY;

    // If tooltip would go too far left (beyond inventory left edge), show on right
    if (tooltipX < -tooltipWidth) {
      tooltipX = localPos.x + offsetX;
    }

    // Keep tooltip vertically within reasonable bounds
    if (tooltipY + tooltipHeight > this.uiHeight) {
      tooltipY = this.uiHeight - tooltipHeight;
    }
    if (tooltipY < 0) {
      tooltipY = 0;
    }

    this.tooltip.x = tooltipX;
    this.tooltip.y = tooltipY;
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

  // ============================================================================
  // Cleanup
  // ============================================================================

  public override destroy(): void {
    this.removeAllListeners();
    this.hideTooltip();

    if (this.dragGhost) {
      this.removeChild(this.dragGhost);
      this.dragGhost.destroy({ children: true });
      this.dragGhost = null;
    }

    super.destroy({ children: true });
  }
}
