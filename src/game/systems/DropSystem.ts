import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { AssetManager } from './AssetManager';
import { getItemById } from '@/data/items';

// ============================================================================
// Drop System
// ============================================================================

export class DropSystem {
  private fieldLayer: Container;
  private partyLayer: Container;
  private fieldWidth: number;
  private fieldHeight: number;
  private itemPickupSound: HTMLAudioElement | null = null;

  private onMesoGainCallback: ((amount: number) => void) | null = null;
  private onItemDropCallback: ((itemName: string) => void) | null = null;
  private onItemPickupCallback: ((itemId: number, quantity: number) => void) | null = null;
  private onDividerEffectCallback: (() => void) | null = null;

  constructor(
    fieldLayer: Container,
    partyLayer: Container,
    fieldWidth: number,
    fieldHeight: number
  ) {
    this.fieldLayer = fieldLayer;
    this.partyLayer = partyLayer;
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  setItemPickupSound(sound: HTMLAudioElement | null): void {
    this.itemPickupSound = sound;
  }

  setCallbacks(callbacks: {
    onMesoGain?: (amount: number) => void;
    onItemDrop?: (itemName: string) => void;
    onItemPickup?: (itemId: number, quantity: number) => void;
    onDividerEffect?: () => void;
  }): void {
    this.onMesoGainCallback = callbacks.onMesoGain ?? null;
    this.onItemDropCallback = callbacks.onItemDrop ?? null;
    this.onItemPickupCallback = callbacks.onItemPickup ?? null;
    this.onDividerEffectCallback = callbacks.onDividerEffect ?? null;
  }

  // ============================================================================
  // Meso Drop
  // ============================================================================

  tryDropMeso(meso: { amount: number; chance: number }): void {
    if (Math.random() * 100 > meso.chance) {
      return;
    }

    if (this.onMesoGainCallback) {
      this.onMesoGainCallback(meso.amount);
    }
  }

  // ============================================================================
  // Item Drop
  // ============================================================================

  tryDropItems(
    drops: Array<{ itemId: number; name?: string; chance: number; minQuantity?: number; maxQuantity?: number }>,
    x: number,
    y: number
  ): void {
    for (const drop of drops) {
      if (Math.random() * 100 <= drop.chance) {
        // Skip if item data doesn't exist
        const itemData = getItemById(drop.itemId);
        if (!itemData) {
          continue;
        }

        const minQty = drop.minQuantity ?? 1;
        const maxQty = drop.maxQuantity ?? 1;
        const quantity = minQty + Math.floor(Math.random() * (maxQty - minQty + 1));

        this.createItemDrop(drop, x, y);

        if (this.onItemDropCallback) {
          this.onItemDropCallback(itemData.name);
        }

        if (this.onItemPickupCallback) {
          this.onItemPickupCallback(drop.itemId, quantity);
        }

        this.playItemPickupSound();
      }
    }
  }

  private async createItemDrop(
    drop: { itemId: number; name?: string; chance: number },
    x: number,
    y: number
  ): Promise<void> {
    const itemContainer = new Container();
    itemContainer.x = x;
    itemContainer.y = y;

    const assetManager = AssetManager.getInstance();
    const iconBlob = await assetManager.getImage('item', drop.itemId, 'icon');

    if (iconBlob) {
      const img = new Image();
      img.src = URL.createObjectURL(iconBlob);
      await new Promise(resolve => { img.onload = resolve; });

      const texture = Texture.from(img);
      const itemSprite = new Sprite(texture);
      itemSprite.anchor.set(0.5);

      const maxSize = 32;
      if (itemSprite.width > maxSize || itemSprite.height > maxSize) {
        const scale = maxSize / Math.max(itemSprite.width, itemSprite.height);
        itemSprite.scale.set(scale);
      }

      itemContainer.addChild(itemSprite);
    } else {
      const fallback = new Graphics();
      fallback.rect(-12, -12, 24, 24);
      fallback.fill({ color: 0x8B4513 });
      fallback.rect(-10, -10, 20, 20);
      fallback.fill({ color: 0xDEB887 });
      itemContainer.addChild(fallback);
    }

    this.fieldLayer.addChild(itemContainer);
    this.flyToPartyArea(itemContainer, x, y);
  }

  private flyToPartyArea(container: Container, startX: number, startY: number): void {
    const targetX = this.fieldWidth / 2;
    const targetY = -5;

    const duration = 600;
    const startTime = Date.now();

    const bounceHeight = 40;
    const bounceTime = 150;

    const animate = (): void => {
      const elapsed = Date.now() - startTime;

      if (elapsed < bounceTime) {
        const progress = elapsed / bounceTime;
        const bounceY = Math.sin(progress * Math.PI) * bounceHeight;
        container.y = startY - bounceY;
        container.scale.set(1 + progress * 0.2);
      } else {
        const flyProgress = Math.min(1, (elapsed - bounceTime) / (duration - bounceTime));

        const easeProgress = 1 - Math.pow(1 - flyProgress, 3);

        container.x = startX + (targetX - startX) * easeProgress;
        container.y = startY + (targetY - startY) * easeProgress;

        const scale = 1.2 - flyProgress * 0.4;
        container.scale.set(scale);
        container.alpha = 1 - flyProgress * 0.3;

        if (flyProgress > 0.6 && flyProgress < 0.65) {
          if (this.onDividerEffectCallback) {
            this.onDividerEffectCallback();
          }
        }

        if (flyProgress >= 1) {
          this.fieldLayer.removeChild(container);
          container.destroy();
          return;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  private playItemPickupSound(): void {
    if (this.itemPickupSound) {
      const sound = this.itemPickupSound.cloneNode() as HTMLAudioElement;
      sound.volume = 0.5;
      sound.play().catch(() => { });
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  clearAll(): void {
    const children = this.fieldLayer.children.slice();
    for (const child of children) {
      if (child.label && child.label.startsWith('dropItem_')) {
        this.fieldLayer.removeChild(child);
        child.destroy();
      }
    }
  }
}
