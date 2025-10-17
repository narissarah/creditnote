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

const ViewModal = () => {
  const api = useApi()
  const [searchQuery, setSearchQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState('CAD')
  const [isProcessing, setIsProcessing] = useState(false)

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
        setCurrency('CAD')
        api.toast.show('No store credit found')
      }
    } catch (error) {
      api.toast.show('Search error')
    }
    setIsProcessing(false)
  }

  const handleReset = () => {
    setSearchQuery('')
    setCustomerId('')
    setCustomerName('')
    setBalance('')
    setCurrency('CAD')
  }

  return (
    <Screen name="ViewStoreCredit" title="View Store Credit">
      <ScrollView>
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

        {customerName && balance && (
          <>
            <Box padding>
              <Text>Customer: {customerName}</Text>
              <Text>Balance: ${balance}</Text>
            </Box>

            <Box padding>
              <Button
                title="Search Another Customer"
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

export default reactExtension('pos.home.modal.render', () => <ViewModal />)
