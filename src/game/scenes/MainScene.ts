import { Container, Graphics, Text } from 'pixi.js';
import { GifSource } from 'pixi.js/gif';
import { BaseScene } from './BaseScene';
import {
  MAP_CONFIG,
  GAME_CONFIG,
  LAYOUT_CONFIG,
} from '@/constants/config';
import { getMapById } from '@/data/maps';
import { getMobById } from '@/data/mobs';
import { getItemById, convertItemDataToItem } from '@/data/items';
import { AudioManager } from '@/game/systems/AudioManager';
import { AssetManager } from '@/game/systems/AssetManager';
import { MonsterSystem, MOB_ANIMATIONS } from '@/game/systems/MonsterSystem';
import { DamageSystem } from '@/game/systems/DamageSystem';
import { DropSystem } from '@/game/systems/DropSystem';
import { LogSystem } from '@/game/systems/LogSystem';
import { FieldView } from '@/game/systems/FieldView';
import { AutoCombatSystem } from '@/game/systems/AutoCombatSystem';
import { PartySlot } from '@/game/ui/PartySlot';
import { CharacterCreationUI } from '@/game/ui/CharacterCreationUI';
import { MapSelectionUI } from '@/game/ui/MapSelectionUI';
import { InventoryUI } from '@/game/ui/InventoryUI';
import { useCharacterStore } from '@/stores/characterStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import {
  createLookWithChoices,
  CORE_ANIMATIONS,
  getIdleAnimation,
  getRandomAttackAnimation,
  getWeaponPreloadAnimations,
} from '@/data/characterLook';
import type { MapInfo } from '@/types/map';
import type { PartyCharacter } from '@/types/party';
import type { Stats } from '@/types/character';
import type { ItemCategory, EquipItem, Equipment, EquipSlot } from '@/types/item';

// ============================================================================
// Equipment Stat Calculation
// ============================================================================

const BASE_WEAPON_ATTACK = 15;
const BASE_MAGIC_ATTACK = 15;

/**
 * Recalculate character stats from all equipped items
 * Updates weaponAttack, magicAttack, and bonus stats on the character
 */
function applyEquipmentStats(character: PartyCharacter): void {
  let totalAttackPower = 0;
  let totalMagicPower = 0;

  const equipment = character.equipment;
  const slots = Object.keys(equipment) as EquipSlot[];

  for (const slot of slots) {
    const item = equipment[slot];
    if (!item) continue;

    totalAttackPower += item.attackPower;
    totalMagicPower += item.magicPower;
  }

  character.weaponAttack = BASE_WEAPON_ATTACK + totalAttackPower;
  character.magicAttack = BASE_MAGIC_ATTACK + totalMagicPower;
}

/**
 * Get the equipped weapon item ID (null if no weapon)
 */
function getWeaponId(character: PartyCharacter): number | null {
  return character.equipment.weapon?.id ?? null;
}

/**
 * Check if a character has a weapon equipped
 */
function hasWeapon(character: PartyCharacter): boolean {
  return character.equipment.weapon !== null;
}

/**
 * Sync character.look.equipItemIds from current equipment state
 * Called after equip/unequip to update visual appearance
 */
function syncLookFromEquipment(character: PartyCharacter): void {
  const equipIds: number[] = [];
  const equipment = character.equipment;
  const slots = Object.keys(equipment) as EquipSlot[];

  for (const slot of slots) {
    const item = equipment[slot];
    if (item) {
      equipIds.push(item.id);
    }
  }

  character.look = {
    ...character.look,
    equipItemIds: equipIds,
  };
}

// ============================================================================
// Beginner Starter Equipment
// ============================================================================

function createStarterEquipItem(
  id: number, name: string, slot: EquipSlot,
  defense: number = 0, attackPower: number = 0,
): EquipItem {
  return {
    id, name, description: '초보자용 기본 장비',
    category: 'equip',
    iconUrl: `https://maplestory.io/api/gms/62/item/${id}/icon`,
    sellPrice: 1, slot, grade: 'common',
    requiredLevel: 0, requiredJob: [],
    stats: {}, combatStats: {},
    attackPower, magicPower: 0, defense,
    upgradeSlots: 7, usedSlots: 0,
  };
}

const BEGINNER_EQUIPMENT: Partial<Record<EquipSlot, EquipItem>> = {
  top: createStarterEquipItem(1040002, '흰색 런닝셔츠', 'top', 2),
  bottom: createStarterEquipItem(1060002, '파란 청 반바지', 'bottom', 1),
  shoes: createStarterEquipItem(1072005, '파란 운동화', 'shoes', 1),
  weapon: createStarterEquipItem(1402001, '목검', 'weapon', 0, 17),
};

function createBeginnerEquipment(): Equipment {
  return {
    weapon: BEGINNER_EQUIPMENT.weapon ?? null,
    hat: null,
    top: BEGINNER_EQUIPMENT.top ?? null,
    bottom: BEGINNER_EQUIPMENT.bottom ?? null,
    overall: null,
    shoes: BEGINNER_EQUIPMENT.shoes ?? null,
    gloves: null,
    cape: null,
    accessory: null,
    shield: null,
  };
}

// ============================================================================
// Types
// ============================================================================

interface LayoutDimensions {
  /** 좌측 패널 - 사냥터 필드 (70%) */
  leftPanel: { x: number; y: number; width: number; height: number };
  /** 우측 패널 전체 (30%) */
  rightPanel: { x: number; y: number; width: number; height: number };
  /** 우측 상단 - 인벤토리 */
  inventory: { x: number; y: number; width: number; height: number };
  /** 우측 하단 - 파티 슬롯 (2x2) */
  partySlots: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Main Scene
// ============================================================================

export class MainScene extends BaseScene {
  private mapInfo: MapInfo | null = null;
  private mobGifSources: Map<string, GifSource> = new Map();
  private mobSounds: Map<string, HTMLAudioElement> = new Map();
  private itemPickupSound: HTMLAudioElement | null = null;

  // Blob URL tracking for cleanup
  private blobUrls: string[] = [];

  // Layout containers
  private leftPanel!: Container;
  private rightPanel!: Container;
  private fieldLayer!: Container;
  private inventoryContainer!: Container;
  private partySlotsContainer!: Container;

  // Layout dimensions
  private layout!: LayoutDimensions;

  // Systems
  private monsterSystem!: MonsterSystem;
  private damageSystem!: DamageSystem;
  private dropSystem!: DropSystem;
  private logSystem!: LogSystem;
  private fieldView!: FieldView;
  private autoCombatSystem!: AutoCombatSystem;

  // Map transition state
  private isChangingMap = false;

  // Animation tracking
  private isDividerAnimating = false;

  // UI elements
  private mapTitleText: Text | null = null;
  private partySlots: PartySlot[] = [];
  private createCharacterButton: Container | null = null;
  private characterCreationUI: CharacterCreationUI | null = null;
  private mapSelectionUI: MapSelectionUI | null = null;
  private inventoryUI: InventoryUI | null = null;
  private addCharacterButton: Container | null = null;

  // Party data
  private partyCharacters: Array<PartyCharacter | null> = [];

  constructor(mapId: number = 104010001) {
    super();
    this.mapInfo = getMapById(mapId) ?? null;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  protected async load(): Promise<void> {
    if (!this.mapInfo) {
      console.error('[MainScene] Map not found');
      return;
    }
    console.log('[MainScene] Loading map:', this.mapInfo.name);

    await this.loadMapAssets();

    if (this.mapInfo.bgm) {
      const audioManager = AudioManager.getInstance();
      audioManager.init();
      audioManager.playBgm(this.mapInfo.bgm);
    }
  }

  protected create(): void {
    this.calculateLayout();
    this.createLayers();
    this.initializeSystems();
    this.createMapButton();
    this.createRightPanel();
    this.createVerticalDivider();
    this.monsterSystem.spawnInitialMonsters();

    console.log('[MainScene] Created with layout:', this.layout);
  }

  update(deltaTime: number): void {
    if (!this.isInitialized || this.isChangingMap) return;

    this.monsterSystem.updateSpawnTimer(deltaTime);
    this.monsterSystem.updateMonsters(deltaTime);
    this.logSystem.updateLogEntries();

    // Auto-combat: each character attacks on their own timer
    const activeParty = this.getActivePartyMembers();
    this.autoCombatSystem.update(activeParty, Date.now());
  }

  // ============================================================================
  // Layout Calculation
  // ============================================================================

  private calculateLayout(): void {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const leftWidth = Math.floor(width * LAYOUT_CONFIG.LEFT_PANEL.WIDTH_RATIO);
    const rightWidth = width - leftWidth;

    const inventoryHeight = Math.floor(height * LAYOUT_CONFIG.RIGHT_PANEL.INVENTORY_HEIGHT_RATIO);
    const partyHeight = height - inventoryHeight;

    this.layout = {
      leftPanel: { x: 0, y: 0, width: leftWidth, height: height },
      rightPanel: { x: leftWidth, y: 0, width: rightWidth, height: height },
      inventory: { x: 0, y: 0, width: rightWidth, height: inventoryHeight },
      partySlots: { x: 0, y: inventoryHeight, width: rightWidth, height: partyHeight },
    };
  }

  // ============================================================================
  // Layer Creation
  // ============================================================================

  private createLayers(): void {
    // 좌측 패널 (사냥터 필드)
    this.leftPanel = new Container();
    this.leftPanel.x = this.layout.leftPanel.x;
    this.leftPanel.y = this.layout.leftPanel.y;
    this.container.addChild(this.leftPanel);

    // 필드 레이어 (leftPanel 내부)
    this.fieldLayer = new Container();
    this.leftPanel.addChild(this.fieldLayer);

    // 우측 패널 (인벤토리 + 파티)
    this.rightPanel = new Container();
    this.rightPanel.x = this.layout.rightPanel.x;
    this.rightPanel.y = this.layout.rightPanel.y;
    this.container.addChild(this.rightPanel);

    // 우측 패널 배경
    const rightBg = new Graphics();
    rightBg.label = 'rightPanelBg';
    rightBg.rect(0, 0, this.layout.rightPanel.width, this.layout.rightPanel.height);
    rightBg.fill({ color: 0x111111 });
    rightBg.stroke({ color: 0x333333, width: 1 });
    this.rightPanel.addChild(rightBg);

    // 인벤토리 컨테이너 (우측 상단)
    this.inventoryContainer = new Container();
    this.inventoryContainer.x = this.layout.inventory.x;
    this.inventoryContainer.y = this.layout.inventory.y;
    this.rightPanel.addChild(this.inventoryContainer);

    // 파티 슬롯 컨테이너 (우측 하단)
    this.partySlotsContainer = new Container();
    this.partySlotsContainer.x = this.layout.partySlots.x;
    this.partySlotsContainer.y = this.layout.partySlots.y;
    this.rightPanel.addChild(this.partySlotsContainer);
  }

  // ============================================================================
  // System Initialization
  // ============================================================================

  private initializeSystems(): void {
    const fieldWidth = this.layout.leftPanel.width;
    const fieldHeight = this.layout.leftPanel.height;

    this.monsterSystem = new MonsterSystem(
      this.fieldLayer,
      fieldWidth,
      fieldHeight
    );
    this.monsterSystem.setMap(this.mapInfo);
    this.monsterSystem.setMobAssets(this.mobGifSources);

    this.damageSystem = new DamageSystem(this.fieldLayer);
    this.damageSystem.setMobSounds(this.mobSounds);

    this.dropSystem = new DropSystem(
      this.fieldLayer,
      this.rightPanel,
      fieldWidth,
      fieldHeight
    );
    this.dropSystem.setItemPickupSound(this.itemPickupSound);
    this.dropSystem.setCallbacks({
      onMesoGain: (amount) => this.onMesoGain(amount),
      onItemDrop: (itemName) => this.logSystem.logItemDrop(itemName),
      onItemPickup: (itemId, quantity) => this.onItemPickup(itemId, quantity),
      onDividerEffect: () => this.playDividerEffect(),
    });

    // 로그 시스템 - 필드 레이어 위에 오버레이
    this.logSystem = new LogSystem(this.fieldLayer, fieldWidth);

    this.fieldView = new FieldView(
      this.fieldLayer,
      fieldWidth,
      fieldHeight
    );

    // Auto-combat system (replaces click-based attack)
    this.autoCombatSystem = new AutoCombatSystem({
      getAliveMonsters: () => this.monsterSystem.getAllMonsters(),
      getMobData: (mobId) => getMobById(mobId) ?? null,
      onAttack: (event) => this.handleAutoAttack(event),
      onMonsterDeath: (event) => this.handleMonsterDeath(event),
      onLevelUp: (result) => this.handleLevelUp(result),
    });
  }

  // ============================================================================
  // Map Button (필드 좌측 상단 오버레이)
  // ============================================================================

  private createMapButton(): void {
    if (!this.mapInfo) return;

    const padding = LAYOUT_CONFIG.MAP_BUTTON.PADDING;

    this.mapTitleText = new Text({
      text: `${this.mapInfo.name} ▼`,
      style: {
        fontSize: 16,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    this.mapTitleText.x = padding;
    this.mapTitleText.y = padding;
    this.mapTitleText.eventMode = 'static';
    this.mapTitleText.cursor = 'pointer';
    this.mapTitleText.on('pointerdown', () => this.openMapSelection());
    this.fieldLayer.addChild(this.mapTitleText);
  }

  // ============================================================================
  // Right Panel (인벤토리 + 파티 슬롯)
  // ============================================================================

  private createRightPanel(): void {
    this.renderPartySlots();
    this.createInventoryUI();
  }

  private renderPartySlots(): void {
    this.clearPartySlots();

    const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;
    const slotGap = LAYOUT_CONFIG.PARTY_AREA.SLOT_GAP;
    const columns = LAYOUT_CONFIG.PARTY_AREA.GRID_COLUMNS;
    const availableWidth = this.layout.partySlots.width - padding * 2;
    const availableHeight = this.layout.partySlots.height - padding * 2;

    const slotWidth = Math.floor((availableWidth - slotGap * (columns - 1)) / columns);
    const slotHeight = Math.floor((availableHeight - slotGap) / 2);

    if (this.partyCharacters.length === 0) {
      this.createCharacterButton = this.createAddCharacterButton(slotWidth, slotHeight, true);
      this.createCharacterButton.x = padding + (availableWidth - slotWidth) / 2;
      this.createCharacterButton.y = padding + (availableHeight - slotHeight) / 2;
      this.partySlotsContainer.addChild(this.createCharacterButton);
    } else {
      for (let i = 0; i < this.partyCharacters.length; i++) {
        const character = this.partyCharacters[i];
        const slot = this.createPartySlot(i, slotWidth, slotHeight);

        if (character) {
          slot.setCharacter(character);
        }

        const col = i % columns;
        const row = Math.floor(i / columns);
        slot.x = padding + col * (slotWidth + slotGap);
        slot.y = padding + row * (slotHeight + slotGap);

        this.partySlotsContainer.addChild(slot);
        this.partySlots.push(slot);
      }

      this.updateAddCharacterButton(slotWidth, slotHeight);
    }
  }

  private updateAddCharacterButton(slotWidth?: number, slotHeight?: number): void {
    if (this.addCharacterButton && this.addCharacterButton.parent) {
      this.addCharacterButton.parent.removeChild(this.addCharacterButton);
      this.addCharacterButton.destroy();
      this.addCharacterButton = null;
    }

    const maxSlots = LAYOUT_CONFIG.PARTY_AREA.MAX_SLOTS;
    if (this.partyCharacters.length > 0 && this.partyCharacters.length < maxSlots) {
      const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;
      const slotGap = LAYOUT_CONFIG.PARTY_AREA.SLOT_GAP;
      const columns = LAYOUT_CONFIG.PARTY_AREA.GRID_COLUMNS;
      const availableWidth = this.layout.partySlots.width - padding * 2;
      const availableHeight = this.layout.partySlots.height - padding * 2;

      const sw = slotWidth ?? Math.floor((availableWidth - slotGap * (columns - 1)) / columns);
      const sh = slotHeight ?? Math.floor((availableHeight - slotGap) / 2);

      const nextIndex = this.partyCharacters.length;
      const col = nextIndex % columns;
      const row = Math.floor(nextIndex / columns);

      this.addCharacterButton = this.createAddCharacterButton(sw, sh, false);
      this.addCharacterButton.x = padding + col * (sw + slotGap);
      this.addCharacterButton.y = padding + row * (sh + slotGap);
      this.partySlotsContainer.addChild(this.addCharacterButton);
    }
  }

  private clearPartySlots(): void {
    for (const slot of this.partySlots) {
      if (slot.parent) {
        slot.parent.removeChild(slot);
      }
      slot.destroy();
    }
    this.partySlots = [];

    if (this.createCharacterButton && this.createCharacterButton.parent) {
      this.createCharacterButton.parent.removeChild(this.createCharacterButton);
      this.createCharacterButton.destroy();
      this.createCharacterButton = null;
    }
  }

  private createAddCharacterButton(width: number, height: number, isInitial: boolean = false): Container {
    const button = new Container();
    button.label = 'addCharacterButton';

    const background = new Graphics();
    background.roundRect(0, 0, width, height, 8);
    background.fill({ color: 0x1a1a1a });
    background.stroke({ color: 0x4488ff, width: 2, alpha: 0.6 });
    button.addChild(background);

    const plusSize = 40;
    const plusGraphics = new Graphics();
    plusGraphics.rect(width / 2 - plusSize / 2, height / 2 - 2, plusSize, 4);
    plusGraphics.fill({ color: 0x4488ff });
    plusGraphics.rect(width / 2 - 2, height / 2 - plusSize / 2, 4, plusSize);
    plusGraphics.fill({ color: 0x4488ff });
    button.addChild(plusGraphics);

    const labelText = isInitial ? '캐릭터 생성' : '캐릭터 추가';
    const label = new Text({
      text: labelText,
      style: { fontSize: 13, fill: 0x4488ff, fontFamily: 'Arial', fontWeight: 'bold' },
    });
    label.anchor.set(0.5, 0);
    label.x = width / 2;
    label.y = height / 2 + plusSize / 2 + 8;
    button.addChild(label);

    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', () => this.onAddCharacterClick());

    button.on('pointerover', () => {
      background.clear();
      background.roundRect(0, 0, width, height, 8);
      background.fill({ color: 0x2a2a2a });
      background.stroke({ color: 0x5599ff, width: 2 });
    });

    button.on('pointerout', () => {
      background.clear();
      background.roundRect(0, 0, width, height, 8);
      background.fill({ color: 0x1a1a1a });
      background.stroke({ color: 0x4488ff, width: 2, alpha: 0.6 });
    });

    return button;
  }

  private onAddCharacterClick(): void {
    console.log('[MainScene] Add character clicked');
    this.showCharacterCreationUI();
  }

  private createVerticalDivider(): void {
    const dividerX = this.layout.leftPanel.width;
    const padding = 20;

    const divider = new Graphics();
    divider.label = 'verticalDivider';
    divider.moveTo(dividerX, padding);
    divider.lineTo(dividerX, MAP_CONFIG.HEIGHT - padding);
    divider.stroke({ color: 0x4488ff, width: 2 });

    const glowLine = new Graphics();
    glowLine.label = 'verticalDividerGlow';
    glowLine.moveTo(dividerX, padding);
    glowLine.lineTo(dividerX, MAP_CONFIG.HEIGHT - padding);
    glowLine.stroke({ color: 0x4488ff, width: 6, alpha: 0.2 });

    this.container.addChild(glowLine);
    this.container.addChild(divider);

    divider.alpha = 0.3;
    glowLine.alpha = 0.15;
  }

  private createPartySlot(index: number, width: number, height: number): PartySlot {
    return new PartySlot({
      width,
      height,
      slotIndex: index,
      character: null,
      onClick: (slotIndex: number) => this.onSlotClick(slotIndex),
      onToggleMode: (slotIndex: number) => this.handleToggleMode(slotIndex),
      onUnequipItem: (slotIndex, equipSlot, item) => this.handleUnequipItem(slotIndex, equipSlot, item),
    });
  }

  private onSlotClick(slotIndex: number): void {
    const character = this.partyCharacters[slotIndex];
    if (character) {
      console.log(`[MainScene] Character slot ${slotIndex} clicked: [name]=[${character.name}]`);
    } else {
      console.log(`[MainScene] Empty slot ${slotIndex} clicked`);
    }
  }

  // ============================================================================
  // Meso & Item Callbacks
  // ============================================================================

  private onMesoGain(amount: number): void {
    const store = useCharacterStore.getState();
    store.addMeso(amount);

    // Update inventory UI with current total
    this.updateInventoryMeso(store.meso);
    this.logSystem.logMesoGain(amount);
  }

  private onItemPickup(itemId: number, quantity: number): void {
    const itemData = getItemById(itemId);
    if (!itemData) {
      console.warn(`[MainScene] Item not found: [itemId]=[${itemId}]`);
      return;
    }

    const item = convertItemDataToItem(itemData);
    const inventoryStore = useInventoryStore.getState();
    const isAdded = inventoryStore.addItem(item, quantity);

    if (isAdded) {
      console.log(`[MainScene] Item added to inventory: [name]=[${item.name}] [quantity]=[${quantity}]`);
      this.refreshInventory();
    } else {
      this.logSystem.logWarning('인벤토리가 가득 찼습니다!');
    }
  }

  // ============================================================================
  // Inventory UI
  // ============================================================================

  private createInventoryUI(): void {
    const padding = LAYOUT_CONFIG.RIGHT_PANEL.PADDING;

    this.inventoryUI = new InventoryUI({
      width: this.layout.inventory.width - padding * 2,
      height: this.layout.inventory.height - padding * 2,
      onTabChange: (tab) => this.onInventoryTabChange(tab),
      onSlotClick: (index, item) => this.onInventorySlotClick(index, item),
      onItemSwap: (category, fromIndex, toIndex) => this.onInventoryItemSwap(category, fromIndex, toIndex),
      onDragOutside: (slotIndex, item, globalX, globalY) => this.handleInventoryDragOutside(slotIndex, item, globalX, globalY),
      onDoubleClick: (slotIndex, item) => this.handleInventoryDoubleClick(slotIndex, item),
    });

    this.inventoryUI.x = padding;
    this.inventoryUI.y = padding;
    this.inventoryContainer.addChild(this.inventoryUI);

    // Initialize with current meso
    const meso = useCharacterStore.getState().meso;
    this.inventoryUI.updateMeso(meso);

    // Load initial items for equip tab
    this.loadInventoryItems('equip');
  }

  private onInventoryTabChange(tab: 'equip' | 'use' | 'etc'): void {
    console.log(`[MainScene] Inventory tab changed: [tab]=[${tab}]`);
    this.loadInventoryItems(tab);
  }

  private loadInventoryItems(category: ItemCategory): void {
    if (!this.inventoryUI) return;

    const inventoryStore = useInventoryStore.getState();

    const inventoryMap = {
      equip: inventoryStore.equipInventory,
      use: inventoryStore.useInventory,
      etc: inventoryStore.etcInventory,
    };

    const items = inventoryMap[category] ?? [];
    this.inventoryUI.updateItems(items);
  }

  private onInventorySlotClick(index: number, item: unknown): void {
    if (item) {
      console.log(`[MainScene] Inventory slot ${index} clicked with item`);
    } else {
      console.log(`[MainScene] Empty inventory slot ${index} clicked`);
    }
  }

  private onInventoryItemSwap(category: 'equip' | 'use' | 'etc', fromIndex: number, toIndex: number): void {
    const inventoryStore = useInventoryStore.getState();
    inventoryStore.swapItems(category, fromIndex, toIndex);
    this.refreshInventory();
    console.log(`[MainScene] Item swapped: [category]=[${category}] [from]=[${fromIndex}] [to]=[${toIndex}]`);
  }

  public updateInventoryMeso(amount: number): void {
    if (this.inventoryUI) {
      this.inventoryUI.updateMeso(amount);
    }
  }

  public refreshInventory(): void {
    if (this.inventoryUI) {
      const currentTab = this.inventoryUI.getTab();
      this.loadInventoryItems(currentTab);
    }
  }

  // ============================================================================
  // Equipment Handlers (장착/해제)
  // ============================================================================

  /**
   * Handle unequip: equipment slot clicked -> move item to inventory
   */
  private handleUnequipItem(slotIndex: number, equipSlot: EquipSlot, item: EquipItem): void {
    const character = this.partyCharacters[slotIndex];
    if (!character) return;

    // Add item to inventory
    const inventoryStore = useInventoryStore.getState();
    const isAdded = inventoryStore.addItem(item);
    if (!isAdded) {
      console.log('[MainScene] Inventory full, cannot unequip');
      return;
    }

    // Remove from character equipment
    character.equipment[equipSlot] = null;

    // Recalculate stats and sync visual appearance
    applyEquipmentStats(character);
    syncLookFromEquipment(character);

    // Refresh UIs
    const slot = this.partySlots[slotIndex];
    if (slot) {
      slot.setCharacter(character);
      this.loadCharacterSprite(character);
    }
    this.refreshInventory();

    console.log(`[MainScene] Unequipped: [slot]=[${equipSlot}] [item]=[${item.name}] [character]=[${character.name}] [weaponAttack]=[${character.weaponAttack}] [magicAttack]=[${character.magicAttack}]`);
  }

  /**
   * Handle equip: inventory item dragged to equipment slot
   */
  private handleEquipItem(slotIndex: number, equipSlot: EquipSlot, _inventoryIndex: number, item: EquipItem): void {
    const character = this.partyCharacters[slotIndex];
    if (!character) return;

    // Validate slot type
    if (item.slot !== equipSlot) {
      console.log(`[MainScene] Slot mismatch: [itemSlot]=[${item.slot}] [targetSlot]=[${equipSlot}]`);
      return;
    }

    // If there's already an item in this slot, move it back to inventory first
    const existingItem = character.equipment[equipSlot];
    if (existingItem) {
      const inventoryStore = useInventoryStore.getState();
      const isAdded = inventoryStore.addItem(existingItem);
      if (!isAdded) {
        console.log('[MainScene] Inventory full, cannot swap equipment');
        return;
      }
    }

    // Remove from inventory
    const inventoryStore = useInventoryStore.getState();
    inventoryStore.removeItem(item.id);

    // Equip to character
    character.equipment[equipSlot] = item;

    // Recalculate stats and sync visual appearance
    applyEquipmentStats(character);
    syncLookFromEquipment(character);

    // Refresh UIs
    const slot = this.partySlots[slotIndex];
    if (slot) {
      slot.setCharacter(character);
      this.loadCharacterSprite(character);
    }
    this.refreshInventory();

    console.log(`[MainScene] Equipped: [slot]=[${equipSlot}] [item]=[${item.name}] [character]=[${character.name}] [weaponAttack]=[${character.weaponAttack}] [magicAttack]=[${character.magicAttack}]`);
  }

  /**
   * Handle inventory drag dropped outside inventory bounds
   * Check if it was dropped over a PartySlot equipment view
   */
  private handleInventoryDragOutside(
    inventoryIndex: number,
    inventorySlot: import('@/types/item').InventorySlot,
    globalX: number,
    globalY: number,
  ): void {
    // Only equip items can be equipped
    if (inventorySlot.item.category !== 'equip') return;

    const equipItem = inventorySlot.item as EquipItem;

    // Check each party slot's equipment view for drop target
    for (let i = 0; i < this.partySlots.length; i++) {
      const partySlot = this.partySlots[i];
      const targetEquipSlot = partySlot.getEquipSlotAtGlobal(globalX, globalY);

      if (targetEquipSlot) {
        this.handleEquipItem(i, targetEquipSlot, inventoryIndex, equipItem);
        return;
      }
    }

    console.log('[MainScene] Inventory drag dropped outside - no valid equipment target');
  }

  /**
   * Handle inventory double-click: auto-equip to active equip view character
   * Finds a character whose equip view is open and equips to the matching slot
   */
  private handleInventoryDoubleClick(
    _slotIndex: number,
    inventorySlot: import('@/types/item').InventorySlot,
  ): void {
    if (inventorySlot.item.category !== 'equip') return;

    const equipItem = inventorySlot.item as EquipItem;
    const targetSlot = equipItem.slot;

    // Find a character whose equip view is currently open
    for (let i = 0; i < this.partySlots.length; i++) {
      const partySlot = this.partySlots[i];
      if (partySlot.getCurrentView() === 'equip' && this.partyCharacters[i]) {
        this.handleEquipItem(i, targetSlot, _slotIndex, equipItem);
        return;
      }
    }

    // Fallback: equip to first available character
    for (let i = 0; i < this.partyCharacters.length; i++) {
      if (this.partyCharacters[i]) {
        this.handleEquipItem(i, targetSlot, _slotIndex, equipItem);
        return;
      }
    }

    console.log('[MainScene] No character available for equipping');
  }

  // ============================================================================
  // Character Creation UI
  // ============================================================================

  private showCharacterCreationUI(): void {
    const maxSlots = LAYOUT_CONFIG.PARTY_AREA.MAX_SLOTS;
    if (this.partyCharacters.length >= maxSlots) {
      console.log('[MainScene] Party is full');
      return;
    }

    if (this.characterCreationUI) {
      this.container.removeChild(this.characterCreationUI);
      this.characterCreationUI.destroy();
      this.characterCreationUI = null;
    }

    this.characterCreationUI = new CharacterCreationUI({
      onConfirm: (data) => {
        this.createCharacter(data.name, data.stats, data.hairId, data.faceId);
        this.hideCharacterCreationUI();
      },
      onCancel: () => {
        this.hideCharacterCreationUI();
      },
    });

    this.characterCreationUI.centerIn(GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    this.container.addChild(this.characterCreationUI);

    console.log('[MainScene] Character creation UI opened');
  }

  private hideCharacterCreationUI(): void {
    if (this.characterCreationUI) {
      this.container.removeChild(this.characterCreationUI);
      this.characterCreationUI.destroy();
      this.characterCreationUI = null;
      console.log('[MainScene] Character creation UI closed');
    }
  }

  private createCharacter(name: string, stats: Stats, hairId: number, faceId: number): void {
    const baseHp = 50 + stats.str * 2;
    const baseMp = 10 + stats.int * 2;
    const look = createLookWithChoices(hairId, faceId);

    const equipment = createBeginnerEquipment();

    const newCharacter: PartyCharacter = {
      id: `char_${Date.now()}`,
      name: name,
      level: 1,
      exp: 0,
      job: 'beginner',
      stats: { ...stats },
      combatStats: {
        accuracy: 10,
        evasion: 5,
        criticalChance: 0,
        criticalDamage: 150,
        dropRate: 1.0,
      },
      statPoints: 0,
      skillPoints: 0,
      hp: baseHp,
      maxHp: baseHp,
      mp: baseMp,
      maxMp: baseMp,
      weaponAttack: BASE_WEAPON_ATTACK,
      magicAttack: BASE_MAGIC_ATTACK,
      isActive: true,
      learnedSkills: [],
      equippedSkillSlots: [null, null, null, null, null, null],
      lastAttackTime: 0,
      currentAnimation: 'stand',
      mode: 'idle',
      targetMonsterId: null,
      look,
      equipment,
    };

    // Calculate stats from beginner equipment and sync look
    applyEquipmentStats(newCharacter);
    syncLookFromEquipment(newCharacter);

    this.partyCharacters.push(newCharacter);
    this.renderPartySlots();

    // Reload sprites for ALL characters (renderPartySlots destroys and recreates all slots)
    this.reloadAllCharacterSprites();

    console.log(`[MainScene] Character created: [name]=[${newCharacter.name}] [stats]=[STR:${stats.str},DEX:${stats.dex},INT:${stats.int},LUK:${stats.luk}] [partySize]=[${this.partyCharacters.length}]`);
  }

  /**
   * Reload sprites for all party characters
   * Called after renderPartySlots() which destroys and recreates all slot UI
   */
  private reloadAllCharacterSprites(): void {
    for (const character of this.partyCharacters) {
      if (character) {
        this.loadCharacterSprite(character);
      }
    }
  }

  /**
   * Load character sprite GIFs and apply to the corresponding party slot
   */
  private async loadCharacterSprite(character: PartyCharacter): Promise<void> {
    const assetManager = AssetManager.getInstance();
    const slotIndex = this.partyCharacters.indexOf(character);
    if (slotIndex === -1) return;

    // 1) Load idle animation FIRST and display immediately
    const slot = this.partySlots[slotIndex];
    if (slot) {
      const idleGif = await this.resolveIdleGif(character, assetManager);
      if (idleGif) {
        slot.setCharacterSprite(idleGif);
      }
    }

    // 2) Preload weapon-specific attack animations (only the ones this weapon uses)
    const weaponId = getWeaponId(character);
    const weaponAnims = getWeaponPreloadAnimations(weaponId);
    if (weaponAnims.length > 0) {
      assetManager.preloadCharacterAnimations(character.look, weaponAnims).catch(() => {});
    }

    // 3) Preload core idle/alert animations in background
    assetManager.preloadCharacterAnimations(character.look, CORE_ANIMATIONS).catch(() => {});
  }

  /**
   * Resolve idle animation GIF with fallback chain
   * stand2 (weapon idle) -> alert (combat ready) -> stand1 (unarmed idle)
   */
  private async resolveIdleGif(
    character: PartyCharacter,
    assetManager: AssetManager,
  ): Promise<GifSource | null> {
    const isArmed = hasWeapon(character);

    if (isArmed) {
      // Try stand2 first (weapon-holding idle)
      const stand2Gif = await assetManager.getCharacterGif(character.look, 'stand2');
      if (stand2Gif) return stand2Gif;

      // Fallback: alert (combat-ready stance, usually shows weapon)
      const alertGif = await assetManager.getCharacterGif(character.look, 'alert');
      if (alertGif) return alertGif;

      console.warn(`[MainScene] stand2/alert failed, falling back to stand1: [name]=[${character.name}]`);
    }

    // Final fallback: stand1 (unarmed idle)
    return assetManager.getCharacterGif(character.look, 'stand1');
  }

  /**
   * Switch a party slot's displayed animation with fallback support
   * If the requested animation fails, falls back to idle animation
   */
  private async updateSlotAnimation(
    slotIndex: number,
    animation: import('@/data/characterLook').CharacterAnimation,
  ): Promise<void> {
    const character = this.partyCharacters[slotIndex];
    if (!character) return;

    const assetManager = AssetManager.getInstance();
    let gifSource = await assetManager.getCharacterGif(character.look, animation);

    // Fallback: if requested animation fails, resolve idle
    if (!gifSource) {
      console.warn(`[MainScene] Animation failed, using idle fallback: [animation]=[${animation}] [name]=[${character.name}]`);
      gifSource = await this.resolveIdleGif(character, assetManager);
    }

    const slot = this.partySlots[slotIndex];
    if (slot && gifSource) {
      slot.setCharacterSprite(gifSource);
    }
  }

  // ============================================================================
  // Auto-Combat Handlers
  // ============================================================================

  /**
   * Handle attack event from AutoCombatSystem
   */
  /** Delay before damage is applied (near end of attack animation) */
  private static readonly ATTACK_DAMAGE_DELAY = 450;

  private handleAutoAttack(event: import('@/game/systems/AutoCombatSystem').AttackEvent): void {
    // Start attack animation immediately
    this.playCharacterAttackMotion(event.characterId);

    // Delay damage to near end of attack animation
    setTimeout(() => {
      this.applyAttackDamage(event);
    }, MainScene.ATTACK_DAMAGE_DELAY);
  }

  /**
   * Apply damage to the target monster (called after attack animation delay)
   */
  private applyAttackDamage(event: import('@/game/systems/AutoCombatSystem').AttackEvent): void {
    const monster = this.monsterSystem.getMonster(event.targetInstanceId);
    if (!monster) return;

    const sprite = this.monsterSystem.getMonsterSprite(event.targetInstanceId);
    if (!sprite) return;

    if (event.isMiss) {
      this.damageSystem.showMissText(sprite);
      return;
    }

    const isDead = this.damageSystem.hitMonster(
      monster,
      sprite,
      event.damage,
      event.isCritical,
      (s, anim) => this.monsterSystem.setMonsterAnimation(s, anim)
    );

    if (isDead) {
      this.damageSystem.clearDamageOffsets(event.targetInstanceId);
      const activeParty = this.getActivePartyMembers();
      this.autoCombatSystem.notifyMonsterDeath(event.targetInstanceId, activeParty);
    }
  }

  /**
   * Briefly switch character slot to attack animation, then back to idle
   */
  private async playCharacterAttackMotion(characterId: string): Promise<void> {
    const slotIndex = this.partyCharacters.findIndex((c) => c?.id === characterId);
    if (slotIndex === -1) return;

    const character = this.partyCharacters[slotIndex];
    if (!character) return;

    // Switch to attack animation (weapon type aware, randomly selected)
    const attackAnim = getRandomAttackAnimation(getWeaponId(character));
    await this.updateSlotAnimation(slotIndex, attackAnim);

    // After a short delay, switch back to idle (weapon aware)
    setTimeout(() => {
      const currentChar = this.partyCharacters[slotIndex];
      if (currentChar && currentChar.mode === 'combat') {
        this.updateSlotAnimation(slotIndex, getIdleAnimation(hasWeapon(currentChar)));
      }
    }, 600);
  }

  /**
   * Handle monster death event from AutoCombatSystem
   */
  private handleMonsterDeath(event: import('@/game/systems/AutoCombatSystem').MonsterDeathEvent): void {
    const { mobData } = event;

    // Distribute EXP to combat-mode party members
    const activeParty = this.getActivePartyMembers();
    this.autoCombatSystem.processMonsterRewards(activeParty, mobData);

    // Log and drops
    this.logSystem.logExpGain(mobData.name, mobData.meta.exp);
    if (mobData.meso) {
      this.dropSystem.tryDropMeso(mobData.meso);
    }

    const monster = this.monsterSystem.getMonster(event.instanceId);
    if (monster) {
      this.dropSystem.tryDropItems(mobData.drops, monster.x, monster.y);
    }

    // Update party slot UI to reflect EXP changes
    this.updatePartySlotStats();
  }

  /**
   * Handle level up event from AutoCombatSystem
   */
  private handleLevelUp(result: import('@/game/systems/LevelSystem').LevelUpResult): void {
    const character = this.getActivePartyMembers().find(
      (c) => c.id === result.characterId
    );
    const charName = character?.name ?? 'Unknown';

    this.logSystem.addLog(
      `${charName} Level UP! Lv.${result.oldLevel} -> Lv.${result.newLevel}`,
      0xFFFF00
    );

    console.log(
      `[LevelUp] [name]=[${charName}] [level]=[${result.oldLevel}->${result.newLevel}] [hp]=[+${result.hpGained}] [mp]=[+${result.mpGained}] [ap]=[+${result.statPointsGained}] [sp]=[+${result.skillPointsGained}]`
    );

    // Refresh UI
    this.updatePartySlotStats();
  }

  /**
   * Toggle a character's combat/idle mode
   */
  private handleToggleMode(slotIndex: number): void {
    const character = this.partyCharacters[slotIndex];
    if (!character) return;

    const newMode = this.autoCombatSystem.toggleMode(character);
    console.log(`[MainScene] Mode toggled: [name]=[${character.name}] [mode]=[${newMode}]`);

    // Update the specific party slot's toggle button
    const partySlot = this.partySlots[slotIndex];
    if (partySlot) {
      partySlot.updateMode(newMode);
    }

    // Switch animation based on mode (weapon-aware, random attack selection)
    const animation = newMode === 'combat'
      ? getRandomAttackAnimation(getWeaponId(character))
      : getIdleAnimation(hasWeapon(character));
    this.updateSlotAnimation(slotIndex, animation);
  }

  /**
   * Get all active (non-null) party members
   */
  private getActivePartyMembers(): PartyCharacter[] {
    return this.partyCharacters.filter(
      (c): c is PartyCharacter => c !== null
    );
  }

  /**
   * Update party slot UI to reflect stat changes
   */
  private updatePartySlotStats(): void {
    for (let i = 0; i < this.partySlots.length; i++) {
      const character = this.partyCharacters[i];
      if (character) {
        this.partySlots[i].updateCharacter(character);
      }
    }
  }

  // ============================================================================
  // Divider Effect
  // ============================================================================

  private playDividerEffect(): void {
    const divider = this.container.getChildByName('verticalDivider') as Graphics;
    const glowLine = this.container.getChildByName('verticalDividerGlow') as Graphics;
    if (!divider) return;

    if (this.isDividerAnimating) return;

    this.isDividerAnimating = true;

    const startTime = Date.now();
    const duration = 500;
    const originalAlpha = 0.3;
    const peakAlpha = 1.0;
    const glowOriginalAlpha = 0.15;
    const glowPeakAlpha = 0.6;

    const animate = (): void => {
      // Stop if scene is being destroyed
      if (!this.isDividerAnimating) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let alpha: number;
      let glowAlpha: number;
      if (progress < 0.25) {
        const riseProgress = progress / 0.25;
        alpha = originalAlpha + (peakAlpha - originalAlpha) * riseProgress;
        glowAlpha = glowOriginalAlpha + (glowPeakAlpha - glowOriginalAlpha) * riseProgress;
      } else {
        const fallProgress = (progress - 0.25) / 0.75;
        const easeOut = 1 - Math.pow(1 - fallProgress, 2);
        alpha = peakAlpha - (peakAlpha - originalAlpha) * easeOut;
        glowAlpha = glowPeakAlpha - (glowPeakAlpha - glowOriginalAlpha) * easeOut;
      }

      divider.alpha = alpha;
      if (glowLine) {
        glowLine.alpha = glowAlpha;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        divider.alpha = originalAlpha;
        if (glowLine) {
          glowLine.alpha = glowOriginalAlpha;
        }
        this.isDividerAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  // ============================================================================
  // Map Selection
  // ============================================================================

  private openMapSelection(): void {
    if (this.mapSelectionUI) {
      return;
    }

    this.mapSelectionUI = new MapSelectionUI({
      onMapSelect: (mapId: number) => {
        this.closeMapSelection();
        this.changeMap(mapId);
      },
      onClose: () => {
        this.closeMapSelection();
      },
      currentMapId: this.mapInfo?.id ?? 0,
    });

    this.container.addChild(this.mapSelectionUI);
  }

  private closeMapSelection(): void {
    if (this.mapSelectionUI) {
      this.container.removeChild(this.mapSelectionUI);
      this.mapSelectionUI.destroy();
      this.mapSelectionUI = null;
    }
  }

  private async changeMap(newMapId: number): Promise<void> {
    if (!this.mapInfo || this.mapInfo.id === newMapId) {
      return;
    }

    console.log(`[MainScene] Changing map: [from]=[${this.mapInfo.name}] [to]=[${newMapId}]`);

    // Pause update loop during map transition
    this.isChangingMap = true;

    // Set all characters to idle when changing maps
    const activeParty = this.getActivePartyMembers();
    this.autoCombatSystem.setAllIdle(activeParty);
    this.renderPartySlots();
    this.reloadAllCharacterSprites();

    this.monsterSystem.clearAll();
    this.dropSystem.clearAll();
    this.damageSystem.clearAll();
    await this.stopCurrentBGM();

    this.mapInfo = getMapById(newMapId) ?? null;
    if (!this.mapInfo) {
      console.error('[MainScene] Failed to load new map:', newMapId);
      this.isChangingMap = false;
      return;
    }

    if (this.mapTitleText) {
      this.mapTitleText.text = `${this.mapInfo.name} ▼`;
    }

    await this.loadMapAssets();

    this.monsterSystem.setMap(this.mapInfo);
    this.monsterSystem.setMobAssets(this.mobGifSources);
    this.damageSystem.setMobSounds(this.mobSounds);
    this.dropSystem.setItemPickupSound(this.itemPickupSound);

    if (this.mapInfo.bgm) {
      const audioManager = AudioManager.getInstance();
      audioManager.playBgm(this.mapInfo.bgm);
    }

    this.monsterSystem.spawnInitialMonsters();

    // Resume update loop
    this.isChangingMap = false;

    console.log(`[MainScene] Map changed successfully to: [map]=[${this.mapInfo.name}]`);
  }

  private async stopCurrentBGM(): Promise<void> {
    const audioManager = AudioManager.getInstance();
    await audioManager.stopBgm();
  }

  // ============================================================================
  // Asset Loading
  // ============================================================================

  private async loadMapAssets(): Promise<void> {
    const mapInfo = this.mapInfo;
    if (!mapInfo) return;

    const assetManager = AssetManager.getInstance();

    // Revoke old blob URLs before loading new assets
    this.revokeBlobUrls();
    this.mobGifSources.clear();
    this.mobSounds.clear();

    if (!mapInfo.spawns) return;

    for (const mobSpawn of mapInfo.spawns.normal.mobs) {
      const mob = getMobById(mobSpawn.mobId);
      if (mob) {
        for (const animation of MOB_ANIMATIONS) {
          const gifSource = await assetManager.getMobGif(mob.id, animation);
          if (gifSource) {
            const key = `${mob.id}_${animation}`;
            this.mobGifSources.set(key, gifSource);
          }
        }

        const mobIdStr = mob.id.toString().padStart(7, '0');
        const soundTypes: Array<'Damage' | 'Die'> = ['Damage', 'Die'];
        for (const soundType of soundTypes) {
          const soundData = await assetManager.getMobSound(mobIdStr, soundType);
          if (soundData) {
            const audio = this.createAudioFromBase64(soundData);
            const key = `${mob.id}_${soundType}`;
            this.mobSounds.set(key, audio);
          }
        }
      }
    }

    const pickupSoundData = await assetManager.getGameSound('Game.img/PickUpItem');
    if (pickupSoundData) {
      this.itemPickupSound = this.createAudioFromBase64(pickupSoundData);
    }

    console.log(`[MainScene] Loaded assets for map: [map]=[${mapInfo.name}]`);
  }

  private createAudioFromBase64(base64Data: string): HTMLAudioElement {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);

    // Track blob URL for cleanup
    this.blobUrls.push(blobUrl);

    return new Audio(blobUrl);
  }

  private revokeBlobUrls(): void {
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async destroy(): Promise<void> {
    // Cancel pending divider animation
    this.isDividerAnimating = false;

    this.autoCombatSystem.destroy();
    this.fieldView.removeClickHandler();
    this.monsterSystem.clearAll();
    this.dropSystem.clearAll();
    this.damageSystem.clearAll();
    this.logSystem.destroy();

    // Stop and cleanup audio resources
    for (const audio of this.mobSounds.values()) {
      audio.pause();
      audio.src = '';
    }
    this.mobSounds.clear();

    if (this.itemPickupSound) {
      this.itemPickupSound.pause();
      this.itemPickupSound.src = '';
      this.itemPickupSound = null;
    }

    // Revoke all blob URLs
    this.revokeBlobUrls();
    this.mobGifSources.clear();

    // Cleanup UI event listeners
    if (this.mapTitleText) {
      this.mapTitleText.off('pointerdown');
    }

    if (this.mapSelectionUI) {
      this.mapSelectionUI.destroy();
      this.mapSelectionUI = null;
    }

    if (this.characterCreationUI) {
      this.characterCreationUI.destroy();
      this.characterCreationUI = null;
    }

    if (this.inventoryUI) {
      this.inventoryUI.destroy();
      this.inventoryUI = null;
    }

    this.clearPartySlots();

    await super.destroy();
  }
}
