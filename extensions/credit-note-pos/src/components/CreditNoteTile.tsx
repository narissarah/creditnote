// Credit Note POS Tile - Main entry point for POS Apps
import React, { useState } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Image,
  Tile,
  Badge
} from '@shopify/ui-extensions-react/point-of-sale';

import AdvancedBarcodeScanner from './AdvancedBarcodeScanner';
import QRCodePrintSystem from './QRCodePrintSystem';
import CompleteCreditManager from './CompleteCreditManager';

// Main Tile Component
const CreditNoteTile: React.FC = () => {
  const api = useApi<'pos.home.tile.render'>();
  const [modalContent, setModalContent] = useState<'menu' | 'scan' | 'print' | 'manage'>('menu');

  const handleTilePress = () => {
    setModalContent('menu');
    // Modal will be rendered by the modal extension
  };

  return (
    <Tile onPress={handleTilePress}>
      <Stack alignment="center" spacing="base">
        <Image
          source="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMwMDdBNUEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjRkZGIj4KPHBhdGg9Ik0zIDVhMiAyIDAgMCAxIDItMmgxMmEyIDIgMCAwIDEgMiAydjE0YTIgMiAwIDAgMS0yIDJIM2EyIDIgMCAwIDEtMi0yVjVabTIgMHYxNGgxMlY1SDV6bTIgM2g4djJIN3ptMCA0aDZ2Mkg3em0wIDRoNHYySDF6Ii8+Cjwvc3ZnPgo8L3N2Zz4K"
          alt="Credit Note System"
        />
        <Text variant="headingMd" alignment="center">
          Credit Notes
        </Text>
        <Text variant="bodySm" alignment="center">
          Complete credit management
        </Text>
        <Badge tone="success" size="small">
          Ready
        </Badge>
      </Stack>
    </Tile>
  );
};

// Main Menu Modal Component
const CreditNoteMainMenu: React.FC = () => {
  const api = useApi<'pos.home.modal.render'>();
  const [activeView, setActiveView] = useState<'menu' | 'scan' | 'print' | 'manage'>('menu');

  const handleError = (error: string) => {
    api.toast.show(error, 'error');
  };

  const handleSuccess = (message: string) => {
    api.toast.show(message, 'success');
  };

  if (activeView === 'scan') {
    return (
      <AdvancedBarcodeScanner
        onCreditRedeemed={(credit, amount) => {
          handleSuccess(`Applied ${amount} credit from ${credit.noteNumber}`);
          setActiveView('menu');
        }}
        onError={handleError}
      />
    );
  }

  if (activeView === 'print') {
    return (
      <QRCodePrintSystem
        onReceiptPrinted={(credit) => {
          handleSuccess(`Receipt printed for ${credit.noteNumber}`);
        }}
        onError={handleError}
      />
    );
  }

  if (activeView === 'manage') {
    return (
      <CompleteCreditManager
        onCreditUpdated={(credit) => {
          handleSuccess(`Credit ${credit.noteNumber} updated`);
        }}
        onError={handleError}
      />
    );
  }

  return (
    <Navigator>
      <Screen name="CreditMenu" title="Credit Note System">
        <ScrollView>
          <Stack spacing="loose">
            {/* Header */}
            <Stack spacing="base" alignment="center">
              <Text variant="headingLg" alignment="center">
                CreditCraft POS System
              </Text>
              <Text variant="bodySm" alignment="center" color="subdued">
                Complete credit note management for Shopify POS
              </Text>
            </Stack>

            {/* Main Actions */}
            <Stack spacing="base">
              <Text variant="headingMd">Quick Actions</Text>
              
              <Button
                onPress={() => setActiveView('scan')}
                title="🔍 Scan & Redeem Credit"
                variant="primary"
                fullWidth
              />
              
              <Button
                onPress={() => setActiveView('print')}
                title="🖨️ Create & Print QR Code"
                variant="primary"
                fullWidth
              />
              
              <Button
                onPress={() => setActiveView('manage')}
                title="📋 Manage Credits"
                variant="primary"
                fullWidth
              />
            </Stack>

            {/* Features Overview */}
            <Stack spacing="base">
              <Text variant="headingSm">System Features</Text>
              
              <Stack spacing="tight">
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">🔲</Text>
                  <Text variant="bodySm">Multi-format barcode scanning (UPC, EAN-13, Code128)</Text>
                </Stack>
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">📱</Text>
                  <Text variant="bodySm">QR code generation with security validation</Text>
                </Stack>
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">🖨️</Text>
                  <Text variant="bodySm">Professional receipt printing with templates</Text>
                </Stack>
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">💳</Text>
                  <Text variant="bodySm">Automatic credit application to cart</Text>
                </Stack>
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">📊</Text>
                  <Text variant="bodySm">Complete credit lifecycle management</Text>
                </Stack>
                <Stack direction="horizontal" spacing="tight" alignment="center">
                  <Text variant="bodySm">🔒</Text>
                  <Text variant="bodySm">Offline-first with secure sync</Text>
                </Stack>
              </Stack>
            </Stack>

            {/* Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">How to Use</Text>
              
              <Stack spacing="tight">
                <Text variant="bodySm">
                  <Text fontWeight="semibold">To Redeem Credits:</Text>
                </Text>
                <Text variant="bodySm">
                  1. Tap "Scan & Redeem Credit"
                </Text>
                <Text variant="bodySm">
                  2. Use camera to scan customer's QR code or barcode
                </Text>
                <Text variant="bodySm">
                  3. Confirm amount and apply to current transaction
                </Text>
              </Stack>
              
              <Stack spacing="tight">
                <Text variant="bodySm">
                  <Text fontWeight="semibold">To Create Credits:</Text>
                </Text>
                <Text variant="bodySm">
                  1. Tap "Create & Print QR Code"
                </Text>
                <Text variant="bodySm">
                  2. Enter customer details and amount
                </Text>
                <Text variant="bodySm">
                  3. Print QR code receipt for customer
                </Text>
              </Stack>
              
              <Stack spacing="tight">
                <Text variant="bodySm">
                  <Text fontWeight="semibold">To Manage Credits:</Text>
                </Text>
                <Text variant="bodySm">
                  1. Tap "Manage Credits"
                </Text>
                <Text variant="bodySm">
                  2. View, search, edit, or delete existing credits
                </Text>
                <Text variant="bodySm">
                  3. Monitor credit usage and expiration dates
                </Text>
              </Stack>
            </Stack>

            {/* System Status */}
            <Stack spacing="base">
              <Text variant="headingSm">System Status</Text>
              
              <Stack direction="horizontal" spacing="tight">
                <Badge tone="success" size="small">Online</Badge>
                <Badge tone="info" size="small">Shopify Connected</Badge>
                <Badge tone="success" size="small">Scanner Ready</Badge>
                <Badge tone="success" size="small">Printer Ready</Badge>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

// Export both components as POS UI Extensions
export default reactExtension('pos.home.tile.render', () => <CreditNoteTile />);

// Also export the modal version
export const CreditNoteModal = reactExtension('pos.home.modal.render', () => <CreditNoteMainMenu />);