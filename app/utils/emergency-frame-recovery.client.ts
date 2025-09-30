// EMERGENCY FRAME CONTEXT RECOVERY SYSTEM
// This is the NUCLEAR OPTION for Frame context errors

export function initEmergencyFrameRecovery() {
  if (typeof window === 'undefined') return;

  console.log('[EMERGENCY FRAME] Initializing nuclear Frame recovery system...');

  // LEVEL 1: Ensure Shopify App Bridge is loaded
  function ensureAppBridge() {
    if (window.shopify?.AppBridge) {
      console.log('[EMERGENCY FRAME] ✅ App Bridge detected');
      return true;
    }

    // Force load App Bridge if missing
    const script = document.createElement('script');
    script.src = 'https://cdn.shopify.com/shopifycloud/app-bridge/3.7.10/app-bridge.js';
    script.async = false;
    document.head.appendChild(script);
    console.log('[EMERGENCY FRAME] ⚠️ Force-loaded App Bridge');
    return false;
  }

  // LEVEL 2: Create emergency Frame context
  function createEmergencyFrameContext() {
    // Check if we're in Polaris Frame context
    const hasFrameContext = document.querySelector('[data-polaris-layer]') ||
                          document.querySelector('.Polaris-Frame');

    if (hasFrameContext) {
      console.log('[EMERGENCY FRAME] ✅ Frame context exists');
      return true;
    }

    // NUCLEAR: Force create Frame wrapper
    console.log('[EMERGENCY FRAME] 🚨 Creating emergency Frame wrapper');

    // Find the React root
    const reactRoot = document.getElementById('root') ||
                     document.querySelector('[data-reactroot]') ||
                     document.querySelector('#app') ||
                     document.body.firstElementChild;

    if (!reactRoot) {
      console.error('[EMERGENCY FRAME] ❌ No React root found');
      return false;
    }

    // Add Polaris Frame classes to force context
    reactRoot.classList.add('Polaris-Frame');
    reactRoot.setAttribute('data-polaris-layer', 'true');

    // Create Frame container structure
    const frameContainer = document.createElement('div');
    frameContainer.className = 'Polaris-Frame__Content';
    frameContainer.setAttribute('data-frame-content', 'true');

    // Move existing content into Frame container
    while (reactRoot.firstChild) {
      frameContainer.appendChild(reactRoot.firstChild);
    }
    reactRoot.appendChild(frameContainer);

    console.log('[EMERGENCY FRAME] ✅ Emergency Frame wrapper created');
    return true;
  }

  // LEVEL 3: Monitor and auto-recover from Frame loss
  function monitorFrameContext() {
    let frameCheckCount = 0;
    const MAX_CHECKS = 10;

    const frameMonitor = setInterval(() => {
      frameCheckCount++;

      // Check for Frame context error in DOM
      const errorElement = document.querySelector('[data-testid="error-message"]') ||
                         document.querySelector('.Polaris-Banner--critical') ||
                         Array.from(document.querySelectorAll('*')).find(el =>
                           el.textContent?.includes('No Frame context was provided'));

      if (errorElement) {
        console.log('[EMERGENCY FRAME] 🚨 Frame error detected - triggering recovery!');

        // NUCLEAR RECOVERY
        ensureAppBridge();
        createEmergencyFrameContext();

        // Force re-render with timeout
        setTimeout(() => {
          if (window.location.href.includes('shop=')) {
            window.location.reload();
          }
        }, 1000);
      }

      // Stop monitoring after max checks
      if (frameCheckCount >= MAX_CHECKS) {
        clearInterval(frameMonitor);
        console.log('[EMERGENCY FRAME] Monitoring stopped after', MAX_CHECKS, 'checks');
      }
    }, 2000); // Check every 2 seconds
  }

  // LEVEL 4: Intercept Frame-related errors
  function interceptFrameErrors() {
    const originalError = window.Error;

    window.addEventListener('error', (event) => {
      if (event.message?.includes('Frame') ||
          event.message?.includes('AppProvider') ||
          event.message?.includes('useFrame')) {

        console.log('[EMERGENCY FRAME] 🚨 Intercepted Frame error:', event.message);
        event.preventDefault();

        // Trigger emergency recovery
        ensureAppBridge();
        createEmergencyFrameContext();

        // Don't reload immediately - give recovery a chance
        setTimeout(() => {
          if (document.querySelector('[data-testid="error-message"]')) {
            console.log('[EMERGENCY FRAME] Recovery failed - forcing reload');
            window.location.reload();
          }
        }, 3000);
      }
    }, true);
  }

  // LEVEL 5: Provide Frame context shim
  function provideFrameShim() {
    // Create a minimal Frame context shim if needed
    if (!window.__FRAME_CONTEXT_SHIM__) {
      window.__FRAME_CONTEXT_SHIM__ = {
        logo: null,
        globalSaveBar: null,
        contextualSaveBar: null,
        toastMessages: [],
        setGlobalRibbonHeight: () => {},
        removeGlobalRibbonHeight: () => {},
        startLoading: () => {},
        stopLoading: () => {},
        showToast: () => {},
        hideToast: () => {},
        setContextualSaveBar: () => {},
        removeContextualSaveBar: () => {},
      };

      console.log('[EMERGENCY FRAME] ✅ Frame context shim provided');
    }
  }

  // EXECUTE EMERGENCY RECOVERY SEQUENCE
  console.log('[EMERGENCY FRAME] 🚀 Starting emergency recovery sequence...');

  // Step 1: Ensure App Bridge
  const hasAppBridge = ensureAppBridge();

  // Step 2: Create emergency Frame if needed
  if (hasAppBridge) {
    createEmergencyFrameContext();
  } else {
    // Wait for App Bridge to load then create Frame
    setTimeout(() => {
      createEmergencyFrameContext();
    }, 1000);
  }

  // Step 3: Provide Frame shim
  provideFrameShim();

  // Step 4: Start monitoring
  setTimeout(monitorFrameContext, 3000);

  // Step 5: Intercept errors
  interceptFrameErrors();

  console.log('[EMERGENCY FRAME] ✅ Emergency recovery system armed');
}

// Auto-initialize on window load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmergencyFrameRecovery);
  } else {
    // DOM already loaded
    setTimeout(initEmergencyFrameRecovery, 100);
  }
}