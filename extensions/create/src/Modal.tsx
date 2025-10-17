import React, { useState } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Button,
  Box,
  TextField,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale'

const SEARCH_CUSTOMERS_QUERY = `
  query searchCustomers($query: String!, $first: Int!) {
    customers(first: $first, query: $query) {
      edges {
        node {
          id
          displayName
          email
        }
      }
    }
  }
`

const STORE_CREDIT_CREDIT_MUTATION = `
  mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
    storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
      storeCreditAccountTransaction {
        amount {
          amount
          currencyCode
        }
        account {
          id
          balance {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CreateModal = () => {
  const api = useApi()
  const [searchQuery, setSearchQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState('')
  const [createdAccountId, setCreatedAccountId] = useState('')
  const [createdBalance, setCreatedBalance] = useState('')
  const [createdCurrency, setCreatedCurrency] = useState('CAD')
  const [qrCodeData, setQrCodeData] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      api.toast.show('Enter at least 2 characters')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: SEARCH_CUSTOMERS_QUERY,
          variables: { query: searchQuery, first: 5 },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        api.toast.show('Search failed')
        setIsProcessing(false)
        return
      }

      const customers = result.data?.customers?.edges || []
      if (customers.length > 0) {
        const customer = customers[0].node
        setCustomerId(customer.id)
        setCustomerName(customer.displayName)
        api.toast.show(`Found: ${customer.displayName}`)
      } else {
        api.toast.show('No customers found')
      }
    } catch (error) {
      api.toast.show('Search error')
    }
    setIsProcessing(false)
  }

  const handleCreate = async () => {
    if (!customerId || !amount || parseFloat(amount) <= 0) {
      api.toast.show('Please search for customer and enter amount')
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: STORE_CREDIT_CREDIT_MUTATION,
          variables: {
            id: customerId,
            creditInput: {
              creditAmount: {
                amount: amount,
                currencyCode: 'CAD',
              },
            },
          },
        }),
      })

      const result = await response.json()

      if (result.data?.storeCreditAccountCredit?.userErrors?.length > 0) {
        const errors = result.data.storeCreditAccountCredit.userErrors
          .map((err: { message: string }) => err.message)
          .join(', ')
        api.toast.show(`Error: ${errors}`)
        setIsProcessing(false)
        return
      }

      if (result.data?.storeCreditAccountCredit?.storeCreditAccountTransaction) {
        const transaction = result.data.storeCreditAccountCredit.storeCreditAccountTransaction
        setCreatedAccountId(transaction.account.id)
        setCreatedBalance(transaction.account.balance.amount)
        setCreatedCurrency(transaction.account.balance.currencyCode)

        // Generate QR code payload
        const qrPayload = JSON.stringify({
          type: 'store_credit',
          customerId: customerId,
          accountId: transaction.account.id,
          amount: transaction.amount.amount,
          balance: transaction.account.balance.amount,
          currency: transaction.account.balance.currencyCode,
          customerName: customerName,
        })
        setQrCodeData(qrPayload)

        setShowSuccess(true)
        api.toast.show('Store credit created successfully!')
      } else {
        api.toast.show('Failed to create store credit')
      }
    } catch (error) {
      api.toast.show('Error creating store credit')
    }
    setIsProcessing(false)
  }

  const handleReset = () => {
    setSearchQuery('')
    setCustomerId('')
    setCustomerName('')
    setAmount('')
    setCreatedAccountId('')
    setCreatedBalance('')
    setCreatedCurrency('CAD')
    setQrCodeData('')
    setShowSuccess(false)
  }

  const handlePrintQR = async () => {
    if (!qrCodeData) {
      api.toast.show('No QR code data to print')
      return
    }

    try {
      // Use Print API to print QR code
      // The route will be: https://creditnote.vercel.app/api/print-qr?data=...
      const encodedData = encodeURIComponent(qrCodeData)
      await api.print.print(`/api/print-qr?data=${encodedData}`)
      api.toast.show('Opening print dialog...')
    } catch (error) {
      console.error('Print error:', error)
      api.toast.show('Failed to print QR code')
    }
  }

  return (
    <Screen name="CreateStoreCredit" title="Create Store Credit">
      <ScrollView>
        {!showSuccess && (
          <>
            <Box padding>
              <Text>Search for Customer</Text>
            </Box>

            <Box padding>
              <TextField
                label="Customer Name or Email"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search..."
                disabled={isProcessing}
              />
            </Box>

            <Box padding>
              <Button
                title={isProcessing ? 'Searching...' : 'Search'}
                onPress={handleSearch}
                disabled={isProcessing || searchQuery.trim().length < 2}
              />
            </Box>

            {customerName && (
              <Box padding>
                <Text>Selected: {customerName}</Text>
              </Box>
            )}

            {customerId && (
              <>
                <Box padding>
                  <TextField
                    label="Amount (CAD)"
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                    disabled={isProcessing}
                  />
                </Box>

                <Box padding>
                  <Button
                    title={isProcessing ? 'Creating...' : 'Create Store Credit'}
                    onPress={handleCreate}
                    disabled={isProcessing || !amount}
                    primary
                  />
                </Box>
              </>
            )}
          </>
        )}

        {showSuccess && (
          <>
            <Box padding>
              <Text>Store Credit Created!</Text>
            </Box>

            <Box padding>
              <Text>Customer: {customerName}</Text>
              <Text>Balance: ${createdBalance}</Text>
            </Box>

            <Box padding>
              <Text>QR Code Data (for printing):</Text>
              <Text>{qrCodeData ? 'Generated' : 'N/A'}</Text>
            </Box>

            <Box padding>
              <Text>Customer ID for Redemption:</Text>
              <Text>{customerId}</Text>
            </Box>

            <Box padding>
              <Button
                title="Print QR Code"
                onPress={handlePrintQR}
              />
            </Box>

            <Box padding>
              <Button
                title="Create Another"
                onPress={handleReset}
                primary
              />
            </Box>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

export default reactExtension('pos.home.modal.render', () => <CreateModal />)
