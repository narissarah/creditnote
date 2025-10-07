import React from 'react';
import {
  Tile,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// QR Scanner Tile - Entry point for scanning and redeeming QR codes
// Opens the scanner modal when pressed

const QRScannerTile = () => {
  const api = useApi();

  const handlePress = () => {
    console.log('[QR Scanner Tile] Opening QR scanner modal');
    api.ui.modal.navigate({
      target: 'qr-scanner-modal',
    });
  };

  return (
    <Tile
      title="Scan QR Code"
      subtitle="Redeem credit notes"
      onPress={handlePress}
      enabled={true}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <QRScannerTile />);
