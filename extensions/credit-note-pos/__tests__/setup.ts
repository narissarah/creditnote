// Jest test setup file
import { TestEnvironment } from '../src/utils/testing.utils';

// Setup test environment before all tests
beforeAll(() => {
  TestEnvironment.setup();
});

// Cleanup after all tests
afterAll(() => {
  TestEnvironment.cleanup();
});

// Mock Shopify UI Extensions
jest.mock('@shopify/ui-extensions-react/point-of-sale', () => ({
  Screen: ({ children }: any) => children,
  ScrollView: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  Button: ({ children, onPress }: any) => ({ children, onPress }),
  BlockStack: ({ children }: any) => children,
  InlineStack: ({ children }: any) => children,
  Divider: () => null,
  Badge: ({ children }: any) => children,
  ProgressIndicator: () => null,
  TextField: ({ value, onChange }: any) => ({ value, onChange }),
  SearchField: ({ value, onChange }: any) => ({ value, onChange }),
  List: ({ children }: any) => children,
  Grid: ({ children }: any) => children,
  GridItem: ({ children }: any) => children,
  Card: ({ children }: any) => children,
  Banner: ({ children }: any) => children,
  Spinner: () => null,
  Icon: () => null,
  Pressable: ({ children, onPress }: any) => ({ children, onPress }),
  PrintingOptions: () => null,
  usePrinting: () => ({
    print: jest.fn().mockResolvedValue(true)
  }),
  useCartLines: () => ({ cartLines: [] }),
  useApplyCartLinesChange: () => ({
    applyCartLinesChange: jest.fn().mockResolvedValue({ type: 'success' })
  }),
  useScannerData: () => ({
    data: null,
    subscribe: jest.fn()
  }),
  useApi: () => ({
    query: jest.fn().mockResolvedValue({ data: null }),
    mutation: jest.fn().mockResolvedValue({ data: null })
  }),
  useStorage: () => ({
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true)
  }),
  useNavigate: () => ({
    navigate: jest.fn()
  }),
  useToast: () => ({
    show: jest.fn()
  }),
  useTranslate: () => (key: string) => key
}));

// Mock performance API
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    getEntries: jest.fn(() => []),
    memory: {
      usedJSHeapSize: 10 * 1024 * 1024, // 10MB
      totalJSHeapSize: 50 * 1024 * 1024, // 50MB
      jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
    }
  }
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    onLine: true,
    userAgent: 'Jest Test Runner'
  }
});

// Mock window events
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    location: {
      href: 'https://example.com'
    }
  }
});

// Mock console methods to prevent test output pollution
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Restore console for debugging when needed
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Mock setTimeout/setInterval for performance tests
jest.useFakeTimers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  TestEnvironment.clearLogs();
});