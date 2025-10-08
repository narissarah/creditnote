import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const TileComponent = () => {
  const api = useApi();

  return (
    <Tile
      title="Scan & Redeem"
      subtitle="Scan QR code to redeem"
      onPress={() => {
        api.action.presentModal();
      }}
      enabled
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <TileComponent />);
