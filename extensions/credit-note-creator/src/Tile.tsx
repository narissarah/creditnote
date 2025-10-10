import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

/**
 * POS Home Tile Component
 * Entry point for credit note creation on POS home screen
 */
const CreditNoteTile = () => {
  const api = useApi();

  return (
    <Tile
      title="Create Credit"
      subtitle="Issue credit note with QR"
      onPress={() => {
        console.log('[Credit Creator Tile] Opening modal');
        api.action.presentModal();
      }}
      enabled
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditNoteTile />);
