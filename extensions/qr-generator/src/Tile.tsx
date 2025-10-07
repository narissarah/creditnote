import React from 'react';
import {
  Tile,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// QR Generator Tile - Entry point for creating new credit notes
// Opens the generator modal when pressed

const QRGeneratorTile = () => {
  const api = useApi();

  const handlePress = () => {
    console.log('[QR Generator Tile] Opening QR generator modal');
    api.ui.modal.navigate({
      target: 'qr-generator-modal',
    });
  };

  return (
    <Tile
      title="Create Credit"
      subtitle="Generate QR code"
      onPress={handlePress}
      enabled={true}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <QRGeneratorTile />);
