import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const TileComponent = () => {
  const api = useApi();

  return (
    <Tile
      title="Credit Manager"
      subtitle="View & manage credit notes"
      onPress={() => {
        api.action.presentModal();
      }}
      enabled
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <TileComponent />);
