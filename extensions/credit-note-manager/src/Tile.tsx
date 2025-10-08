import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const TileComponent = () => {
  const api = useApi();

  return (
    <Tile
      title="Manage Credits"
      subtitle="View & manage credit notes"
      onPress={() => {
        api.action.presentModal();
      }}
      enabled
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <TileComponent />);
