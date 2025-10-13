import { useState, useEffect } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Navigator,
  Button,
  reactExtension,
  useApi,
  useCartSubscription,
  List,
  Section,
  Badge,
} from '@shopify/ui-extensions-react/point-of-sale'

/**
 * Helper function to make authenticated API calls from POS extensions
 * POS extensions CANNOT send custom headers to external domains due to CORS restrictions
 * Solution: Send auth data in query parameters for GET requests
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

    console.log('[POS Auth] Making GET request with query auth')
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

// Format currency
const formatCurrency = (amountInCents: number, currency: string = 'USD') => {
  const amount = amountInCents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Get status badge color
const getStatusColor = (status: string): 'success' | 'warning' | 'critical' | 'info' => {
  switch (status) {
    case 'active':
      return 'success'
    case 'partially_used':
      return 'info'
    case 'fully_used':
      return 'warning'
    case 'expired':
      return 'critical'
    default:
      return 'info'
  }
}

// Get status display text
const getStatusText = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Active'
    case 'partially_used':
      return 'Partially Used'
    case 'fully_used':
      return 'Fully Used'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

interface CreditNote {
  id: string
  noteNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  originalAmount: number
  remainingAmount: number
  currency: string
  status: string
  expiresAt: string
  createdAt: string
  qrCodeUrl?: string
}

const Modal = () => {
  const api = useApi()
  const cart = useCartSubscription()
  const [credits, setCredits] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null)

  // Fetch credits when modal opens or customer changes
  useEffect(() => {
    if (cart.customer?.id) {
      fetchCredits()
    }
  }, [cart.customer?.id])

  const fetchCredits = async () => {
    if (!cart.customer?.id) {
      api.toast.show('Please add a customer to the cart first', { duration: 2000 })
      return
    }

    try {
      setLoading(true)
      setError('')

      console.log('[Credit Viewer] Fetching credits for customer:', cart.customer.id)

      // Convert customer ID to GID format
      const customerGid = `gid://shopify/Customer/${cart.customer.id}`

      // Build URL with query parameters
      const url = new URL('https://creditnote.vercel.app/api/credit-notes')
      url.searchParams.set('customerId', customerGid)
      url.searchParams.set('status', 'all')
      url.searchParams.set('limit', '50')

      const response = await makeAuthenticatedRequest(api, url.toString())

      console.log('[Credit Viewer] Response status:', response.status)

      if (!response.ok) {
        let errorText
        try {
          errorText = await response.text()
          console.error('[Credit Viewer] Error response:', errorText)
        } catch (e) {
          console.error('[Credit Viewer] Could not read error response')
        }
        throw new Error(`Server returned ${response.status}`)
      }

      const data = await response.json()
      console.log('[Credit Viewer] Success:', data)

      if (data.success && data.credits) {
        setCredits(data.credits)
        if (data.credits.length === 0) {
          api.toast.show('No credit notes found', { duration: 2000 })
        } else {
          api.toast.show(`Found ${data.credits.length} credit note(s)`, { duration: 2000 })
        }
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('[Credit Viewer] Error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch credit notes'
      setError(errorMsg)
      api.toast.show(errorMsg, { duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (credit: CreditNote) => {
    setSelectedCredit(credit)
    api.navigation.navigate('details')
  }

  const handleRefresh = () => {
    fetchCredits()
  }

  return (
    <Navigator initialScreenName="list">
      {/* List Screen */}
      <Screen name="list" title="Credit Notes">
        <ScrollView>
          {!cart.customer?.id ? (
            <>
              <Text>⚠️ No customer in cart</Text>
              <Text>Please add a customer to view their credit notes.</Text>
            </>
          ) : (
            <>
              <Section>
                <Text>Customer ID: {cart.customer.id}</Text>
                <Text>Total Credits: {credits.length}</Text>
              </Section>

              {error && (
                <Section>
                  <Text>Error: {error}</Text>
                </Section>
              )}

              {loading ? (
                <Text>Loading credit notes...</Text>
              ) : credits.length === 0 ? (
                <Section>
                  <Text>No credit notes found for this customer.</Text>
                </Section>
              ) : (
                <List>
                  {credits.map((credit) => (
                    <List.Item
                      key={credit.id}
                      title={`${credit.noteNumber} - ${formatCurrency(credit.remainingAmount, credit.currency)}`}
                      subtitle={`${getStatusText(credit.status)} • Expires ${formatDate(credit.expiresAt)}`}
                      onPress={() => handleViewDetails(credit)}
                    />
                  ))}
                </List>
              )}

              <Button
                title={loading ? 'Loading...' : 'Refresh'}
                onPress={handleRefresh}
                isDisabled={loading}
              />
            </>
          )}
        </ScrollView>
      </Screen>

      {/* Details Screen */}
      <Screen name="details" title="Credit Note Details">
        <ScrollView>
          {selectedCredit && (
            <>
              <Section title="Credit Note Information">
                <Text>Note Number: {selectedCredit.noteNumber}</Text>
                <Text>Status: {getStatusText(selectedCredit.status)}</Text>
                <Badge tone={getStatusColor(selectedCredit.status)}>
                  {getStatusText(selectedCredit.status)}
                </Badge>
              </Section>

              <Section title="Amount Details">
                <Text>
                  Original Amount: {formatCurrency(selectedCredit.originalAmount, selectedCredit.currency)}
                </Text>
                <Text>
                  Remaining Amount: {formatCurrency(selectedCredit.remainingAmount, selectedCredit.currency)}
                </Text>
                <Text>
                  Used Amount:{' '}
                  {formatCurrency(
                    selectedCredit.originalAmount - selectedCredit.remainingAmount,
                    selectedCredit.currency
                  )}
                </Text>
              </Section>

              <Section title="Customer Information">
                <Text>Name: {selectedCredit.customerName}</Text>
                <Text>Email: {selectedCredit.customerEmail}</Text>
                <Text>Customer ID: {selectedCredit.customerId}</Text>
              </Section>

              <Section title="Dates">
                <Text>Created: {formatDate(selectedCredit.createdAt)}</Text>
                <Text>Expires: {formatDate(selectedCredit.expiresAt)}</Text>
              </Section>

              <Button
                title="Back to List"
                onPress={() => api.navigation.navigate('list')}
              />
            </>
          )}
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)
