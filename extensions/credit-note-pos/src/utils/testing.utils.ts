// Comprehensive testing utilities for Shopify POS extension
import { CreditNote, StaffPermission } from '../types/credit.types';

/**
 * Mock data generators for testing
 */
export class MockDataGenerator {
  /**
   * Generate mock credit notes for testing
   */
  static generateMockCreditNotes(count: number = 10): CreditNote[] {
    const statuses = ['active', 'used', 'expired', 'cancelled'] as const;
    const reasons = [
      'Product return',
      'Service issue',
      'Promotional credit',
      'Loyalty reward',
      'Customer service gesture'
    ];
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

    return Array.from({ length: count }, (_, i) => ({
      id: `credit_${i + 1}_${Date.now()}`,
      noteNumber: `CN${(1000 + i).toString()}`,
      customerId: `customer_${i + 1}`,
      customerName: `Test Customer ${i + 1}`,
      customerEmail: `customer${i + 1}@test.com`,
      originalAmount: parseFloat((Math.random() * 500 + 10).toFixed(2)),
      remainingAmount: parseFloat((Math.random() * 500 + 10).toFixed(2)),
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)] as any,
      qrCode: `https://example.com/credit/${i + 1}`,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      expiresAt: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  /**
   * Generate mock staff permissions for testing
   */
  static generateMockStaffPermissions(count: number = 5): StaffPermission[] {
    const roles = ['Manager', 'Cashier', 'Senior Cashier', 'Supervisor', 'Admin'];
    const permissions = [
      'create_credits',
      'redeem_credits',
      'void_credits',
      'view_reports',
      'manage_settings',
      'bulk_operations',
      'override_limits'
    ];

    return Array.from({ length: count }, (_, i) => ({
      staffId: `staff_${i + 1}`,
      staffName: `Staff Member ${i + 1}`,
      role: roles[i % roles.length],
      permissions: permissions.slice(0, Math.floor(Math.random() * permissions.length) + 1),
      dailyLimit: Math.floor(Math.random() * 5000) + 1000,
      requiresApproval: Math.random() > 0.5,
      isActive: Math.random() > 0.1,
      lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }));
  }
}

/**
 * Test scenario generators
 */
export class TestScenarios {
  /**
   * Generate barcode scanning test scenarios
   */
  static getBarcodeTestCases() {
    return [
      {
        name: 'Valid UPC Barcode',
        barcode: '123456789012',
        expectedType: 'UPC',
        shouldPass: true
      },
      {
        name: 'Valid EAN-13 Barcode',
        barcode: '1234567890123',
        expectedType: 'EAN-13',
        shouldPass: true
      },
      {
        name: 'Valid Code128 Barcode',
        barcode: 'ABC123XYZ',
        expectedType: 'Code128',
        shouldPass: true
      },
      {
        name: 'Valid Credit Note Barcode',
        barcode: 'CN123456789012',
        expectedType: 'CreditNote',
        shouldPass: true
      },
      {
        name: 'Invalid Barcode - Too Short',
        barcode: '123',
        expectedType: 'Unknown',
        shouldPass: false
      },
      {
        name: 'Invalid Barcode - Invalid Characters',
        barcode: '12345@#$%^',
        expectedType: 'Unknown',
        shouldPass: false
      },
      {
        name: 'Empty Barcode',
        barcode: '',
        expectedType: 'Unknown',
        shouldPass: false
      }
    ];
  }

  /**
   * Generate QR code test scenarios
   */
  static getQRCodeTestCases() {
    return [
      {
        name: 'Valid Credit QR Code',
        qrData: 'https://example.com/credit/CN123456?amount=50.00&currency=USD',
        shouldPass: true
      },
      {
        name: 'Valid Transaction QR Code',
        qrData: 'TXN:123456:50.00:USD:2025-01-01',
        shouldPass: true
      },
      {
        name: 'Invalid QR Code - Malformed URL',
        qrData: 'not-a-valid-url',
        shouldPass: false
      },
      {
        name: 'Invalid QR Code - Missing Required Parameters',
        qrData: 'https://example.com/credit/CN123456',
        shouldPass: false
      },
      {
        name: 'Empty QR Code',
        qrData: '',
        shouldPass: false
      }
    ];
  }

  /**
   * Generate performance test scenarios
   */
  static getPerformanceTestCases() {
    return [
      {
        name: 'Large Dataset Search',
        dataSize: 10000,
        operation: 'search',
        expectedMaxTime: 1000 // ms
      },
      {
        name: 'Bulk Credit Processing',
        dataSize: 200,
        operation: 'bulk_process',
        expectedMaxTime: 5000 // ms
      },
      {
        name: 'Virtual List Rendering',
        dataSize: 1000,
        operation: 'render',
        expectedMaxTime: 500 // ms
      },
      {
        name: 'Cache Performance',
        dataSize: 5000,
        operation: 'cache_lookup',
        expectedMaxTime: 50 // ms
      }
    ];
  }
}

/**
 * Test assertion utilities
 */
export class TestAssertions {
  /**
   * Assert that a value is defined and not null
   */
  static assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
    if (value === undefined || value === null) {
      throw new Error(message || 'Expected value to be defined');
    }
  }

  /**
   * Assert that two values are equal
   */
  static assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
  }

  /**
   * Assert that a value is true
   */
  static assertTrue(value: boolean, message?: string): void {
    if (!value) {
      throw new Error(message || 'Expected value to be true');
    }
  }

  /**
   * Assert that a value is false
   */
  static assertFalse(value: boolean, message?: string): void {
    if (value) {
      throw new Error(message || 'Expected value to be false');
    }
  }

  /**
   * Assert that an array contains a specific item
   */
  static assertContains<T>(array: T[], item: T, message?: string): void {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to contain ${item}`);
    }
  }

  /**
   * Assert that an array has a specific length
   */
  static assertLength<T>(array: T[], expectedLength: number, message?: string): void {
    if (array.length !== expectedLength) {
      throw new Error(message || `Expected array length ${expectedLength}, but got ${array.length}`);
    }
  }

  /**
   * Assert that a function throws an error
   */
  static assertThrows(fn: () => void, message?: string): void {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw an error');
    }
  }

  /**
   * Assert that an async function throws an error
   */
  static async assertThrowsAsync(fn: () => Promise<void>, message?: string): Promise<void> {
    let threw = false;
    try {
      await fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected async function to throw an error');
    }
  }

  /**
   * Assert that a value matches a regular expression
   */
  static assertMatches(value: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(value)) {
      throw new Error(message || `Expected "${value}" to match pattern ${pattern}`);
    }
  }

  /**
   * Assert that an object has a specific property
   */
  static assertHasProperty(obj: any, property: string, message?: string): void {
    if (!(property in obj)) {
      throw new Error(message || `Expected object to have property "${property}"`);
    }
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  private static measurements: Map<string, number[]> = new Map();

  /**
   * Start measuring performance for an operation
   */
  static startMeasurement(operationName: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMeasurement(operationName, duration);
      return duration;
    };
  }

  /**
   * Record a performance measurement
   */
  static recordMeasurement(operationName: string, duration: number): void {
    if (!this.measurements.has(operationName)) {
      this.measurements.set(operationName, []);
    }
    this.measurements.get(operationName)!.push(duration);
  }

  /**
   * Get performance statistics for an operation
   */
  static getStats(operationName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const measurements = this.measurements.get(operationName);
    if (!measurements || measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      count: measurements.length,
      average: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      p95: sorted[p95Index] || sorted[sorted.length - 1]
    };
  }

  /**
   * Clear all measurements
   */
  static clearMeasurements(): void {
    this.measurements.clear();
  }

  /**
   * Run a performance benchmark
   */
  static async runBenchmark<T>(
    name: string,
    operation: () => Promise<T>,
    iterations: number = 100
  ): Promise<{
    results: T[];
    stats: {
      count: number;
      average: number;
      min: number;
      max: number;
      p95: number;
    };
  }> {
    const results: T[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const stopMeasurement = this.startMeasurement(name);
      const result = await operation();
      stopMeasurement();
      results.push(result);
    }

    const stats = this.getStats(name)!;
    return { results, stats };
  }
}

/**
 * Mock API responses for testing
 */
export class MockAPIResponses {
  /**
   * Mock successful GraphQL response
   */
  static mockGraphQLSuccess<T>(data: T) {
    return {
      data,
      errors: undefined,
      extensions: {}
    };
  }

  /**
   * Mock GraphQL error response
   */
  static mockGraphQLError(message: string, code?: string) {
    return {
      data: null,
      errors: [{
        message,
        extensions: { code }
      }],
      extensions: {}
    };
  }

  /**
   * Mock credit note creation response
   */
  static mockCreditCreationResponse(creditNote: Partial<CreditNote>) {
    return this.mockGraphQLSuccess({
      creditNoteCreate: {
        creditNote: {
          id: 'gid://shopify/CreditNote/123456',
          noteNumber: 'CN1234',
          amount: '50.00',
          currency: 'USD',
          status: 'ACTIVE',
          ...creditNote
        },
        userErrors: []
      }
    });
  }

  /**
   * Mock credit note redemption response
   */
  static mockCreditRedemptionResponse(success: boolean = true) {
    if (success) {
      return this.mockGraphQLSuccess({
        creditNoteRedeem: {
          creditNote: {
            id: 'gid://shopify/CreditNote/123456',
            status: 'USED',
            usedAt: new Date().toISOString()
          },
          userErrors: []
        }
      });
    } else {
      return this.mockGraphQLError('Credit note not found or already used');
    }
  }

  /**
   * Mock order creation response
   */
  static mockOrderCreationResponse() {
    return this.mockGraphQLSuccess({
      draftOrderCreate: {
        draftOrder: {
          id: 'gid://shopify/DraftOrder/123456',
          name: '#D1234',
          totalPrice: '50.00'
        },
        userErrors: []
      }
    });
  }
}

/**
 * Test environment setup utilities
 */
export class TestEnvironment {
  private static originalConsole: Console;
  private static logs: string[] = [];

  /**
   * Setup test environment
   */
  static setup(): void {
    // Mock console for testing
    this.originalConsole = console;
    this.logs = [];
    
    global.console = {
      ...console,
      log: (...args) => {
        this.logs.push(args.join(' '));
        this.originalConsole.log(...args);
      },
      error: (...args) => {
        this.logs.push('ERROR: ' + args.join(' '));
        this.originalConsole.error(...args);
      },
      warn: (...args) => {
        this.logs.push('WARN: ' + args.join(' '));
        this.originalConsole.warn(...args);
      }
    };

    // Mock performance API if not available
    if (typeof performance === 'undefined') {
      global.performance = {
        now: () => Date.now(),
        mark: () => {},
        measure: () => {},
        clearMarks: () => {},
        clearMeasures: () => {},
        getEntriesByName: () => [],
        getEntriesByType: () => [],
        getEntries: () => []
      } as any;
    }
  }

  /**
   * Cleanup test environment
   */
  static cleanup(): void {
    if (this.originalConsole) {
      global.console = this.originalConsole;
    }
    this.logs = [];
  }

  /**
   * Get captured logs
   */
  static getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear captured logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Integration test utilities
 */
export class IntegrationTestUtils {
  /**
   * Simulate barcode scanning
   */
  static simulateBarcodeScan(barcode: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(barcode);
      }, 100); // Simulate scan delay
    });
  }

  /**
   * Simulate QR code generation
   */
  static simulateQRGeneration(data: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`data:image/png;base64,mockqrcode_${btoa(data)}`);
      }, 200); // Simulate generation delay
    });
  }

  /**
   * Simulate network delay
   */
  static simulateNetworkDelay(ms: number = 500): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Simulate offline/online state changes
   */
  static simulateOfflineMode(duration: number = 5000): Promise<void> {
    return new Promise((resolve) => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));

      setTimeout(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true
        });

        // Dispatch online event
        window.dispatchEvent(new Event('online'));
        resolve();
      }, duration);
    });
  }
}