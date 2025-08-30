// Custom hook for offline sync operations in POS
import { useState, useEffect, useCallback } from 'react';
import { OfflineSyncItem } from '../types/credit.types';
import { validateOfflinePayload } from '../utils/validation.utils';

export interface UseOfflineSyncResult {
  // State
  isOnline: boolean;
  syncInProgress: boolean;
  pendingItems: OfflineSyncItem[];
  lastSyncTime: Date | null;
  
  // Operations
  addToQueue: (operation: string, payload: any) => Promise<string>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  
  // Settings
  enableOfflineMode: boolean;
  setEnableOfflineMode: (enabled: boolean) => void;
}

const STORAGE_KEY = 'creditcraft_offline_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;

export function useOfflineSync(): UseOfflineSyncResult {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingItems, setPendingItems] = useState<OfflineSyncItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [enableOfflineMode, setEnableOfflineMode] = useState(true);

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (enableOfflineMode && pendingItems.length > 0) {
        processQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableOfflineMode, pendingItems.length]);

  // Load queue from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setPendingItems(data.items || []);
        setLastSyncTime(data.lastSync ? new Date(data.lastSync) : null);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  }, []);

  // Save queue to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        items: pendingItems,
        lastSync: lastSyncTime?.toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }, [pendingItems, lastSyncTime]);

  /**
   * Add operation to offline sync queue
   */
  const addToQueue = useCallback(async (operation: string, payload: any): Promise<string> => {
    // Validate payload
    const validation = validateOfflinePayload(payload);
    if (!validation.isValid) {
      throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
    }

    // Check queue size limit
    if (pendingItems.length >= MAX_QUEUE_SIZE) {
      throw new Error('Offline queue is full. Please sync or clear old items.');
    }

    const item: OfflineSyncItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      payload: {
        ...payload,
        operation, // Include operation in payload for backend processing
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId()
      },
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    setPendingItems(prev => [...prev, item]);
    return item.id;
  }, [pendingItems.length]);

  /**
   * Process entire offline sync queue
   */
  const processQueue = useCallback(async (): Promise<void> => {
    if (!isOnline || syncInProgress || pendingItems.length === 0) {
      return;
    }

    setSyncInProgress(true);

    try {
      // Process items in order
      for (const item of pendingItems) {
        try {
          await processItem(item);
          
          // Remove successfully processed item
          setPendingItems(prev => prev.filter(p => p.id !== item.id));
          
        } catch (error) {
          // Increment retry count
          const updatedItem = {
            ...item,
            retryCount: item.retryCount + 1
          };

          if (updatedItem.retryCount >= MAX_RETRY_COUNT) {
            // Remove item after max retries
            setPendingItems(prev => prev.filter(p => p.id !== item.id));
            console.error(`Max retries exceeded for item ${item.id}:`, error);
          } else {
            // Update item with new retry count
            setPendingItems(prev => 
              prev.map(p => p.id === item.id ? updatedItem : p)
            );
          }
        }
      }

      setLastSyncTime(new Date());

    } finally {
      setSyncInProgress(false);
    }
  }, [isOnline, syncInProgress, pendingItems]);

  /**
   * Process individual sync item
   */
  const processItem = useCallback(async (item: OfflineSyncItem): Promise<void> => {
    const apiUrl = getApiUrl();
    
    // Determine endpoint based on operation
    let endpoint = '';
    let method = 'POST';
    
    switch (item.operation) {
      case 'CREDIT_REDEEM':
        endpoint = '/api/credit-notes/redeem';
        break;
      case 'CREDIT_CREATE':
        endpoint = '/api/credit-notes';
        break;
      case 'TRANSACTION_LOG':
        endpoint = '/api/credit-notes/transactions';
        break;
      default:
        endpoint = '/api/offline-sync';
    }

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-POS-Request': 'true',
        'X-Offline-Sync': 'true'
      },
      body: JSON.stringify(item.payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API operation failed');
    }
  }, []);

  /**
   * Clear entire offline queue
   */
  const clearQueue = useCallback(async (): Promise<void> => {
    setPendingItems([]);
    setLastSyncTime(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * Retry specific item
   */
  const retryItem = useCallback(async (itemId: string): Promise<void> => {
    const item = pendingItems.find(p => p.id === itemId);
    if (!item) return;

    try {
      await processItem(item);
      setPendingItems(prev => prev.filter(p => p.id !== itemId));
    } catch (error) {
      // Update retry count
      setPendingItems(prev =>
        prev.map(p =>
          p.id === itemId
            ? { ...p, retryCount: p.retryCount + 1 }
            : p
        )
      );
      throw error;
    }
  }, [pendingItems, processItem]);

  /**
   * Remove specific item from queue
   */
  const removeItem = useCallback(async (itemId: string): Promise<void> => {
    setPendingItems(prev => prev.filter(p => p.id !== itemId));
  }, []);

  return {
    isOnline,
    syncInProgress,
    pendingItems,
    lastSyncTime,
    addToQueue,
    processQueue,
    clearQueue,
    retryItem,
    removeItem,
    enableOfflineMode,
    setEnableOfflineMode
  };
}

/**
 * Get device ID for tracking
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  // Try to get from localStorage first
  let deviceId = localStorage.getItem('pos_device_id');
  
  if (!deviceId) {
    // Generate new device ID
    deviceId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('pos_device_id', deviceId);
  }
  
  return deviceId;
}

/**
 * Get API URL based on environment
 */
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://localhost:3000'; // Development fallback
}