import { createContext, useContext, ReactNode, useEffect } from 'react';

interface EmbeddedAppContextType {
  toast: (message: string, options?: any) => void;
  loading: (isLoading: boolean) => void;
  ready: boolean;
}

const EmbeddedAppContext = createContext<EmbeddedAppContextType | null>(null);

export function useEmbeddedApp() {
  const context = useContext(EmbeddedAppContext);
  if (!context) {
    throw new Error('useEmbeddedApp must be used within an EmbeddedAppProvider');
  }
  return context;
}

/**
 * 2025 Embedded App Provider - Replaces deprecated Frame component
 * Provides context that IndexTable and other Polaris components expect
 */
export function EmbeddedAppProvider({ children }: { children: ReactNode }) {
  const contextValue = {
    toast: (message: string, options?: any) => {
      if (typeof window !== 'undefined' && window.shopify?.toast) {
        window.shopify.toast.show(message, options);
      } else {
        console.log('Toast:', message);
      }
    },
    loading: (isLoading: boolean) => {
      if (typeof window !== 'undefined' && window.shopify?.loading) {
        window.shopify.loading(isLoading);
      }
    },
    ready: typeof window !== 'undefined' && !!window.shopify
  };

  // Ensure App Bridge is ready before rendering children
  useEffect(() => {
    if (typeof window !== 'undefined' && window.shopify) {
      window.shopify.ready(() => {
        console.log('🎯 FRAME CONTEXT REPLACEMENT: App Bridge Ready for IndexTable');
      });
    }
  }, []);

  return (
    <EmbeddedAppContext.Provider value={contextValue}>
      {children}
    </EmbeddedAppContext.Provider>
  );
}

// Type declarations for window.shopify
declare global {
  interface Window {
    shopify?: {
      ready: (callback: () => void) => void;
      toast: {
        show: (message: string, options?: any) => void;
      };
      loading: (isLoading: boolean) => void;
    };
  }
}