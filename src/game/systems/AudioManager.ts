// ============================================================================
// Audio Manager
// ============================================================================

import { AUDIO_CONFIG } from '@/constants/config';
import { AssetManager } from './AssetManager';

// ============================================================================
// Types
// ============================================================================

interface AudioState {
  bgm: HTMLAudioElement | null;
  currentBgmPath: string | null;
  isMuted: boolean;
  bgmVolume: number;
  isWaitingForInteraction: boolean;
  pendingBgm: HTMLAudioElement | null;
}

// ============================================================================
// AudioManager Class
// ============================================================================

export class AudioManager {
  private static instance: AudioManager | null = null;
  private state: AudioState = {
    bgm: null,
    currentBgmPath: null,
    isMuted: false,
    bgmVolume: AUDIO_CONFIG.DEFAULT_BGM_VOLUME,
    isWaitingForInteraction: false,
    pendingBgm: null,
  };
  private isInitialized = false;
  private interactionHandler: (() => void) | null = null;

  // ============================================================================
  // Singleton
  // ============================================================================

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initialize audio manager (call after user interaction)
   */
  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[AudioManager] Initialized');
  }

  /**
   * Play BGM from MapleStory.IO API
   * @param bgmPath - BGM path (e.g., "Bgm02/AboveTheTreetops")
   */
  async playBgm(bgmPath: string): Promise<void> {
    if (!bgmPath) return;

    // Skip if same BGM is already playing
    if (this.state.currentBgmPath === bgmPath && this.state.bgm) {
      return;
    }

    // Stop current BGM
    this.stopBgm();

    try {
      // Use AssetManager for cached BGM loading
      const assetManager = AssetManager.getInstance();
      const audioData = await assetManager.getBgm(bgmPath);
      if (!audioData) {
        console.warn(`[AudioManager] Failed to load BGM: [bgmPath]=[${bgmPath}]`);
        return;
      }

      // Create audio element from base64 data
      const audio = this.createAudioFromBase64(audioData);
      audio.loop = true;
      audio.volume = this.state.isMuted ? 0 : this.state.bgmVolume;

      // Store state
      this.state.bgm = audio;
      this.state.currentBgmPath = bgmPath;

      // Play with fade-in
      await this.fadeIn(audio, AUDIO_CONFIG.FADE_DURATION);
      console.log(`[AudioManager] Playing BGM: [bgmPath]=[${bgmPath}]`);
    } catch (error) {
      console.error(`[AudioManager] Error playing BGM: [bgmPath]=[${bgmPath}]`, error);
    }
  }

  /**
   * Stop current BGM
   */
  stopBgm(): void {
    if (this.state.bgm) {
      this.fadeOut(this.state.bgm, AUDIO_CONFIG.FADE_DURATION).then(() => {
        if (this.state.bgm) {
          this.state.bgm.pause();
          this.state.bgm.src = '';
          this.state.bgm = null;
        }
      });
      this.state.currentBgmPath = null;
    }
  }

  /**
   * Pause current BGM
   */
  pauseBgm(): void {
    if (this.state.bgm) {
      this.state.bgm.pause();
    }
  }

  /**
   * Resume current BGM
   */
  resumeBgm(): void {
    if (this.state.bgm) {
      this.state.bgm.play().catch(() => {
        // Autoplay blocked, will retry on user interaction
      });
    }
  }

  /**
   * Set BGM volume
   * @param volume - Volume level (0.0 - 1.0)
   */
  setBgmVolume(volume: number): void {
    this.state.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.state.bgm && !this.state.isMuted) {
      this.state.bgm.volume = this.state.bgmVolume;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.state.isMuted = !this.state.isMuted;
    if (this.state.bgm) {
      this.state.bgm.volume = this.state.isMuted ? 0 : this.state.bgmVolume;
    }
    return this.state.isMuted;
  }

  /**
   * Get current mute state
   */
  isMuted(): boolean {
    return this.state.isMuted;
  }

  /**
   * Get current BGM volume
   */
  getBgmVolume(): number {
    return this.state.bgmVolume;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create audio element from base64 encoded data
   */
  private createAudioFromBase64(base64Data: string): HTMLAudioElement {
    // Convert base64 to blob for better compatibility
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Try audio/mpeg (MP3) format - MapleStory uses MP3
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);
    
    const audio = new Audio(blobUrl);
    
    // Add error handling
    audio.onerror = (e) => {
      console.error('[AudioManager] Audio error:', e);
    };
    
    audio.oncanplaythrough = () => {
      console.log('[AudioManager] Audio ready to play');
    };
    
    return audio;
  }

  /**
   * Fade in audio
   */
  private fadeIn(audio: HTMLAudioElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const targetVolume = this.state.isMuted ? 0 : this.state.bgmVolume;
      audio.volume = 0;
      
      const startFadeIn = () => {
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;

        const fadeInterval = setInterval(() => {
          currentStep++;
          audio.volume = Math.min(targetVolume, volumeStep * currentStep);

          if (currentStep >= steps) {
            clearInterval(fadeInterval);
            audio.volume = targetVolume;
            resolve();
          }
        }, stepTime);
      };
      
      audio.play()
        .then(() => {
          // Autoplay succeeded
          this.state.isWaitingForInteraction = false;
          startFadeIn();
        })
        .catch(() => {
          // Autoplay blocked - silently wait for user interaction
          this.state.isWaitingForInteraction = true;
          this.state.pendingBgm = audio;
          
          // Remove previous handler if exists
          if (this.interactionHandler) {
            document.removeEventListener('click', this.interactionHandler);
            document.removeEventListener('keydown', this.interactionHandler);
          }
          
          // Add new handler
          this.interactionHandler = () => {
            if (this.state.pendingBgm) {
              this.state.pendingBgm.play()
                .then(() => {
                  this.state.isWaitingForInteraction = false;
                  console.log('[AudioManager] BGM started after user interaction');
                  startFadeIn();
                })
                .catch(() => {});
            }
            
            // Cleanup
            if (this.interactionHandler) {
              document.removeEventListener('click', this.interactionHandler);
              document.removeEventListener('keydown', this.interactionHandler);
              this.interactionHandler = null;
            }
          };
          
          document.addEventListener('click', this.interactionHandler, { once: true });
          document.addEventListener('keydown', this.interactionHandler, { once: true });
          
          // Resolve immediately to not block loading
          resolve();
        });
    });
  }

  /**
   * Fade out audio
   */
  private fadeOut(audio: HTMLAudioElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startVolume = audio.volume;
      const steps = 20;
      const stepTime = duration / steps;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, startVolume - volumeStep * currentStep);

        if (currentStep >= steps) {
          clearInterval(fadeInterval);
          audio.volume = 0;
          resolve();
        }
      }, stepTime);
    });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy audio manager
   */
  destroy(): void {
    // Cleanup interaction handler
    if (this.interactionHandler) {
      document.removeEventListener('click', this.interactionHandler);
      document.removeEventListener('keydown', this.interactionHandler);
      this.interactionHandler = null;
    }
    
    this.stopBgm();
    this.state.pendingBgm = null;
    this.state.isWaitingForInteraction = false;
    this.isInitialized = false;
    AudioManager.instance = null;
  }
}
