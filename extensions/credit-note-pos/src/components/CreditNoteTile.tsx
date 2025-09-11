// Credit Note POS Tile - Main entry point for POS Apps
import React from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  Stack,
  Text,
  Button,
  Image,
  Tile,
  Badge
} from '@shopify/ui-extensions-react/point-of-sale';

const CreditNoteTile: React.FC = () => {
  const api = useApi<'pos.home.tile.render'>();

  const handleTilePress = () => {
    // Open the credit note management modal
    // The modal will be handled by CreditScanner component
    // which includes both scanning and management functionality
    console.log('Credit Note tile pressed - opening management interface');
  };

  return (
    <Tile onPress={handleTilePress}>
      <Stack alignment="center" spacing="base">
        <Image
          source="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMwMDdBNUEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjRkZGIj4KPHA+dGg9Ik0zIDVhMiAyIDAgMCAxIDItMmgxMmEyIDIgMCAwIDEgMiAydjE0YTIgMiAwIDAgMS0yIDJIM2EyIDIgMCAwIDEtMi0yVjVabTIgMHYxNGgxMlY1SDV6bTIgM2g4djJIN3ptMCA0aDZ2Mkg3em0wIDRoNHYySDF6Ii8+Cjwvc3ZnPgo8L3N2Zz4K"
          alt="Credit Note Scanner"
        />
        <Text variant="headingMd" alignment="center">
          Credit Notes
        </Text>
        <Text variant="bodySm" alignment="center">
          Scan & redeem credit notes
        </Text>
        <Badge tone="success" size="small">
          Ready
        </Badge>
      </Stack>
    </Tile>
  );
};

// Export as POS UI Extension for tile rendering
export default reactExtension('pos.home.tile.render', () => <CreditNoteTile />);