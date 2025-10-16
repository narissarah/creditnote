import { useState } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Navigator,
  TextField,
  Button,
  Image,
  reactExtension,
  useApi,
  useCartSubscription,
} from '@shopify/ui-extensions-react/point-of-sale'

/**
 * CRITICAL FIX: Rely on Shopify's automatic authentication for POS extensions
 *
 * According to Shopify docs:
 * "When using fetch() to request from your app's configured auth domain,
 * Shopify automatically adds an Authorization header with an OpenID Connect ID Token"
 *
 * We should NOT manually handle session tokens - let Shopify handle it automatically!
 * This function now simply adds a header to indicate this is a POS request.
 */
async function makeAuthenticatedRequest(
  api: ReturnType<typeof useApi>,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  console.log('[POS Extension] Making authenticated request to:', url)
  console.log('[POS Extension] Shopify will automatically add Authorization header')

  // Shopify automatically adds Authorization header for requests to app domain
  // We just need to indicate this is from POS
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-POS-Request': 'true', // Flag to help server identify POS requests
      ...options.headers,
    },
  })
}

const Modal = () => {
  const api = useApi()
  const cart = useCartSubscription()
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noteNumber, setNoteNumber] = useState('')
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null)
  const [creditNoteData, setCreditNoteData] = useState<any | null>(null)

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

      // CRITICAL FIX: Backend expects amount in dollars, not cents
      // The backend schema uses Decimal(10,2) which stores dollar amounts
      const amountInDollars = parseFloat(amount)

      // Calculate expiry (365 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 365)

      // Convert customer ID from number to Shopify GID format
      const customerGid = `gid://shopify/Customer/${cart.customer.id}`

      console.log('[Credit Creator] Creating note:', {
        customerName,
        amount: amountInDollars,
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
            amount: amountInDollars,
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
        setQrCodeImage(data.data.qrCodeImage || null)
        setCreditNoteData(data.data)
        console.log('[Credit Creator] QR Code Image:', data.data.qrCodeImage ? 'Present' : 'Missing')
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
          <Text>✅ Credit Note Created Successfully!</Text>

          <Text>Note Number: {noteNumber}</Text>
          <Text>Customer: {customerName}</Text>
          <Text>Amount: ${amount}</Text>
          {creditNoteData?.currency && <Text>Currency: {creditNoteData.currency}</Text>}
          {creditNoteData?.expiresAt && (
            <Text>Expires: {new Date(creditNoteData.expiresAt).toLocaleDateString()}</Text>
          )}

          {/* QR Code Display */}
          {qrCodeImage && (
            <>
              <Text>QR Code:</Text>
              <Image
                source={qrCodeImage}
                accessibilityLabel={`QR code for credit note ${noteNumber}`}
              />
              <Text>Scan this QR code to redeem</Text>
            </>
          )}

          <Button
            title="Create Another"
            onPress={() => {
              setCustomerName('')
              setAmount('')
              setNoteNumber('')
              setQrCodeImage(null)
              setCreditNoteData(null)
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
