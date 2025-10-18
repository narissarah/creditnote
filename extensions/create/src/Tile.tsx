import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {
  const api = useApi()
  return (
    <Tile
      title="Create Store Credit"
      subtitle="Issue store credit to customers"
      onPress={() => {
        api.action.presentModal()
      }}
      enabled
    />
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})