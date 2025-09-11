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
  syncStats: SyncStats;
  
  // Operations
  addToQueue: (operation: string, payload: any, priority?: 'HIGH' | 'MEDIUM' | 'LOW') => Promise<string>;
  processQueue: () => Promise<void>;
  processBatch: (itemIds: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  
  // Conflict Resolution
  resolveConflict: (itemId: string, resolution: 'LOCAL' | 'SERVER' | 'MERGE') => Promise<void>;
  
  // Settings
  enableOfflineMode: boolean;
  setEnableOfflineMode: (enabled: boolean) => void;
  syncStrategy: 'IMMEDIATE' | 'BATCH' | 'SCHEDULED';
  setSyncStrategy: (strategy: 'IMMEDIATE' | 'BATCH' | 'SCHEDULED') => void;
}

export interface SyncStats {
  totalSynced: number;
  totalFailed: number;
  lastSyncDuration: number;
  queueSize: number;
  successRate: number;
}

const STORAGE_KEY = 'creditcraft_offline_queue';
const STATS_KEY = 'creditcraft_sync_stats';
const MAX_QUEUE_SIZE = 200;
const MAX_RETRY_COUNT = 5;
const BATCH_SIZE = 10;
const PRIORITY_WEIGHTS = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function useOfflineSync(): UseOfflineSyncResult {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingItems, setPendingItems] = useState<OfflineSyncItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [enableOfflineMode, setEnableOfflineMode] = useState(true);
  const [syncStrategy, setSyncStrategy] = useState<'IMMEDIATE' | 'BATCH' | 'SCHEDULED'>('BATCH');
  const [syncStats, setSyncStats] = useState<SyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncDuration: 0,
    queueSize: 0,
    successRate: 100
  });

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
   * Add operation to offline sync queue with priority
   */
  const addToQueue = useCallback(async (
    operation: string, 
    payload: any,
    priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
  ): Promise<string> => {
    // Validate payload
    const validation = validateOfflinePayload(payload);
    if (!validation.isValid) {
      throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
    }

    // Check queue size limit
    if (pendingItems.length >= MAX_QUEUE_SIZE) {
      // Auto-remove oldest low priority items if queue is full
      const lowPriorityItems = pendingItems
        .filter(item => (item as any).priority === 'LOW')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      if (lowPriorityItems.length > 0) {
        setPendingItems(prev => prev.filter(p => p.id !== lowPriorityItems[0].id));
      } else {
        throw new Error('Offline queue is full. Please sync or clear old items.');
      }
    }

    const item: OfflineSyncItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      payload: {
        ...payload,
        operation,
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId(),
        priority
      },
      timestamp: new Date().toISOString(),
      retryCount: 0,
      priority
    } as OfflineSyncItem & { priority: string };

    // Insert item based on priority
    setPendingItems(prev => {
      const newItems = [...prev, item];
      // Sort by priority and timestamp
      return newItems.sort((a, b) => {
        const aPriority = PRIORITY_WEIGHTS[(a as any).priority as keyof typeof PRIORITY_WEIGHTS] || 2;
        const bPriority = PRIORITY_WEIGHTS[(b as any).priority as keyof typeof PRIORITY_WEIGHTS] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // Same priority, sort by timestamp (older first)
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
    });

    // Trigger immediate sync for high priority items if online
    if (priority === 'HIGH' && isOnline && syncStrategy === 'IMMEDIATE') {
      setTimeout(() => processQueue(), 100);
    }

    return item.id;
  }, [pendingItems.length, isOnline, syncStrategy]);

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
   * Process batch of specific items
   */
  const processBatch = useCallback(async (itemIds: string[]): Promise<void> => {
    if (!isOnline || syncInProgress) return;

    const itemsToProcess = pendingItems.filter(item => itemIds.includes(item.id));
    if (itemsToProcess.length === 0) return;

    setSyncInProgress(true);
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      // Process items in batches for better performance
      const batches = [];
      for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
        batches.push(itemsToProcess.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (item) => {
          try {
            await processItem(item);
            setPendingItems(prev => prev.filter(p => p.id !== item.id));
            successCount++;
          } catch (error) {
            const updatedItem = { ...item, retryCount: item.retryCount + 1 };
            
            if (updatedItem.retryCount >= MAX_RETRY_COUNT) {
              setPendingItems(prev => prev.filter(p => p.id !== item.id));
              console.error(`Max retries exceeded for item ${item.id}:`, error);
            } else {
              setPendingItems(prev => 
                prev.map(p => p.id === item.id ? updatedItem : p)
              );
            }
            failureCount++;
          }
        });

        // Process batch concurrently but wait for completion
        await Promise.all(batchPromises);
      }

      // Update stats
      const duration = Date.now() - startTime;
      updateSyncStats(successCount, failureCount, duration);
      
      if (successCount > 0) {
        setLastSyncTime(new Date());
      }

    } finally {
      setSyncInProgress(false);
    }
  }, [isOnline, syncInProgress, pendingItems, processItem]);

  /**
   * Resolve conflicts for items that failed due to server conflicts
   */
  const resolveConflict = useCallback(async (
    itemId: string,
    resolution: 'LOCAL' | 'SERVER' | 'MERGE'
  ): Promise<void> => {
    const item = pendingItems.find(p => p.id === itemId);
    if (!item) return;

    try {
      let resolvedPayload = { ...item.payload };

      switch (resolution) {
        case 'LOCAL':
          // Use local version, force update server
          resolvedPayload.forceUpdate = true;
          break;
          
        case 'SERVER':
          // Fetch latest from server and discard local changes
          const serverData = await fetchLatestFromServer(item);
          if (serverData) {
            // Remove item as server version is newer
            setPendingItems(prev => prev.filter(p => p.id !== itemId));
            return;
          }
          break;
          
        case 'MERGE':
          // Attempt to merge changes
          const mergedData = await attemptMerge(item);
          if (mergedData) {
            resolvedPayload = mergedData;
          }
          break;
      }

      // Update item with resolved payload
      const updatedItem = {
        ...item,
        payload: resolvedPayload,
        retryCount: 0 // Reset retry count
      };

      setPendingItems(prev => 
        prev.map(p => p.id === itemId ? updatedItem : p)
      );

      // Try to process the resolved item immediately
      if (isOnline) {
        await processItem(updatedItem);
        setPendingItems(prev => prev.filter(p => p.id !== itemId));
      }

    } catch (error) {
      console.error('Conflict resolution failed:', error);
      throw error;
    }
  }, [pendingItems, isOnline, processItem]);

  /**
   * Update sync statistics
   */
  const updateSyncStats = useCallback((
    successCount: number, 
    failureCount: number, 
    duration: number
  ) => {
    setSyncStats(prev => {
      const newTotalSynced = prev.totalSynced + successCount;
      const newTotalFailed = prev.totalFailed + failureCount;
      const totalAttempts = newTotalSynced + newTotalFailed;
      
      const newStats = {
        totalSynced: newTotalSynced,
        totalFailed: newTotalFailed,
        lastSyncDuration: duration,
        queueSize: pendingItems.length,
        successRate: totalAttempts > 0 ? (newTotalSynced / totalAttempts) * 100 : 100
      };

      // Save stats to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
        } catch (error) {
          console.warn('Failed to save sync stats:', error);
        }
      }

      return newStats;
    });
  }, [pendingItems.length]);

  // Load stats from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STATS_KEY);
      if (stored) {
        setSyncStats(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load sync stats:', error);
    }
  }, []);

  // Update queue size in stats when pendingItems change
  useEffect(() => {
    setSyncStats(prev => ({ ...prev, queueSize: pendingItems.length }));
  }, [pendingItems.length]);

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
    syncStats,
    addToQueue,
    processQueue,
    processBatch,
    clearQueue,
    retryItem,
    removeItem,
    resolveConflict,
    enableOfflineMode,
    setEnableOfflineMode,
    syncStrategy,
    setSyncStrategy
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

/**
 * Fetch latest data from server for conflict resolution
 */
async function fetchLatestFromServer(item: OfflineSyncItem): Promise<any | null> {
  try {
    const apiUrl = getApiUrl();
    let endpoint = '';
    
    switch (item.operation) {
      case 'CREDIT_REDEEM':
        endpoint = `/api/credit-notes/${item.payload.creditNoteId}`;
        break;
      default:
        return null;
    }

    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'X-POS-Request': 'true',
        'X-Conflict-Resolution': 'true'
      }
    });

    if (response.ok) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch latest from server:', error);
    return null;
  }
}

/**
 * Attempt to merge local and server changes
 */
async function attemptMerge(item: OfflineSyncItem): Promise<any | null> {
  try {
    const serverData = await fetchLatestFromServer(item);
    if (!serverData) return null;

    // Simple merge strategy - prefer local changes for most fields
    // but use server data for computed fields like remaining amounts
    const merged = {
      ...serverData.data,
      ...item.payload,
      // Preserve server-computed fields
      remainingAmount: serverData.data?.remainingAmount,
      status: serverData.data?.status,
      updatedAt: new Date().toISOString(),
      mergedAt: new Date().toISOString(),
      conflictResolved: true
    };

    return merged;
  } catch (error) {
    console.error('Failed to merge data:', error);
    return null;
  }
}