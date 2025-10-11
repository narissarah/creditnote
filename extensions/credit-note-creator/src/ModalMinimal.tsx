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

  const handleCreate = () => {
    if (!customerName) {
      api.ui.toast.show('Customer name is required', { duration: 2000 })
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      api.ui.toast.show('Please enter a valid amount', { duration: 2000 })
      return
    }

    api.ui.toast.show('Credit note created successfully!', { duration: 3000 })
    api.navigation.navigate('success')
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

          <Button
            title="Create Credit Note"
            onPress={handleCreate}
          />
        </ScrollView>
      </Screen>

      <Screen name="success" title="Success">
        <ScrollView>
          <Text>Credit Note Created!</Text>
          <Text>Customer: {customerName}</Text>
          <Text>Amount: ${amount}</Text>

          <Button
            title="Create Another"
            onPress={() => {
              setCustomerName('')
              setAmount('')
              api.navigation.navigate('create')
            }}
          />
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)
