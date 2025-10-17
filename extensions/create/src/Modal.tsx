import React, { useEffect } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Button,
  Box,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale'

// Remote logging function
async function remoteLog(level: string, message: string, data?: any) {
  try {
    await fetch('https://creditnote.vercel.app/api/pos-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extension: 'CREATE',
        level,
        message,
        data
      })
    })
  } catch (err) {
    // Silently fail - logging shouldn't break the extension
    console.error('[CREATE] Remote log failed:', err)
  }
}

// Minimal test extension with remote logging
export default reactExtension('pos.home.modal.render', () => {
  const api = useApi()

  useEffect(() => {
    // Log that the extension mounted
    remoteLog('INFO', 'Extension mounted successfully')
    console.log('[CREATE] Extension mounted, remote log sent')

    return () => {
      remoteLog('INFO', 'Extension unmounting')
    }
  }, [])

  const handleButtonPress = () => {
    remoteLog('INFO', 'Button clicked')
    console.log('[CREATE] Button clicked')
    api.toast.show('Button works! Check Vercel logs for remote log.')
  }

  // Log render
  console.log('[CREATE] Rendering extension')
  remoteLog('INFO', 'Extension rendering')

  return (
    <Screen name="Test" title="Create Store Credit - Test">
      <ScrollView>
        <Box padding>
          <Text>Hello from Create Extension!</Text>
        </Box>
        <Box padding>
          <Text>Remote logging enabled. Check Vercel logs.</Text>
        </Box>
        <Box padding>
          <Button
            title="Test Button"
            onPress={handleButtonPress}
            primary
          />
        </Box>
      </ScrollView>
    </Screen>
  )
})
