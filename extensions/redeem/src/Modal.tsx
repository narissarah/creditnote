import React, { useState } from 'react'
import {
  Text,
  Screen,
  ScrollView,
  Button,
  Box,
  TextField,
  CameraScanner,
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

const GET_STORE_CREDIT_QUERY = `
  query getStoreCredit($customerId: ID!) {
    customer(id: $customerId) {
      id
      displayName
      storeCreditAccounts(first: 1) {
        edges {
          node {
            id
            balance {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`

const STORE_CREDIT_DEBIT_MUTATION = `
  mutation storeCreditAccountDebit($id: ID!, $debitInput: StoreCreditAccountDebitInput!) {
    storeCreditAccountDebit(id: $id, debitInput: $debitInput) {
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

const RedeemModal = () => {
  const api = useApi()
  const [searchQuery, setSearchQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState('CAD')
  const [amount, setAmount] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleScan = (data: string) => {
    // Close scanner
    setShowScanner(false)

    // Parse scanned data - could be customer ID directly or JSON payload
    let scannedCustomerId = data

    try {
      // Try to parse as JSON (in case it's our QR payload)
      const parsed = JSON.parse(data)
      if (parsed.customerId) {
        scannedCustomerId = parsed.customerId
      }
    } catch {
      // If not JSON, treat as direct customer ID
      // If it doesn't start with gid://, add the prefix
      if (!scannedCustomerId.startsWith('gid://')) {
        scannedCustomerId = `gid://shopify/Customer/${scannedCustomerId}`
      }
    }

    // Use the scanned ID to fetch customer
    setSearchQuery(scannedCustomerId)
    fetchCustomerById(scannedCustomerId)
  }

  const fetchCustomerById = async (id: string) => {
    setIsProcessing(true)
    try {
      // Fetch balance
      const balanceResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: GET_STORE_CREDIT_QUERY,
          variables: { customerId: id },
        }),
      })

      const balanceResult = await balanceResponse.json()

      if (balanceResult.errors) {
        api.toast.show('Failed to fetch customer')
        setIsProcessing(false)
        return
      }

      const customer = balanceResult.data?.customer
      if (!customer) {
        api.toast.show('Customer not found')
        setIsProcessing(false)
        return
      }

      setCustomerId(customer.id)
      setCustomerName(customer.displayName)

      const account = customer.storeCreditAccounts?.edges?.[0]?.node
      if (account && account.balance) {
        setBalance(account.balance.amount)
        setCurrency(account.balance.currencyCode)
        api.toast.show(`Balance: ${account.balance.amount} ${account.balance.currencyCode}`)
      } else {
        setBalance('0.00')
        api.toast.show('No store credit found')
      }
    } catch (error) {
      api.toast.show('Error fetching customer')
    }
    setIsProcessing(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      api.toast.show('Enter at least 2 characters')
      return
    }

    setIsProcessing(true)
    try {
      // Search for customer
      const searchResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: SEARCH_CUSTOMERS_QUERY,
          variables: { query: searchQuery, first: 5 },
        }),
      })

      const searchResult = await searchResponse.json()

      if (searchResult.errors) {
        api.toast.show('Search failed')
        setIsProcessing(false)
        return
      }

      const customers = searchResult.data?.customers?.edges || []
      if (customers.length === 0) {
        api.toast.show('No customers found')
        setIsProcessing(false)
        return
      }

      const customer = customers[0].node
      setCustomerId(customer.id)
      setCustomerName(customer.displayName)

      // Fetch balance
      const balanceResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: GET_STORE_CREDIT_QUERY,
          variables: { customerId: customer.id },
        }),
      })

      const balanceResult = await balanceResponse.json()

      if (balanceResult.errors) {
        api.toast.show('Failed to fetch balance')
        setIsProcessing(false)
        return
      }

      const account = balanceResult.data?.customer?.storeCreditAccounts?.edges?.[0]?.node
      if (account && account.balance) {
        setBalance(account.balance.amount)
        setCurrency(account.balance.currencyCode)
        api.toast.show(`Balance: ${account.balance.amount} ${account.balance.currencyCode}`)
      } else {
        setBalance('0.00')
        api.toast.show('No store credit found')
      }
    } catch (error) {
      api.toast.show('Search error')
    }
    setIsProcessing(false)
  }

  const handleRedeem = async () => {
    if (!customerId || !amount || parseFloat(amount) <= 0) {
      api.toast.show('Please enter a valid amount')
      return
    }

    if (parseFloat(amount) > parseFloat(balance)) {
      api.toast.show('Amount exceeds available balance')
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: STORE_CREDIT_DEBIT_MUTATION,
          variables: {
            id: customerId,
            debitInput: {
              debitAmount: {
                amount: amount,
                currencyCode: currency,
              },
            },
          },
        }),
      })

      const result = await response.json()

      if (result.data?.storeCreditAccountDebit?.userErrors?.length > 0) {
        const errors = result.data.storeCreditAccountDebit.userErrors
          .map((err: { message: string }) => err.message)
          .join(', ')
        api.toast.show(`Error: ${errors}`)
        setIsProcessing(false)
        return
      }

      if (result.data?.storeCreditAccountDebit?.storeCreditAccountTransaction) {
        const transaction = result.data.storeCreditAccountDebit.storeCreditAccountTransaction
        const newBalance = transaction.account.balance.amount
        setBalance(newBalance)
        api.toast.show(`Redeemed successfully! New balance: ${newBalance}`)
        setAmount('')
      } else {
        api.toast.show('Failed to redeem store credit')
      }
    } catch (error) {
      api.toast.show('Error redeeming store credit')
    }
    setIsProcessing(false)
  }

  return (
    <Screen name="RedeemStoreCredit" title="Redeem Store Credit">
      {showScanner ? (
        <CameraScanner
          onScan={handleScan}
          onCancel={() => setShowScanner(false)}
        />
      ) : (
        <ScrollView>
          <Box padding>
            <Text>Search or Scan Customer</Text>
          </Box>

          <Box padding>
            <Button
              title="Scan QR Code / Barcode"
              onPress={() => setShowScanner(true)}
              primary
            />
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
          <>
            <Box padding>
              <Text>Customer: {customerName}</Text>
              <Text>Balance: ${balance}</Text>
            </Box>

            <Box padding>
              <TextField
                label="Amount to Redeem"
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
                disabled={isProcessing}
              />
            </Box>

            <Box padding>
              <Button
                title={isProcessing ? 'Redeeming...' : 'Redeem'}
                onPress={handleRedeem}
                disabled={isProcessing || !amount || parseFloat(balance) <= 0}
                primary
              />
            </Box>
          </>
        )}
        </ScrollView>
      )}
    </Screen>
  )
}

export default reactExtension('pos.home.modal.render', () => <RedeemModal />)
