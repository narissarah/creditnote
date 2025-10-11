import { useState } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Navigator,
  TextField,
  Button,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale'

const Modal = () => {
  const api = useApi()
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noteNumber, setNoteNumber] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!customerName) {
      api.ui.toast.show('Customer name is required', { duration: 2000 })
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      api.ui.toast.show('Please enter a valid amount', { duration: 2000 })
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('[Credit Creator] Starting creation process')
      console.log('[Credit Creator] API object:', {
        hasSession: !!api.session,
        hasGetToken: !!api.session?.getSessionToken,
        hasCurrentSession: !!api.session?.currentSession
      })

      // Get session token for logging only
      let sessionToken
      let shopDomain

      try {
        sessionToken = await api.session.getSessionToken()
        console.log('[Credit Creator] Session token obtained:', !!sessionToken)
      } catch (tokenError) {
        console.error('[Credit Creator] Failed to get session token:', tokenError)
        throw new Error('Failed to get session token: ' + (tokenError instanceof Error ? tokenError.message : 'Unknown error'))
      }

      try {
        shopDomain = api.session.currentSession?.shopDomain
        console.log('[Credit Creator] Shop domain:', shopDomain)
      } catch (domainError) {
        console.error('[Credit Creator] Failed to get shop domain:', domainError)
      }

      if (!sessionToken) {
        throw new Error('Unable to authenticate - no session token')
      }

      // Convert to cents
      const amountInCents = Math.round(parseFloat(amount) * 100)

      // Calculate expiry (365 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      console.log('[Credit Creator] Creating note:', {
        customerName,
        amount: amountInCents,
        shopDomain
      })

      // Call API - Note: POS extensions cannot send custom headers to external domains
      // We pass authentication data in the request body instead
      const response = await fetch('https://creditnote.vercel.app/api/credit-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Authentication data (POS cannot send custom headers)
          sessionToken: sessionToken,
          shopDomain: shopDomain,
          isPOSRequest: true,

          // Credit note data
          customerId: `pos-customer-${Date.now()}`,
          customerName: customerName.trim(),
          amount: amountInCents,
          currency: 'USD',
          expiresAt: expiresAt.toISOString(),
        }),
      })

      console.log('[Credit Creator] Response status:', response.status)
      console.log('[Credit Creator] Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        let errorText
        try {
          errorText = await response.text()
          console.error('[Credit Creator] Error response body:', errorText)
        } catch (e) {
          console.error('[Credit Creator] Could not read error response')
        }
        throw new Error(`Server returned ${response.status}: ${errorText || 'No details'}`)
      }

      const data = await response.json()
      console.log('[Credit Creator] Success:', data)

      if (data.success && data.data) {
        setNoteNumber(data.data.noteNumber || 'N/A')
        api.ui.toast.show('Credit note created!', { duration: 3000 })
        api.navigation.navigate('success')
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('[Credit Creator] Error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to create credit note'
      setError(errorMsg)
      api.ui.toast.show(errorMsg, { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Navigator initialScreenName="create">
      <Screen name="create" title="Create Credit Note">
        <ScrollView>
          <Text>Customer Information</Text>

          <TextField
            label="Customer Name"
            placeholder="Enter customer name"
            value={customerName}
            onChange={setCustomerName}
          />

          <TextField
            label="Amount (USD)"
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
          />

          {error && <Text>Error: {error}</Text>}

          <Button
            title={loading ? "Creating..." : "Create Credit Note"}
            onPress={handleCreate}
            isDisabled={loading}
          />
        </ScrollView>
      </Screen>

      <Screen name="success" title="Success">
        <ScrollView>
          <Text>Credit Note Created!</Text>
          <Text>Note Number: {noteNumber}</Text>
          <Text>Customer: {customerName}</Text>
          <Text>Amount: ${amount}</Text>

          <Button
            title="Create Another"
            onPress={() => {
              setCustomerName('')
              setAmount('')
              setNoteNumber('')
              setError('')
              api.navigation.navigate('create')
            }}
          />
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)
