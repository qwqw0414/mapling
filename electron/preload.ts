import { contextBridge } from 'electron';

// ============================================================================
// Preload Script
// ============================================================================

/**
 * Exposes a limited API to the renderer process via contextBridge.
 * This maintains security by keeping contextIsolation enabled
 * while allowing controlled access to Electron features.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Returns the current platform identifier */
  platform: process.platform,
  /** Indicates the app is running inside Electron */
  isElectron: true,
});
