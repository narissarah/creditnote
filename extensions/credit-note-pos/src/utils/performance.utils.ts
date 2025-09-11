// Performance optimization utilities for high-volume POS operations
import { CreditNote, OfflineSyncItem } from '../types/credit.types';

/**
 * Debounce function for search inputs and API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function for high-frequency events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Virtual list item interface for large datasets
 */
export interface VirtualListItem {
  id: string;
  height: number;
  data: any;
}

/**
 * Calculate visible items for virtual scrolling
 */
export function calculateVisibleItems(
  items: VirtualListItem[],
  containerHeight: number,
  scrollTop: number,
  itemHeight: number = 60,
  overscan: number = 5
): {
  visibleItems: VirtualListItem[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
} {
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY
  };
}

/**
 * Chunk array for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Memory-efficient credit search
 */
export class CreditSearchIndex {
  private searchIndex: Map<string, Set<string>> = new Map();
  private credits: Map<string, CreditNote> = new Map();
  
  constructor() {
    this.buildIndex = debounce(this.buildIndex.bind(this), 300);
  }
  
  /**
   * Add credits to search index
   */
  addCredits(credits: CreditNote[]): void {
    credits.forEach(credit => {
      this.credits.set(credit.id, credit);
    });
    this.buildIndex();
  }
  
  /**
   * Remove credit from index
   */
  removeCredit(creditId: string): void {
    this.credits.delete(creditId);
    // Remove from search index
    this.searchIndex.forEach((creditIds) => {
      creditIds.delete(creditId);
    });
  }
  
  /**
   * Build searchable index
   */
  private buildIndex(): void {
    this.searchIndex.clear();
    
    this.credits.forEach((credit, creditId) => {
      const searchableFields = [
        credit.noteNumber,
        credit.customerName,
        credit.customerEmail,
        credit.reason,
        credit.status,
        credit.currency
      ].filter(Boolean);
      
      searchableFields.forEach(field => {
        const words = field!.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 1) {
            if (!this.searchIndex.has(word)) {
              this.searchIndex.set(word, new Set());
            }
            this.searchIndex.get(word)!.add(creditId);
          }
        });
      });
    });
  }
  
  /**
   * Search credits with fuzzy matching
   */
  search(query: string, limit: number = 50): CreditNote[] {
    if (!query || query.length < 2) {
      return Array.from(this.credits.values()).slice(0, limit);
    }
    
    const queryWords = query.toLowerCase().split(/\s+/);
    const matchingCreditIds = new Map<string, number>();
    
    queryWords.forEach(word => {
      // Exact match
      if (this.searchIndex.has(word)) {
        this.searchIndex.get(word)!.forEach(creditId => {
          matchingCreditIds.set(creditId, (matchingCreditIds.get(creditId) || 0) + 2);
        });
      }
      
      // Partial match
      this.searchIndex.forEach((creditIds, indexWord) => {
        if (indexWord.includes(word) && indexWord !== word) {
          creditIds.forEach(creditId => {
            matchingCreditIds.set(creditId, (matchingCreditIds.get(creditId) || 0) + 1);
          });
        }
      });
    });
    
    // Sort by relevance score
    const sortedMatches = Array.from(matchingCreditIds.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .slice(0, limit);
    
    return sortedMatches
      .map(([creditId]) => this.credits.get(creditId)!)
      .filter(Boolean);
  }
  
  /**
   * Get index statistics
   */
  getStats(): {
    totalCredits: number;
    indexSize: number;
    memoryUsage: number;
  } {
    let totalIndexEntries = 0;
    this.searchIndex.forEach(creditIds => {
      totalIndexEntries += creditIds.size;
    });
    
    return {
      totalCredits: this.credits.size,
      indexSize: this.searchIndex.size,
      memoryUsage: totalIndexEntries * 8 // Rough estimate in bytes
    };
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private memoryUsage: number[] = [];
  
  /**
   * Start timing an operation
   */
  startTimer(operation: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }
  
  /**
   * Record a performance metric
   */
  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }
  
  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.memoryUsage.push(memory.usedJSHeapSize);
      
      // Keep only last 50 measurements
      if (this.memoryUsage.length > 50) {
        this.memoryUsage.shift();
      }
    }
  }
  
  /**
   * Get performance statistics
   */
  getStats(operation: string): {
    average: number;
    min: number;
    max: number;
    p95: number;
    count: number;
  } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    
    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p95: sorted[p95Index] || sorted[sorted.length - 1],
      count: values.length
    };
  }
  
  /**
   * Get all performance metrics
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.metrics.forEach((_, operation) => {
      stats[operation] = this.getStats(operation);
    });
    
    if (this.memoryUsage.length > 0) {
      stats.memoryUsage = {
        current: this.memoryUsage[this.memoryUsage.length - 1],
        average: this.memoryUsage.reduce((sum, val) => sum + val, 0) / this.memoryUsage.length,
        trend: this.memoryUsage.length > 1 
          ? this.memoryUsage[this.memoryUsage.length - 1] - this.memoryUsage[0]
          : 0
      };
    }
    
    return stats;
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.memoryUsage = [];
  }
}

/**
 * Batch processor for high-volume operations
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processing = false;
  private processors: Map<string, (items: T[]) => Promise<void>> = new Map();
  
  constructor(
    private batchSize: number = 10,
    private flushInterval: number = 1000
  ) {
    // Auto-flush on interval
    setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }
  
  /**
   * Register a batch processor
   */
  registerProcessor(type: string, processor: (items: T[]) => Promise<void>): void {
    this.processors.set(type, processor);
  }
  
  /**
   * Add item to processing queue
   */
  add(item: T): void {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }
  
  /**
   * Flush current queue
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const items = this.queue.splice(0);
    
    try {
      // Group items by type if they have a type property
      const grouped = new Map<string, T[]>();
      
      items.forEach(item => {
        const type = (item as any).type || 'default';
        if (!grouped.has(type)) {
          grouped.set(type, []);
        }
        grouped.get(type)!.push(item);
      });
      
      // Process each group
      const promises = Array.from(grouped.entries()).map(async ([type, groupItems]) => {
        const processor = this.processors.get(type) || this.processors.get('default');
        if (processor) {
          await processor(groupItems);
        }
      });
      
      await Promise.all(promises);
      
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue failed items
      this.queue.unshift(...items);
    } finally {
      this.processing = false;
    }
  }
  
  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    processing: boolean;
    processorCount: number;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      processorCount: this.processors.size
    };
  }
}

/**
 * Cache with automatic cleanup and size limits
 */
export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; lastAccessed: number }>();
  
  constructor(
    private maxSize: number = 1000,
    private maxAge: number = 5 * 60 * 1000 // 5 minutes
  ) {
    // Cleanup expired entries periodically
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }
  
  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() - entry.lastAccessed > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Update access time
    entry.lastAccessed = Date.now();
    return entry.value;
  }
  
  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
      
      // Remove oldest 10% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, {
      value,
      lastAccessed: Date.now()
    });
  }
  
  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: K[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.lastAccessed > this.maxAge) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.cache.delete(key));
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: 0 // Would need to track hits/misses
    };
  }
}

/**
 * Initialize global performance utilities
 */
export const globalPerformanceMonitor = new PerformanceMonitor();
export const globalCreditSearchIndex = new CreditSearchIndex();
export const globalBatchProcessor = new BatchProcessor<OfflineSyncItem>(20, 2000);

// Performance monitoring React hook
export function usePerformanceMonitor() {
  const measureOperation = (operation: string) => {
    return globalPerformanceMonitor.startTimer(operation);
  };
  
  const recordMemoryUsage = () => {
    globalPerformanceMonitor.recordMemoryUsage();
  };
  
  const getPerformanceStats = () => {
    return globalPerformanceMonitor.getAllStats();
  };
  
  return {
    measureOperation,
    recordMemoryUsage,
    getPerformanceStats
  };
}

/**
 * Optimize component re-renders with deep comparison
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
  return (num / 1000000000).toFixed(1) + 'B';
}