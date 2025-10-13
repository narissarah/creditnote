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
  useCartSubscription,
} from '@shopify/ui-extensions-react/point-of-sale'

/**
 * Helper function to make authenticated API calls from POS extensions
 * POS extensions CANNOT send custom headers to external domains due to CORS restrictions
 * Solution:
 * - POST requests: Send auth data in request body
 * - GET requests: Send auth data in query parameters
 */
async function makeAuthenticatedRequest(
  api: ReturnType<typeof useApi>,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const sessionToken = await api.session.getSessionToken()
  const shopDomain = api.session.currentSession?.shopDomain

  if (!sessionToken) {
    throw new Error('Unable to authenticate - no session token')
  }

  const method = options.method || 'GET'
  const isGetRequest = method.toUpperCase() === 'GET'

  if (isGetRequest) {
    // For GET requests, add auth params to URL
    const urlObj = new URL(url)
    urlObj.searchParams.set('sessionToken', sessionToken)
    urlObj.searchParams.set('isPOS', 'true')
    if (shopDomain) {
      urlObj.searchParams.set('shopDomain', shopDomain)
    }

    console.log('[POS Auth] Making GET request with query auth:', urlObj.toString())
    return fetch(urlObj.toString(), {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } else {
    // For POST/PUT/DELETE requests, add auth data to body
    const body = options.body ? JSON.parse(options.body as string) : {}
    const authenticatedBody = {
      ...body,
      sessionToken,
      shopDomain,
      isPOSRequest: true,
    }

    console.log('[POS Auth] Making POST request with body auth')
    return fetch(url, {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(authenticatedBody),
    })
  }
}

const Modal = () => {
  const api = useApi()
  const cart = useCartSubscription()
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noteNumber, setNoteNumber] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!customerName) {
      api.toast.show('Customer name is required', { duration: 2000 })
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      api.toast.show('Please enter a valid amount', { duration: 2000 })
      return
    }

    // Check if customer is in cart
    if (!cart.customer?.id) {
      api.toast.show('Please add a customer to the cart first', { duration: 3000 })
      setError('No customer selected. Please add a customer to the POS cart.')
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('[Credit Creator] Starting creation process')

      // Convert to cents
      const amountInCents = Math.round(parseFloat(amount) * 100)

      // Calculate expiry (365 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      // Convert customer ID from number to Shopify GID format
      const customerGid = `gid://shopify/Customer/${cart.customer.id}`

      console.log('[Credit Creator] Creating note:', {
        customerName,
        amount: amountInCents,
        customerId: customerGid
      })

      // Use the new helper function that handles POS authentication correctly
      const response = await makeAuthenticatedRequest(
        api,
        'https://creditnote.vercel.app/api/credit-notes',
        {
          method: 'POST',
          body: JSON.stringify({
            customerId: customerGid,
            customerName: customerName.trim(),
            amount: amountInCents,
            currency: 'USD',
            expiresAt: expiresAt.toISOString(),
          }),
        }
      )

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
        api.toast.show('Credit note created!', { duration: 3000 })
        api.navigation.navigate('success')
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('[Credit Creator] Error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to create credit note'
      setError(errorMsg)
      api.toast.show(errorMsg, { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Navigator initialScreenName="create">
      <Screen name="create" title="Create Credit Note">
        <ScrollView>
          {cart.customer?.id ? (
            <Text>Customer ID: {cart.customer.id}</Text>
          ) : (
            <Text>⚠️ No customer in cart. Please add a customer first.</Text>
          )}

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
            isDisabled={loading || !cart.customer?.id}
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
