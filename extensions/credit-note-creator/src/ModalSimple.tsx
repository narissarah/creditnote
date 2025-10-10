import React from 'react';
import {
  reactExtension,
  Screen,
  Text,
  Button,
} from '@shopify/ui-extensions-react/point-of-sale';

function SimpleModal() {
  return (
    <Screen name="test" title="Test Modal">
      <Text variant="headingLg">Extension Works!</Text>
      <Text>If you see this, the extension loaded successfully.</Text>
      <Button
        title="Close"
        onPress={() => console.log('Button pressed')}
      />
    </Screen>
  );
}

export default reactExtension('pos.home.modal.render', () => <SimpleModal />);
