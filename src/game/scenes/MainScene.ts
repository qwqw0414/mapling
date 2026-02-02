import { Container, Graphics, Text } from 'pixi.js';
import { GifSource } from 'pixi.js/gif';
import { BaseScene } from './BaseScene';
import {
  MAP_CONFIG,
  LAYOUT_CONFIG,
  SLOT_CONFIG,
} from '@/constants/config';
import { getMapById } from '@/data/maps';
import { getMobById } from '@/data/mobs';
import { AudioManager } from '@/game/systems/AudioManager';
import { AssetManager } from '@/game/systems/AssetManager';
import { MonsterSystem, MOB_ANIMATIONS } from '@/game/systems/MonsterSystem';
import { DamageSystem } from '@/game/systems/DamageSystem';
import { DropSystem } from '@/game/systems/DropSystem';
import { LogSystem } from '@/game/systems/LogSystem';
import { FieldView } from '@/game/systems/FieldView';
import { PartySlot } from '@/game/ui/PartySlot';
import { CharacterCreationUI } from '@/game/ui/CharacterCreationUI';
import { MapSelectionUI } from '@/game/ui/MapSelectionUI';
import { InventoryUI } from '@/game/ui/InventoryUI';
import { useCharacterStore } from '@/stores/characterStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import type { MapInfo } from '@/types/map';
import type { PartyCharacter } from '@/types/party';
import type { Stats } from '@/types/character';
import type { ItemCategory } from '@/types/item';

// ============================================================================
// Types
// ============================================================================

interface LayoutDimensions {
  header: { x: number; y: number; width: number; height: number };
  party: { x: number; y: number; width: number; height: number };
  partySlots: { x: number; y: number; width: number; height: number };
  inventory: { x: number; y: number; width: number; height: number };
  field: { x: number; y: number; width: number; height: number };
  log: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Main Scene
// ============================================================================

export class MainScene extends BaseScene {
  private mapInfo: MapInfo | null = null;
  private mobGifSources: Map<string, GifSource> = new Map();
  private mobSounds: Map<string, HTMLAudioElement> = new Map();
  private itemPickupSound: HTMLAudioElement | null = null;

  // Layout containers
  private headerLayer!: Container;
  private partyLayer!: Container;
  private fieldLayer!: Container;
  private logLayer!: Container;

  // Layout dimensions
  private layout!: LayoutDimensions;

  // Systems
  private monsterSystem!: MonsterSystem;
  private damageSystem!: DamageSystem;
  private dropSystem!: DropSystem;
  private logSystem!: LogSystem;
  private fieldView!: FieldView;

  // Map transition state
  private isChangingMap = false;

  // UI elements
  private mapTitleText: Text | null = null;
  private partySlots: PartySlot[] = [];
  private createCharacterButton: Container | null = null;
  private characterCreationUI: CharacterCreationUI | null = null;
  private mapSelectionUI: MapSelectionUI | null = null;
  private inventoryUI: InventoryUI | null = null;

  // Party area sub-containers
  private partySlotsContainer!: Container;
  private inventoryContainer!: Container;

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
    this.createHeader();
    this.createPartyArea();
    this.createPartyFieldDivider();
    this.monsterSystem.spawnInitialMonsters();

    console.log('[MainScene] Created with layout:', this.layout);
  }

  update(deltaTime: number): void {
    if (!this.isInitialized || this.isChangingMap) return;

    this.monsterSystem.updateSpawnTimer(deltaTime);
    this.monsterSystem.updateMonsters(deltaTime);
    this.logSystem.updateLogEntries();
  }

  // ============================================================================
  // Layout Calculation
  // ============================================================================

  private calculateLayout(): void {
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;

    const headerHeight = LAYOUT_CONFIG.HEADER.HEIGHT;
    const partyHeight = Math.floor((height - headerHeight) * LAYOUT_CONFIG.PARTY_AREA.HEIGHT_RATIO);
    const logHeight = Math.floor((height - headerHeight) * LAYOUT_CONFIG.LOG_AREA.HEIGHT_RATIO);
    const fieldHeight = height - headerHeight - partyHeight - logHeight;

    // Inventory fixed width, party slots take remaining space
    const inventoryWidth = LAYOUT_CONFIG.PARTY_AREA.INVENTORY_WIDTH;
    const partySlotsWidth = width - inventoryWidth;

    this.layout = {
      header: { x: 0, y: 0, width: width, height: headerHeight },
      party: { x: 0, y: headerHeight, width: width, height: partyHeight },
      partySlots: { x: 0, y: 0, width: partySlotsWidth, height: partyHeight },
      inventory: { x: partySlotsWidth, y: 0, width: inventoryWidth, height: partyHeight },
      field: { x: 0, y: headerHeight + partyHeight, width: width, height: fieldHeight },
      log: { x: 0, y: headerHeight + partyHeight + fieldHeight, width: width, height: logHeight },
    };
  }

  // ============================================================================
  // Layer Creation
  // ============================================================================

  private createLayers(): void {
    this.headerLayer = new Container();
    this.partyLayer = new Container();
    this.fieldLayer = new Container();
    this.logLayer = new Container();

    this.headerLayer.y = this.layout.header.y;
    this.partyLayer.y = this.layout.party.y;
    this.fieldLayer.y = this.layout.field.y;
    this.logLayer.y = this.layout.log.y;

    this.container.addChild(this.headerLayer);
    this.container.addChild(this.partyLayer);
    this.container.addChild(this.fieldLayer);
    this.container.addChild(this.logLayer);

    this.drawLayoutDebug();
  }

  private drawLayoutDebug(): void {
    const borders = [
      { layer: this.headerLayer, layout: this.layout.header },
      { layer: this.partyLayer, layout: this.layout.party },
      { layer: this.fieldLayer, layout: this.layout.field },
      { layer: this.logLayer, layout: this.layout.log },
    ];

    for (const { layer, layout } of borders) {
      const border = new Graphics();
      border.label = 'debugBorder';
      border.rect(0, 0, layout.width, layout.height);
      border.stroke({ color: 0x333333, width: 1 });
      layer.addChild(border);
    }
  }

  private updateDebugBorders(): void {
    const updates = [
      { layer: this.headerLayer, layout: this.layout.header },
      { layer: this.partyLayer, layout: this.layout.party },
      { layer: this.fieldLayer, layout: this.layout.field },
      { layer: this.logLayer, layout: this.layout.log },
    ];

    for (const { layer, layout } of updates) {
      const border = layer.getChildByName('debugBorder') as Graphics;
      if (border) {
        border.clear();
        border.rect(0, 0, layout.width, layout.height);
        border.stroke({ color: 0x333333, width: 1 });
      }
    }
  }

  // ============================================================================
  // System Initialization
  // ============================================================================

  private initializeSystems(): void {
    this.monsterSystem = new MonsterSystem(
      this.fieldLayer,
      this.layout.field.width,
      this.layout.field.height
    );
    this.monsterSystem.setMap(this.mapInfo);
    this.monsterSystem.setMobAssets(this.mobGifSources);

    this.damageSystem = new DamageSystem(this.fieldLayer);
    this.damageSystem.setMobSounds(this.mobSounds);

    this.dropSystem = new DropSystem(
      this.fieldLayer,
      this.partyLayer,
      this.layout.field.width,
      this.layout.field.height
    );
    this.dropSystem.setItemPickupSound(this.itemPickupSound);
    this.dropSystem.setCallbacks({
      onMesoGain: (amount) => this.onMesoGain(amount),
      onItemDrop: (itemName) => this.logSystem.logItemDrop(itemName),
      onDividerEffect: () => this.playDividerEffect(),
    });

    this.logSystem = new LogSystem(this.logLayer);

    this.fieldView = new FieldView(
      this.fieldLayer,
      this.layout.field.width,
      this.layout.field.height
    );
    this.fieldView.setupClickHandler(() => this.attackRandomMonster());
  }

  // ============================================================================
  // Header Area
  // ============================================================================

  private createHeader(): void {
    if (!this.mapInfo) return;

    const padding = LAYOUT_CONFIG.HEADER.PADDING;

    this.mapTitleText = new Text({
      text: `${this.mapInfo.name} ▼`,
      style: {
        fontSize: 18,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        dropShadow: { color: 0x000000, blur: 2, distance: 1 },
      },
    });
    this.mapTitleText.x = padding;
    this.mapTitleText.y = (this.layout.header.height - this.mapTitleText.height) / 2;
    this.mapTitleText.eventMode = 'static';
    this.mapTitleText.cursor = 'pointer';
    this.mapTitleText.on('pointerdown', () => this.openMapSelection());
    this.headerLayer.addChild(this.mapTitleText);

    this.updateAddCharacterButton();
  }

  private updateAddCharacterButton(): void {
    if (this.createCharacterButton && this.createCharacterButton.parent === this.headerLayer) {
      this.headerLayer.removeChild(this.createCharacterButton);
      this.createCharacterButton.destroy();
      this.createCharacterButton = null;
    }

    const maxSlots = LAYOUT_CONFIG.PARTY_AREA.MAX_SLOTS;
    if (this.partyCharacters.length > 0 && this.partyCharacters.length < maxSlots) {
      const padding = LAYOUT_CONFIG.HEADER.PADDING;

      this.createCharacterButton = this.createSmallAddButton();

      // Position on the right side of header
      this.createCharacterButton.x = this.layout.header.width - padding - 32;
      this.createCharacterButton.y = (this.layout.header.height - 32) / 2;

      this.headerLayer.addChild(this.createCharacterButton);
    }
  }

  // ============================================================================
  // Party Area
  // ============================================================================

  private createPartyArea(): void {
    // Create sub-containers for party slots and inventory
    this.partySlotsContainer = new Container();
    this.partySlotsContainer.x = this.layout.partySlots.x;
    this.partySlotsContainer.y = this.layout.partySlots.y;
    this.partyLayer.addChild(this.partySlotsContainer);

    this.inventoryContainer = new Container();
    this.inventoryContainer.x = this.layout.inventory.x;
    this.inventoryContainer.y = this.layout.inventory.y;
    this.partyLayer.addChild(this.inventoryContainer);

    this.renderPartySlots();
    this.createInventoryUI();
  }

  private renderPartySlots(): void {
    this.clearPartySlots();

    const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;
    const availableHeight = this.layout.partySlots.height - padding * 2;
    const availableWidth = this.layout.partySlots.width;

    const slotWidth = SLOT_CONFIG.MIN_WIDTH;
    const slotHeight = Math.max(SLOT_CONFIG.MIN_HEIGHT, availableHeight);
    const slotGap = LAYOUT_CONFIG.PARTY_AREA.SLOT_GAP;

    if (this.partyCharacters.length === 0) {
      this.createCharacterButton = this.createAddCharacterButton(slotWidth, slotHeight, true);
      this.createCharacterButton.x = (availableWidth - slotWidth) / 2;
      this.createCharacterButton.y = padding;
      this.partySlotsContainer.addChild(this.createCharacterButton);
    } else {
      const totalWidth = this.partyCharacters.length * slotWidth + (this.partyCharacters.length - 1) * slotGap;
      const startX = (availableWidth - totalWidth) / 2;
      const startY = padding;

      for (let i = 0; i < this.partyCharacters.length; i++) {
        const character = this.partyCharacters[i];
        const slot = this.createPartySlot(i, slotWidth, slotHeight);

        if (character) {
          slot.setCharacter(character);
        }

        slot.x = startX + i * (slotWidth + slotGap);
        slot.y = startY;
        this.partySlotsContainer.addChild(slot);
        this.partySlots.push(slot);
      }
    }

    this.updateAddCharacterButton();
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

  private createSmallAddButton(): Container {
    const button = new Container();
    button.label = 'smallAddButton';

    const buttonSize = 32;
    const plusSize = 16;

    const background = new Graphics();
    background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
    background.fill({ color: 0x4488ff });
    background.stroke({ color: 0xFFFFFF, width: 2 });
    button.addChild(background);

    const plusGraphics = new Graphics();
    plusGraphics.rect(buttonSize / 2 - plusSize / 2, buttonSize / 2 - 1.5, plusSize, 3);
    plusGraphics.fill({ color: 0xFFFFFF });
    plusGraphics.rect(buttonSize / 2 - 1.5, buttonSize / 2 - plusSize / 2, 3, plusSize);
    plusGraphics.fill({ color: 0xFFFFFF });
    button.addChild(plusGraphics);

    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', () => this.onAddCharacterClick());

    button.on('pointerover', () => {
      background.clear();
      background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
      background.fill({ color: 0x5599ff });
      background.stroke({ color: 0xFFFFFF, width: 2 });
    });

    button.on('pointerout', () => {
      background.clear();
      background.circle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
      background.fill({ color: 0x4488ff });
      background.stroke({ color: 0xFFFFFF, width: 2 });
    });

    return button;
  }

  private onAddCharacterClick(): void {
    console.log('[MainScene] Add character clicked');
    this.showCharacterCreationUI();
  }

  private createPartyFieldDivider(): void {
    const divider = new Graphics();
    divider.label = 'partyFieldDivider';

    const lineY = this.layout.party.height;
    const padding = 30;

    divider.moveTo(padding, lineY);
    divider.lineTo(this.layout.party.width - padding, lineY);
    divider.stroke({ color: 0x4488ff, width: 2 });

    const glowLine = new Graphics();
    glowLine.label = 'partyFieldDividerGlow';
    glowLine.moveTo(padding, lineY);
    glowLine.lineTo(this.layout.party.width - padding, lineY);
    glowLine.stroke({ color: 0x4488ff, width: 6, alpha: 0.2 });

    this.partyLayer.addChild(glowLine);
    this.partyLayer.addChild(divider);

    divider.alpha = 0.3;
    glowLine.alpha = 0.15;
  }

  private updatePartyFieldDivider(): void {
    const divider = this.partyLayer.getChildByName('partyFieldDivider') as Graphics;
    const glowLine = this.partyLayer.getChildByName('partyFieldDividerGlow') as Graphics;

    if (divider) {
      const lineY = this.layout.party.height;
      const padding = 30;
      const currentAlpha = divider.alpha;

      divider.clear();
      divider.moveTo(padding, lineY);
      divider.lineTo(this.layout.party.width - padding, lineY);
      divider.stroke({ color: 0x4488ff, width: 2 });
      divider.alpha = currentAlpha;
    }

    if (glowLine) {
      const lineY = this.layout.party.height;
      const padding = 30;

      glowLine.clear();
      glowLine.moveTo(padding, lineY);
      glowLine.lineTo(this.layout.party.width - padding, lineY);
      glowLine.stroke({ color: 0x4488ff, width: 6, alpha: 0.2 });
    }
  }

  private createPartySlot(index: number, width: number, height: number): PartySlot {
    return new PartySlot({
      width,
      height,
      slotIndex: index,
      character: null,
      onClick: (slotIndex: number) => this.onSlotClick(slotIndex),
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
    // Add to store
    useCharacterStore.getState().addMeso(amount);

    // Update inventory UI
    const currentMeso = useCharacterStore.getState().meso;
    this.updateInventoryMeso(currentMeso);

    // Log the gain
    this.logSystem.logMesoGain(amount);
  }

  // ============================================================================
  // Inventory UI
  // ============================================================================

  private createInventoryUI(): void {
    const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;

    this.inventoryUI = new InventoryUI({
      width: this.layout.inventory.width - padding,
      height: this.layout.inventory.height - padding * 2,
      onTabChange: (tab) => this.onInventoryTabChange(tab),
      onSlotClick: (index, item) => this.onInventorySlotClick(index, item),
    });

    this.inventoryUI.x = padding / 2;
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
        this.createCharacter(data.name, data.stats);
        this.hideCharacterCreationUI();
      },
      onCancel: () => {
        this.hideCharacterCreationUI();
      },
    });

    this.characterCreationUI.centerIn(MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
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

  private createCharacter(name: string, stats: Stats): void {
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
        criticalChance: 0.05,
        criticalDamage: 1.5,
        dropRate: 1.0,
      },
      statPoints: 0,
      skillPoints: 0,
      hp: 50 + stats.str * 2,
      maxHp: 50 + stats.str * 2,
      mp: 10 + stats.int * 2,
      maxMp: 10 + stats.int * 2,
      isActive: true,
      learnedSkills: [],
      equippedSkillSlots: [null, null, null, null, null, null],
      lastAttackTime: 0,
      currentAnimation: 'stand',
    };

    this.partyCharacters.push(newCharacter);
    this.renderPartySlots();

    console.log(`[MainScene] Character created: [name]=[${newCharacter.name}] [stats]=[STR:${stats.str},DEX:${stats.dex},INT:${stats.int},LUK:${stats.luk}] [partySize]=[${this.partyCharacters.length}]`);
  }

  // ============================================================================
  // Combat (Test)
  // ============================================================================

  private attackRandomMonster(): void {
    const monsters = this.monsterSystem.getAllMonsters();
    const aliveMonsters = Array.from(monsters.entries())
      .filter(([, state]) => !state.isDying);

    if (aliveMonsters.length === 0) return;

    const randomIndex = Math.floor(Math.random() * aliveMonsters.length);
    const [targetId, monster] = aliveMonsters[randomIndex];

    const isCritical = Math.random() < 0.3;
    const damage = isCritical
      ? Math.floor(Math.random() * 26) + 25
      : Math.floor(Math.random() * 21) + 10;

    const sprite = this.monsterSystem.getMonsterSprite(targetId);
    if (!sprite) return;

    const isDead = this.damageSystem.hitMonster(
      monster,
      sprite,
      damage,
      isCritical,
      (s, anim) => this.monsterSystem.setMonsterAnimation(s, anim)
    );

    if (isDead) {
      const mob = getMobById(monster.mobId);
      if (mob) {
        this.logSystem.logExpGain(mob.name, mob.meta.exp);
        this.dropSystem.tryDropMeso(mob.meso);
        this.dropSystem.tryDropItems(mob.drops, monster.x, monster.y);
      }

      this.damageSystem.clearDamageOffsets(targetId);
    }

    const mob = getMobById(monster.mobId);
    if (mob) {
      const critText = isCritical ? ' [CRITICAL]' : '';
      console.log(
        `[Combat] Hit ${mob.name}: [damage]=[${damage}]${critText} [hp]=[${monster.currentHp}/${monster.maxHp}] [dead]=[${isDead}]`
      );
    }
  }

  // ============================================================================
  // Divider Effect
  // ============================================================================

  private playDividerEffect(): void {
    const divider = this.partyLayer.getChildByName('partyFieldDivider') as Graphics;
    const glowLine = this.partyLayer.getChildByName('partyFieldDividerGlow') as Graphics;
    if (!divider) return;

    if (divider.alpha > 0.5) return;

    const startTime = Date.now();
    const duration = 500;
    const originalAlpha = 0.3;
    const peakAlpha = 1.0;
    const glowOriginalAlpha = 0.15;
    const glowPeakAlpha = 0.6;

    const animate = (): void => {
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
    if (!this.mapInfo) return;

    const assetManager = AssetManager.getInstance();

    this.mobGifSources.clear();
    this.mobSounds.clear();

    for (const mobSpawn of this.mapInfo.spawns.normal.mobs) {
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

    console.log(`[MainScene] Loaded assets for map: [map]=[${this.mapInfo.name}]`);
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
    return new Audio(blobUrl);
  }

  // ============================================================================
  // Resize Handler
  // ============================================================================

  onResize(_width: number, _height: number): void {
    this.calculateLayout();

    this.headerLayer.y = this.layout.header.y;
    this.partyLayer.y = this.layout.party.y;
    this.fieldLayer.y = this.layout.field.y;
    this.logLayer.y = this.layout.log.y;

    this.updateDebugBorders();

    // Update party area sub-containers
    this.partySlotsContainer.x = this.layout.partySlots.x;
    this.inventoryContainer.x = this.layout.inventory.x;

    this.updateAddCharacterButton();

    this.renderPartySlots();
    this.updatePartyFieldDivider();

    // Resize inventory UI
    if (this.inventoryUI) {
      const padding = LAYOUT_CONFIG.PARTY_AREA.PADDING;
      this.inventoryUI.resize(
        this.layout.inventory.width - padding,
        this.layout.inventory.height - padding * 2
      );
    }

    this.fieldView.updateFieldDimensions(this.layout.field.width, this.layout.field.height);
    this.monsterSystem.setFieldDimensions(this.layout.field.width, this.layout.field.height);

    console.log(`[MainScene] Resized to ${this.layout.field.width}x${this.layout.field.height}`);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async destroy(): Promise<void> {
    this.fieldView.removeClickHandler();
    this.monsterSystem.clearAll();
    this.dropSystem.clearAll();
    this.damageSystem.clearAll();
    this.logSystem.destroy();

    this.mobGifSources.clear();
    this.mobSounds.clear();
    this.itemPickupSound = null;

    if (this.mapSelectionUI) {
      this.mapSelectionUI.destroy();
      this.mapSelectionUI = null;
    }

    if (this.inventoryUI) {
      this.inventoryUI.destroy();
      this.inventoryUI = null;
    }

    await super.destroy();
  }
}
